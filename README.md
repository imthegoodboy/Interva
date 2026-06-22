# Anna Interview Simulator

Anna Interview Simulator is a production-ready Anna App that runs a realistic mock interview inside Anna. It gives a candidate a configurable interview workspace, asks adaptive panel questions, evaluates answers, tracks weak areas, and turns the final report into a focused study plan for the next practice session.

The app is designed for job seekers, students, engineers, and technical interview candidates who need more than a static question bank. It supports role presets, custom roles, multiple difficulty levels, live answer coaching, report history, and Anna-backed persistence.

Current release: `0.1.7`.

Demo video link :https://youtu.be/fDhmv222eRw

## Status

- Anna app slug: `ai-interview-simulator`
- Package name: `anna-app-ai-interview-simulator`
- App type: schema 2 static SPA
- Runtime: browser UI hosted by Anna
- Custom Executa: none in this release
- Current release version: `0.1.7`
- Primary verification gate: `npm run preflight:real`

## What The App Does

Anna Interview Simulator guides the user through a complete mock interview loop:

1. The user selects a role preset or enters a custom target role.
2. The user chooses level, difficulty, question count, focus areas, and role context.
3. The app starts a panel interview.
4. The panel asks a role-specific opening question.
5. The user answers in a focused interview workspace.
6. The answer coach gives live structure signals while the user writes.
7. The app evaluates the submitted answer.
8. The next question adapts to the answer, weak areas, and target role.
9. The completed interview becomes a scored report.
10. The report creates a study plan and "next mock" setup based on weak areas.
11. Progress history persists through Anna storage so later sessions build on earlier ones.

## AI-Generated vs Deterministic Behavior

The app has two execution paths.

When running inside Anna with agent sessions available:

- Opening questions can be generated through `anna.agent.session`.
- Answer evaluations can be generated through `anna.agent.session`.
- Follow-up or next questions can adapt to the current answer and previous interview turns.
- The final report combines AI evaluation output with deterministic app-side normalization, scoring safeguards, and storage compaction.

When the Anna agent session is unavailable, offline, or times out:

- The app clearly marks the session as local fallback or standalone fallback.
- It keeps the interview moving with deterministic local question generation and scoring.
- It does not pretend fallback output was AI-generated.
- It still creates reports, study plans, and progress history.

Static data in the app:

- Role presets are static.
- Focus-area labels are static.
- Answer-coach checks are deterministic.
- Storage compaction rules are deterministic.

Dynamic data in the app:

- Anna-backed questions and evaluations are generated at runtime when the Anna agent bridge is available.
- Fallback questions and scores are computed from the current setup and answer content when Anna agent access is unavailable.

## Main Features

- Role presets for frontend, backend, full-stack, data, and engineering manager practice.
- Custom role input for any interview target.
- Configurable level, difficulty, focus areas, question count, and context.
- Three panel personas used by the interview engine: HR Manager, Senior Engineer, and Tech Lead.
- Live answer coach for STAR structure, specifics, tradeoffs, metrics, and answer depth.
- Adaptive follow-up and next-question loop.
- Scores for communication, technical depth, and readiness.
- Report page with strengths, weak areas, per-question feedback, and study-plan tasks.
- Progress page with saved report history and recurring weak-area trends.
- "Next mock" button that converts weak areas into the next interview setup.
- Study-plan copy action.
- Best-effort Anna chat artifact export for completed reports.
- Anna storage persistence with compacted report history.
- Local fallback mode for deterministic offline testing.
- Responsive UI for desktop and mobile app windows.
- Tokenized visual system in `bundle/tokens.css`.
- No external scripts, analytics, or provider API keys in the UI bundle.

## User Flow

### Setup

The setup view collects interview configuration:

- target role
- role level
- difficulty
- number of questions, clamped between 4 and 8
- focus areas
- optional role context

The role presets fill the form quickly, but the user can override the role or context before starting.

### Interview

The interview view contains:

- current question
- question timeline
- answer input
- live answer coach
- submitted-turn history
- active scoring state
- finish action

The answer coach updates while the user types. It checks for concrete structure and signal rather than trying to score the answer before submission.

### Report

The report view contains:

- readiness score
- communication score
- technical score
- strengths
- weak areas
- per-question evaluations
- personalized study plan
- next-practice setup
- copy-plan action
- optional chat artifact save action

### Progress

The progress view summarizes saved interviews:

- interview count
- average readiness
- recurring weak areas
- history list
- quick access to older reports

## Anna Integration

The app uses Anna host APIs through the schema 2 UI bundle.

Declared manifest permissions:

- `storage.read`
- `storage.write`
- `chat.append_artifact`

Declared host APIs:

- `anna.agent.session`
- `anna.storage.get`
- `anna.storage.set`
- `anna.storage.list`
- `anna.storage.delete`
- `anna.chat.append_artifact`
- `anna.window.set_title`

Important behavior:

- `anna.agent.session` powers adaptive questions and evaluations in the Anna-backed path.
- `anna.storage` saves setup, active interview state, report history, selected report id, and study-plan task state.
- `anna.chat.append_artifact` saves completed report summaries to the Anna conversation when available.
- The app does not call `anna.tools.invoke`.
- The app does not require an Executa binary in this release.
- The app keeps deterministic fallback available so local and judge testing can continue even if agent access is unavailable.

## Data And Storage

The workspace state is stored under one app-specific Anna storage snapshot. The app uses schema version `2` for saved state.

The saved snapshot contains:

- normalized setup
- current view
- current active interview
- selected report id
- compact report history

Storage guardrails:

- Target snapshot size: `210000` bytes.
- Hard budget used by tests: `240000` bytes.
- Report history is compacted before writing.
- The app first tries to keep up to 24 reports.
- If answers are too long, it gradually reduces retained report count and text length.
- Long answers are trimmed in saved history, but active in-memory interview flow can still use the full current answer during the session.

The storage module lives in:

```text
bundle/workspace-storage.js
```

## Project Structure

```text
anna-app-ai-interview-simulator/
├── app.json                         # Anna app listing metadata
├── manifest.json                    # Schema 2 app manifest and host API permissions
├── package.json                     # Scripts and test dependencies
├── package-lock.json                # Locked npm dependency graph
├── DEPLOY.md                        # Release checklist and Anna publish notes
├── README.md                        # Project documentation
├── fixtures/
│   └── happy-path.jsonl             # Anna fixture used by fixture verification
├── tests/
│   ├── e2e-smoke.js                 # Playwright smoke test for the full app flow
│   ├── interview-engine.spec.js     # Unit tests for scoring, setup, reports, study plan
│   ├── manifest.spec.js             # Manifest contract tests
│   └── workspace-storage.spec.js    # Storage compaction and budget tests
└── bundle/
    ├── index.html                   # Static app shell
    ├── tokens.css                   # Design tokens and visual system
    ├── style.css                    # Responsive app UI
    ├── app.js                       # UI controller and Anna bridge orchestration
    ├── interview-engine.js          # Interview, scoring, prompts, reports, study plan
    ├── workspace-storage.js         # Anna storage snapshot compaction
    └── icon.svg                     # App icon
```

## Key Files

### `manifest.json`

Defines the Anna runtime contract:

- schema version
- permissions
- host APIs
- app view size limits
- CSP restrictions
- static SPA entrypoint
- required and optional Executas

The current manifest intentionally has empty `required_executas` and `optional_executas`.

### `bundle/interview-engine.js`

Contains the domain logic:

- role presets
- focus areas
- setup normalization
- interview creation
- deterministic answer evaluation
- fallback next-question generation
- AI prompt builders
- AI result normalization
- report generation
- study-plan generation
- progress aggregation

### `bundle/app.js`

Owns the browser app behavior:

- view routing
- event handling
- Anna host API detection
- agent session creation and attachment
- timeout recovery
- storage load and save
- report artifact save
- toast messages
- UI rendering

### `bundle/workspace-storage.js`

Owns compact persistence:

- storage schema version
- snapshot generation
- report compaction
- score clamping
- text trimming
- byte-size calculation

### `tests/e2e-smoke.js`

Runs the judge-facing happy path:

- starts the Anna dev harness when needed
- loads the app
- verifies setup
- starts a mock interview
- checks the live answer coach
- submits an answer
- finishes the interview
- verifies report and study plan
- verifies progress history
- checks mobile viewport overflow
- captures screenshots under `test-results/e2e-smoke/`

## Local Development

Install dependencies:

```powershell
cd examples\anna-app-ai-interview-simulator
npm install
```

Run the offline deterministic harness:

```powershell
npm run dev
```

Run the Anna-backed harness with real agent/session and APS storage:

```powershell
npm run dev:real
```

The app uses these default ports:

- `5190` for offline deterministic development
- `5191` for Anna-backed real development

## Test Commands

Run unit tests:

```powershell
npm test
```

Verify fixtures:

```powershell
npm run fixture:verify
```

Validate Anna manifest and bundle contract:

```powershell
npm run validate
```

Run offline Playwright smoke test:

```powershell
npm run e2e
```

Run real Anna Playwright smoke test:

```powershell
npm run e2e:real
```

Run the full local gate:

```powershell
npm run preflight
```

Run the full Anna-backed release gate:

```powershell
npm run preflight:real
```

## Judge Quick Path

