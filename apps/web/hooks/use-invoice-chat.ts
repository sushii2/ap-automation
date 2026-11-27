"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  INITIAL_CHAT_STATE,
  chatReducer,
  isSettledAfter,
} from "@/lib/chat/chat-state";
import type { ChatAction } from "@/lib/chat/chat-state";
import type { ChatStreamEvent } from "@/lib/chat/protocol";

const CHAT_PATH = "/dashboard/chat";

// A turn can outlive one connection (the server caps how long a response may
// stay open), so an unfinished turn is picked up again a few times.
const MAX_RECONNECTS = 5;
const RECONNECT_DELAY_MS = 1000;

const START_FAILED = "Couldn't start the chat. Try again in a moment.";
const CONNECTION_LOST =
  "Lost the connection to the assistant. Reload the page to pick the chat back up.";

// "settled": the assistant has stopped. "unsettled": the connection ended
// before it did. "missing": the chat does not exist for this user.
type FollowResult = "settled" | "unsettled" | "missing";

interface FollowOptions {
  sessionId: string;
  /**
  A new message to send; without one the chat is replayed and resumed.
  */
  message?: string;
  signal: AbortSignal;
  dispatch: (action: ChatAction) => void;
}

const wait = (milliseconds: number) =>
  // eslint-disable-next-line promise/avoid-new -- browsers have no promise-returning setTimeout
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

/**
Calls `onLine` for each complete line of the stream, until it ends.
*/
const readLines = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  onLine: (line: string) => void,
  buffered = ""
): Promise<void> => {
  const { done, value } = await reader.read();
  if (done) {
    return;
  }
  const lines = (buffered + decoder.decode(value, { stream: true })).split(
    "\n"
  );
  const rest = lines.pop() ?? "";
  for (const line of lines) {
    if (line) {
      onLine(line);
    }
  }
  await readLines(reader, decoder, onLine, rest);
};

/**
Reads a chat stream to its end, one JSON event per line.
*/
const readChatStream = async (
  body: ReadableStream<Uint8Array>,
  { message, dispatch }: FollowOptions
): Promise<FollowResult> => {
  // A sent message is settled by the answer's end, a replay by its last event.
  let isSettled = message === undefined;
  await readLines(body.getReader(), new TextDecoder(), (line) => {
    const event = JSON.parse(line) as ChatStreamEvent;
    isSettled = isSettledAfter(event, isSettled);
    dispatch(event);
  });
  return isSettled ? "settled" : "unsettled";
};

