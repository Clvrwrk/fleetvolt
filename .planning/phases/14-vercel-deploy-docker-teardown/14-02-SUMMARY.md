# 14-02 SUMMARY — Health Endpoint + API Client Fix + Deploy Checklist

**Wave:** 1 | **Plan:** 02 | **Phase:** 14-vercel-deploy-docker-teardown

## What was done

### Task 1: Create /health endpoint
- Created `apps/web/src/app/health/route.ts` — Next.js App Router GET handler
- Returns `{status:"ok", timestamp, services:{convex: boolean, googleMaps: boolean}}`
- Checks env var presence only — no external network calls (fast, non-blocking)
- 200 status code

### Task 2: Fix API client — remove all localhost:4000 + /api/v1/ references
- `src/lib/server-catalog.ts`: removed `localhost:4000` fallback, returns `[]` when `API_URL` not set
- `src/app/page.tsx`: removed `localhost:4000` fallback, returns `0` when `API_URL` not set
- `src/app/status/stack-health-content.tsx`: removed 5× `localhost:4000` fallbacks, returns error when `API_URL` not set
- `src/lib/route-geometry.ts`: removed `/api/v1/routing/route` dead rewrite reference, returns empty coords when `API_URL` not set
- **Result:** zero localhost:4000/8000/3000 or /api/v1/ references in active code paths (only comment references explaining the decommission)

### Task 3: Document production deploy checklist
- Added "## Production Deploy Checklist" to `apps/web/convex/README.md`
- 9 numbered steps covering: Vercel env vars, Convex prod deploy, Vercel deploy, domain wiring, DNS, SSL, health check, MAP-01/02/03 visual verification
- Marked as HUMAN CHECKLIST — plan does not execute the live deploy

## Acceptance criteria results
- /health route exists with `export async function GET` ✅
- /health returns JSON with status, timestamp, services fields ✅
- /health makes no external network calls ✅
- Zero `localhost:4000`/`localhost:8000` in src/ (excluding tests + .env) ✅ (only comment references)
- Zero `/api/v1/` in src/ (excluding tests) ✅ (only comment reference)
- API base URL logic reads from env var with no localhost fallback ✅
- Convex README has "## Production Deploy Checklist" ✅
- Checklist mentions `npx vercel --prod`, `npx convex deploy`, fleetvolt.network, DNS, MAP-01/02/03 ✅

## tsc status
Pre-existing errors only (pulse components, scenario-form.tsx Zod4 resolver, convex/physics/simulate.ts). No new errors introduced by 14-02.

## What needs Chris's manual Vercel deploy
The following are human gates — the code and docs are ready but require Chris's Vercel/Convex account access:
1. `npx convex deploy` — create the Convex production deployment
2. Set env vars in Vercel dashboard (NEXT_PUBLIC_CONVEX_URL, CONVEX_DEPLOY_KEY, Google Maps keys)
3. `npx vercel --prod` — deploy to Vercel production
4. Add `fleetvolt.network` domain in Vercel dashboard + point DNS
5. Visually verify MAP-01/02/03 on the deployed `/planner`

## Deviations / blockers
- None. All code tasks completed. Live deploy is a documented manual gate.

## Files modified
- `apps/web/src/app/health/route.ts` — created (health endpoint)
- `apps/web/src/lib/server-catalog.ts` — fixed (removed localhost fallback)
- `apps/web/src/app/page.tsx` — fixed (removed localhost fallback)
- `apps/web/src/app/status/stack-health-content.tsx` — fixed (5× localhost removal)
- `apps/web/src/lib/route-geometry.ts` — fixed (removed /api/v1/ dead rewrite)
- `apps/web/convex/README.md` — appended Production Deploy Checklist
