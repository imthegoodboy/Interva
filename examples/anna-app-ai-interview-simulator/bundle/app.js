import {
  DEFAULT_SETUP,
  FOCUS_AREAS,
  INTERVIEWERS,
  ROLE_PRESETS,
  aggregateProgress,
  analyzeAnswerQuality,
  applyTurn,
  applyRolePreset,
  buildAgentSystemPrompt,
  buildEvaluationPrompt,
  buildOpeningPrompt,
  completeInterview,
  createInterview,
  formatDateTime,
  getInterviewer,
  setupFromWeakAreas,
  normalizeSetup,
  parsePanelJson,
  scoreLabel,
  wordCount,
} from "./interview-engine.js";

const STORAGE_KEY = "ai-interview-simulator:workspace:v1";
const MAX_HISTORY = 24;

const PAGE_META = {
  setup: {
    title: "Setup",
    subtitle: "Choose the target role and interview shape.",
  },
  interview: {
    title: "Interview",
    subtitle: "Answer the panel, get scored, and receive adaptive follow-ups.",
  },
  report: {
    title: "Report",
    subtitle: "Review readiness, weak areas, and a personalized study plan.",
  },
  progress: {
    title: "Progress",
    subtitle: "Track saved interviews and recurring improvement themes.",
  },
};

const emptyState = {
  setup: DEFAULT_SETUP,
  view: "setup",
  currentInterview: null,
  history: [],
  selectedReportId: null,
};

let state = clone(emptyState);
let anna = null;
let agentHandle = null;
let runtimeMode = "standalone";
let busyLabel = "";

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  bindEvents();
  renderStaticSetup();
  syncSetupForm();
  render();

  await connectAnna();
  state = hydrateState(await readWorkspace());
  syncSetupForm();
  render();
}

function cacheElements() {
  Object.assign(els, {
    navItems: Array.from(document.querySelectorAll(".nav-item")),
    views: Array.from(document.querySelectorAll(".view")),
    pageTitle: document.querySelector("#page-title"),
    pageSubtitle: document.querySelector("#page-subtitle"),
    setupForm: document.querySelector("#setup-form"),
    setupSummary: document.querySelector("#setup-summary"),
    setupStats: document.querySelector("#setup-stats"),
    rolePresetList: document.querySelector("#role-preset-list"),
    roleInput: document.querySelector("#role-input"),
    levelSelect: document.querySelector("#level-select"),
    difficultySelect: document.querySelector("#difficulty-select"),
    questionCountSelect: document.querySelector("#question-count-select"),
    contextInput: document.querySelector("#context-input"),
    focusAreaList: document.querySelector("#focus-area-list"),
    interviewerPreview: document.querySelector("#interviewer-preview"),
    quickStartBtn: document.querySelector("#quick-start-btn"),
    resetBtn: document.querySelector("#reset-demo-btn"),
    loadLastBtn: document.querySelector("#load-last-btn"),
    connectionDot: document.querySelector("#connection-dot"),
    connectionLabel: document.querySelector("#connection-label"),
    interviewStatusBand: document.querySelector("#interview-status-band"),
    questionTimeline: document.querySelector("#question-timeline"),
    panelStrip: document.querySelector("#panel-strip"),
    questionBand: document.querySelector("#question-band"),
    transcript: document.querySelector("#transcript"),
    answerForm: document.querySelector("#answer-form"),
    answerInput: document.querySelector("#answer-input"),
    answerHint: document.querySelector("#answer-hint"),
    finishInterviewBtn: document.querySelector("#finish-interview-btn"),
    submitAnswerBtn: document.querySelector("#submit-answer-btn"),
    answerCoach: document.querySelector("#answer-coach"),
    scoreStack: document.querySelector("#score-stack"),
    followupList: document.querySelector("#followup-list"),
    liveWeakAreaList: document.querySelector("#live-weak-area-list"),
    reportLayout: document.querySelector("#report-layout"),
    progressLayout: document.querySelector("#progress-layout"),
    toast: document.querySelector("#toast"),
  });
}

