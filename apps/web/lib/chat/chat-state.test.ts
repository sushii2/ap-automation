import assert from "node:assert/strict";
import { test } from "node:test";

import {
  INITIAL_CHAT_STATE,
  chatReducer,
  isChatClosed,
  isSettledAfter,
} from "./chat-state.ts";
import type { ChatAction } from "./chat-state.ts";

const run = (actions: ChatAction[], from = INITIAL_CHAT_STATE) => {
  let state = from;
  for (const action of actions) {
    state = chatReducer(state, action);
  }
  return state;
};

const report = { id: "file_1", name: "spend.pdf", sizeBytes: 2048 };

test("a sent message is pending until the server echoes it", () => {
  const sent = run([{ id: "local", text: "Hi", type: "sent" }]);
  assert.deepEqual(sent.pending, [{ id: "local", text: "Hi" }]);

  const echoed = chatReducer(sent, {
    id: "u1",
    text: "Hi",
    turn: 0,
    type: "user",
  });
  assert.deepEqual(echoed.pending, []);
  assert.deepEqual(echoed.turns[0]?.questions, [{ id: "u1", text: "Hi" }]);
});

test("deltas build an answer and the finished message replaces them", () => {
  const streaming = run([
    { id: "a1", text: "Two inv", turn: 0, type: "delta" },
    { id: "a1", text: "oices", turn: 0, type: "delta" },
  ]);
  assert.deepEqual(streaming.turns[0]?.answers, [
    { complete: false, id: "a1", text: "Two invoices" },
  ]);

  const done = run(
    [
      {
        id: "a1",
        text: "Two invoices need review.",
        turn: 0,
        type: "assistant",
      },
      // A delta that arrives late must not be appended to the finished text.
      { id: "a1", text: " need", turn: 0, type: "delta" },
    ],
    streaming
  );
  assert.deepEqual(done.turns[0]?.answers, [
    { complete: true, id: "a1", text: "Two invoices need review." },
  ]);
});

test("replaying a chat on reconnect changes nothing", () => {
  const events: ChatAction[] = [
    { id: "u1", text: "Report please", turn: 0, type: "user" },
    { id: "a1", text: "Here it is.", turn: 0, type: "assistant" },
    { reason: "end_turn", turn: 0, type: "turn_end" },
    { files: [report], turn: 0, type: "files" },
  ];
  assert.deepEqual(run([...events, ...events]), run(events));
});

test("turns stay in order whatever order their events arrive in", () => {
  const state = run([
    { id: "u2", text: "Second", turn: 1, type: "user" },
    { files: [report], turn: 0, type: "files" },
    { id: "u3", text: "Third", turn: 2, type: "user" },
  ]);
  assert.deepEqual(
    state.turns.map((turn) => turn.turn),
    [0, 1, 2]
  );
});

test("a file is shown once, in the turn that first reported it", () => {
  const state = run([
    { files: [report], turn: 0, type: "files" },
    { files: [report], turn: 1, type: "files" },
  ]);
  assert.deepEqual(state.turns[0]?.files, [report]);
  assert.equal(state.turns.length, 1);
});

test("a failed send drops the pending message and reports the error", () => {
  const state = run([
    { id: "local", text: "Hi", type: "sent" },
    { id: "local", message: "Couldn't start the chat.", type: "send_failed" },
  ]);
  assert.deepEqual(state.pending, []);
  assert.equal(state.error, "Couldn't start the chat.");
});

test("a chat is closed once it hits its budget", () => {
  const open = run([{ reason: "end_turn", turn: 0, type: "turn_end" }]);
  assert.equal(isChatClosed(open), false);

  const closed = run([{ reason: "budget_reached", turn: 0, type: "turn_end" }]);
  assert.equal(isChatClosed(closed), true);
});

test("files reported after a turn ends leave the chat settled", () => {
  const asked = isSettledAfter(
    { id: "u1", text: "Report please", turn: 0, type: "user" },
    true
  );
  const ended = isSettledAfter(
    { reason: "end_turn", turn: 0, type: "turn_end" },
    asked
  );
  const filed = isSettledAfter(
    { files: [report], turn: 0, type: "files" },
    ended
  );
  assert.deepEqual([asked, ended, filed], [false, true, true]);
});
