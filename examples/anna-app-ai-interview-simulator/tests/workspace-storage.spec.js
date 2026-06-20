import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETUP,
  applyTurn,
  completeInterview,
  createInterview,
} from "../bundle/interview-engine.js";
import {
  STORAGE_HARD_BYTES,
  STORAGE_TARGET_BYTES,
  buildWorkspaceSnapshot,
  snapshotByteSize,
} from "../bundle/workspace-storage.js";

describe("workspace storage compaction", () => {
  it("keeps a full 24-report history under the Anna storage budget", () => {
    const history = Array.from({ length: 24 }, (_, index) => makeCompletedReport(index, 1500));
    const { snapshot, bytes, historyLimit } = buildWorkspaceSnapshot({
      setup: DEFAULT_SETUP,
      view: "progress",
      currentInterview: null,
      history,
      selectedReportId: history[0].id,
    });

    expect(bytes).toBeLessThanOrEqual(STORAGE_TARGET_BYTES);
    expect(snapshotByteSize(snapshot)).toBe(bytes);
    expect(snapshot.history).toHaveLength(24);
    expect(historyLimit).toBe(24);
    expect(snapshot.history[0].turns[0].answer.length).toBeLessThan(500);
  });

  it("degrades history count before exceeding the hard storage ceiling", () => {
    const history = Array.from({ length: 24 }, (_, index) => makeCompletedReport(index, 5000));
    const { snapshot, bytes, historyLimit } = buildWorkspaceSnapshot({
      setup: DEFAULT_SETUP,
      view: "progress",
      currentInterview: makeActiveInterview(900),
      history,
      selectedReportId: history[0].id,
    });

    expect(bytes).toBeLessThanOrEqual(STORAGE_HARD_BYTES);
    expect(historyLimit).toBeLessThanOrEqual(24);
    expect(snapshot.currentInterview.turns[0].answer).toContain("database");
    expect(snapshot.history[0].studyPlan.tasks.length).toBeGreaterThan(0);
  });
});

function makeCompletedReport(seed, answerLength) {
  let interview = createInterview({ ...DEFAULT_SETUP, role: `Role ${seed}` }, Date.now() + seed);
  const answer = makeAnswer(answerLength);
  for (let index = 0; index < 6; index += 1) {
    interview = applyTurn(interview, answer, null);
  }
  return completeInterview(interview, Date.now() + seed);
}

function makeActiveInterview(answerLength) {
  let interview = createInterview({ ...DEFAULT_SETUP, role: "Active Role" }, Date.now() + 10_000);
  interview = applyTurn(interview, makeAnswer(answerLength), null);
  interview.agentSessionUuid = "session-test";
  interview.agentIssue = {
    stage: "Answer evaluation",
    message: "Anna agent timed out after 120 seconds.",
    at: new Date().toISOString(),
  };
  return interview;
}

function makeAnswer(length) {
  return [
    "When we had a production API latency issue for 20000 users, I first clarified impact and reproduced the request path.",
    "I traced the queue, cache, database index, and API timeout behavior, then compared the tradeoff between rolling back quickly and shipping a targeted schema fix.",
    "We rolled back first, added tests and observability, and reduced p95 latency by 35 percent while keeping the team updated.",
  ].join(" ").padEnd(length, " database");
}
