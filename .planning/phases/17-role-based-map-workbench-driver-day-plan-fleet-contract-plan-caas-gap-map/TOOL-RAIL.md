# Workbench Tool Rail — Navigation + Tool Panel

**Status:** Locked UX (Phase 17 UAT, 2026-07-08)  
**Owner surface:** Map workbench (`/workbench`, `/driver/day-plan`, `/fleet/contract-plan`, `/caas/gap-map`)

## Problem this solves

Phase 16 introduced a global left **AppShell sidebar** (role-filtered nav). Phase 17 needs a **map-first** planning surface where day-plan / contract / gap tools must sit beside the map without crushing it.

Running both chrome systems at once (global sidebar + floating tool overlays) wasted horizontal space and left an empty graphite rail when `useRoleNav()` had no role yet. The product decision: **on map workbench routes, the left rail is the tool panel; role navigation lives at the top of that same rail.**

## Locked layout

```
┌─ AppShell top bar (page title + user) ─────────────────────────┐
│ ┌─ Tool rail (~320px) ─────────┐ ┌─ Map (full remaining) ────┐ │
│ │ Logo                         │ │                           │ │
│ │ Role nav links (above)       │ │  Route + assets + spurs   │ │
│ │ ───────────────────────────  │ │                           │ │
│ │ ▾ Day-plan inputs (tools)    │ │                           │ │
│ │   …form / layers / AI…       │ │                           │ │
│ │ ▸ Day-plan summary (cards)   │ │                           │ │
│ └──────────────────────────────┘ └───────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### Rules

1. **Global `Sidebar` is hidden** on map-workbench routes. `AppShell` uses `isMapWorkbenchRoute()` → no sidebar, `pl-0`, full-bleed `main` (`fv-app-main--map`).
2. **Tool rail owns the left edge** (`workbench-tool-rail`, ~`w-80`). Map is the primary work surface beside it.
3. **Navigation sits above tools** — `WorkbenchRailNav`: logo → role nav links → then accordion tool sections.
4. **Tools slide open/closed as accordions** under the nav:
   - Inputs accordion: default **open**
   - Summary accordion: default **collapsed**
   - Open state persisted in `localStorage` (`fleetvolt_workbench_inputs_open`, `fleetvolt_workbench_summary_open`)
5. **Same shell, different job** — Driver / Fleet / CaaS share the rail; eyebrow + title + layer set change by mode.
6. **Dashboards keep the global sidebar** — `/driver`, `/fleet`, `/caas` remain launchpads with Phase 16 chrome. Empty role nav there is a separate auth/role-hydration concern, not a reason to put planning tools back in the global sidebar.

## Key files

| Piece | Path |
|-------|------|
| Hide global sidebar on workbench | `apps/web/src/components/nav/app-shell.tsx` (`isMapWorkbenchRoute`) |
| Stacked rail shell | `apps/web/src/components/workbench/map-workbench/map-workbench-shell.tsx` |
| Nav above tools | `apps/web/src/components/workbench/map-workbench/workbench-rail-nav.tsx` |
| Role-scoped layers | `apps/web/src/components/workbench/map-workbench/role-layers.ts` |
| Global sidebar (non-workbench) | `apps/web/src/components/nav/sidebar.tsx` |

## What not to do

- Do not re-enable the global AppShell sidebar on workbench routes “to fix empty nav.”
- Do not put day-plan / contract / gap forms only in the global sidebar.
- Do not treat an empty `useRoleNav()` list on `/driver` as a blocker for the workbench tool rail — the rail already shows a short “role tools load after…” fallback and still exposes planning accordions.

## Follow-ups (optional)

- When role hydrates slowly on dashboards, soft-fallback nav items by path (`/driver` → driver toolbox) without changing the workbench rail contract.
- Mobile: bottom sheet already carries tools; keep nav accessible via sheet or compact header, not a second desktop sidebar.