function bindEvents() {
  els.navItems.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  els.setupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    beginInterview();
  });
  els.setupForm.addEventListener("input", syncSetupDraft);
  els.setupForm.addEventListener("change", syncSetupDraft);
  els.rolePresetList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-preset-id]");
    if (!button) return;
    state.setup = applyRolePreset(readSetupForm(), button.dataset.presetId);
    syncSetupForm();
    renderSetupBlueprint();
    await persistWorkspace();
    showToast(`${button.textContent.trim()} preset applied.`);
  });
  els.quickStartBtn.addEventListener("click", () => {
    if (state.view === "interview" && state.currentInterview) {
      els.answerInput?.focus();
      return;
    }
    beginInterview();
  });
  els.resetBtn.addEventListener("click", resetWorkspace);
  els.loadLastBtn.addEventListener("click", () => {
    const latest = state.history[0];
    if (!latest) {
      showToast("No saved interviews yet.");
      return;
    }
    state.selectedReportId = latest.id;
    setView("report");
  });
  els.answerInput.addEventListener("input", () => {
    els.answerHint.textContent = `${wordCount(els.answerInput.value)} words`;
    renderAnswerCoach(state.currentInterview);
  });
  els.answerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAnswer();
  });
  els.finishInterviewBtn.addEventListener("click", () => finishInterview(false));
  els.reportLayout.addEventListener("click", handleReportClick);
  els.progressLayout.addEventListener("click", handleProgressClick);
  document.body.addEventListener("click", (event) => {
    const target = event.target.closest("[data-empty-target]");
    if (target) setView(target.dataset.emptyTarget);
  });
}

async function connectAnna() {
  try {
    const mod = await import("/static/anna-apps/_sdk/latest/index.js");
    anna = await mod.AnnaAppRuntime.connect();
    window.anna = anna;
    runtimeMode = "anna";
    updateConnection("Connected to Anna", true);
    await anna.window?.set_title?.({ title: "Anna Interview Simulator" });
  } catch (error) {
    anna = null;
    runtimeMode = "standalone";
    updateConnection("Standalone preview", false);
  }
}

function renderStaticSetup() {
  els.focusAreaList.innerHTML = FOCUS_AREAS.map((area) => `
    <label class="segment-option">
      <input type="checkbox" name="focusArea" value="${escapeHtml(area)}" />
      <span>${escapeHtml(area)}</span>
    </label>
  `).join("");

  els.rolePresetList.innerHTML = ROLE_PRESETS.map((preset) => `
    <button class="preset-button" type="button" data-preset-id="${escapeHtml(preset.id)}">
      ${escapeHtml(preset.label)}
    </button>
  `).join("");

  els.interviewerPreview.innerHTML = INTERVIEWERS.map((person) => `
    <div class="interviewer-line">
      <div class="avatar">${escapeHtml(person.shortTitle)}</div>
      <div>
        <strong>${escapeHtml(person.title)}</strong>
        <span>${escapeHtml(person.intent)}</span>
      </div>
    </div>
  `).join("");
}

function render() {
  const meta = PAGE_META[state.view] || PAGE_META.setup;
  els.pageTitle.textContent = meta.title;
  els.pageSubtitle.textContent = meta.subtitle;
  els.navItems.forEach((item) => item.classList.toggle("is-active", item.dataset.view === state.view));
  els.views.forEach((view) => view.classList.toggle("is-active", view.id === `view-${state.view}`));
  els.quickStartBtn.textContent = state.currentInterview ? "Resume mock" : "Start mock";

  renderSetupBlueprint();
  renderInterview();
  renderReport();
  renderProgress();
  syncSetupForm(false);
  document.body.classList.toggle("is-busy", Boolean(busyLabel));
}

function syncSetupForm(writeValues = true) {
  const setup = normalizeSetup(state.setup);
  if (writeValues) {
    els.roleInput.value = setup.role;
    els.levelSelect.value = setup.level;
    els.difficultySelect.value = setup.difficulty;
    els.questionCountSelect.value = String(setup.questionCount);
    els.contextInput.value = setup.context;
  }
  Array.from(els.focusAreaList.querySelectorAll("input[name='focusArea']")).forEach((input) => {
    input.checked = setup.focusAreas.includes(input.value);
  });
}

