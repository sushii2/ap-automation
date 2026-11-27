import "server-only";

import { setTimeout as sleep } from "node:timers/promises";

import Anthropic from "@anthropic-ai/sdk";

import { getAnthropic } from "./anthropic.ts";
import { createEventProjector } from "./project-events.ts";
import { CHAT_STREAM_CONTENT_TYPE } from "./protocol.ts";
import type { EventProjector } from "./project-events.ts";
import type { ChatFile, ChatStreamEvent } from "./protocol.ts";
import type { BetaManagedAgentsSession } from "@anthropic-ai/sdk/resources/beta/sessions/sessions";

// Follows one chat session and emits what the UI should show. Every connection replays the stored history first and then tails the live stream, so a page reload or a dropped connection picks up exactly where the chat is.

// Listing a session's files is still gated on the Managed Agents beta.
const MANAGED_AGENTS_BETA = "managed-agents-2026-04-01";

// A file the assistant just saved takes a moment to show up in the listing.
const FILE_POLL_ATTEMPTS = 4;
const FILE_POLL_INTERVAL_MS = 1500;

const DENIED_MESSAGE =
  "No one is available to approve this step. Find another way to finish the task.";

const REJECTED_MESSAGE =
  "This chat can't take another message. Start a new chat to continue.";
const FAILED_MESSAGE =
  "Something went wrong while talking to the assistant. Try again in a moment.";

interface StreamChatOptions {
  session: BetaManagedAgentsSession;
  /**
  A new message from the user to send before following the chat.
  */
  message?: string;
  /**
  Aborts when the browser goes away.
  */
  signal: AbortSignal;
}

type Emit = (events: ChatStreamEvent[]) => void;

/**
The files the assistant has saved for the user, without the mounted inputs.
*/
export const listOutputFiles = async (session: BetaManagedAgentsSession) => {
  const inputIds = new Set(
    session.resources.flatMap((resource) =>
      resource.type === "file" ? [resource.file_id] : []
    )
  );
  const files = [];
  const listing = getAnthropic().beta.files.list({
    betas: [MANAGED_AGENTS_BETA],
    scope_id: session.id,
  });
  for await (const file of listing) {
    if (!inputIds.has(file.id) && file.downloadable !== false) {
      files.push(file);
    }
  }
  return files;
};

type OutputFile = Awaited<ReturnType<typeof listOutputFiles>>[number];

const toChatFile = (file: OutputFile): ChatFile => ({
  id: file.id,
  name: file.filename,
  sizeBytes: file.size_bytes,
});

/**
One `files` event per turn that produced any, placed by when each was saved.
*/
const filesByTurn = (files: OutputFile[], projector: EventProjector) => {
  const turns = new Map<number, ChatFile[]>();
  for (const file of files) {
    const turn = projector.turnAt(file.created_at);
    turns.set(turn, [...(turns.get(turn) ?? []), toChatFile(file)]);
  }
  return [...turns].map(([turn, turnFiles]): ChatStreamEvent => ({
    turn,
    files: turnFiles,
    type: "files",
  }));
};

/**
 * The output files not in `knownIds` yet. Asks up to `attempts` times, since a file saved at the very end of a turn is listed a little later.
 */
const findNewFiles = async (
  session: BetaManagedAgentsSession,
  knownIds: Set<string>,
  attempts: number,
  signal: AbortSignal
): Promise<OutputFile[]> => {
  const files = await listOutputFiles(session);
  const created = files.filter((file) => !knownIds.has(file.id));
  if (created.length > 0 || attempts <= 1) {
    return created;
  }
  await sleep(FILE_POLL_INTERVAL_MS, undefined, { signal });
  return findNewFiles(session, knownIds, attempts - 1, signal);
};

/**
 * Tool calls paused for approval are denied: the chat has no reviewer, and the session would otherwise wait forever.
 */
const denyPendingAsks = async (sessionId: string, eventIds: string[]) => {
  if (eventIds.length === 0) {
    return;
  }
  try {
    await getAnthropic().beta.sessions.events.send(sessionId, {
      events: eventIds.map((id) => ({
        deny_message: DENIED_MESSAGE,
        result: "deny" as const,
        tool_use_id: id,
        type: "user.tool_confirmation" as const,
      })),
    });
  } catch (error) {
    // Already answered by another connection to the same chat.
    if (!(error instanceof Anthropic.BadRequestError)) {
      throw error;
    }
  }
};

