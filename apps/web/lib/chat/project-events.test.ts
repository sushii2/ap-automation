import assert from "node:assert/strict";
import { test } from "node:test";

import { createEventProjector } from "./project-events.ts";
import type { BetaManagedAgentsStreamSessionEvents } from "@anthropic-ai/sdk/resources/beta/sessions/events";

type SessionEvent = BetaManagedAgentsStreamSessionEvents;

const at = (second: number) => {
  const time = new Date(Date.UTC(2026, 10, 26, 9, 0, second));
  return time.toISOString();
};

const userMessage = (id: string, text: string): SessionEvent => ({
  id,
  content: [{ text, type: "text" }],
  processed_at: at(0),
  type: "user.message",
});

const agentMessage = (id: string, text: string): SessionEvent => ({
  id,
  content: [{ text, type: "text" }],
  processed_at: at(1),
  type: "agent.message",
});

const toolUse = (command: string): SessionEvent => ({
  id: "t1",
  input: { command },
  name: "bash",
  processed_at: at(1),
  type: "agent.tool_use",
});

const idle = (
  id: string,
  second: number,
  reason: "end_turn" | "budget_reached" = "end_turn"
): SessionEvent => ({
  id,
  processed_at: at(second),
  stop_details: null,
  stop_reason: { type: reason },
  type: "session.status_idle",
});

const waitingForApproval = (id: string, eventIds: string[]): SessionEvent => ({
  id,
  processed_at: at(1),
  stop_details: null,
  stop_reason: { event_ids: eventIds, type: "requires_action" },
  type: "session.status_idle",
});

test("a question and its answer share a turn, and the turn ends on idle", () => {
  const projector = createEventProjector();
  const events = [
    userMessage("u1", "Which invoices need review?"),
    agentMessage("a1", "Two invoices need review."),
    idle("i1", 2),
    userMessage("u2", "Which vendors?"),
  ].flatMap((event) => projector.project(event, false));

  assert.deepEqual(events, [
    { id: "u1", text: "Which invoices need review?", turn: 0, type: "user" },
    { id: "a1", text: "Two invoices need review.", turn: 0, type: "assistant" },
    { reason: "end_turn", turn: 0, type: "turn_end" },
    { id: "u2", text: "Which vendors?", turn: 1, type: "user" },
  ]);
  assert.equal(projector.isSettled(), false);
});

test("progress is only reported while following live", () => {
  const replay = createEventProjector();
  assert.deepEqual(replay.project(toolUse("python a.py"), false), []);

  const live = createEventProjector();
  assert.deepEqual(live.project(toolUse("python a.py"), true), [
    { text: "Running the analysis", type: "activity" },
  ]);
  assert.deepEqual(
    live.project(
      {
        delta: {
          content: { text: "Two inv", type: "text" },
          type: "content_delta",
        },
        event_id: "a1",
        type: "event_delta",
      },
      true
    ),
    [{ id: "a1", text: "Two inv", turn: 0, type: "delta" }]
  );
});

test("a paused tool call is pending until the session runs again", () => {
  const projector = createEventProjector();
  projector.project(userMessage("u1", "Make a report"), true);
  assert.deepEqual(
    projector.project(waitingForApproval("i1", ["t1"]), true),
    []
  );
  assert.deepEqual(projector.pendingAskIds(), ["t1"]);
  assert.equal(projector.isSettled(), false);

  projector.project(
    { id: "r1", processed_at: at(2), type: "session.status_running" },
    true
  );
  assert.deepEqual(projector.pendingAskIds(), []);
});

test("a message sent but not yet in the history keeps the chat unsettled", () => {
  const projector = createEventProjector();
  projector.project(userMessage("u1", "Hi"), false);
  projector.project(idle("i1", 2), false);
  assert.equal(projector.isSettled(), true);

  projector.expectTurnFor("u2");
  assert.equal(projector.isSettled(), false);
});

test("a message whose turn already ended in the history stays settled", () => {
  const projector = createEventProjector();
  projector.project(userMessage("u1", "Hi"), false);
  projector.project(idle("i1", 2), false);

  projector.expectTurnFor("u1");
  assert.equal(projector.isSettled(), true);
});

test("the budget pause ends the turn with its own reason", () => {
  const projector = createEventProjector();
  projector.project(userMessage("u1", "Hi"), true);
  assert.deepEqual(projector.project(idle("i1", 2, "budget_reached"), true), [
    { reason: "budget_reached", turn: 0, type: "turn_end" },
  ]);
});

test("files are placed in the turn that was running when they were saved", () => {
  const projector = createEventProjector();
  projector.project(userMessage("u1", "Report please"), false);
  projector.project(
    toolUse("python build.py /mnt/session/outputs/report.pdf"),
    false
  );
  assert.equal(projector.wroteOutput(), true);
  projector.project(idle("i1", 10), false);
  projector.project(userMessage("u2", "And a spreadsheet"), false);
  projector.project(idle("i2", 50), false);

  // Saved during turn 0, and indexed just after turn 0 ended.
  assert.equal(projector.turnAt(at(8)), 0);
  assert.equal(projector.turnAt(at(12)), 0);
  assert.equal(projector.turnAt(at(40)), 1);
  // Saved after every finished turn: the one in progress.
  assert.equal(projector.turnAt(at(70)), 2);
});