function syncSetupDraft() {
  state.setup = readSetupForm();
  renderSetupBlueprint();
  persistWorkspace();
}

function renderSetupBlueprint() {
  const setup = normalizeSetup(state.setup);
  els.setupSummary.textContent = `${setup.questionCount} ${setup.difficulty.toLowerCase()} questions for ${setup.level.toLowerCase()} ${setup.role} practice.`;
  els.setupStats.innerHTML = [
    statLine("Focus", setup.focusAreas.slice(0, 3).join(", ")),
    statLine("Mode", runtimeMode === "anna" ? "Anna agent" : "Standalone"),
    statLine("Saved", `${state.history.length} reports`),
  ].join("");
  Array.from(els.rolePresetList.querySelectorAll("[data-preset-id]")).forEach((button) => {
    const preset = ROLE_PRESETS.find((item) => item.id === button.dataset.presetId);
    const isActive = preset
      && setup.role === preset.role
      && preset.focusAreas.every((area) => setup.focusAreas.includes(area));
    button.classList.toggle("is-active", Boolean(isActive));
  });
}

function renderInterview() {
  const interview = state.currentInterview;
  if (!interview) {
    els.interviewStatusBand.innerHTML = emptyPanel(
      "No active interview",
      "Start a panel from Setup. Saved reports remain available in Report and Progress.",
      "Start mock",
      "setup",
    );
    els.questionTimeline.innerHTML = "";
    els.panelStrip.innerHTML = renderPanelStrip(null);
    els.questionBand.innerHTML = "";
    els.transcript.innerHTML = "";
    els.answerForm.hidden = true;
    renderLiveRails(null);
    return;
  }

  const total = interview.setup.questionCount;
  const answered = interview.turns.length;
  const progress = Math.round((answered / total) * 100);
  els.answerForm.hidden = false;
  els.submitAnswerBtn.disabled = Boolean(busyLabel);
  els.finishInterviewBtn.disabled = Boolean(busyLabel);
  els.interviewStatusBand.innerHTML = `
    <div>
      <div class="section-label">${escapeHtml(interview.setup.role)}</div>
      <strong>${answered}/${total} answered</strong>
    </div>
    <div class="thin-progress" aria-label="Interview progress">
      <span style="width:${progress}%"></span>
    </div>
    <div class="agent-mode">${escapeHtml(agentModeLabel(interview))}</div>
  `;
  els.questionTimeline.innerHTML = renderQuestionTimeline(interview);
  els.panelStrip.innerHTML = renderPanelStrip(interview.currentQuestion?.interviewer);
  els.questionBand.innerHTML = renderQuestion(interview.currentQuestion, answered + 1, total);
  els.transcript.innerHTML = renderTranscript(interview);
  renderLiveRails(interview);
}

function renderPanelStrip(activeId) {
  return INTERVIEWERS.map((person) => `
    <div class="panel-person ${person.id === activeId ? "is-active" : ""}">
      <div class="avatar">${escapeHtml(person.shortTitle)}</div>
      <div>
        <strong>${escapeHtml(person.title)}</strong>
        <span>${escapeHtml(person.focus)}</span>
      </div>
    </div>
  `).join("");
}

function renderQuestionTimeline(interview) {
  const total = interview.setup.questionCount;
  const answered = interview.turns.length;
  return Array.from({ length: total }, (_, index) => {
    const status = index < answered ? "complete" : index === answered ? "active" : "pending";
    const label = index < answered
      ? interview.turns[index]?.question?.interviewerTitle || "Answered"
      : index === answered
        ? interview.currentQuestion?.interviewerTitle || "Current question"
        : "Queued";
    return `
      <div class="timeline-step is-${status}">
        <span>${index + 1}</span>
        <strong>${escapeHtml(label)}</strong>
      </div>
    `;
  }).join("");
}

