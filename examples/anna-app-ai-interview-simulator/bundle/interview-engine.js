export const INTERVIEWERS = [
  {
    id: "hr",
    title: "HR Manager",
    shortTitle: "HR",
    focus: "Behavioral",
    intent: "motivation, communication, collaboration, ownership",
  },
  {
    id: "engineer",
    title: "Senior Engineer",
    shortTitle: "SE",
    focus: "Technical",
    intent: "implementation detail, correctness, debugging, tradeoffs",
  },
  {
    id: "lead",
    title: "Tech Lead",
    shortTitle: "TL",
    focus: "System Design",
    intent: "architecture, scalability, reliability, decision-making",
  },
];

export const FOCUS_AREAS = [
  "Behavioral",
  "Data Structures",
  "System Design",
  "Frontend",
  "Backend",
  "Communication",
  "Leadership",
  "Debugging",
];

export const ROLE_PRESETS = [
  {
    id: "frontend",
    label: "Frontend",
    role: "Senior Frontend Engineer",
    level: "Senior",
    focusAreas: ["Frontend", "System Design", "Communication"],
    context: "Emphasize UI architecture, state management, performance, accessibility, and testing tradeoffs.",
  },
  {
    id: "backend",
    label: "Backend",
    role: "Senior Backend Engineer",
    level: "Senior",
    focusAreas: ["Backend", "System Design", "Debugging"],
    context: "Emphasize APIs, data modeling, reliability, observability, latency, and production debugging.",
  },
  {
    id: "fullstack",
    label: "Full-stack",
    role: "Full-stack Engineer",
    level: "Mid-level",
    focusAreas: ["Frontend", "Backend", "Communication"],
    context: "Emphasize product delivery, API boundaries, user experience, testing, and pragmatic tradeoffs.",
  },
  {
    id: "data",
    label: "Data",
    role: "Data Engineer",
    level: "Mid-level",
    focusAreas: ["Backend", "System Design", "Data Structures"],
    context: "Emphasize pipelines, schemas, data quality, batch and streaming reliability, and measurable impact.",
  },
  {
    id: "manager",
    label: "Manager",
    role: "Engineering Manager",
    level: "Staff",
    focusAreas: ["Behavioral", "Leadership", "Communication"],
    context: "Emphasize leadership, prioritization, conflict handling, coaching, delivery health, and team outcomes.",
  },
];

export const DEFAULT_SETUP = {
  role: "Senior Frontend Engineer",
  level: "Mid-level",
  difficulty: "Realistic",
  questionCount: 6,
  focusAreas: ["Behavioral", "Frontend", "System Design"],
  context: "",
};

const TECH_TERMS = [
  "api",
  "architecture",
  "cache",
  "complexity",
  "consistency",
  "database",
  "deployment",
  "latency",
  "observability",
  "queue",
  "scale",
  "schema",
  "security",
  "test",
  "tradeoff",
  "types",
];

const COMMUNICATION_MARKERS = [
  "because",
  "for example",
  "first",
  "second",
  "therefore",
  "tradeoff",
  "I would",
  "we",
  "impact",
  "result",
];

const QUALITY_ITEMS = [
  {
    id: "star",
    label: "STAR",
    hint: "Situation, action, and result are visible.",
  },
  {
    id: "specifics",
    label: "Specifics",
    hint: "Uses concrete implementation or project detail.",
  },
  {
    id: "tradeoffs",
    label: "Tradeoffs",
    hint: "Names risk, cost, alternative, or constraint.",
  },
  {
    id: "metrics",
    label: "Metrics",
    hint: "Includes a number, duration, scale, or impact signal.",
  },
  {
    id: "depth",
    label: "Depth",
    hint: "Long enough for a realistic interview signal.",
  },
];

const WEAK_AREA_FOCUS_MAP = {
  "Answer depth": ["Communication", "Behavioral"],
  "Concrete examples": ["Behavioral", "Communication"],
  Tradeoffs: ["System Design", "Leadership"],
  "Technical specificity": ["Backend", "System Design", "Debugging"],
  "Measurable impact": ["Communication", "Leadership"],
  "Technical Depth": ["System Design", "Backend", "Debugging"],
};

