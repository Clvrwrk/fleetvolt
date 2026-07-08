# 15-02-SUMMARY — Hotspot Report Panel + Drill-Down (Wave 2)

**Phase:** 15 — Hotspot Explorer + AI Brief
**Plan:** 02 (Wave 2)
**Commit:** `7cf6c56`
**Status:** ✅ Complete
**Date:** 2026-07-07

---

## What Was Delivered

Clicking a hotspot pin on the map now opens a drill-down report panel populated from the Phase-12 `hotspotReport` query (`convex/report.ts`). The panel renders all six data sections plus a "What's Missing" derived-gaps panel — the same payload that will ground the LLM sales brief in Wave 3.

## Artifacts Created / Modified

| File | Action | Purpose |
|------|--------|---------|
| `report-sections/carriers-section.tsx` | Created | Carrier name + city + corridorCity + distanceM list |
| `report-sections/parking-section.tsx` | Created | Count + totalSpots + parking list |
| `report-sections/pois-section.tsx` | Created | Total + byType grid + flat list |
| `report-sections/chargers-section.tsx` | Created | class8WithinRadius + fiveClosest table + class8Chargers list |
| `report-sections/score-section.tsx` | Created | Score as large number, "modeled" label, 4 proxy inputs, component bars |
| `report-sections/freight-context-section.tsx` | Created | FAF zone-061 totals (ktons, value, truck mode) |
| `whats-missing-panel.tsx` | Created | mobileEnergyOpportunity + zero-coverage flags + deferredToPhase13 markers |
| `hotspot-report-panel.tsx` | Created | Main panel: useQuery(api.report.hotspotReport, {lat,lng,radiusM:5000,hotspotId}) + all sections + close button |
| `hotspot-explorer.tsx` | Modified | Wired onHotspotSelect → selectedHotspot state → HotspotReportPanel |
| `hotspot-map.tsx` | Modified | Typed hotspotId as Id<"hotspots">, onHotspotSelect callback fires on pin click |

## Task Completion

| Task | Status | Notes |
|------|--------|-------|
| Report section components (6) | ✅ Done | All 6 created with typed Props, 'use client', FvInsetCard wrappers |
| What's Missing panel | ✅ Done | mobileEnergyOpportunity callout + flags + deferred markers (no fabricated numbers) |
| HotspotReportPanel + wire to explorer | ✅ Done | useQuery(api.report.hotspotReport), loading/error states, close button, explorer renders panel on pin click |

## Acceptance Criteria

- ✅ 6 files exist under `apps/web/src/components/hotspot/report-sections/`
- ✅ score-section.tsx contains "modeled" and does NOT contain "observed"
- ✅ score-section.tsx lists the 4 proxy input names (NATD_parking_capacity, Caltrans_5axle_truckAADT, FAF_zone061_flow, POLB_carrier_concentration)
- ✅ chargers-section.tsx renders class8WithinRadius and fiveClosest
- ✅ Each component has a typed Props interface matching the report.ts payload
- ✅ All files use 'use client' directive
- ✅ whats-missing-panel.tsx contains "mobileEnergyOpportunity" and "Phase-13"
- ✅ whats-missing-panel.tsx does NOT contain hardcoded detour km or CO2 numbers
- ✅ hotspot-report-panel.tsx contains `useQuery(api.report.hotspotReport`
- ✅ hotspot-explorer.tsx renders `<HotspotReportPanel` when hotspot selected
- ✅ hotspot-report-panel.tsx imports all 6 section components + whats-missing-panel

## tsc Status

Clean except:
- Pre-existing `scenario-form.tsx` TS2769 error (documented)
- Phase-13 parallel executor errors in `convex/physics/simulate.ts` (not our files)

## Threat Model Mitigations

- **T-15-02a** (score "observed"): score-section.tsx hardcodes "modeled" label; no "observed" string ✅
- **T-15-02b** (32K doc limit): default radius 5000m (not 5mi/8047m); error state graceful ✅
- **T-15-02c** (fabricated detour/CO2): whats-missing-panel only renders deferred string markers ✅

## Deviations / Blockers

None. All tasks completed as planned.
