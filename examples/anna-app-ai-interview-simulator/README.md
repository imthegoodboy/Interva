# Anna Interview Simulator

Anna Interview Simulator is a production-ready schema 2 Anna App for realistic mock interviews. It opens as a native Anna app window, runs a three-person interview panel, evaluates each answer, tracks progress across sessions, and turns weak areas into the next practice plan.

The product is built for job seekers, students, and engineers who need more than a static question bank. The app adapts to the target role, level, difficulty, focus areas, and role context, then uses Anna agent sessions for AI-generated panel questions and feedback. If Anna's agent session is unavailable, the app clearly reports the fallback state and keeps the interview moving with deterministic local scoring.

Current release target: `0.1.7`.

## Judge Quick Path

```powershell
cd examples\anna-app-ai-interview-simulator
npm install
npm run preflight
npm run preflight:real
```

`preflight` validates the deterministic app path. `preflight:real` runs Playwright against the Anna-backed local harness with real Anna agent-session access and APS storage.

The core flow to review:

1. Pick a role preset or enter a custom target role.
2. Start a mock interview.
3. Answer at least one panel question.
4. Confirm the answer coach, scoring, follow-up, report, study plan, and progress history work.
5. Use “Next mock” to turn weak areas into the next interview setup.

## What Is Inside

```text
anna-app-ai-interview-simulator/
├── app.json
├── manifest.json
├── bundle/
│   ├── index.html
│   ├── tokens.css
│   ├── style.css
│   ├── app.js
│   ├── interview-engine.js
│   ├── workspace-storage.js
│   └── icon.svg
├── fixtures/
│   └── happy-path.jsonl
├── tests/
│   ├── e2e-smoke.js
│   ├── interview-engine.spec.js
│   ├── manifest.spec.js
│   └── workspace-storage.spec.js
└── DEPLOY.md
```

## Product Features

- Role-specific mock interviews for frontend, backend, full-stack, data, and manager tracks.
- Custom target role, level, difficulty, question count, focus areas, and role context.
- Three-panel loop: HR Manager, Senior Engineer, and Tech Lead.
- Anna agent-powered adaptive questions and evaluations when running inside Anna.
- Deterministic fallback scoring that is clearly labeled when the agent is unavailable.
- Live answer coach for STAR structure, specifics, tradeoffs, metrics, and depth.
- Report generation with readiness scores, strengths, weak areas, question feedback, and study-plan tasks.
- Progress view with saved interview history, average scores, and recurring weak-area trends.
- Cloud persistence through Anna storage with compacted history to stay below app-storage limits.
- Chat artifact export for completed reports when Anna returns a valid artifact id.
- Tokenized, responsive UI with reduced-motion support and no external scripts or analytics.

## Anna Integration

- `schema: 2` static SPA bundle.
- `anna.agent.session` powers the adaptive AI panel when the app runs inside Anna.
- `anna.storage.get/set/list/delete` persists setup, active interview state, saved reports, and study-plan task completion.
- `anna.chat.append_artifact` can save a completed report back to the current Anna conversation.
- No provider API keys are stored in the bundle.
- No bundled Executa is required; schema 2 allows UI-only apps that rely on host APIs.

When the Anna agent session is unavailable or times out, the app shows a fallback status and uses deterministic local scoring so the mock can continue without pretending the fallback was AI-generated.

Saved report history is compacted before writing to Anna storage. This keeps the workspace under Anna's app-storage budget while preserving setup, scores, weak areas, study-plan tasks, and concise question feedback after reload.

The UI bundle is self-contained. It loads `tokens.css`, `style.css`, and local JavaScript modules only; the manifest does not allow external origins.

## Executa Distribution

This app intentionally does not ship an `executas/` directory because it does not invoke a custom tool through `anna.tools.invoke`. The interview engine runs in the UI with Anna agent-session synthesis and deterministic fallback scoring.

If a future version moves scoring, resume parsing, repository inspection, or another local capability into an Executa, that tool should be distributed as a binary: mint the real `tool_id`, keep the app manifest on the `bundled:<handle>` dependency, package platform archives with `bin/<tool_id>` and archive `manifest.json`, publish those archives through release assets, configure Binary distribution URLs on Anna, and verify the local Agent shows the tool as `Binary` and `Running`.

## Local Development

```powershell
cd examples\anna-app-ai-interview-simulator
npm install
npm test
npm run fixture:verify
npm run validate
npm run e2e
npm run e2e:real
npm run dev
```

For Anna-backed agent sessions and APS storage:

```powershell
npm run dev:real
```

Open the harness URL printed by `anna-app dev`.
This app uses `5190` for the offline harness and `5191` for the real Anna harness to avoid the lower ports commonly used by other examples.

Use the full local production gate before pushing a draft:

```powershell
npm run preflight
npm run preflight:real
```

`preflight` runs the deterministic offline harness. `preflight:real` also starts the Anna-backed harness on port `5191` with APS storage and longer Playwright timeouts.

Playwright screenshots are written to:

```text
test-results/e2e-smoke/
```

## Product Flow

1. Configure role, level, difficulty, question count, focus areas, and role context.
2. Use a role preset when a standard loop is enough.
3. Begin a panel interview.
4. Answer each question in the interview workspace while the answer coach tracks STAR, specifics, tradeoffs, metrics, and depth.
5. The panel evaluates the answer, scores it, identifies weak areas, and asks a follow-up or next question.
6. Completing the interview creates a report and personalized study plan.
7. Copy the study plan or start the next mock from weak areas.
8. Saved reports appear in Progress with aggregate weak-area trends.
9. The connection line shows whether the app is Anna-connected and whether storage is cloud-saved or using local backup.

## Privacy

Interview setup, scores, compact report history, and study-plan task state are stored through Anna app storage for the current app/user context. Long free-form answers are compacted in saved history to stay within Anna storage limits. The app does not embed third-party analytics, external scripts, or provider credentials.

## Release Notes

### 0.1.7

- Final Hallmark-guided UI polish with shared design tokens, clearer focus states, reduced-motion handling, and subtle non-layout motion.
- Added `tokens.css` to keep the visual system portable and explicit.
- Added Hallmark preflight/log records and explicit accent-ink token handling.
- Updated judge-facing documentation and release checklist.

### 0.1.6

- Published the first Hallmark-tokenized bundle candidate and updated the installed app path.

### 0.1.5

- Added compact Anna workspace storage and visible agent fallback states.
- Added real Anna/APS Playwright smoke coverage.
- Published as the stable baseline before the final UI polish pass.
