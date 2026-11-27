import { OUTPUT_DIRECTORY } from "./agent-config.ts";
import type { ChatStreamEvent, TurnEndReason } from "./protocol.ts";
import type {
  BetaManagedAgentsSessionStatusIdleEvent,
  BetaManagedAgentsStreamSessionEvents,
} from "@anthropic-ai/sdk/resources/beta/sessions/events";

// Turns the session's raw event log into what the chat UI shows. Pure, so the same code replays a stored chat and follows a live one, and is unit-tested.

type StopReason = BetaManagedAgentsSessionStatusIdleEvent["stop_reason"];

// A report file is indexed a moment after the turn that wrote it ends.
const FILE_INDEXING_GRACE_MS = 15_000;

const TOOL_ACTIVITY: Record<string, string> = {
  bash: "Running the analysis",
  edit: "Editing a file",
  glob: "Looking through the files",
  grep: "Searching the data",
  read: "Reading the data",
  write: "Writing a file",
};

const END_REASONS: Record<
  Exclude<StopReason["type"], "requires_action">,
  TurnEndReason
> = {
  budget_reached: "budget_reached",
  end_turn: "end_turn",
  refusal: "refusal",
  retries_exhausted: "failed",
};

const textOf = (content: { type: string; text?: string }[]) =>
  content
    .map((block) => (block.type === "text" ? (block.text ?? "") : ""))
    .join("")
    .trim();

export const createEventProjector = () => {
  const state = {
    // True from a user message until the turn it starts has ended.
    awaitingTurn: false,
    // Tool calls paused for an approval nobody is there to give.
    pendingAskIds: [] as string[],
    seenIds: new Set<string>(),
    turn: 0,
    // When each finished turn ended, by turn number.
    turnEnds: [] as number[],
    wroteOutput: false,
  };

  const endTurn = (reason: TurnEndReason, at: string): ChatStreamEvent[] => {
    const ended = state.turn;
    state.turnEnds.push(Date.parse(at));
    state.turn += 1;
    state.awaitingTurn = false;
    state.pendingAskIds = [];
    return [{ reason, turn: ended, type: "turn_end" }];
  };

  const projectIdle = (event: BetaManagedAgentsSessionStatusIdleEvent) => {
    if (event.stop_reason.type === "requires_action") {
      state.pendingAskIds = event.stop_reason.event_ids;
      return [];
    }
    return endTurn(END_REASONS[event.stop_reason.type], event.processed_at);
  };

  /**
   * The chat events for one session event. `isLive` is false while replaying
   * history: progress updates only make sense as they happen.
   */
  const project = (
    event: BetaManagedAgentsStreamSessionEvents,
    isLive: boolean
  ): ChatStreamEvent[] => {
    if ("id" in event) {
      state.seenIds.add(event.id);
    }
    switch (event.type) {
      case "user.message": {
        state.awaitingTurn = true;
        state.wroteOutput = false;
        return [
          {
            id: event.id,
            text: textOf(event.content),
            turn: state.turn,
            type: "user",
          },
        ];
      }
      case "agent.message": {
        const text = textOf(event.content);
        return text
          ? [{ text, id: event.id, turn: state.turn, type: "assistant" }]
          : [];
      }
      case "event_delta": {
        return isLive
          ? [
              {
                id: event.event_id,
                text: event.delta.content.text,
                turn: state.turn,
                type: "delta",
              },
            ]
          : [];
      }
      case "agent.thinking": {
        return isLive ? [{ text: "Thinking", type: "activity" }] : [];
      }
      case "agent.tool_use": {
        if (JSON.stringify(event.input).includes(OUTPUT_DIRECTORY)) {
          state.wroteOutput = true;
        }
        const text = TOOL_ACTIVITY[event.name] ?? "Working";
        return isLive ? [{ text, type: "activity" }] : [];
      }
      case "session.status_running": {
        state.pendingAskIds = [];
        return [];
      }
      case "session.status_idle": {
        return projectIdle(event);
      }
      case "session.status_terminated": {
        return endTurn("terminated", event.processed_at);
      }
      default: {
        return [];
      }
    }
  };

  return {
    project,
    /**
     * Call after sending a message: if its echo has not been seen yet, the turn it starts is still to come, whatever the history replay ended on.
     */
    expectTurnFor: (eventId: string | null) => {
      if (!eventId || !state.seenIds.has(eventId)) {
        state.awaitingTurn = true;
      }
    },
    hasSeen: (eventId: string) => state.seenIds.has(eventId),
    /**
    True when the assistant has nothing left to do for now.
    */
    isSettled: () => !state.awaitingTurn && state.pendingAskIds.length === 0,
    pendingAskIds: () => state.pendingAskIds,
    /**
    The turn being answered, or the next one when the chat is idle.
    */
    currentTurn: () => state.turn,
    /**
     * The turn a file created at `createdAt` belongs to: the first one that
     * ended after it, or the turn in progress.
     */
    turnAt: (createdAt: string) => {
      const created = Date.parse(createdAt) - FILE_INDEXING_GRACE_MS;
      const index = state.turnEnds.findIndex((end) => end >= created);
      return index === -1 ? state.turn : index;
    },
    /**
    Whether the turn that just ended saved anything for the user.
    */
    wroteOutput: () => state.wroteOutput,
  };
};

export type EventProjector = ReturnType<typeof createEventProjector>;
