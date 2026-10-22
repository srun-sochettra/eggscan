# EggScan

**GitHub exploration with an egg-themed personality.**

EggScan brings profile activity, repository evidence, README feedback and technology-stack summaries into a React interface backed by GitHub APIs and structured AI responses. Explore a profile, inspect a repository, or try the app's playful comparison and feedback modes.

![EggScan cover](cover.png)

[Open EggScan](https://eggscan.0xlab.workers.dev/) · [Architecture](docs/architecture.md) · [Deployment guide](frontend/README-MIGRATION.md)

The app address above is configured in the repository's production deployment script. Availability was not verified during this documentation refresh.

## Explore the suite

| Experience | Focus |
| --- | --- |
| Profile Scanner | GitHub profile and repository evidence with AI-generated summaries |
| Repository Deep Dive | Repository structure, stack and improvement suggestions |
| CommitShame | Commit-message feedback with selectable tone |
| READMErater | README feedback and documentation suggestions |
| StackRoast | Language and configuration-based stack commentary |
| Battle Mode | A playful side-by-side profile comparison |
| Saved results | Stored honest-mode scans, result links and a leaderboard |

Egg-themed scores and verdicts are generated product outputs, not validated measures of competence, employability, compensation or professional worth. Use the app for exploration and entertainment, not hiring or workplace performance decisions. AI feedback can be inaccurate or omit important context.

## Architecture at a glance

```text
React + Vite interface
        |
    same-origin /api
        |
Cloudflare Worker: Hono + TypeScript + Zod
        |                 |                 |
   GitHub APIs        AI providers        D1 storage
```

The current frontend includes the Worker, D1 migration and Cloudflare Vite integration. The original **Java 21 / Spring Boot 3.3.4 / PostgreSQL** backend remains in `backend/` as the retained alternative/rollback codebase. The two paths are not interchangeable without configuration and verification.

| Area | Current Worker path |
| --- | --- |
| Interface | React 18, React Router, Tailwind CSS 3 |
| Build | Vite 7 with the Cloudflare Vite plugin |
| API | Hono, TypeScript and Zod schemas |
| Storage | Cloudflare D1 |
| Evidence | GitHub REST/GraphQL integration |
| AI | Configurable provider adapters and fallback orchestration |
| Tests | Vitest and React Testing Library; Java tests retained separately |

Versions above describe manifest declarations, not a freshly installed environment.

## Run locally

Use Node.js/npm compatible with `frontend/package.json` and its dependencies. Use a real Git checkout: the Vite configuration calls `git rev-parse` to create its build marker.

From the repository root, using PowerShell:

```powershell
cd frontend
npm install
Copy-Item .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your own server-side credentials. The Wrangler configuration declares `GITHUB_TOKEN` and `GROQ_API_KEY` as required. Optional provider keys are listed in the example; do not leave placeholder values enabled as though they were valid credentials.

Then initialise the local D1 schema and start development:

```powershell
npm run db:migrate:local
npm run dev
```

Use the local address printed by Vite. The browser API client uses relative `/api` paths; the old `VITE_API_URL` setup does not configure the current client.

The checked-in D1 binding points to an existing deployment's database. Do not apply remote migrations or deploy a fork until its account, database binding and target have been reviewed. See the [deployment guide](frontend/README-MIGRATION.md).

## Check the project

From `frontend/`:

```powershell
npm run typecheck
npm test
npm run build
```

The build script runs the repository's emoji check, Vite build, production-asset check and distribution-secret check. These are useful gates, not proof of complete security or correct live-provider behaviour.

No dependency installation, tests or build were executed for this documentation refresh. No lockfile was included in the supplied text export; use a current repository lockfile if available rather than treating dependency ranges as a reproducible installation.

## AI and data boundaries

The Worker orchestration includes Groq, Gemini, Cerebras, NVIDIA NIM, OpenRouter and Workers AI adapters. Providers are selected according to configuration and runtime availability. Code support does not establish that every provider is enabled, free, reachable or production-tested.

Repository evidence sent for analysis may reach configured fallback providers. Review provider choices and data handling before scanning sensitive material. Public GitHub content can still contain personal information or accidentally exposed secrets.

Honest-mode scans use a 24-hour cache lookup and are persisted in D1. That lookup window is **not** an automatic deletion or retention policy. Stored result links and leaderboard responses expose selected scan data through API routes; do not treat them as private records.

## Project layout

```text
frontend/
  src/             React pages, components and API client
  worker/          Hono API, GitHub access, AI orchestration and storage
  migrations/      D1 schema migration
  scripts/         Build checks and production deployment helper
  wrangler.jsonc   Worker, assets, D1 and AI bindings
backend/           Retained Java/Spring Boot implementation
```

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and the existing [Code of Conduct](CODE_OF_CONDUCT.md). Report only checks actually performed and keep credentials out of commits, screenshots and generated assets.

## Licence

Source code is distributed under the [MIT License](LICENSE), with the existing EggScan Contributors attribution retained. Third-party APIs, models and services have their own terms.