/**
 * Sends the user's message. A chat at its budget, or one that has ended, refuses new messages: that is reported as `isRejected`, not thrown.
 */
const sendMessage = async (sessionId: string, text: string) => {
  const sent = await getAnthropic()
    .beta.sessions.events.send(sessionId, {
      events: [{ content: [{ text, type: "text" }], type: "user.message" }],
    })
    .catch((error: unknown) => {
      if (error instanceof Anthropic.BadRequestError) {
        return null;
      }
      throw error;
    });
  return sent
    ? { eventId: sent.data?.[0]?.id ?? null, isRejected: false }
    : { eventId: null, isRejected: true };
};

/**
 * After a turn ends, emits the files it saved. Only keeps looking for one when the turn says it saved something.
 */
const emitNewFiles = async (
  { session, signal }: StreamChatOptions,
  projector: EventProjector,
  knownFileIds: Set<string>,
  turn: number,
  emit: Emit
) => {
  const attempts = projector.wroteOutput() ? FILE_POLL_ATTEMPTS : 1;
  const created = await findNewFiles(session, knownFileIds, attempts, signal);
  for (const file of created) {
    knownFileIds.add(file.id);
  }
  if (created.length === 0) {
    return;
  }
  const files = created.map((file) => toChatFile(file));
  emit([{ files, turn, type: "files" }]);
};

const runChat = async (options: StreamChatOptions, emit: Emit) => {
  const { session, message, signal } = options;
  const client = getAnthropic();
  const projector = createEventProjector();

  // Open the live stream before anything else: it only carries what happens after it connects, and the history fetch below covers everything before.
  const live = await client.beta.sessions.events.stream(
    session.id,
    { event_deltas: ["agent.message"] },
    { signal }
  );

  const sent =
    message === undefined ? null : await sendMessage(session.id, message);
  if (sent?.isRejected) {
    emit([{ message: REJECTED_MESSAGE, type: "error" }]);
    return;
  }

  const history = client.beta.sessions.events.list(session.id, {
    order: "asc",
  });
  for await (const event of history) {
    emit(projector.project(event, false));
  }
  if (sent) {
    projector.expectTurnFor(sent.eventId);
  }

  const files = await listOutputFiles(session);
  const knownFileIds = new Set(files.map((file) => file.id));
  emit(filesByTurn(files, projector));

  await denyPendingAsks(session.id, projector.pendingAskIds());
  if (projector.isSettled()) {
    return;
  }

  for await (const event of live) {
    // The stream overlaps the history; anything already replayed is skipped.
    if ("id" in event && projector.hasSeen(event.id)) {
      continue;
    }
    const projected = projector.project(event, true);
    emit(projected);
    await denyPendingAsks(session.id, projector.pendingAskIds());

    const ended = projected.find((item) => item.type === "turn_end");
    if (ended) {
      await emitNewFiles(options, projector, knownFileIds, ended.turn, emit);
    }
    if (projector.isSettled()) {
      return;
    }
  }
};

/**
 * The chat as a streaming response, one JSON event per line. The response ends when the assistant has nothing left to do.
 */
export const chatStreamResponse = (options: StreamChatOptions) => {
  const encoder = new TextEncoder();
  // Stops the upstream connections once this response is done or abandoned.
  const teardown = new AbortController();
  const signal = AbortSignal.any([options.signal, teardown.signal]);

  const run = async (
    controller: ReadableStreamDefaultController<Uint8Array>
  ) => {
    const emit: Emit = (events) => {
      for (const event of events) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }
    };
    try {
      await runChat({ ...options, signal }, emit);
    } catch (error) {
      // An abort means the browser left; there is no one to tell.
      if (!signal.aborted) {
        console.error("Invoice chat stream failed", error);
        emit([{ message: FAILED_MESSAGE, type: "error" }]);
      }
    }
    // Already aborted means the browser cancelled, and the stream is closed.
    if (teardown.signal.aborted) {
      return;
    }
    controller.close();
    teardown.abort();
  };

  const body = new ReadableStream<Uint8Array>({
    cancel: () => teardown.abort(),
    // Not awaited: the stream starts flowing while the chat is followed.
    start: (controller) => {
      void run(controller);
    },
  });

  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": CHAT_STREAM_CONTENT_TYPE,
      // Tell proxies not to hold the stream back.
      "X-Accel-Buffering": "no",
    },
  });
};
