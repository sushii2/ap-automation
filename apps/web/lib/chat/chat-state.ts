import type { ChatFile, ChatStreamEvent, TurnEndReason } from "./protocol.ts";

// What the chat UI renders, built by applying stream events one at a time.
// Applying the same event twice changes nothing, so replaying a chat on reconnect merges into what is already on screen. Pure, and unit-tested.

interface ChatText {
  id: string;
  text: string;
}

interface AssistantText extends ChatText {
  /**
  False while the text is still arriving as deltas.
  */
  complete: boolean;
}

export interface ChatTurn {
  turn: number;
  questions: ChatText[];
  answers: AssistantText[];
  files: ChatFile[];
  ended: TurnEndReason | null;
}

export interface ChatState {
  turns: ChatTurn[];
  /**
  Messages the user sent that the server has not echoed back yet.
  */
  pending: ChatText[];
  /**
  What the assistant is doing right now.
  */
  activity: string | null;
  error: string | null;
}

export type ChatAction =
  | ChatStreamEvent
  | { type: "sent"; id: string; text: string }
  | { type: "send_failed"; id: string; message: string }
  | { type: "reset" };

export const INITIAL_CHAT_STATE: ChatState = {
  activity: null,
  error: null,
  pending: [],
  turns: [],
};

/**
After these endings the session takes no more messages.
*/
export const isChatClosed = (state: ChatState) =>
  state.turns.some(
    (turn) => turn.ended === "budget_reached" || turn.ended === "terminated"
  );

/**
 * Whether the assistant has stopped, given the latest stream event. A stream that ends while this is false was cut off mid-answer and should be resumed.
 */
export const isSettledAfter = (event: ChatStreamEvent, wasSettled: boolean) => {
  switch (event.type) {
    case "turn_end":
    case "error": {
      return true;
    }
    // Files are reported after the turn that saved them has ended.
    case "files": {
      return wasSettled;
    }
    default: {
      return false;
    }
  }
};

const emptyTurn = (turn: number): ChatTurn => ({
  answers: [],
  ended: null,
  files: [],
  questions: [],
  turn,
});

/**
Replaces one turn, creating it in order if it is new.
*/
const withTurn = (
  turns: ChatTurn[],
  turn: number,
  update: (current: ChatTurn) => ChatTurn
) => {
  const current = turns.find((item) => item.turn === turn) ?? emptyTurn(turn);
  const others = turns.filter((item) => item.turn !== turn);
  const position = others.findIndex((item) => item.turn > turn);
  const before = position === -1 ? others : others.slice(0, position);
  return [...before, update(current), ...others.slice(before.length)];
};

/**
Drops the oldest unconfirmed message with this text: the server has it now.
*/
const confirmPending = (pending: ChatText[], text: string) => {
  const confirmed = pending.find((message) => message.text === text);
  return confirmed
    ? pending.filter((message) => message !== confirmed)
    : pending;
};

const upsertAnswer = (
  answers: AssistantText[],
  id: string,
  update: (current: AssistantText | undefined) => AssistantText
) =>
  answers.some((answer) => answer.id === id)
    ? answers.map((answer) => (answer.id === id ? update(answer) : answer))
    : [...answers, update(undefined)];

const applyStreamEvent = (
  state: ChatState,
  event: ChatStreamEvent
): ChatState => {
  switch (event.type) {
    case "user": {
      return {
        ...state,
        pending: confirmPending(state.pending, event.text),
        turns: withTurn(state.turns, event.turn, (turn) =>
          turn.questions.some((question) => question.id === event.id)
            ? turn
            : {
                ...turn,
                questions: [
                  ...turn.questions,
                  { id: event.id, text: event.text },
                ],
              }
        ),
      };
    }
    case "assistant": {
      return {
        ...state,
        activity: null,
        turns: withTurn(state.turns, event.turn, (turn) => ({
          ...turn,
          answers: upsertAnswer(turn.answers, event.id, () => ({
            complete: true,
            id: event.id,
            text: event.text,
          })),
        })),
      };
    }
    case "delta": {
      return {
        ...state,
        activity: null,
        turns: withTurn(state.turns, event.turn, (turn) => ({
          ...turn,
          answers: upsertAnswer(turn.answers, event.id, (current) =>
            // The finished message is authoritative; late deltas are dropped.
            current?.complete
              ? current
              : {
                  complete: false,
                  id: event.id,
                  text: (current?.text ?? "") + event.text,
                }
          ),
        })),
      };
    }
    case "activity": {
      return { ...state, activity: event.text };
    }
    case "files": {
      const known = new Set(
        state.turns.flatMap((turn) => turn.files.map((file) => file.id))
      );
      const added = event.files.filter((file) => !known.has(file.id));
      return added.length === 0
        ? state
        : {
            ...state,
            turns: withTurn(state.turns, event.turn, (turn) => ({
              ...turn,
              files: [...turn.files, ...added],
            })),
          };
    }
    case "turn_end": {
      return {
        ...state,
        activity: null,
        turns: withTurn(state.turns, event.turn, (turn) => ({
          ...turn,
          ended: event.reason,
        })),
      };
    }
    case "error": {
      return { ...state, activity: null, error: event.message };
    }
    default: {
      return state;
    }
  }
};

export const chatReducer = (
  state: ChatState,
  action: ChatAction
): ChatState => {
  switch (action.type) {
    case "sent": {
      const message = { id: action.id, text: action.text };
      return { ...state, error: null, pending: [...state.pending, message] };
    }
    case "send_failed": {
      return {
        ...state,
        error: action.message,
        pending: state.pending.filter((message) => message.id !== action.id),
      };
    }
    case "reset": {
      return INITIAL_CHAT_STATE;
    }
    default: {
      return applyStreamEvent(state, action);
    }
  }
};
