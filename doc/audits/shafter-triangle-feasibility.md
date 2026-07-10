---
type: audit
title: Shafter Triangle — data-feasibility report (can our data + physics produce the Energy Forward report?)
author: cw-claude (Claude Code agent) ← Chris Hussey (CEO)
date: "2026-07-10"
status: canonical
tags: [audit, feasibility, shafter-triangle, fleetvolt, energy-forward, physics, faf]
related: [[genesis-fleetvolt]], [[shafter-triangle-charger-inventory]], [[tesla-semi-laden-energy-intensity]], [[monday-demo-script]]
linear: FLE-4
---

# Shafter Triangle — data-feasibility report

**Question this answers (FLE-4, from [[genesis-fleetvolt]] §Shafter-Triangle):** can FleetVolt's *current* data + physics produce the Energy Forward report — charger gaps per leg, predicted charge-need points under 10/20–80% discipline, existing infra at those points, mobile-battery placement, trips/day impact — for the triangle Shafter→Long Beach (Wonderful Co export, Tesla Class-8, fully laden) → Long Beach→Ontario (SCAQMD) → Ontario→Shafter?

**Verdict: PARTIALLY — today the build produces defensible, parity-verified numbers for the SoCal legs, but a complete triangle report is blocked by four concrete gaps.** The physics is real and wired to the workbench; the *report/siting layer that would assemble Energy Forward's document does not call it*, one leg has no route, Shafter/Kern freight isn't ingested, and two of the five required outputs (mobile-battery placement, trips/day) don't exist yet. All are closeable; effort is scoped below. **Method note:** every number here is from a live Convex query or an offline fixture test run on 2026-07-10 — not code reading. No pushes, deploys, or schema changes were made.

---

## 1. What the report CAN say today (real numbers, live/verified)

### Charger gap — REAL, for the SoCal corridor
`chargers/queries.ts:class8Gap` over the POLB→San Bernardino corridor returns **3 Class-8-capable (≥350 kW, MD/HD) DC stations**, non-inflated (count === surfaced list):
- WattEV — Port of Long Beach (Pier A), **360 kW** (closest, **2,569.8 m** from POLB)
- WattEV — San Bernardino, **360 kW**
- Greenlane Charging Center, **400 kW**

`fiveClosest` at POLB returns 5 stations at 2278 / 2570 / 3026 / 3079 / 3881 m, each with `powerKw / maxVehicleClass / connectorTypes`. Charger data is **statewide CA** (AFDC ingest `state=CA&fuel_type=ELEC&ev_charging_level=dc_fast`, `chargers/ingest.ts:74`) — **not** SoCal-boxed — so CA-99/CA-58/Kern chargers are present in principle once queried on those legs.
_Evidence: `apps/web/convex/flagship.test.ts` (a) GREEN; `apps/web/convex/chargers/queries.ts`._

### Fully-laden SoC physics — REAL, parity-verified (28/28)
`physics/orchestrator.ts:runSimulation()` runs grade-aware, laden-mass (curb+payload) force physics → sequential SoC integration with regen. TS↔Python parity, **0.0000 % diff**, on real corridors:
- **POLB→Cajon Pass drayage:** 217.59 kWh, SoC 100 → 92.82 → 85.64 → 76.40 → … → **44.77 %**, verdict *feasible*, **0 stops needed**.
- **Flat-highway OEM run:** 229.49 kWh, SoC 99.95 → … → **41.75 %**, 0 stops.

kWh/mi is an **output** of the physics (mass × grade × aero × rolling), not a hardcoded fudge — Tesla Semi params (`usable_kwh` 740 LR / 493 SR, Crr 0.0065, drag 0.36, frontal 9.8 m², regen_eff 0.8, drivetrain_eff 0.93) come from `data/trucks/tesla_semi_lr.json` / `_sr.json`.
_Evidence: `physics.test.ts` + `physics/parity.test.ts` — 28/28 pass, offline._

### Charge-need point detection under battery discipline — REAL (engine level)
`physics/chargingPlanner.ts:planGreedyStops` enforces **trigger 18 % → floor 10 % → target 80 % → min-arrival 10 %** and flags a charge-need point (`soc_deficit_kwh`, `cannot_reach_destination`) when SoC would cross the floor before a reachable charger. This is exactly the "10/20–80 % discipline" §Shafter-Triangle asks for — it exists and runs.
_Evidence: `physics/types.ts:56` (defaults), `physics/chargingPlanner.ts:99,125`._

### Freight & demand context — REAL, zone-061 only
FAF zone-061 (LA/Long Beach) outbound: **393k truck-ktons / ~$1.29T** total value; most-congested route **I-5 = 3.08M** 5-axle truck-AADT (436 segments, data-driven, not hardcoded); carrier density top **Long Beach 127 / 560 in corridor**. `report.ts:hotspotReport` fuses six live layers (carriers, parking, POIs, chargers, modeled score, freightContext) at a point in <1 s.
_Evidence: `flagship.test.ts` (c)(d)(e) GREEN; `report.ts`._

