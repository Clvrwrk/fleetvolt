---
status: testing
phase: 17-role-based-map-workbench-driver-day-plan-fleet-contract-plan-caas-gap-map
source:
  - 17-00-SUMMARY.md
started: 2026-07-08T22:20:00.000Z
updated: 2026-07-08T22:20:00.000Z
mode: mvp
---

## Current Test

number: 1
name: Driver dashboard launchpad CTA
expected: |
  Open the Driver home (/driver) while signed in (or with local e2e bypass).
  You should see one dominant primary button labeled "Start Day Plan"
  (not a registration form as the main surface, not a wall of cards as the work area).
awaiting: user response

## Tests

### Section A — User-flow walk-through

### 1. Driver dashboard launchpad CTA
expected: At /driver, one dominant primary CTA reads "Start Day Plan" and the page feels like a launchpad (dashboard), not the planning work surface itself.
result: pending

### 2. Driver opens full-viewport day-plan workbench
expected: Clicking "Start Day Plan" opens a full-viewport map workbench (left tools + map + right cards or mobile sheet). The primary work area is the map — not a centered FramedPanel / chat card layout.
result: pending

### 3. Driver day plan produces map + result cards
expected: With origin/destination (or AI draft POLB→Barstow), run Calculate day plan. You see route geometry (or advisory warning), feasibility/charge-stop cards, and honest "unavailable" labels where detour/access isn't computed — not a long prose report as the primary output.
result: pending

### 4. Fleet contract plan from dashboard
expected: From /fleet, "Plan Contract" opens fleet workbench mode. After Calculate, you see trucks/drivers/charge-events style summary cards with assumption labels (and gap/CaaS support when applicable).
result: pending

### 5. CaaS gap map from dashboard
expected: From /caas, "Find Charger Gaps" opens CaaS workbench. You get a US/opportunity-style map with gap/carrier layers; drilldown steps that lack data are disabled/labeled rather than blocking the whole flow.
result: pending

### 6. Map-first AI command bar
expected: In any workbench mode, use the AI command bar with a role example prompt. Output updates draft/layers/cards first; any prose is a short summary — not a wall of text. Errors (if any) are human-readable.
result: pending

### Section B — Technical checks (run only if Section A all pass)

### 7. Hybrid routes and mode parsing
expected: /driver/day-plan, /fleet/contract-plan, /caas/gap-map, and /workbench?mode=… all land in the same workbench shell with the correct mode chrome/copy.
result: pending

### 8. Desktop / mobile layout chrome
expected: Desktop: map dominates viewport with left tools + right cards. Mobile (~390px): map primary + bottom sheet for tools (not a squeezed three-column layout).
result: pending

### Section C — Coverage / visual judgment

### 9. Screenshot / visual review (Driver, Fleet, CaaS)
expected: Visually confirm Driver, Fleet, and CaaS workbench initial states look map-first; Google tiles may be blank if key/referrer blocks — DOM/layout still must look correct.
result: pending

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps

[]
