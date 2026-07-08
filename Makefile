# FleetVolt Makefile
#
# Phase 14 (v3.0 — 2026-07-07): Docker stack decommissioned.
# FleetVolt now deploys on Vercel (web) + Convex (data + compute).

.PHONY: help dev build deploy convex-deploy

help:
	@echo "FleetVolt: deployed on Vercel + Convex (Docker stack decommissioned Phase 14)."
	@echo ""
	@echo "Targets:"
	@echo "  make dev            — local dev server (pnpm dev in apps/web)"
	@echo "  make build          — local production build"
	@echo "  make deploy         — deploy to Vercel production"
	@echo "  make convex-deploy  — push Convex schema + functions to production"

dev:
	cd apps/web && pnpm dev

build:
	cd apps/web && pnpm build

deploy:
	npx vercel --prod

convex-deploy:
	cd apps/web && npx convex deploy