function renderQuestion(question, number, total) {
  if (!question) return "";
  return `
    <div class="question-meta">
      <span>Question ${number} of ${total}</span>
      <span>${escapeHtml(question.competency)}</span>
      ${question.followUp ? "<span>Follow-up</span>" : ""}
    </div>
    <h2>${escapeHtml(question.text)}</h2>
    <p>${escapeHtml(question.interviewerTitle)} is listening for specific decisions, evidence, and tradeoffs.</p>
  `;
}

function renderTranscript(interview) {
  if (!interview.turns.length) {
    return `
      <div class="empty-thread">
        <strong>The panel is ready.</strong>
        <span>Answer the opening question to begin scoring and adaptive follow-ups.</span>
      </div>
    `;
  }
  return interview.turns.map((turn, index) => `
    <article class="turn">
      <div class="turn-index">${index + 1}</div>
      <div class="turn-body">
        <div class="turn-question">
          <span>${escapeHtml(turn.question.interviewerTitle)}</span>
          <strong>${escapeHtml(turn.question.text)}</strong>
        </div>
        <p class="turn-answer">${escapeHtml(turn.answer)}</p>
        <div class="turn-eval">
          <strong>${escapeHtml(turn.evaluation.summary)}</strong>
          <span>${scorePill("Communication", turn.evaluation.scores.communication)}</span>
          <span>${scorePill("Technical", turn.evaluation.scores.technical)}</span>
        </div>
      </div>
    </article>
  `).join("");
}

function renderLiveRails(interview) {
  renderAnswerCoach(interview);
  const scores = interview?.liveScores || { communication: 0, technical: 0, readiness: 0 };
  els.scoreStack.innerHTML = [
    scoreRow("Communication", scores.communication),
    scoreRow("Technical Depth", scores.technical),
    scoreRow("Readiness", scores.readiness),
  ].join("");

  const lastTurn = interview?.turns?.[interview.turns.length - 1];
  els.followupList.innerHTML = `
    <div class="rail-block">
      <strong>Follow-up</strong>
      <p>${escapeHtml(lastTurn?.followUp || interview?.currentQuestion?.text || "The next adaptive prompt will appear after the first answer.")}</p>
    </div>
  `;

  const weakAreas = interview?.weakAreas || [];
  els.liveWeakAreaList.innerHTML = `
    <div class="rail-block">
      <strong>Weak Areas</strong>
      ${weakAreas.length
        ? `<ul>${weakAreas.map((area) => `<li>${escapeHtml(area)}</li>`).join("")}</ul>`
        : "<p>No weak-area trend yet.</p>"}
    </div>
  `;
}

