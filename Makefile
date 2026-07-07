# FleetVolt Makefile
#
# NOTE (Phase 11, v3.0 Full Platform Migration — 2026-07-07):
# Routing moved from self-hosted Valhalla to the PTV Developer Routing API.
# The Valhalla PBF-build workflow (valhalla-pbf / valhalla-verify-pbf /
# valhalla-verify-route / valhalla-status) has been RETIRED (P11-06).
#
# The scripts/build_socal_pbf.sh + scripts/verify_valhalla_*.sh files and the
# data/valhalla/ + data/socal.osm.pbf artifacts are RETAINED on disk but are
# no longer used at runtime. Full removal is deferred to Phase 14 (Vercel +
# Docker decommission).

.PHONY: help

help:
	@echo "FleetVolt: routing runs on the PTV Developer Routing API (Valhalla retired in Phase 11)."
	@echo "No active make targets. Docker workflow: docker compose up -d"
