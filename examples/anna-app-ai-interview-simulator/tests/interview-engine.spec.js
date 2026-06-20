import { describe, expect, it } from "vitest";
import {
  aggregateProgress,
  analyzeAnswerQuality,
  applyTurn,
  applyRolePreset,
  completeInterview,
  createInterview,
  evaluateAnswer,
  focusAreasFromWeakAreas,
  parsePanelJson,
} from "../bundle/interview-engine.js";

describe("interview engine", () => {
  it("scores detailed answers higher than shallow answers", () => {
    const interview = createInterview({ role: "Backend Engineer" }, 1);
    const shallow = evaluateAnswer("I would fix it and communicate well.", interview.currentQuestion, interview.setup);
    const detailed = evaluateAnswer(
      "First, I would clarify the user impact and reproduce the issue. In a project with a similar API latency problem, we traced the queue depth, database indexes, and cache hit rate. The tradeoff was between a quick rollback and a targeted schema fix, so we chose rollback first, then added tests and observability. The result was a 35% latency reduction.",
      interview.currentQuestion,
      interview.setup,
    );

    expect(detailed.scores.communication).toBeGreaterThan(shallow.scores.communication);
    expect(detailed.scores.technical).toBeGreaterThan(shallow.scores.technical);
  });

  it("applies a turn and produces adaptive interview state", () => {
    const interview = createInterview({ role: "Senior Frontend Engineer", questionCount: 4 }, 2);
    const updated = applyTurn(
      interview,
      "I would start by clarifying requirements, then build an API contract, typed component boundary, loading states, tests, and observability. The main tradeoff is whether to optimize first for delivery speed or extensibility.",
      null,
    );

    expect(updated.turns).toHaveLength(1);
    expect(updated.currentQuestion.text).toBeTruthy();
    expect(updated.liveScores.readiness).toBeGreaterThan(0);
  });

  it("normalizes agent 0-10 scores into percentage scores", () => {
    const interview = createInterview({ role: "Senior Frontend Engineer", questionCount: 4 }, 7);
    const updated = applyTurn(
      interview,
      "I would clarify requirements, explain tradeoffs, add tests, and measure impact with usage metrics.",
      {
        evaluation: {
          summary: "Solid answer.",
          scores: { communication: 7, technical: 8, readiness: 7.5 },
          strengths: ["Clear structure"],
          weakAreas: ["More metrics"],
        },
        next_question: {
          interviewer: "engineer",
          text: "How would you test the failure cases?",
          competency: "Technical",
        },
      },
    );

    expect(updated.turns[0].evaluation.scores).toMatchObject({
      communication: 70,
      technical: 80,
      readiness: 75,
    });
  });

  it("generates a study plan when an interview completes", () => {
    const interview = createInterview({ role: "Software Engineer", questionCount: 4 }, 3);
    const withTurn = applyTurn(interview, "I would do it quickly.", null);
    const completed = completeInterview(withTurn, 4);

    expect(completed.status).toBe("completed");
    expect(completed.studyPlan.tasks.length).toBeGreaterThan(0);
    expect(completed.weakAreas.length).toBeGreaterThan(0);
  });

  it("aggregates saved interview progress", () => {
    const interview = createInterview({ role: "Tech Lead" }, 5);
    const completed = completeInterview(
      applyTurn(interview, "I would explain the architecture, API, database, cache, tests, observability, and tradeoff between consistency and latency with a concrete example.", null),
      6,
    );
    const progress = aggregateProgress([completed]);

    expect(progress.completedCount).toBe(1);
    expect(progress.averages.readiness).toBeGreaterThan(0);
  });

  it("parses strict or fenced JSON from an agent response", () => {
    expect(parsePanelJson('{"ok":true}')).toEqual({ ok: true });
    expect(parsePanelJson("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
  });

  it("applies role presets into normalized setup", () => {
    const setup = applyRolePreset({ role: "Generalist", focusAreas: ["Behavioral"] }, "backend");

    expect(setup.role).toBe("Senior Backend Engineer");
    expect(setup.focusAreas).toEqual(["Backend", "System Design", "Debugging"]);
  });

  it("maps weak areas into next-practice focus areas", () => {
    expect(focusAreasFromWeakAreas(["Tradeoffs", "Measurable impact"], ["Frontend"])).toEqual([
      "System Design",
      "Leadership",
      "Communication",
    ]);
  });

  it("detects live answer quality signals", () => {
    const quality = analyzeAnswerQuality(
      "When we had an API latency issue, I led the debugging, compared the rollback tradeoff with a database index fix, added tests and observability, and reduced p95 latency by 35% for 20000 users.",
    );

    expect(quality.wordCount).toBeGreaterThan(20);
    expect(quality.items.filter((item) => item.met).map((item) => item.id)).toEqual(
      expect.arrayContaining(["star", "specifics", "tradeoffs", "metrics"]),
    );
  });
});