function renderAnswerCoach(interview) {
  const quality = analyzeAnswerQuality(els.answerInput?.value || "");
  if (!interview) {
    els.answerCoach.innerHTML = `
      <div class="coach-meter" aria-label="Answer readiness">
        <span style="width:0%"></span>
      </div>
      <p class="muted-line">Start a mock to activate answer coaching.</p>
    `;
    return;
  }
  els.answerCoach.innerHTML = `
    <div class="coach-meter" aria-label="Answer readiness">
      <span style="width:${quality.score}%"></span>
    </div>
    <div class="coach-count">${quality.wordCount} words</div>
    <div class="coach-list">
      ${quality.items.map((item) => `
        <div class="coach-row ${item.met ? "is-met" : ""}">
          <span class="coach-dot" aria-hidden="true"></span>
          <div>
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(item.hint)}</small>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderReport() {
  const report = selectedReport();
  if (!report) {
    els.reportLayout.innerHTML = emptyPanel(
      "No interview report yet",
      "Complete a mock interview to generate scores, feedback, weak areas, and a study plan.",
      "Start mock",
      "setup",
    );
    return;
  }
  const scores = report.liveScores || { communication: 0, technical: 0, readiness: 0 };
  const tasks = report.studyPlan?.tasks || [];
  els.reportLayout.innerHTML = `
    <section class="report-main">
      <div class="report-heading">
        <div>
          <div class="section-label">Interview Report</div>
          <h2>${escapeHtml(report.setup.role)}</h2>
          <p>${escapeHtml(formatDateTime(report.completedAt || report.startedAt))} · ${report.turns.length} answered</p>
        </div>
        <div class="readiness-number">
          <span>${scores.readiness}</span>
          <small>${escapeHtml(scoreLabel(scores.readiness))}</small>
        </div>
      </div>
      <div class="score-band">
        ${scoreRow("Communication", scores.communication)}
        ${scoreRow("Technical Depth", scores.technical)}
        ${scoreRow("Overall Readiness", scores.readiness)}
      </div>
      <div class="feedback-columns">
        <section>
          <div class="section-label">Strengths</div>
          ${listOrEmpty(report.strengths, "Strengths will appear as the panel gathers signal.")}
        </section>
        <section>
          <div class="section-label">Weak Areas</div>
          ${listOrEmpty(report.weakAreas, "No recurring weak areas detected.")}
        </section>
      </div>
      <div class="turn-review">
        <div class="section-label">Question Feedback</div>
        ${report.turns.map((turn, index) => `
          <details ${index === 0 ? "open" : ""}>
            <summary>${index + 1}. ${escapeHtml(turn.question.interviewerTitle)} · ${escapeHtml(turn.question.competency)}</summary>
            <p>${escapeHtml(turn.evaluation.summary)}</p>
            <div>${scorePill("Communication", turn.evaluation.scores.communication)} ${scorePill("Technical", turn.evaluation.scores.technical)}</div>
          </details>
        `).join("")}
      </div>
    </section>
    <aside class="study-plan">
      <div class="section-label">Personalized Study Plan</div>
      <h3>${escapeHtml(report.studyPlan?.headline || "Next practice plan")}</h3>
      <div class="task-list">
        ${tasks.map((task, index) => `
          <label class="task-row">
            <input type="checkbox" data-task-index="${index}" ${task.done ? "checked" : ""} />
            <span>
          <strong>${escapeHtml(task.area)}</strong>
          <small>${escapeHtml(task.action)} · ${escapeHtml(task.effort)}</small>
        </span>
      </label>
        `).join("")}
      </div>
      <div class="next-practice-line">
        <span>Next practice</span>
        <strong>${escapeHtml(setupFromWeakAreas(report).focusAreas.join(", "))}</strong>
      </div>
      <div class="study-plan-actions">
        <button class="primary-button" type="button" data-action="new-interview">Next mock</button>
        <button class="ghost-button" type="button" data-action="copy-plan">Copy study plan</button>
        <button class="ghost-button" type="button" data-action="append-artifact">Save to chat</button>
      </div>
    </aside>
  `;
}

function renderProgress() {
  const progress = aggregateProgress(state.history);
  els.progressLayout.innerHTML = `
    <section class="progress-summary">
      <div>
        <div class="section-label">Saved Interviews</div>
        <strong>${progress.completedCount}</strong>
        <span>Total completed</span>
      </div>
      <div>${scoreRow("Avg Communication", progress.averages.communication)}</div>
      <div>${scoreRow("Avg Technical", progress.averages.technical)}</div>
      <div>${scoreRow("Avg Readiness", progress.averages.readiness)}</div>
    </section>
    <section class="history-timeline">
      <div class="section-label">Interview History</div>
      ${state.history.length ? state.history.map((item) => `
        <button class="history-row" type="button" data-report-id="${escapeHtml(item.id)}">
          <span>${escapeHtml(formatDateTime(item.completedAt || item.startedAt))}</span>
          <strong>${escapeHtml(item.setup.role)}</strong>
          <small>${item.liveScores?.readiness || 0} readiness · ${item.turns.length} answers</small>
        </button>
      `).join("") : "<p class=\"muted-line\">No saved interviews yet.</p>"}
    </section>
    <aside class="progress-weakness">
      <div class="section-label">Recurring Weak Areas</div>
      ${progress.weakAreas.length ? listOrEmpty(progress.weakAreas, "") : "<p class=\"muted-line\">Finish more interviews to see trends.</p>"}
    </aside>
  `;
}

