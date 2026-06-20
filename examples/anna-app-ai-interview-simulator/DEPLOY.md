# Deploy AI Interview Simulator

Use production unless intentionally testing staging:

```powershell
$HOST = "https://anna.partners"
cd examples\anna-app-ai-interview-simulator
```

## Preflight

```powershell
npm install
npm test
npm run validate
anna-app whoami --json
```

The manifest is a schema 2 UI app with no bundled Executas. It uses:

- `storage.read`
- `storage.write`
- `chat.append_artifact`
- `ui.host_api.agent.session.auto`

## Local Preview

Offline UI and deterministic fallback:

```powershell
anna-app dev --port 5190 --no-llm
```

Anna agent sessions and APS storage:

```powershell
anna-app dev --port 5191 --llm-account https://anna.partners --storage aps
```

## Push, Cut, Review

```powershell
anna-app apps push --account $HOST --json
anna-app apps cut 0.1.0 --account $HOST --json
anna-app apps submit-review ai-interview-simulator --account $HOST --json
anna-app apps status ai-interview-simulator --account $HOST --json
```

After approval:

```powershell
anna-app apps release 0.1.0 --account $HOST --json
```

## Review Checklist

- `npm test` passes.
- `anna-app validate --strict` passes.
- App loads at desktop and mobile widths.
- Setup, Interview, Report, and Progress pages are reachable.
- Agent-backed flow works with `dev:real`, and local fallback works with `--no-llm`.
- Completed reports persist after reload.
- Chat artifact saving is best-effort and never claims success unless Anna returns an artifact id.
