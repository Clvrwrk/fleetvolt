---
status: resolved
trigger: "Clicking Show freight volume out of west coast ports changes the map but Apply to map goes grey without visible completion, and remains disabled after refresh."
created: 2026-07-12
updated: 2026-07-12
---

# AI map action stuck disabled

## Symptoms

- Expected: selecting the west-coast freight-volume preset should visibly apply the intended map state, provide a clear result or completion message, and leave Apply to map ready for the next command.
- Actual: the statewide map remains visually crowded, Apply to map becomes disabled with no visible outcome, and refresh does not restore the control.
- Errors: none surfaced in the UI.
- Timeline: observed on the temporary Vercel review build after Phase 20 visual handoff.
- Reproduction: open `/workbench?mode=caas_gap_map`, click `Show freight volume out of west coast ports`, then refresh.

## Current Focus

- hypothesis: confirmed and repaired.
- test: exact public-Vercel click and refresh reproduction plus regression, lint, production/Docker builds, browser inspection, and three ScreenshotOne viewports.
- expecting: command remains visible; Apply re-enables; explicit completion receipt is visible; west-coast freight preset isolates ports/freight/geo/highways; refresh preserves the correct layer profile without disabling Apply.
- next_action: Chris visual acceptance on FLE-17.

## Evidence

- 2026-07-12: live refreshed page showed an empty command input, disabled Apply button, no summary/error, and only Class 8 gap + carrier controls active.
- 2026-07-12: the west-coast freight prompt was absent from the deterministic-intent matcher, so it could call the general planner and fall into the generic CaaS gap/carrier fallback.
- 2026-07-12: successful submit explicitly cleared the input; disabled state was `isRunning || prompt.trim().length === 0`, so the idle button looked permanently grey after every preset run and refresh.
- 2026-07-12: completion summary rendered below all example chips, outside the visible panel area in the reported desktop state.
- 2026-07-12: repaired public review keeps the command populated, leaves Apply enabled, and shows `Applied to map` with the freight-specific summary.
- 2026-07-12: repaired freight preset activates only ports, freight-flow, geo-regions, and highways and removes unrelated markers.
- 2026-07-12: ScreenshotOne desktop 1440x900, iPad 1024x1366, and mobile 390x844 receipts passed.

## Eliminated

- hypothesis: a persisted in-flight request flag caused the disabled button. Evidence: `isRunning` is component-local React state initialized false; live inspection showed an empty input and no running/error state.

## Resolution

- root_cause: three UX/control-flow defects combined: the known freight prompt was not routed to its deterministic intent, the generic fallback persisted gap/carrier layers instead, and successful execution cleared the input while the only visible completion message sat below the fold. The disabled button was valid empty-input behavior but appeared stuck.
- fix: added a dedicated west-coast freight result with a decluttered layer set and geographic focus; classified freight prompts as deterministic; retain/prepopulate the command so Apply remains available; moved an `aria-live` completion receipt above suggestion chips; added a shareable `aiPreset=west-coast-freight` deep link for reproducible review evidence.
- verification: focused ESLint pass; regression test 1/1; Next production build pass; Docker production build pass; exact click then refresh passes on public Vercel; ScreenshotOne passes at all three required viewports.
- files_changed: apps/web/src/components/workbench/map-workbench/ai-command-bar.tsx, apps/web/src/lib/ai-command-bar.test.ts.
