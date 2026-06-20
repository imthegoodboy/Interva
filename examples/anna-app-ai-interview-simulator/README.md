# Anna Interview Simulator

Anna Interview Simulator is a schema 2 Anna App that runs a multi-agent mock interview panel in a native app window. The HR Manager, Senior Engineer, and Tech Lead panel asks adaptive questions, evaluates answers, scores communication and technical depth, identifies weak areas, saves progress, and creates a personalized study plan.

## What Is Inside

```text
anna-app-ai-interview-simulator/
├── app.json
├── manifest.json
├── bundle/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── interview-engine.js
│   └── icon.svg
├── fixtures/
│   └── happy-path.jsonl
├── tests/
│   ├── e2e-smoke.js
│   ├── interview-engine.spec.js
│   └── manifest.spec.js
└── DEPLOY.md
```

## Anna Integration

- `schema: 2` static SPA bundle.
- `anna.agent.session` powers the adaptive AI panel when the app runs inside Anna.
- `anna.storage.get/set/list/delete` persists setup, active interview state, saved reports, and study-plan task completion.
- `anna.chat.append_artifact` can save a completed report back to the current Anna conversation.
- No provider API keys are stored in the bundle.
- No bundled Executa is required; schema 2 allows UI-only apps that rely on host APIs.

When the Anna agent session is unavailable or times out, the app shows a fallback status and uses deterministic local scoring so the mock can continue without pretending the fallback was AI-generated.

Saved report history is compacted before writing to Anna storage. This keeps the workspace under Anna's app-storage budget while preserving setup, scores, weak areas, study-plan tasks, and concise question feedback after reload.

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
