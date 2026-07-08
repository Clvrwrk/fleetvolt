# DEPRECATED — services/ directory

**Status:** DEPRECATED (Phase 14, v3.0 — 2026-07-07)

## What lived here

- **`services/simulator/`** — Python FastAPI simulation service (~3,454 LOC). The physics
  engine (NumPy/SciPy segment model, elevation, charging, energy) was ported to Convex
  TypeScript actions in **Phase 13**. This code is retired.
- **`services/api/`** — Fastify Node.js API proxy (:4000). All data now flows directly
  through Convex (client-side `ConvexProvider`). This service is decommissioned.

## Why it's kept

These directories are retained for **historical reference** and parity validation. The
Python physics implementation served as the reference for the Convex TS port, and may be
useful for future cross-validation or debugging.

## Do NOT build or run

- No Dockerfiles exist for these services (deleted in Phase 14).
- No `docker compose` targets exist in the Makefile.
- These directories are **not part of the production deployment** (Vercel + Convex).
- Do not attempt to build, run, or deploy these services.

## Future cleanup

Full deletion of `services/` is a future cleanup step, pending Chris's confirmation.
Git history preserves all code if deletion is approved.