// A dropped connection is "unsettled"; the caller decides whether to reconnect.
const connect = async (
  options: FollowOptions,
  message: string | undefined
): Promise<FollowResult> => {
  const response = await fetch(`${CHAT_PATH}/${options.sessionId}`, {
    signal: options.signal,
    ...(message !== undefined && {
      body: JSON.stringify({ text: message }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  }).catch(() => null);
  if (response?.status === 404) {
    return "missing";
  }
  if (!response?.ok || !response.body) {
    return "unsettled";
  }
  return readChatStream(response.body, options).catch(
    () => "unsettled" as const
  );
};

/**
 * Follows the chat until the assistant stops, reconnecting if the connection ends first. Only the first attempt sends the message.
 */
const followChat = async (
  options: FollowOptions,
  attempt = 0
): Promise<FollowResult> => {
  const result = await connect(
    options,
    attempt === 0 ? options.message : undefined
  );
  const isFinal =
    result !== "unsettled" ||
    attempt >= MAX_RECONNECTS ||
    options.signal.aborted;
  if (isFinal) {
    return result;
  }
  await wait(RECONNECT_DELAY_MS);
  return followChat(options, attempt + 1);
};

const startChat = async () => {
  const response = await fetch(CHAT_PATH, { method: "POST" }).catch(() => null);
  if (!response?.ok) {
    return null;
  }
  const { sessionId } = (await response.json()) as { sessionId: string };
  return sessionId;
};

// The open chat's ID lives in localStorage so a reload reopens it. The
// "storage" event only fires in other tabs, so changes made here announce
// themselves.
const STORAGE_EVENT = "invoice-chat-storage";

const subscribeToStorage = (onChange: () => void) => {
  addEventListener("storage", onChange);
  addEventListener(STORAGE_EVENT, onChange);
  return () => {
    removeEventListener("storage", onChange);
    removeEventListener(STORAGE_EVENT, onChange);
  };
};

const storeSessionId = (storageKey: string, sessionId: string | null) => {
  if (sessionId) {
    localStorage.setItem(storageKey, sessionId);
  } else {
    localStorage.removeItem(storageKey);
  }
  dispatchEvent(new Event(STORAGE_EVENT));
};

const noStoredSession = () => null;

/**
 * The invoice chat: its messages, and the calls that drive it. `storageKey`
 * is where this user's open chat is remembered between page loads.
 */
export const useInvoiceChat = (storageKey: string, isEnabled: boolean) => {
  const [state, dispatch] = useReducer(chatReducer, INITIAL_CHAT_STATE);
  // "loading" while reopening a stored chat, "busy" while the assistant works.
  const [status, setStatus] = useState<"idle" | "loading" | "busy">("idle");
  const sessionId = useSyncExternalStore(
    subscribeToStorage,
    () => localStorage.getItem(storageKey),
    noStoredSession
  );
  const connection = useRef<AbortController | null>(null);
  // The chat this hook is already following, so storing its ID doesn't reopen it.
  const followedId = useRef<string | null>(null);

  const reset = useCallback(() => {
    connection.current?.abort();
    followedId.current = null;
    storeSessionId(storageKey, null);
    dispatch({ type: "reset" });
    setStatus("idle");
  }, [storageKey]);

  const follow = useCallback(
    async (id: string, message?: string) => {
      connection.current?.abort();
      const controller = new AbortController();
      connection.current = controller;
      followedId.current = id;
      setStatus(message === undefined ? "loading" : "busy");

      const result = await followChat({
        dispatch,
        message,
        sessionId: id,
        signal: controller.signal,
      });
      // A newer connection, or a reset, has taken over.
      if (controller.signal.aborted) {
        return;
      }
      if (result === "missing") {
        reset();
        return;
      }
      if (result === "unsettled") {
        dispatch({ message: CONNECTION_LOST, type: "error" });
      }
      setStatus("idle");
    },
    [reset]
  );

  // Reopen the chat this browser was last in.
  useEffect(() => {
    if (isEnabled && sessionId && followedId.current !== sessionId) {
      void follow(sessionId);
    }
  }, [follow, isEnabled, sessionId]);

  // Leaving the page drops the connection and forgets what was being followed, so that mounting again (as React's development mode does) reopens it.
  useEffect(
    () => () => {
      connection.current?.abort();
      followedId.current = null;
    },
    []
  );

  const send = useCallback(
    async (text: string) => {
      const id = crypto.randomUUID();
      dispatch({ id, text, type: "sent" });
      setStatus("busy");

      const chatId = sessionId ?? (await startChat());
      if (!chatId) {
        dispatch({ id, message: START_FAILED, type: "send_failed" });
        setStatus("idle");
        return;
      }
      // Claim the chat before storing its ID, or the effect above would reopen it.
      followedId.current = chatId;
      storeSessionId(storageKey, chatId);
      await follow(chatId, text);
    },
    [follow, sessionId, storageKey]
  );

  /**
  Asks the assistant to stop; the open stream ends once it has.
  */
  const stop = useCallback(async () => {
    if (sessionId) {
      await fetch(`${CHAT_PATH}/${sessionId}/interrupt`, {
        method: "POST",
      }).catch(() => null);
    }
  }, [sessionId]);

  const downloadUrl = (fileId: string) =>
    `${CHAT_PATH}/${sessionId}/files/${fileId}`;

  return { downloadUrl, reset, send, state, status, stop };
};