---

## 2. What it CANNOT say yet (the four blockers)

| # | Blocker | Why it blocks the Energy Forward report | Evidence |
|---|---------|------------------------------------------|----------|
| **B1** | **The report layer does not call the physics engine.** `report.ts` computes `mobileEnergyOpportunity` from a heuristic proxy score and marks detour cost + charge-need as *"external — Phase-13 … not computed in Convex"* — a **stale comment**: physics *is* now wired to the workbench/planner, just not to the report. | Per-leg charger gaps, charge-need points, and infra-at-need-point are never fused into a single siting document. Needs glue code. | `report.ts:114,293-298`; physics wired at `workbench/actions.ts:582,900`, `planner.ts:179` |
| **B2** | **Leg 3 (Ontario→Shafter, I-15/CA-58/CA-99) has no routing corridor**, and Leg 2's spec routes via **I-10, not SR-60**. All geometry needs a live `PTV_DEVELOPER_API_KEY` (Google fallback); offline yields only a straight-line preview. | No triangle polyline → no per-leg gap/need-point placement for the full loop. | `faf/buildCorridors.ts` (`polb-shafter-ze`, `polb-ontario-i10`; no Ontario→Shafter); `maps/ptv-routes.ts:175`, `maps/google-routes.ts:285` |
| **B3** | **Shafter/Kern freight is not ingested.** Only FAF zone-061 is loaded; `report.ts` and `faf/queries.ts` hardcode `PORT_ZONE="061"`. Kern falls in FAF zone **069 "Rest of California"** — a catch-all that cannot isolate Kern from the rest of non-metro CA. | Freight context for the Shafter end of the triangle is empty; even after ingest, 069 is coarse. | `report.ts:43,247`, `faf/queries.ts:12`; `data/ingest/faf/out/faf_lookups.json` |
| **B4** | **Trips/day and mobile-battery placement don't exist.** `kpiAggregator.ts` outputs total_kwh / wh_per_mi / regen / time only — no daily-cycle or charging-downtime math. No BESS/mobile-battery siting optimizer exists (`grep "mobile.*battery\|BESS"` → 0 hits); only the binary `mobileEnergyOpportunity` flag. | Two of the five §Shafter-Triangle deliverables (mobile-battery placement, trips/day) are unbuilt. | `physics/kpiAggregator.ts:6`; repo-wide grep |

**Provenance caveats (credibility risk, from the queued research plans):** the 10/80 floor/ceiling and regen caps are **hardcoded defaults, not OEM-sourced** ([[tesla-semi-laden-energy-intensity]] is still `status: queued`), and there is **no independent charger inventory** to validate our 3-station gap against ([[shafter-triangle-charger-inventory]] also `queued`). Both are the demo's highest-leverage attack surfaces and should be closed before an engineer audience.

---

## 3. Ingestion / glue plan to close the gaps

| Task | What | Effort | Note |
|------|------|--------|------|
| **G1 — fuse physics into the report** | Have `report.ts` (or a new `triangleReport` action) call `physics.simulate` per leg, collecting charge-need points, then resolve infra within radius of each need-point via the existing charger layer. | **M (1–2 days)** | Highest value — turns real physics into the actual siting document. Also delete the stale Phase-13 comment. |
| **G2 — add the three legs** | Add `CORRIDOR_SPECS` entries for Leg 3 Ontario→Shafter (I-15/CA-58/CA-99) and correct Leg 2 to SR-60; run route geometry with the live PTV key. | **S–M (~1 day + key)** | Cannot be fixture-tested; needs the PTV key present in the environment. |
| **G3 — ingest zone-069** | Generalize `prep_faf_zone061.py` → `cmd_filter(zone)` emitting `faf_zone069.json` (069 rows already in the on-disk 695 MB CSV); parameterize the ingest action; un-hardcode `PORT_ZONE` in `report.ts` + `faf/queries.ts` to resolve zone by location. | **S (½–1 day)** | Un-hardcoding zone-by-location is the fiddly part. **069 ≠ Kern-specific** — for true granularity use CalTrans PeMS/AADT (already used elsewhere) or FAF county data as a Kern proxy. |
| **G4 — trips/day + mobile-battery** | Add daily-cycle KPI (drive time + charge dwell → trips/day) to `kpiAggregator`; add a first-cut mobile-battery placement rule (need-points with zero infra + high freight flow → candidate BESS sites). | **M–L (2–4 days)** | New capability, not glue. Genesis says viz design happens *after* data proves out — keep this data-only. |
| **G5 — provenance** | Execute the two queued research plans → adopt sourced laden kWh/mi + independent charger inventory as the physics/charger provenance cards. | **S–M** | De-risks the demo's most attackable numbers. |

