// What the chat routes stream to the browser: one JSON object per line.
// Shared by the server and the client, so no imports from either side.

export interface ChatFile {
  id: string;
  name: string;
  sizeBytes: number;
}

/**
 * Why the assistant stopped. Only `end_turn` is a normal finish; after
 * `budget_reached` or `terminated` the chat accepts no more messages.
 */
export type TurnEndReason =
  "end_turn" | "budget_reached" | "refusal" | "failed" | "terminated";

/**
 * `turn` counts the finished turns before the event, so everything belonging to
 * one question and its answer shares a number. Events are idempotent by `id`:
 * a reconnect replays the whole chat and the client merges it.
 */
export type ChatStreamEvent =
  | { type: "user"; id: string; turn: number; text: string }
  | { type: "assistant"; id: string; turn: number; text: string }
  // Text of an assistant message that is still being written; append to `id`.
  | { type: "delta"; id: string; turn: number; text: string }
  // What the assistant is doing right now, e.g. "Running the analysis".
  | { type: "activity"; text: string }
  | { type: "files"; turn: number; files: ChatFile[] }
  | { type: "turn_end"; turn: number; reason: TurnEndReason }
  | { type: "error"; message: string };

export const CHAT_STREAM_CONTENT_TYPE = "application/x-ndjson";
