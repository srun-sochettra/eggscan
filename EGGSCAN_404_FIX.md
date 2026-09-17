# EggScan production 404 fix

## Root cause

`frontend/worker/index.ts` contained a hand-written `/` HTML response with old Vite asset hashes (`index-5hKMBgaA.js` and `index-BNxE2a6p.css`). The production build generates content-hashed filenames, so the Worker could serve HTML that referenced files absent from the deployed asset manifest. This explains the stylesheet 404 visible in the console and proves the deployed root document was not the current Vite `dist/client/index.html`.

The same production state returned 404 for `/api/scan/:username`, despite that route existing in source. That indicates deployment/runtime drift, not a missing source route. The previous deployment smoke test checked only root HTML and JavaScript. It did not verify CSS or any `/api/*` endpoint, so it could not detect this split deployment.

## Changes

1. Removed the hand-written Worker `/` route. Cloudflare static assets now own the SPA document and serve the exact Vite-generated HTML with matching asset hashes.
2. Extended `scripts/deploy-production.mjs` to verify the generated stylesheet and `/api/health` after deployment.
3. Retained the existing regression test for `/api/health`, which already proves the route is registered in the source application.

## Required local verification

Run from `frontend/`:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run deploy:production
```

Then manually request:

```bash
curl -i https://eggscan.0xlab.workers.dev/api/health
curl -i "https://eggscan.0xlab.workers.dev/api/scan/yornyain?mode=honest"
```

The health endpoint must return HTTP 200 and `{"status":"ok","service":"eggscan-worker"}`. The scan endpoint must no longer return 404. A provider failure may still return a structured non-404 error and requires Cloudflare Worker logs plus credential/provider checks.
