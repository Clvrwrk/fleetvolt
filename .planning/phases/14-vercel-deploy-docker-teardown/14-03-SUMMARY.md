# 14-03 SUMMARY — Docker Stack Decommission

**Wave:** 2 | **Plan:** 03 | **Phase:** 14-vercel-deploy-docker-teardown

## What was done

### Task 1: Decommission docker-compose.yml
- Replaced entire content with deprecation notice comment
- No active `services:` block remains — file is a historical marker only

### Task 2: Delete all Dockerfiles
- `git rm -f` on all 3: apps/web/Dockerfile, services/api/Dockerfile, services/simulator/Dockerfile
- All confirmed deleted (test -f returns false)

### Task 3: Create services/DEPRECATED.md
- Documents that the Python simulator was ported to Convex TS actions (Phase 13)
- Documents that the Fastify API is decommissioned (Convex replaces)
- States "Do NOT build or run" — no Dockerfiles, no Makefile targets
- Kept for historical reference / parity validation

### Task 4: Update Makefile for Vercel workflow
- Rewrote with `dev`, `build`, `deploy`, `convex-deploy` targets
- Zero `docker compose` references, zero `valhalla` references
- Help text: "FleetVolt: deployed on Vercel + Convex (Docker stack decommissioned Phase 14)"

### Task 5: Update README.md Quick Start for Vercel
- Replaced `docker compose up --build` with `cd apps/web && pnpm install && pnpm dev`
- Replaced `curl localhost:8000/v1/meta/stack` with `curl localhost:3000/health`
- Added "Production Deployment" subsection pointing to convex/README.md checklist
- Removed Valhalla PBF build instructions and PostGIS verification
- References fleetvolt.network and /health endpoint

### Task 6: Update AGENTS.md stack section
- Constraints: "Hybrid Node + Python" → "TypeScript full-stack (Next.js + Convex)"
- Constraints: "Docker Compose on VPS" → "Vercel (web) + Convex (data + compute)"
- Docker Compose Service Baseline table: marked DECOMMISSIONED, all services show ❌ except web (Vercel ✅)
- "What NOT to Use" table: struck through Vercel entry, marked "Now ACTIVE"

## Acceptance criteria results
- docker-compose.yml: no active services block, contains "DECOMMISSIONED" ✅
- All 3 Dockerfiles deleted (git tracked) ✅
- services/DEPRECATED.md: exists, contains "DEPRECATED", mentions Phase 13, "do not" ✅
- Makefile: 0 docker compose, 0 valhalla, 4 vercel, has dev: + deploy: targets ✅
- README.md: 0 "docker compose up", 1 "pnpm dev", 2 "fleetvolt.network", 2 "/health" ✅
- AGENTS.md: no active "Docker Compose on VPS" constraint, mentions Vercel + Convex, baseline DEPRECATED ✅

## tsc status
No code changes in 14-03 — only Docker/docs/Makefile. Pre-existing tsc errors unchanged.

## Deviations / blockers
- None. All 6 tasks completed autonomously.

## Files modified
- `docker-compose.yml` — replaced with deprecation notice
- `apps/web/Dockerfile` — deleted (git rm)
- `services/api/Dockerfile` — deleted (git rm)
- `services/simulator/Dockerfile` — deleted (git rm)
- `services/DEPRECATED.md` — created (deprecation marker)
- `Makefile` — rewritten with Vercel dev/deploy targets
- `README.md` — Quick Start updated for Vercel + Convex
- `AGENTS.md` — constraints + stack table + baseline updated