async function beginInterview() {
  state.setup = readSetupForm();
  const interview = createInterview(state.setup);
  state.currentInterview = interview;
  state.selectedReportId = null;
  state.view = "interview";
  els.answerInput.value = "";
  els.answerHint.textContent = "0 words";
  await persistWorkspace();
  render();
  scrollActiveViewToTop();

  setBusy("Preparing panel...");
  try {
    let result = null;
    try {
      result = await runPanelAgent(interview, buildOpeningPrompt(interview));
    } catch {
      result = null;
    }
    const question = result?.next_question ? normalizeAgentQuestion(result.next_question) : null;
    if (question && state.currentInterview?.id === interview.id) {
      state.currentInterview.currentQuestion = question;
      state.currentInterview.agentMode = "anna-agent";
    } else if (state.currentInterview?.id === interview.id) {
      state.currentInterview.agentMode = anna ? "local-fallback" : "standalone";
    }
    await persistWorkspace();
  } finally {
    setBusy("");
    render();
  }
}

async function submitAnswer() {
  const interview = state.currentInterview;
  const answer = els.answerInput.value.trim();
  if (!interview) {
    showToast("Start an interview first.");
    return;
  }
  if (wordCount(answer) < 18) {
    showToast("Give the panel a fuller answer before submitting.");
    return;
  }

  setBusy("Evaluating answer...");
  render();
  try {
    let aiResult = null;
    try {
      aiResult = await runPanelAgent(interview, buildEvaluationPrompt(interview, answer));
    } catch {
      aiResult = null;
    }
    const next = applyTurn(interview, answer, aiResult);
    next.agentMode = aiResult ? "anna-agent" : (anna ? "local-fallback" : "standalone");
    state.currentInterview = next;
    els.answerInput.value = "";
    els.answerHint.textContent = "0 words";
    if (next.turns.length >= next.setup.questionCount) {
      await finishInterview(true, next);
      return;
    }
    await persistWorkspace();
  } finally {
    setBusy("");
    render();
  }
}

async function finishInterview(autoComplete = false, sourceInterview = null) {
  const interview = sourceInterview || state.currentInterview;
  if (!interview) {
    showToast("No active interview to finish.");
    return;
  }
  if (!autoComplete && interview.turns.length === 0) {
    showToast("Answer at least one question before finishing.");
    return;
  }
  const completed = completeInterview(interview);
  state.history = [completed, ...state.history.filter((item) => item.id !== completed.id)].slice(0, MAX_HISTORY);
  state.selectedReportId = completed.id;
  state.currentInterview = null;
  state.view = "report";
  agentHandle = null;
  await persistWorkspace();
  render();
  scrollActiveViewToTop();
  appendReportArtifact(completed);
}

async function runPanelAgent(interview, prompt) {
  if (!anna?.agent?.session) return null;
  const handle = await ensureAgentSession(interview);
  if (!handle?.run) return null;
  let text = "";
  const stream = handle.run({ content: prompt });
  for await (const frame of stream) {
    text += extractStreamText(frame);
  }
  return parsePanelJson(text);
}

function extractStreamText(frame) {
  if (!frame) return "";
  if (typeof frame === "string") return frame;
  if (frame.event === "token" && frame.text) return frame.text;
  if (frame.event === "message" && frame.content) return frame.content;
  if (frame.text && frame.event !== "raw") return frame.text;

  const payload = frame.payload || frame;
  if (payload.event === "raw" || payload.event === "end") return "";
  if (typeof payload.text === "string" && payload.event !== "raw") return payload.text;
  if (typeof payload.delta?.content === "string") return payload.delta.content;

  const choices = payload.choices || frame.choices;
  if (Array.isArray(choices)) {
    return choices.map((choice) => {
      const delta = choice?.delta || {};
      if (typeof delta.content === "string") return delta.content;
      if (typeof choice?.text === "string") return choice.text;
      if (typeof choice?.message?.content === "string") return choice.message.content;
      return "";
    }).join("");
  }
  return "";
}

