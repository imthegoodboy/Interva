import { normalizeSetup } from "./interview-engine.js";

export const STORAGE_SCHEMA_VERSION = 2;
export const STORAGE_TARGET_BYTES = 210_000;
export const STORAGE_HARD_BYTES = 240_000;

const HISTORY_PROFILES = [
  { limit: 24, answer: 420, question: 360, summary: 280, action: 260 },
  { limit: 18, answer: 320, question: 280, summary: 220, action: 220 },
  { limit: 12, answer: 240, question: 220, summary: 180, action: 180 },
  { limit: 8, answer: 180, question: 180, summary: 140, action: 150 },
  { limit: 4, answer: 120, question: 140, summary: 120, action: 130 },
  { limit: 1, answer: 80, question: 100, summary: 100, action: 120 },
];

export function buildWorkspaceSnapshot(state, options = {}) {
  const targetBytes = options.targetBytes || STORAGE_TARGET_BYTES;
  const base = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    setup: normalizeSetup(state?.setup),
    view: state?.view || "setup",
    currentInterview: state?.currentInterview || null,
    selectedReportId: state?.selectedReportId || null,
  };
  const history = Array.isArray(state?.history) ? state.history : [];

  for (const profile of HISTORY_PROFILES) {
    const snapshot = {
      ...base,
      history: history.slice(0, profile.limit).map((report) => compactReport(report, profile)),
    };
    const bytes = snapshotByteSize(snapshot);
    if (bytes <= targetBytes) {
      return {
        snapshot,
        bytes,
        compacted: true,
        historyLimit: profile.limit,
      };
    }
  }

  const fallback = {
    ...base,
    currentInterview: base.currentInterview ? compactInterview(base.currentInterview, HISTORY_PROFILES.at(-1)) : null,
    history: history.slice(0, 1).map((report) => compactReport(report, HISTORY_PROFILES.at(-1))),
  };
  return {
    snapshot: fallback,
    bytes: snapshotByteSize(fallback),
    compacted: true,
    historyLimit: fallback.history.length,
  };
}

export function snapshotByteSize(value) {
  const json = JSON.stringify(value);
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(json).length;
  return json.length;
}

export function compactReport(report, profile = HISTORY_PROFILES[0]) {
  const compacted = compactInterview(report, profile);
  return {
    ...compacted,
    status: "completed",
    completedAt: report?.completedAt || compacted.completedAt || null,
    liveScores: compactScores(report?.liveScores),
    weakAreas: compactList(report?.weakAreas, 6, 80),
    strengths: compactList(report?.strengths, 6, 80),
    studyPlan: compactStudyPlan(report?.studyPlan, profile),
  };
}

export function compactInterview(interview, profile = HISTORY_PROFILES[0]) {
  if (!interview || typeof interview !== "object") return null;
  return {
    id: text(interview.id, 80),
    setup: normalizeSetup(interview.setup),
    status: text(interview.status, 24) || "active",
    startedAt: text(interview.startedAt, 40),
    completedAt: text(interview.completedAt, 40),
    questionIndex: Number(interview.questionIndex || 0),
    currentQuestion: compactQuestion(interview.currentQuestion, profile),
    turns: Array.isArray(interview.turns)
      ? interview.turns.map((turn) => compactTurn(turn, profile))
      : [],
    liveScores: compactScores(interview.liveScores),
    weakAreas: compactList(interview.weakAreas, 6, 80),
    agentSessionUuid: text(interview.agentSessionUuid, 120),
    agentMode: text(interview.agentMode, 40),
    agentIssue: interview.agentIssue ? {
      stage: text(interview.agentIssue.stage, 80),
      message: text(interview.agentIssue.message, 220),
      at: text(interview.agentIssue.at, 40),
    } : null,
  };
}

function compactTurn(turn, profile) {
  return {
    id: text(turn?.id, 80),
    createdAt: text(turn?.createdAt, 40),
    question: compactQuestion(turn?.question, profile),
    answer: text(turn?.answer, profile.answer),
    answerWasTrimmed: String(turn?.answer || "").length > profile.answer,
    evaluation: compactEvaluation(turn?.evaluation, profile),
    followUp: text(turn?.followUp, profile.summary),
  };
}

function compactQuestion(question, profile) {
  if (!question) return null;
  return {
    id: text(question.id, 80),
    interviewer: text(question.interviewer, 40),
    interviewerTitle: text(question.interviewerTitle, 80),
    competency: text(question.competency, 80),
    text: text(question.text, profile.question),
    followUp: Boolean(question.followUp),
  };
}

function compactEvaluation(evaluation, profile) {
  return {
    summary: text(evaluation?.summary, profile.summary),
    scores: compactScores(evaluation?.scores),
    strengths: compactList(evaluation?.strengths, 4, 80),
    weakAreas: compactList(evaluation?.weakAreas, 4, 80),
  };
}

function compactStudyPlan(studyPlan, profile) {
  if (!studyPlan || typeof studyPlan !== "object") return null;
  return {
    headline: text(studyPlan.headline, 140),
    carryForward: compactList(studyPlan.carryForward, 4, 80),
    tasks: Array.isArray(studyPlan.tasks)
      ? studyPlan.tasks.slice(0, 6).map((task) => ({
        id: text(task.id, 80),
        area: text(task.area, 80),
        action: text(task.action, profile.action),
        effort: text(task.effort, 40),
        done: Boolean(task.done),
      }))
      : [],
  };
}

function compactScores(scores = {}) {
  return {
    communication: clampScore(scores.communication),
    technical: clampScore(scores.technical),
    readiness: clampScore(scores.readiness),
  };
}

function compactList(items, limit, itemLimit) {
  return Array.isArray(items)
    ? items.map((item) => text(item, itemLimit)).filter(Boolean).slice(0, limit)
    : [];
}

function text(value, limit) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (raw.length <= limit) return raw;
  return `${raw.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function clampScore(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
