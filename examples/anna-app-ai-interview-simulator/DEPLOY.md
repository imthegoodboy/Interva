# Deploy Anna Interview Simulator

Use production unless intentionally testing staging:

```powershell
$ANNA_HOST = "https://anna.partners"
cd examples\anna-app-ai-interview-simulator
```

## Preflight

```powershell
npm install
npm run preflight
npm run preflight:real
anna-app whoami --json
```

The manifest is a schema 2 UI app with no bundled Executas. It uses:

- `storage.read`
- `storage.write`
- `chat.append_artifact`
- `ui.host_api.agent.session.auto`

No Executa binary is required for this release because the bundle never calls `anna.tools.invoke`. If a future release adds a custom Executa, follow the binary distribution path before review: minted `tool_id`, platform archives, archive `manifest.json`, Binary distribution URLs, and Agent verification as `Binary` / `Running`.

The app compacts saved report history before writing to Anna storage so one workspace key remains below the platform storage budget. If cloud persistence fails, the connection line reports local backup mode.

## Local Preview

Offline UI and deterministic fallback:

```powershell
anna-app dev --port 5190 --no-llm
```

Anna agent sessions and APS storage:

```powershell
anna-app dev --port 5191 --llm-account https://anna.partners --storage aps
```

Automated real-harness smoke test:

```powershell
npm run e2e:real
```

## Push, Cut, Review

```powershell
anna-app apps push --account $ANNA_HOST --json
anna-app apps cut 0.1.5 --account $ANNA_HOST --json
anna-app apps submit-review ai-interview-simulator --account $ANNA_HOST --json
anna-app apps status ai-interview-simulator --account $ANNA_HOST --json
```

After approval:

```powershell
anna-app apps release 0.1.5 --account $ANNA_HOST --json
```

## Review Checklist

- `npm test` passes.
- `npm run fixture:verify` passes.
- `anna-app validate --strict` passes.
- `npm run e2e` passes against the Anna dev harness.
- `npm run e2e:real` passes against Anna-hosted LLM/session and APS storage.
- App loads at desktop and mobile widths.
- Setup, Interview, Report, and Progress pages are reachable.
- Agent-backed flow works with `dev:real`, and local fallback works with `--no-llm`.
- No custom Executa is declared or invoked; if this changes, binary packaging is required before review.
- Completed compact reports persist after reload without exceeding Anna storage limits.
- Chat artifact saving is best-effort and never claims success unless Anna returns an artifact id.
- After publishing a new version, open Installed Apps and update/reinstall Anna Interview Simulator so the account is on the latest `is_latest` version before final browser QA.
