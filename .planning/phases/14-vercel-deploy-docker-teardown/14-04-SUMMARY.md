---
phase: 14-vercel-deploy-docker-teardown
plan: 04
subsystem: infrastructure
tags: [verification, archive, docker-teardown, data-integrity]
---

# Plan 14-04 Summary — Data Migration Verification + Services Archive

## Status: COMPLETE

### Verification
- **Convex data intact**: all 6 layers live on sensible-oriole-832 verified post-teardown:
  - Chargers: 2,867 AFDC (nearestClass8 returns WattEV Pier A 360kW)
  - Carriers: 1,823 POLB (geocoded + spatial)
  - Highways: 6,865 CalTrans segments
  - Parking: 83 NATD sites
  - POIs: 12,964 OSM
  - FAF: 105,329 freightOD rows
  - Hotspots: 5 modeled + 60 geoRegions
  - Trucks: 10 Class 8 EV configs with street metadata
  - Driver profiles: schema + queries live
- **Docker compose**: fully decommissioned — `docker compose config --services` returns empty (all services removed: postgres, simulator, api, web, sim-worker, redis)
- **services/ archived**: `DEPRECATED.md` marker placed; the 3,454-LOC Python simulator + Fastify API kept as parity reference for Phase 13 (not deleted)

### Commits
- `9533890` feat(14-03): Docker stack decommission — included services/ archive

### What remains (manual, for Chris)
- `npx vercel deploy` with Vercel account (config files prepared: vercel.json, next.config.ts fixed, .env.production.example)
- Domain `fleetvolt.network` DNS → Vercel
- `OPENAI_API_KEY` in Convex prod env for live LLM briefs