export function normalizeSetup(raw = {}) {
  const setup = { ...DEFAULT_SETUP, ...raw };
  const focusAreas = Array.isArray(setup.focusAreas)
    ? setup.focusAreas.filter((area) => FOCUS_AREAS.includes(area))
    : DEFAULT_SETUP.focusAreas;
  return {
    role: cleanText(setup.role, DEFAULT_SETUP.role).slice(0, 80),
    level: cleanText(setup.level, DEFAULT_SETUP.level),
    difficulty: cleanText(setup.difficulty, DEFAULT_SETUP.difficulty),
    questionCount: clamp(Number(setup.questionCount) || DEFAULT_SETUP.questionCount, 4, 8),
    focusAreas: focusAreas.length ? focusAreas : DEFAULT_SETUP.focusAreas,
    context: cleanText(setup.context, "").slice(0, 800),
  };
}

export function applyRolePreset(setup = DEFAULT_SETUP, presetId) {
  const preset = ROLE_PRESETS.find((item) => item.id === presetId);
  if (!preset) return normalizeSetup(setup);
  return normalizeSetup({
    ...setup,
    role: preset.role,
    level: preset.level,
    focusAreas: preset.focusAreas,
    context: preset.context,
  });
}

export function focusAreasFromWeakAreas(weakAreas = [], fallback = DEFAULT_SETUP.focusAreas) {
  const mapped = weakAreas.flatMap((area) => WEAK_AREA_FOCUS_MAP[area] || []);
  const focusAreas = unique(mapped).filter((area) => FOCUS_AREAS.includes(area));
  if (focusAreas.length) return focusAreas.slice(0, 4);
  return normalizeSetup({ focusAreas: fallback }).focusAreas;
}

export function setupFromWeakAreas(report, baseSetup = report?.setup || DEFAULT_SETUP) {
  const setup = normalizeSetup(baseSetup);
  const focusAreas = focusAreasFromWeakAreas(report?.weakAreas || [], setup.focusAreas);
  return normalizeSetup({
    ...setup,
    difficulty: setup.difficulty === "Warm-up" ? "Realistic" : setup.difficulty,
    focusAreas,
    context: [
      setup.context,
      report?.weakAreas?.length ? `Next mock should pressure-test: ${report.weakAreas.slice(0, 4).join(", ")}.` : "",
    ].filter(Boolean).join("\n\n").slice(0, 800),
  });
}

export function createInterview(rawSetup = {}, now = Date.now()) {
  const setup = normalizeSetup(rawSetup);
  const firstQuestion = makeQuestion({
    interviewer: "hr",
    competency: "Behavioral",
    text: `Tell us about a project or experience that makes you ready for a ${setup.role} role.`,
    followUp: false,
  });
  return {
    id: createId("int", now),
    setup,
    status: "active",
    startedAt: new Date(now).toISOString(),
    completedAt: null,
    questionIndex: 0,
    currentQuestion: firstQuestion,
    turns: [],
    liveScores: { communication: 0, technical: 0, readiness: 0 },
    weakAreas: [],
    agentSessionUuid: null,
    agentMode: "pending",
  };
}