async function ensureAgentSession(interview) {
  if (agentHandle) return agentHandle;
  if (interview.agentSessionUuid && anna.agent.session.attach) {
    agentHandle = anna.agent.session.attach(interview.agentSessionUuid);
    return agentHandle;
  }
  agentHandle = await anna.agent.session({
    submode: "auto",
    system_prompt: buildAgentSystemPrompt(interview.setup),
  });
  if (agentHandle?.app_session_uuid) {
    interview.agentSessionUuid = agentHandle.app_session_uuid;
    state.currentInterview = interview;
    await persistWorkspace();
  }
  return agentHandle;
}

function readSetupForm() {
  const focusAreas = Array.from(els.focusAreaList.querySelectorAll("input[name='focusArea']:checked"))
    .map((input) => input.value);
  return normalizeSetup({
    role: els.roleInput.value,
    level: els.levelSelect.value,
    difficulty: els.difficultySelect.value,
    questionCount: Number(els.questionCountSelect.value),
    focusAreas,
    context: els.contextInput.value,
  });
}

function setView(view) {
  if (!PAGE_META[view]) return;
  if (view === "interview" && !state.currentInterview) {
    showToast("Start or resume an interview from Setup.");
  }
  state.view = view;
  render();
  scrollActiveViewToTop();
  persistWorkspace();
}

async function resetWorkspace() {
  const ok = window.confirm("Clear local interview simulator state?");
  if (!ok) return;
  state = clone(emptyState);
  agentHandle = null;
  try {
    await anna?.storage?.delete?.({ key: STORAGE_KEY });
  } catch {
    // Local preview or older host.
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be blocked.
  }
  syncSetupForm();
  render();
}

function handleReportClick(event) {
  const actionButton = event.target.closest("[data-action]");
  if (actionButton?.dataset.action === "new-interview") {
    const report = selectedReport();
    state.setup = setupFromWeakAreas(report);
    syncSetupForm();
    setView("setup");
    showToast("Next mock focus areas loaded.");
    return;
  }
  if (actionButton?.dataset.action === "copy-plan") {
    const report = selectedReport();
    if (report) copyStudyPlan(report);
    return;
  }
  if (actionButton?.dataset.action === "append-artifact") {
    const report = selectedReport();
    if (report) appendReportArtifact(report, true);
    return;
  }
  const taskInput = event.target.closest("input[data-task-index]");
  if (taskInput) {
    toggleTask(Number(taskInput.dataset.taskIndex), taskInput.checked);
  }
}

function handleProgressClick(event) {
  const row = event.target.closest("[data-report-id]");
  if (!row) return;
  state.selectedReportId = row.dataset.reportId;
  setView("report");
}

async function toggleTask(index, done) {
  const report = selectedReport();
  if (!report?.studyPlan?.tasks?.[index]) return;
  report.studyPlan.tasks[index].done = done;
  state.history = state.history.map((item) => item.id === report.id ? report : item);
  await persistWorkspace();
  renderReport();
}

async function copyStudyPlan(report) {
  const tasks = report.studyPlan?.tasks || [];
  const text = [
    `Study plan for ${report.setup.role}`,
    `Readiness: ${report.liveScores?.readiness || 0}/100`,
    report.weakAreas?.length ? `Weak areas: ${report.weakAreas.join(", ")}` : "",
    "",
    ...tasks.map((task, index) => `${index + 1}. ${task.area}: ${task.action} (${task.effort})`),
  ].filter((line, index, lines) => line || lines[index - 1]).join("\n");
  try {
    await navigator.clipboard?.writeText?.(text);
    showToast("Study plan copied.");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    showToast("Study plan copied.");
  }
}

async function appendReportArtifact(report, explicit = false) {
  if (!anna?.chat?.append_artifact) {
    if (explicit) showToast("Chat artifacts are available inside Anna.");
    return;
  }
  try {
    await anna.chat.append_artifact({
      kind: "app_event",
      summary: `AI Interview Simulator report for ${report.setup.role}: ${report.liveScores.readiness}/100 readiness.`,
      payload: {
        app: "ai-interview-simulator",
        report_id: report.id,
        role: report.setup.role,
        scores: report.liveScores,
        weak_areas: report.weakAreas,
        study_plan: report.studyPlan,
      },
    });
    if (explicit) showToast("Report saved to chat.");
  } catch (error) {
    if (explicit) showToast(`Could not save artifact: ${error?.message || error}`);
  }
}

