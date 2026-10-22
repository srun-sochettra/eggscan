# Contributing to EggScan

Keep changes focused on a reproducible issue or a concrete user benefit. Read the [README](README.md) and [architecture notes](docs/architecture.md) first.

## Choose the implementation path

The frontend contains the React application and Cloudflare Worker API. The Java backend remains a separate retained implementation. State which path a change affects; do not silently assume a fix in one changes the other.

## Local checks

Follow the README setup, including local credentials and the local D1 migration. From frontend/, run:

```powershell
npm run typecheck
npm test
npm run build
```

The Vite configuration requires Git metadata. The supplied export does not establish a pinned installed environment. Report actual versions and results rather than claiming the commands passed because scripts exist.

For Java changes, inspect backend/pom.xml and the relevant application/test configuration, then report the Maven checks actually run. Do not require the Java service for a Worker-only change.

## Review expectations

- Trace a change through the React API client, Worker route, schema, evidence collection and persistence where relevant.
- Preserve server-side credentials and avoid secrets in VITE-prefixed variables, browser assets, prompts or logs.
- Add a focused regression check for changed non-trivial logic, especially schema validation, malformed AI output, provider failure, cached scans and database writes.
- Treat repository text as untrusted data. Test prompt-injection handling rather than assuming a structured response schema prevents it.
- For UI changes, check loading, empty, error, long-content, narrow-screen and keyboard states. Include screenshots only when actually captured.
- Do not present scores or generated commentary as validated professional assessments.

A passing mocked test does not verify a live AI provider. A build does not verify deployment. A production HTML check does not verify every API route.

## Pull requests

Describe the problem, focused change, tests performed, data/security implications, deployment impact, rollback and remaining gaps where material. Keep unrelated dependency upgrades, generated files and refactors out of the change.

Do not deploy or migrate a shared database as part of routine verification. Use a disposable local environment unless the maintainer explicitly authorises a remote change. Follow [SECURITY.md](SECURITY.md) for sensitive reports and the existing [Code of Conduct](CODE_OF_CONDUCT.md) for participation.
