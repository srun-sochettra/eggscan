# Worker setup and deployment

The frontend now includes a TypeScript Worker and D1 implementation alongside the React UI. This guide replaces the earlier one-time overlay-copy instructions. Do not recopy migration scaffolding over the current source.

## Local development

Follow the [root README](../README.md): install dependencies in frontend/, copy .dev.vars.example to .dev.vars, set real local credentials, apply the local migration and run the development server.

```powershell
npm run db:migrate:local
npm run dev
```

The current browser client uses same-origin /api requests. Changing VITE_API_URL alone does not reconnect it to the retained Spring service.

## Deployment configuration

Inspect wrangler.jsonc before any remote action. It declares the Worker entry point, dist/client assets, API-first routing, a DB binding, an AI binding, model variables and required secret names.

The checked-in database ID belongs to the existing configuration. For a separate deployment, provision your own database and replace the binding with its returned ID. Do not reuse another deployment's binding blindly.

The existing provisioning workflow is:

```powershell
npx wrangler login
npx wrangler d1 create eggscan
```

Review account and resource names before running these commands. They authenticate to or create resources in a Cloudflare account; they were not executed during this refresh.

Set deployment secrets through Wrangler rather than putting values in public configuration:

```powershell
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put GROQ_API_KEY
```

Optional provider secret names are GEMINI_API_KEY, CEREBRAS_API_KEY, NVIDIA_API_KEY and OPENROUTER_API_KEY. Workers AI uses the configured AI binding. Review provider availability and cost separately; no entitlement or free usage is promised.

Binding types can be regenerated with:

```powershell
npm run cf-typegen
```

## Database migration

The repository includes migrations/0001_scan_records.sql. The local and remote commands target different environments:

```powershell
npm run db:migrate:local
npm run db:migrate:remote
```

The remote command changes the configured remote database. Confirm the account, binding, schema and recovery plan before running it. This guide does not authorise a production migration or claim that a backup exists.

## Build and release helpers

The manifest includes both deploy and deploy:production scripts. The production helper builds, performs a Wrangler dry run using generated configuration, deploys and checks the configured production HTML marker/module response.

```powershell
npm run typecheck
npm test
npm run build
```

After reviewing the target and authorising the remote change, the existing production helper is:

```powershell
npm run deploy:production
```

**Fork warning:** scripts/deploy-production.mjs contains the existing production URL as a literal. Inspect and adapt that target before using the helper for another deployment. A successful HTML/module check would not prove live AI requests, D1 persistence or every route works.

## Retained Java backend

backend/ remains the Java 21 / Spring Boot / PostgreSQL implementation, retained by the migration material as an alternative/rollback path. Keeping its files does not establish a tested operational rollback.

Its application configuration reads DB_URL, DB_USERNAME, DB_PASSWORD, GITHUB_TOKEN and GROQ_API_KEY. The example file is not a complete database provisioning workflow. Verify database setup, runtime configuration, browser API routing and API compatibility before switching paths.

## Verification boundary

These commands and behaviours were checked against the supplied scripts/configuration. No provisioning, secret update, migration, build, deployment or live API verification was performed for this refresh.