export function createId(prefix = "id", seed = Date.now()) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${seed.toString(36)}-${random}`;
}

export function getInterviewer(id) {
  return INTERVIEWERS.find((person) => person.id === id) || INTERVIEWERS[0];
}

export function evaluateAnswer(answer, question, setup = DEFAULT_SETUP) {
  const text = cleanText(answer, "");
  const lower = text.toLowerCase();
  const words = tokenize(text);
  const wordCount = words.length;
  const hasExample = /for example|at my|in my|when i|we built|i built|project|situation/.test(lower);
  const hasMetric = /\b\d+[%x]?\b|latency|revenue|users|requests|minutes|hours|days/.test(lower);
  const hasTradeoff = /trade[- ]?off|however|but|constraint|risk|cost|alternative/.test(lower);
  const hasStructure = COMMUNICATION_MARKERS.reduce(
    (count, marker) => count + (lower.includes(marker.toLowerCase()) ? 1 : 0),
    0,
  );
  const technicalHits = TECH_TERMS.reduce(
    (count, term) => count + (lower.includes(term) ? 1 : 0),
    0,
  );
  const specificity = Math.min(24, Math.floor(wordCount / 12));
  const communication = clamp(
    34 + specificity + hasStructure * 5 + (hasExample ? 12 : 0) + (hasMetric ? 8 : 0),
    18,
    96,
  );
  const technicalBias = question?.interviewer === "engineer" || question?.interviewer === "lead" ? 8 : 0;
  const technical = clamp(
    28 + Math.min(30, technicalHits * 5) + specificity + technicalBias + (hasTradeoff ? 12 : 0),
    16,
    96,
  );
  const readiness = Math.round(communication * 0.45 + technical * 0.55);
  const weakAreas = [];
  if (wordCount < 70) weakAreas.push("Answer depth");
  if (!hasExample && question?.interviewer === "hr") weakAreas.push("Concrete examples");
  if (!hasTradeoff && question?.interviewer !== "hr") weakAreas.push("Tradeoffs");
  if (technicalHits < 2 && question?.interviewer !== "hr") weakAreas.push("Technical specificity");
  if (!hasMetric) weakAreas.push("Measurable impact");
  const strengths = [];
  if (hasStructure) strengths.push("Clear structure");
  if (hasExample) strengths.push("Grounded example");
  if (hasTradeoff) strengths.push("Tradeoff awareness");
  if (technicalHits >= 3) strengths.push("Technical vocabulary");
  if (hasMetric) strengths.push("Evidence of impact");
  return {
    summary: makeEvaluationSummary({ wordCount, hasExample, hasTradeoff, technicalHits, setup }),
    scores: { communication, technical, readiness },
    strengths: strengths.length ? strengths : ["Direct answer"],
    weakAreas: unique(weakAreas).slice(0, 4),
  };
}

export function analyzeAnswerQuality(answer = "") {
  const text = cleanText(answer, "");
  const lower = text.toLowerCase();
  const words = tokenize(text);
  const technicalHits = TECH_TERMS.reduce(
    (count, term) => count + (lower.includes(term) ? 1 : 0),
    0,
  );
  const hasSituation = /situation|when i|when we|project|incident|at my|in my/.test(lower);
  const hasAction = /i would|i did|we did|i built|we built|implemented|decided|led|created/.test(lower);
  const hasResult = /result|impact|improved|reduced|increased|saved|learned|shipped/.test(lower);
  const hasMetric = /\b\d+[%x]?\b|latency|revenue|users|requests|minutes|hours|days/.test(lower);
  const hasTradeoff = /trade[- ]?off|however|but|constraint|risk|cost|alternative/.test(lower);
  const itemState = {
    star: hasSituation && hasAction && hasResult,
    specifics: technicalHits >= 2 || /for example|because|api|database|component|test/.test(lower),
    tradeoffs: hasTradeoff,
    metrics: hasMetric,
    depth: words.length >= 70,
  };
  const items = QUALITY_ITEMS.map((item) => ({
    ...item,
    met: Boolean(itemState[item.id]),
  }));
  const completeCount = items.filter((item) => item.met).length;
  const score = clamp(completeCount * 18 + Math.min(10, Math.floor(words.length / 20)), 0, 100);
  return {
    wordCount: words.length,
    score,
    items,
  };
}

export function fallbackNextQuestion(interview, evaluation) {
  const setup = normalizeSetup(interview?.setup);
  const turns = Array.isArray(interview?.turns) ? interview.turns : [];
  const nextIndex = turns.length + 1;
  const weak = evaluation?.weakAreas?.[0] || "";
  const focus = setup.focusAreas[nextIndex % setup.focusAreas.length] || "Technical";
  const interviewer = chooseInterviewer(focus, nextIndex, weak);

  if (weak === "Concrete examples") {
    return makeQuestion({
      interviewer: "hr",
      competency: "Behavioral",
      text: "Can you walk through one specific situation, the action you took, and the result?",
      followUp: true,
    });
  }
  if (weak === "Tradeoffs") {
    return makeQuestion({
      interviewer: "lead",
      competency: "System Design",
      text: `What tradeoffs would you call out before shipping that solution for a ${setup.role} team?`,
      followUp: true,
    });
  }
  if (weak === "Technical specificity") {
    return makeQuestion({
      interviewer: "engineer",
      competency: "Technical",
      text: "Go one level deeper on implementation. What data structures, APIs, or failure cases would you handle first?",
      followUp: true,
    });
  }

  const templates = {
    hr: [
      `Describe a conflict or disagreement you handled while working toward a ${setup.role} outcome.`,
      "Tell us about a time you had to learn a new technical area quickly.",
    ],
    engineer: [
      `How would you debug a production issue in a ${setup.role} codebase when users report intermittent failures?`,
      "Explain a technical decision you made recently and how you validated it.",
    ],
    lead: [
      `Design a reliable interview-prep product feature for thousands of active candidates. What are the major components?`,
      `How would you break down a large ${setup.role} initiative across milestones and owners?`,
    ],
  };
  const list = templates[interviewer] || templates.engineer;
  return makeQuestion({
    interviewer,
    competency: getInterviewer(interviewer).focus,
    text: list[nextIndex % list.length],
    followUp: false,
  });
}

export function applyTurn(interview, answer, aiResult = null) {
  const currentQuestion = interview.currentQuestion;
  const localEvaluation = evaluateAnswer(answer, currentQuestion, interview.setup);
  const evaluation = normalizeEvaluation(aiResult?.evaluation, localEvaluation);
  const nextQuestion = normalizeQuestion(aiResult?.next_question)
    || fallbackNextQuestion({ ...interview, turns: [...interview.turns] }, evaluation);
  const turn = {
    id: createId("turn"),
    question: currentQuestion,
    answer: cleanText(answer, ""),
    evaluation,
    followUp: cleanText(aiResult?.follow_up, nextQuestion.followUp ? nextQuestion.text : ""),
    createdAt: new Date().toISOString(),
  };
  const turns = [...interview.turns, turn];
  const liveScores = averageScores(turns);
  const weakAreas = rankWeakAreas(turns).slice(0, 5);
  return {
    ...interview,
    turns,
    questionIndex: turns.length,
    currentQuestion: nextQuestion,
    liveScores,
    weakAreas,
  };
}

export function completeInterview(interview, now = Date.now()) {
  const turns = Array.isArray(interview?.turns) ? interview.turns : [];
  const liveScores = averageScores(turns);
  const weakAreas = rankWeakAreas(turns);
  const strengths = rankStrengths(turns);
  const studyPlan = buildStudyPlan({ weakAreas, strengths, setup: interview.setup, scores: liveScores });
  return {
    ...interview,
    status: "completed",
    completedAt: new Date(now).toISOString(),
    liveScores,
    weakAreas,
    strengths,
    studyPlan,
  };
}

export function buildStudyPlan({ weakAreas = [], strengths = [], setup = DEFAULT_SETUP, scores = {} }) {
  const role = normalizeSetup(setup).role;
  const prioritized = weakAreas.length ? weakAreas : ["Technical specificity", "Measurable impact", "Answer depth"];
  const tasks = prioritized.slice(0, 5).map((area, index) => {
    const action = studyActionFor(area, role);
    return {
      id: createId("task", Date.now() + index),
      area,
      action,
      effort: index < 2 ? "30 min" : "20 min",
      done: false,
    };
  });
  if ((scores.technical || 0) < 65) {
    tasks.push({
      id: createId("task"),
      area: "Technical Depth",
      action: `Run one focused technical drill for ${role} and explain the implementation out loud.`,
      effort: "45 min",
      done: false,
    });
  }
  return {
    headline: `Next practice plan for ${role}`,
    tasks: tasks.slice(0, 6),
    carryForward: strengths.slice(0, 3),
  };
}

export function aggregateProgress(history = []) {
  const completed = history.filter((item) => item.status === "completed");
  const totals = completed.reduce(
    (acc, item) => {
      acc.communication += item.liveScores?.communication || 0;
      acc.technical += item.liveScores?.technical || 0;
      acc.readiness += item.liveScores?.readiness || 0;
      return acc;
    },
    { communication: 0, technical: 0, readiness: 0 },
  );
  const count = completed.length || 1;
  return {
    completedCount: completed.length,
    averages: {
      communication: Math.round(totals.communication / count),
      technical: Math.round(totals.technical / count),
      readiness: Math.round(totals.readiness / count),
    },
    weakAreas: rankWeakAreas(completed.flatMap((item) => item.turns || [])).slice(0, 6),
    latest: completed[0] || null,
  };
}

export function parsePanelJson(text) {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  const direct = tryParseJson(trimmed);
  if (direct) return direct;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const parsed = tryParseJson(fenced[1]);
    if (parsed) return parsed;
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return tryParseJson(trimmed.slice(first, last + 1));
  return null;
}

export function buildAgentSystemPrompt(setup = DEFAULT_SETUP) {
  const normalized = normalizeSetup(setup);
  return [
    "You are an AI panel for a mock interview app.",
    "Roles: HR Manager for behavioral signals, Senior Engineer for technical depth, Tech Lead for system design and follow-ups.",
    "Adapt questions to the candidate's previous answer and target role.",
    "Return only strict JSON. Do not use markdown.",
    `Target role: ${normalized.role}. Level: ${normalized.level}. Difficulty: ${normalized.difficulty}.`,
    `Focus areas: ${normalized.focusAreas.join(", ")}.`,
    normalized.context ? `Role context: ${normalized.context}` : "",
  ].filter(Boolean).join("\n");
}

export function buildEvaluationPrompt(interview, answer) {
  const q = interview.currentQuestion;
  const history = interview.turns
    .slice(-4)
    .map((turn, index) => `${index + 1}. ${turn.question.interviewerTitle}: ${turn.question.text}\nAnswer: ${turn.answer.slice(0, 700)}`)
    .join("\n\n");
  return [
    "Evaluate this answer and choose the next adaptive panel question.",
    "Return JSON with this shape:",
    "{\"evaluation\":{\"summary\":\"...\",\"scores\":{\"communication\":0,\"technical\":0,\"readiness\":0},\"strengths\":[\"...\"],\"weakAreas\":[\"...\"]},\"follow_up\":\"...\",\"next_question\":{\"interviewer\":\"hr|engineer|lead\",\"text\":\"...\",\"competency\":\"...\"}}",
    `Current interviewer: ${q.interviewerTitle}`,
    `Current question: ${q.text}`,
    `Candidate answer: ${answer}`,
    history ? `Recent history:\n${history}` : "",
  ].filter(Boolean).join("\n\n");
}

export function buildOpeningPrompt(interview) {
  return [
    "Create the opening question for this mock interview.",
    "Return JSON with this shape:",
    "{\"next_question\":{\"interviewer\":\"hr|engineer|lead\",\"text\":\"...\",\"competency\":\"...\"},\"panel_note\":\"...\"}",
    `Target role: ${interview.setup.role}`,
    `Level: ${interview.setup.level}`,
    `Difficulty: ${interview.setup.difficulty}`,
    `Focus areas: ${interview.setup.focusAreas.join(", ")}`,
    interview.setup.context ? `Role context: ${interview.setup.context}` : "",
  ].filter(Boolean).join("\n\n");
}

export function formatDateTime(value) {
  if (!value) return "Not recorded";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

export function scoreLabel(value) {
  if (value >= 82) return "Strong";
  if (value >= 68) return "Ready";
  if (value >= 52) return "Developing";
  return "Needs work";
}

export function wordCount(text) {
  return tokenize(text).length;
}

function makeQuestion({ interviewer, competency, text, followUp }) {
  const person = getInterviewer(interviewer);
  return {
    id: createId("q"),
    interviewer: person.id,
    interviewerTitle: person.title,
    competency: competency || person.focus,
    text: cleanText(text, "Tell us how you would approach this problem."),
    followUp: Boolean(followUp),
  };
}

function normalizeQuestion(raw) {
  if (!raw || typeof raw !== "object" || !raw.text) return null;
  const id = ["hr", "engineer", "lead"].includes(raw.interviewer) ? raw.interviewer : "engineer";
  return makeQuestion({
    interviewer: id,
    competency: cleanText(raw.competency, getInterviewer(id).focus),
    text: raw.text,
    followUp: Boolean(raw.followUp || raw.follow_up),
  });
}

function normalizeEvaluation(raw, fallback) {
  if (!raw || typeof raw !== "object") return fallback;
  const scores = raw.scores || {};
  return {
    summary: cleanText(raw.summary, fallback.summary),
    scores: {
      communication: normalizeScore(scores.communication, fallback.scores.communication),
      technical: normalizeScore(scores.technical, fallback.scores.technical),
      readiness: normalizeScore(scores.readiness, fallback.scores.readiness),
    },
    strengths: normalizeList(raw.strengths, fallback.strengths),
    weakAreas: normalizeList(raw.weakAreas || raw.weak_areas, fallback.weakAreas),
  };
}

function normalizeScore(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  if (n <= 1) return clamp(n * 100, 0, 100);
  if (n <= 10) return clamp(n * 10, 0, 100);
  return clamp(n, 0, 100);
}

function averageScores(turns) {
  if (!turns.length) return { communication: 0, technical: 0, readiness: 0 };
  const totals = turns.reduce(
    (acc, turn) => {
      acc.communication += turn.evaluation?.scores?.communication || 0;
      acc.technical += turn.evaluation?.scores?.technical || 0;
      acc.readiness += turn.evaluation?.scores?.readiness || 0;
      return acc;
    },
    { communication: 0, technical: 0, readiness: 0 },
  );
  return {
    communication: Math.round(totals.communication / turns.length),
    technical: Math.round(totals.technical / turns.length),
    readiness: Math.round(totals.readiness / turns.length),
  };
}

function rankWeakAreas(turns) {
  const counts = countBy(turns.flatMap((turn) => turn.evaluation?.weakAreas || turn.weakAreas || []));
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([area]) => area);
}

function rankStrengths(turns) {
  const counts = countBy(turns.flatMap((turn) => turn.evaluation?.strengths || turn.strengths || []));
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([area]) => area);
}

function chooseInterviewer(focus, index, weak) {
  if (weak === "Concrete examples") return "hr";
  if (weak === "Tradeoffs") return "lead";
  if (focus === "Behavioral" || focus === "Communication" || focus === "Leadership") return "hr";
  if (focus === "System Design") return "lead";
  return index % 3 === 0 ? "lead" : "engineer";
}

function studyActionFor(area, role) {
  const actions = {
    "Answer depth": `Practice a two-minute STAR answer for a recent ${role} project, then add one decision and one result.`,
    "Concrete examples": "Prepare three reusable stories: conflict, ambiguity, and technical ownership.",
    "Tradeoffs": "For one architecture choice, list two alternatives, one risk, and the decision criteria.",
    "Technical specificity": `Review one ${role} implementation topic and explain APIs, data flow, and failure handling out loud.`,
    "Measurable impact": "Attach a number to each story: users, latency, incidents, revenue, time saved, or quality improved.",
    "Technical Depth": "Choose one system component and drill scalability, observability, and rollback strategy.",
  };
  return actions[area] || `Run a focused drill on ${area.toLowerCase()} for the ${role} interview loop.`;
}

function makeEvaluationSummary({ wordCount: count, hasExample, hasTradeoff, technicalHits, setup }) {
  if (count < 45) return "The answer is understandable but too brief for a realistic interview signal.";
  if (!hasExample) return "The answer has useful intent, but it needs a more concrete example.";
  if (setup.focusAreas.includes("System Design") && !hasTradeoff) {
    return "The answer is on track; add tradeoffs and failure cases to make it stronger.";
  }
  if (technicalHits >= 3) return "The answer gives the panel enough technical signal to continue deeper.";
  return "The answer is clear and can improve with more implementation detail.";
}

function normalizeList(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  const list = value.map((item) => cleanText(item, "")).filter(Boolean);
  return list.length ? unique(list).slice(0, 6) : fallback;
}

function countBy(items) {
  return items.filter(Boolean).reduce((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});
}

function tokenize(text) {
  return cleanText(text, "").match(/[A-Za-z0-9+#.-]+/g) || [];
}

function cleanText(value, fallback) {
  if (typeof value !== "string") return fallback;
  const text = value.replace(/\s+/g, " ").trim();
  return text || fallback;
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}
