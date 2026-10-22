# Architecture notes

## Scope

These notes cover selected source paths inspected for the documentation refresh, not an exhaustive repository audit. The Worker path and retained Java path must be distinguished when reasoning about deployment.

## Browser and API

frontend/src/api/eggscan.js uses an empty base prefix and relative API paths. frontend/worker/index.ts defines Hono routes for health, scans, stored results, leaderboard, comparisons, repository deep dives and the commit/README/stack tools. Input schemas are defined in worker/lib/schemas.ts.

The Cloudflare Vite plugin participates in the frontend build. Wrangler points to worker/index.ts, dist/client assets and the D1/AI bindings. Vite obtains a Git commit marker during configuration, so a plain source directory without Git metadata is not equivalent to a normal checkout for this build.

## Evidence, AI and storage

Worker analysis functions collect GitHub evidence and request structured AI output. The orchestration code includes adapters for Groq, Gemini, Cerebras, NVIDIA NIM, OpenRouter and Workers AI, with configuration checks, response validation and circuit-breaker support.

Code-level limits and schemas do not prove output truth, provider reliability or complete injection resistance. Provider/model defaults are configuration, not a statement of current external availability.

worker/lib/db.ts reads recent scans with a 24-hour cutoff and stores scan payloads in D1. Result-by-ID reads do not use that cutoff. Leaderboard queries select one stored entry per username and limit the response to ten. These behaviours do not establish an automatic retention/deletion policy.

## Build and deployment

The frontend build script runs emoji, asset and distribution-secret checks around Vite. The production helper uses generated Wrangler configuration and verifies a build marker and compiled module response at its configured production URL.

That release check is narrower than an end-to-end scan. Live provider responses, database writes, error recovery and browser interaction need their own verification.

## Retained backend

backend/pom.xml declares Java 21 and Spring Boot 3.3.4. Application configuration uses PostgreSQL/JPA and GitHub/Groq settings. The earlier migration guide retained this directory for rollback; no rollback rehearsal or parity test was performed during this refresh.

## Documentation corrections

The root README no longer presents PostgreSQL as the current Worker's storage, an external API-base environment variable as the current browser configuration, or an unsupported percentage speedup as measured fact. Security reporting no longer advertises an unverified mailbox or response deadline.

The existing code of conduct is retained unchanged. Its operational contact details and enforcement arrangements were not verified by this refresh.