**Fastest path to a real (if SoCal-only) triangle report:** G1 + G2 (Legs 1–2) ≈ 2–3 days — this produces genuine charge-need points + per-leg gaps on the Long Beach ↔ Ontario portion using live physics, which already covers the two legs where our data is strongest. The Shafter end (G3) is coarse until a Kern proxy is chosen.

---

## 4. Draft report skeleton — what Energy Forward would receive

> **FleetVolt — Shafter Triangle Charging-Feasibility Brief** *(draft; today's fill-state noted)*
> **Truck/load:** Tesla Semi (LR, 740 kWh usable), fully laden ~82,000 lb GCW · **Discipline:** charge→80 %, floor 10 %, trigger 18 %.
> **Per leg (Leg 1 Shafter→LB · Leg 2 LB→Ontario · Leg 3 Ontario→Shafter):**
> 1. *Class-8 charger gaps* — ✅ computable per corridor (SoCal legs live: 3 stations, e.g. WattEV 360 kW ×2, Greenlane 400 kW). ⛔ Leg 3 route missing.
> 2. *Predicted charge-need points (SoC floor)* — ✅ engine computes (parity-verified SoC trajectories); ⛔ not yet fused into the report (G1) and needs the leg geometry (G2).
> 3. *Infra at need-points* — ✅ charger/parking/POI layers answer within radius once need-points exist.
> 4. *Mobile-battery placement* — ⛔ heuristic flag only; real optimizer = G4.
> 5. *Trips/day impact* — ⛔ not built = G4.
> **Freight context:** ✅ zone-061 (393k truck-ktons, $1.29T) for the LB end; ⛔ Shafter/Kern = G3.
> **Provenance:** every rendered figure cites its source card (physics inputs, charger record, FAF row) per the genesis "no pixel without provenance" law — kWh/mi + charger inventory provenance pending G5.

---

## 5. Alignment audit — one-engine-filtered check (genesis architecture law)

**Verdict:** FleetVolt is **mostly one truth engine, filtered — with two real pockets of drift**, not three diverging products. UI is a single `MapWorkbenchShell` parameterized by a `mode` prop (driver/fleet/caas) over one Zustand store; **energy/SoC is cleanly single-sourced** — every consumer reads `total_kwh`/`soc_pct` from `physics/orchestrator.ts:runSimulation()`, none re-derives it; routing is single-sourced in the app (one `routeGeometry`, PTV-primary/Google-fallback). **The drift is real and worth fixing before scaling:**

1. **Charger-gap logic is triplicated** (the Hunter's *primary* siting signal): a point-radius inline filter in `report.ts:114`, a corridor-wide unique-station union in `chargers/queries.ts:class8Gap`, and a per-zone aggregate boolean in `caas/queries.ts:getChargerGapByArea`. None delegates to another → the same corridor can read "gap" or "no gap" depending on which persona's view calls which path. **This is exactly the "three times diverging" failure the vision warns against.** Recommend: collapse to one `class8Gap` primitive that the other two call.
2. **`physics/detourValidator.ts` bypasses the canonical route path**, calling raw Google Directions in *car* (`mode=driving`) profile for charger-detour ETAs — a second, lower-fidelity route computation feeding the same physics engine. Recommend: route detours through the canonical `routeGeometry` (truck profile).

(The hotspot demand score is correctly single-sourced: `hotspots/score.ts:computeHotspotScore` imported directly by `report.ts:36`. A Python `services/simulator` reimplements the PTV call — expected at a cross-language boundary, but note it as unshared.)
_Evidence: `map-workbench-shell.tsx:106`, `stores/map-workbench-store.ts`, `physics/orchestrator.ts:106`, `workbench/actions.ts:364,601`, `physics/detourValidator.ts:1-40`, `report.ts:114` vs `chargers/queries.ts:117` vs `caas/queries.ts:182`._

---

## 6. Bottom line

- **Can our data + physics produce the report?** The **physics half is real and defensible today** (parity-verified fully-laden SoC + charge-need discipline); the **assembly + Shafter coverage is not yet wired**. The single highest-leverage fix is **G1 (fuse physics into the report)** — everything else is data breadth or new features.
- **For Monday:** the honest, strong demo is the **Long Beach ↔ Ontario portion** — live charger gap (3 stations, real kW), a parity-verified laden SoC run, and the freight/carrier context — framed as "here is the engine; Shafter/Kern is the next ingest." Do **not** claim a full Shafter-origin triangle until G2/G3 land.
- **Do not build UI in this task** (per genesis): visualization design is CEO + cw-cowork *after* this data proves out.
