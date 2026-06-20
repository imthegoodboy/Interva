# AI Interview Simulator

AI Interview Simulator is a schema 2 Anna App that runs a multi-agent mock interview panel in a native app window. The HR Manager, Senior Engineer, and Tech Lead panel asks adaptive questions, evaluates answers, scores communication and technical depth, identifies weak areas, saves progress, and creates a personalized study plan.

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

When the Anna agent session is unavailable, the app falls back to deterministic local scoring so local preview and offline QA still exercise the full UI flow.

## Local Development

```powershell
cd examples\anna-app-ai-interview-simulator
npm install
npm test
npm run validate
npm run dev
```

For Anna-backed agent sessions and APS storage:

```powershell
npm run dev:real
```

Open the harness URL printed by `anna-app dev`.
This app uses `5190` for the offline harness and `5191` for the real Anna harness to avoid the lower ports commonly used by other examples.

## Product Flow

1. Configure role, level, difficulty, question count, focus areas, and role context.
2. Begin a panel interview.
3. Answer each question in the interview workspace.
4. The panel evaluates the answer, scores it, identifies weak areas, and asks a follow-up or next question.
5. Completing the interview creates a report and personalized study plan.
6. Saved reports appear in Progress with aggregate weak-area trends.

## Privacy

Interview setup, answers, scores, reports, and task state are stored through Anna app storage for the current app/user context. The app does not embed third-party analytics, external scripts, or provider credentials.