async function readWorkspace() {
  if (anna?.storage?.get) {
    try {
      const result = await anna.storage.get({ key: STORAGE_KEY });
      if (result?.value) return result.value;
    } catch {
      // Fall through to browser storage.
    }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function persistWorkspace() {
  const snapshot = {
    setup: normalizeSetup(state.setup),
    view: state.view,
    currentInterview: state.currentInterview,
    history: state.history.slice(0, MAX_HISTORY),
    selectedReportId: state.selectedReportId,
  };
  if (anna?.storage?.set) {
    try {
      await anna.storage.set({ key: STORAGE_KEY, value: snapshot });
    } catch {
      // Browser storage keeps standalone preview usable.
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore quota/private-mode failures.
  }
}

function hydrateState(value) {
  if (!value || typeof value !== "object") return clone(emptyState);
  return {
    setup: normalizeSetup(value.setup),
    view: PAGE_META[value.view] ? value.view : "setup",
    currentInterview: value.currentInterview || null,
    history: Array.isArray(value.history) ? value.history.slice(0, MAX_HISTORY) : [],
    selectedReportId: value.selectedReportId || value.history?.[0]?.id || null,
  };
}

function selectedReport() {
  return state.history.find((item) => item.id === state.selectedReportId) || state.history[0] || null;
}

function updateConnection(label, connected) {
  els.connectionLabel.textContent = label;
  els.connectionDot.classList.toggle("status-dot--online", connected);
  els.connectionDot.classList.toggle("status-dot--offline", !connected);
}

function setBusy(label) {
  busyLabel = label || "";
  if (busyLabel) {
    showToast(busyLabel, 1200);
  } else {
    window.clearTimeout(showToast.timer);
    els.toast.hidden = true;
  }
}

function showToast(message, timeout = 2400) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.hidden = true;
  }, timeout);
}

function scrollActiveViewToTop() {
  requestAnimationFrame(() => {
    const active = document.querySelector(".view.is-active");
    if (active) active.scrollTop = 0;
    const workspace = document.querySelector(".workspace");
    if (workspace) workspace.scrollTop = 0;
  });
}

function normalizeAgentQuestion(raw) {
  if (!raw?.text) return null;
  const id = ["hr", "engineer", "lead"].includes(raw.interviewer) ? raw.interviewer : "engineer";
  const person = getInterviewer(id);
  return {
    id: `q-${Date.now().toString(36)}`,
    interviewer: id,
    interviewerTitle: person.title,
    competency: raw.competency || person.focus,
    text: raw.text,
    followUp: Boolean(raw.followUp || raw.follow_up),
  };
}

function agentModeLabel(interview) {
  if (busyLabel) return busyLabel;
  if (interview.agentMode === "anna-agent") return "Anna agent active";
  if (interview.agentMode === "local-fallback") return "Local scoring fallback";
  if (runtimeMode === "anna") return "Anna agent ready";
  return "Standalone fallback";
}

function scoreRow(label, value = 0) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value || 0)));
  return `
    <div class="score-row">
      <div>
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(scoreLabel(safeValue))}</span>
      </div>
      <div class="score-track" aria-label="${escapeHtml(label)} ${safeValue} out of 100">
        <span style="width:${safeValue}%"></span>
      </div>
      <b>${safeValue}</b>
    </div>
  `;
}

function statLine(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function scorePill(label, value) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value || 0)));
  return `<span class="score-pill">${escapeHtml(label)} ${safeValue}</span>`;
}

function listOrEmpty(items = [], emptyText) {
  if (!items.length) return `<p class="muted-line">${escapeHtml(emptyText)}</p>`;
  return `<ul class="plain-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function emptyPanel(title, body, actionLabel, targetView) {
  return `
    <div class="empty-panel">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
      <button class="primary-button" type="button" data-empty-target="${escapeHtml(targetView)}">${escapeHtml(actionLabel)}</button>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