For judging or final acceptance, run:

```powershell
cd examples\anna-app-ai-interview-simulator
npm install
npm run preflight
npm run preflight:real
```

Then review this app flow:

1. Open the app in Anna.
2. Choose a preset such as Backend or Frontend.
3. Start a mock interview.
4. Answer one question with a realistic answer.
5. Confirm answer-coach signals update.
6. Submit the answer.
7. Finish the interview.
8. Confirm the report contains scores, weak areas, and a personalized study plan.
9. Confirm Progress shows the saved interview.
10. Use Next mock to load weak-area focus into a new setup.

## Deployment

Use production unless intentionally testing staging:

```powershell
$ANNA_HOST = "https://anna.partners"
cd examples\anna-app-ai-interview-simulator
```

Run preflight:

```powershell
npm install
npm run preflight
npm run preflight:real
anna-app whoami --json
```

Push a draft bundle:

```powershell
anna-app apps push --account $ANNA_HOST --json
```

Cut the current version:

```powershell
anna-app apps cut 0.1.7 --account $ANNA_HOST --json
```

Submit review:

```powershell
anna-app apps submit-review ai-interview-simulator --account $ANNA_HOST --json
anna-app apps status ai-interview-simulator --account $ANNA_HOST --json
```

After approval, release:

```powershell
anna-app apps release 0.1.7 --account $ANNA_HOST --json
```

If the CLI reports a contradictory lowercase-status release guard, verify the version and publish through the Anna Developer Console version table. See `DEPLOY.md` for the current workaround notes.

After publishing, reinstall or update the installed app in Anna and verify:

- latest version is `0.1.7`
- installed version is `0.1.7`
- update available is false
- bundle status is ready

## Executa Notes

This release intentionally has no custom Executa.

That is correct because:

- the UI does not call `anna.tools.invoke`
- the app uses `anna.agent.session` for AI behavior
- the app uses Anna storage for persistence
- the app uses chat artifacts for report export
- schema 2 supports UI-only apps

If a future version adds resume parsing, repository analysis, local file inspection, or heavyweight scoring through an Executa, follow the Anna binary distribution path:

1. Mint the real platform `tool_id`.
2. Keep app references on the bundled handle.
3. Package platform archives with `bin/<tool_id>`.
4. Include archive `manifest.json`.
5. Upload platform assets to a release.
6. Configure Binary URLs on Anna.
7. Reinstall on the local Agent.
8. Verify the tool shows `Binary` and `Running`.

## Privacy And Safety

- The bundle contains no provider API keys.
- The app does not send data to third-party analytics.
- The app does not load external scripts.
- CSP keeps scripts, styles, fonts, and images restricted to local bundle/data sources.
- Saved report history is compacted before storage.
- Chat artifact save is best-effort and only reports success when Anna returns an artifact id.
- If Anna agent access is unavailable, the app labels fallback mode instead of hiding it.

## Troubleshooting

### The app says local fallback or standalone fallback

This means the Anna agent session was unavailable, timed out, or the app is running in offline mode. Use:

```powershell
npm run dev:real
```

or:

```powershell
npm run e2e:real
```

to verify the Anna-backed path.

### The app does not save progress

Check whether the connection line reports cloud storage or local backup. In real Anna mode, verify `storage.read` and `storage.write` are still present in `manifest.json`.

### Reports disappear or history is shorter than expected

The app compacts history to stay within the Anna storage budget. Very long answers can reduce retained report count. This is expected and is covered by `workspace-storage.spec.js`.

### Release fails even though the app is approved or published

Some CLI versions have shown a contradictory lowercase-status release guard. Confirm the cut version exists with:

```powershell
anna-app apps status ai-interview-simulator --account https://anna.partners --json
anna-app apps versions ai-interview-simulator --account https://anna.partners --json
```

Then publish from the Anna Developer Console version table if needed.

### Playwright cannot open the live Anna page

The local browser profile may not be signed in. Use the authenticated Anna API and `npm run e2e:real` as the reliable release verification path, or sign in manually before browser-driven live checks.

## Release Notes

### 0.1.7

- Final Hallmark-guided UI polish with shared design tokens, clearer focus states, reduced-motion handling, and subtle non-layout motion.
- Added `tokens.css` to keep the visual system portable and explicit.
- Added Hallmark preflight/log records and explicit accent-ink token handling.
- Updated judge-facing documentation and release checklist.
- Published and installed as the current production version.

### 0.1.6

- Published the first Hallmark-tokenized bundle candidate and updated the installed app path.

### 0.1.5

- Added compact Anna workspace storage and visible agent fallback states.
- Added real Anna/APS Playwright smoke coverage.
- Published as the stable baseline before the final UI polish pass.
