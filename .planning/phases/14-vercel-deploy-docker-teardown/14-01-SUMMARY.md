# 14-01 SUMMARY — Vercel Build Config

**Wave:** 0 | **Plan:** 01 | **Phase:** 14-vercel-deploy-docker-teardown

## What was done

### Task 1: Fix next.config.ts for Vercel
- Removed `output: "standalone"` (Docker-oriented — Vercel handles Next.js natively)
- Removed `apiUrl` constant and the entire `rewrites()` block (the `/api/v1/:path*` rewrite proxied to the decommissioned Fastify API at localhost:4000)
- Preserved `turbopack.root` / `monorepoRoot` config (Vercel respects this for monorepo builds)
- Result: minimal config — turbopack root only

### Task 2: Create vercel.json
- Created at monorepo root with `framework: "nextjs"`, buildCommand pointing to `apps/web`, outputDirectory `apps/web/.next`
- No env vars or secrets in the file

### Task 3: Create .env.production.example
- All 4 production env vars documented: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, NEXT_PUBLIC_GOOGLE_MAP_ID, NEXT_PUBLIC_CONVEX_URL, CONVEX_DEPLOY_KEY
- Includes fleetvolt.network referrer allowlist note
- All placeholders — no real values

### Task 4: Convex production deployment docs
- Added "## Production Deployment" section to convex/README.md
- Documents `npx convex deploy`, CONVEX_DEPLOY_KEY, NEXT_PUBLIC_CONVEX_URL (prod vs dev), and that dev data is NOT auto-migrated

## Acceptance criteria results
- next.config.ts: no `output:`, no `rewrites`, no `localhost:4000`, no `API_URL` ✅
- next.config.ts: has `turbopack` + `monorepoRoot` ✅
- vercel.json: has `"framework": "nextjs"` and `apps/web` in buildCommand/outputDirectory ✅
- .env.production.example: all 4 env vars present, fleetvolt.network mentioned, no real values ✅
- convex/README.md: has Production Deployment section with `npx convex deploy`, CONVEX_DEPLOY_KEY, "NOT auto-migrated" ✅

## tsc status
Pre-existing errors only (convex/physics/simulate.ts, pulse components, scenario-form.tsx Zod4 resolver). No new errors introduced by 14-01.

## Deviations / blockers
- None. All tasks completed autonomously.

## Files modified
- `apps/web/next.config.ts` — rewritten (removed Docker standalone + dead rewrite)
- `vercel.json` — created (monorepo build config)
- `apps/web/.env.production.example` — created (production env template)
- `apps/web/convex/README.md` — appended Production Deployment section
