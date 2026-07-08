# 15-01 SUMMARY — Hotspot Explorer Map (Wave 1)

**Phase:** 15 — Hotspot Explorer + AI Brief
**Plan:** 01 (Wave 1)
**Status:** ✅ Complete
**Date:** 2026-07-07

---

## What Was Built

The first vertical slice of the Hotspot Explorer: a user opens `/hotspot` and sees a Google Maps vector view of the US with modeled truck parking/dwelling hotspots rendered as clickable pins. Three zoom levels transition through data layers imperatively (no remount).

### Artifacts Created

| File | Purpose |
|------|---------|
| `apps/web/convex/hotspots/queries.ts` | `listModeledHotspots` — returns modeledDwell hotspots via `by_kind` index |
| `apps/web/convex/geo/queries.ts` | `listGeoRegions` — returns geoRegions optionally filtered by level via `by_level` index |
| `apps/web/src/lib/hotspot-zoom.ts` | `zoomLevelForZoom`, `scoreToColor`, `scoreToRadiusPx`, `ZOOM_THRESHOLDS` — pure functions |
| `apps/web/src/lib/hotspot-zoom.test.ts` | 19 unit tests — all pass |
| `apps/web/src/app/hotspot/page.tsx` | `/hotspot` route — thin server shell |
| `apps/web/src/components/hotspot/hotspot-explorer.tsx` | Client surface wrapping TechnicalFrame + HotspotMap (parity with PulseSurface) |
| `apps/web/src/components/hotspot/hotspot-map.tsx` | Google Maps vector base + 3 zoom levels + AdvancedMarker pins |

### Commits

1. `28dfc43` — feat(15-01): Convex queries listModeledHotspots + listGeoRegions
2. `aa75711` — feat(15-01): zoom-level logic + score-to-visual mapping
3. `e3b5204` — feat(15-01): /hotspot route + HotspotExplorer + HotspotMap

---

## Acceptance Criteria

- ✅ `listModeledHotspots` uses `withIndex("by_kind")` with `eq("kind","modeledDwell")`
- ✅ `listGeoRegions` uses `withIndex("by_level")` when level arg is provided
- ✅ Neither query calls `ctx.runQuery` (thin, direct table reads)
- ✅ `zoomLevelForZoom(3) === 'nation'`, `zoomLevelForZoom(7) === 'state'`, `zoomLevelForZoom(11) === 'county'`
- ✅ `scoreToRadiusPx(0) === 6`, `scoreToRadiusPx(1) === 18`, `scoreToRadiusPx(0.5) === 12`
- ✅ `hotspot-zoom.test.ts` exits 0 (19/19 pass)
- ✅ `/hotspot` route loads `HotspotExplorer`
- ✅ `hotspot-explorer.tsx` has `'use client'` and imports `useQuery` from `convex/react`
- ✅ `hotspot-map.tsx` uses `APIProvider + Map` with `renderingType={RenderingType.VECTOR}`
- ✅ `hotspot-map.tsx` uses `<AdvancedMarker>` (not `google.maps.Marker`)
- ✅ Pin title strings contain "modeled" (never "observed")
- ✅ `MapUnavailable` fallback when API_KEY/MAP_ID missing

---

## Test Results

```
hotspot-zoom.test.ts: 19 tests, 19 pass, 0 fail
tsc --noEmit: clean (except pre-existing scenario-form.tsx TS2769)
```

---

## Deviations / Blockers

1. **Convex codegen blocked by Phase 13:** `npx convex dev --once` fails because `convex/physics/inputsHash.ts` imports `node:crypto` without a `"use node"` directive. This is a Phase 13 file being worked on in parallel. **Workaround:** manually patched `convex/_generated/api.d.ts` to include the new `hotspots/queries` and `geo/queries` modules. The runtime `api.js` uses `anyApi` so it works without changes. When Phase 13 fixes the `node:crypto` issue, a normal `npx convex dev` will regenerate the file cleanly.

2. **No functional blockers.** All acceptance criteria met.
