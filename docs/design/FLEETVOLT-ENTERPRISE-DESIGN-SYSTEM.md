# FleetVolt Electric Command System

Version 1.0 · Controlled Alpha · 12 July 2026

## 1. System thesis

FleetVolt is an operating system for the Class 8 energy transition. It must feel like a freight command center: decisive, technical, physically grounded, and calm under load. It must never look like a generic SaaS dashboard, a consumer EV app, or a speculative crypto interface.

The system uses two intentional surfaces:

- **Command Dark** is the default application environment for navigation, dashboards, planning, analysis, and decisions.
- **Data Paper** is an exception used for maps, dense documents, long tables, and printable executive reports when a lighter field materially improves comprehension.

Dark and light are not interchangeable themes. They are assigned by task.

## 2. Brand principles

1. **Evidence before decoration.** Real routes, maps, charts, and source receipts are the imagery.
2. **One dominant signal.** Electric blue identifies the primary action or selected object. It does not wash entire screens.
3. **Industrial precision.** Square or 1–2 px radii dominate operating controls. Large soft cards are not a FleetVolt pattern.
4. **Telemetry has a voice.** JetBrains Mono is reserved for state, provenance, measurements, labels, and machine feedback.
5. **Motion proves state.** Motion communicates loading, route direction, freshness, or selection. It never decorates idle space.
6. **Unknown is not zero.** UI states must distinguish unavailable, stale, estimated, modeled, and verified data.

## 3. Color system

| Token | Value | Role |
|---|---:|---|
| Carbon | `#07090C` | Application canvas and deepest chrome |
| Gunmetal | `#121820` | Raised panels and top bars |
| Armor | `#202A34` | Interactive and secondary surfaces |
| Electric | `#42A5D9` | Primary action, active route, focus, selected state |
| Signal | `#6FD49A` | Verified, ready, feasible, live |
| Safety Amber | `#F0B84B` | Attention, infrastructure gap, modeled warning |
| Alert | `#E4675B` | Failure, destructive action, invalid state |
| Signal White | `#F3F7FA` | Primary text on Command Dark |
| Cool Copy | `#A5B2BC` | Secondary content |
| Instrument Gray | `#728390` | Metadata and inactive controls |

### Color rules

- Electric is the only brand action color.
- Green, amber, and red are semantic and must include text or icon support; color alone never carries status.
- Charts may extend the palette only through documented data series. They may not reuse semantic colors with a conflicting meaning.
- Focus rings use a brighter electric tint and remain visible on every surface.
- All body text and interactive controls target WCAG 2.2 AA. Large display text is not a reason to weaken operating-copy contrast.

## 4. Typography

### Arcline

Arcline is the FleetVolt application voice. Use Regular for body and interface copy, Bold for headings and strong values, and Light only for oversized editorial display. Default body copy is 14–16 px with 1.5–1.7 line height.

### Brokline

Brokline is a campaign signature, not an interface font. Its approved use is the public promise “OWN THE TRANSITION” and future equivalent brand moments approved by the product owner. Never use it for navigation, labels, data, or controls.

### JetBrains Mono

Use for telemetry, provenance, status, timestamps, coordinates, IDs, units, small caps labels, and machine feedback. Do not use it for paragraphs.

### Scale

| Role | Desktop | Mobile | Weight |
|---|---:|---:|---:|
| Hero | 64–104 px | 38–52 px | 700–900 |
| Page title | 32–48 px | 28–36 px | 700–900 |
| Section title | 22–32 px | 20–26 px | 700 |
| Card title | 16–20 px | 16–18 px | 700 |
| Body | 14–16 px | 14–16 px | 400 |
| Technical label | 7–10 px | 7–10 px | 700–900 mono |
| Data value | 18–40 px | 18–32 px | 700–900 |

## 5. Geometry and spacing

FleetVolt uses a 4 px base unit and an 8 px operating rhythm.

- Control heights: 40 px compact, 48 px standard, 56 px touch-priority.
- Page gutters: 64 px wide desktop, 32 px compact desktop/tablet, 16 px mobile.
- Panel padding: 24–32 px desktop, 18–22 px mobile.
- Panel gaps: 12–16 px compact, 20–28 px strategic.
- Radius: 0–2 px operating controls, 8 px popovers, full circles only for pins, status dots, and avatars.
- Borders: 1 px, cool blue-gray at 8–26% opacity.
- Shadows: restrained and deep; never soft white skeuomorphism.

## 6. Component contract

### Application shell

- Carbon canvas, fixed black navigation rail, translucent gunmetal top bar.
- The live Arcline FleetVolt lockup is the only internal wordmark.
- Active navigation uses an electric edge and brighter copy. Inactive copy must remain readable, not disabled-looking.
- Maps own their workspace and may replace the standard rail with the workbench tool rail.

### Buttons

- Primary: solid Electric, carbon copy, one per decision region.
- Secondary: transparent gunmetal, low-contrast border, cool copy.
- Destructive: Alert only after a clear consequence label.
- Disabled: remains legible and explains the missing prerequisite when the reason is not obvious.
- Loading: gray 50% page overlay where blocking is necessary, live trace ring, pulsing bolt; the bolt makes one rotation per minute.

### Panels and cards

- Panels group a decision or an evidence set, not arbitrary content.
- A colored left edge is reserved for verdicts, exceptions, and selected objects.
- Cards must have a label, a clear content hierarchy, and—if actionable—one obvious next action.

### Inputs

- Labels are always visible; placeholders do not replace labels.
- Units sit beside values and remain visible during editing.
- Validation appears adjacent to the field with corrective language.
- Route and location controls preserve source, freshness, and geometry state where relevant.

### Tables

- Sticky headers for long operational tables.
- Numeric columns align right; names and categories align left.
- Provenance and freshness are available without leaving the table context.
- Horizontal scrolling is acceptable only on Data Paper at mobile sizes; primary actions remain fixed or move above the table.

### Status

Approved vocabulary: `LIVE`, `VERIFIED`, `MODELED`, `ESTIMATED`, `STALE`, `UNAVAILABLE`, `BLOCKED`, `COMING SOON`, and `HUMAN REVIEW`.

### Maps

- Map geometry stays geographically true. No straight-line route placeholders may be presented as routed results.
- Markers use a shared visual mass. Meaning changes through color, symbol, and label—not arbitrary size.
- Selected routes isolate route-related evidence. Unrelated markers filter out unless explicitly restored.
- Proximity evidence defaults to a maximum 10-mile route detour unless a workflow specifies a stricter threshold.

## 7. Motion

| Motion | Duration | Use |
|---|---:|---|
| Micro response | 120–180 ms | Hover, press, small state change |
| Panel transition | 220–300 ms | Drawer, inspector, result panel |
| Route or data reveal | 350–700 ms | Progressive evidence reveal |
| Brand ring | 1.2 s loop | Active loading trace only |
| Bolt rotation | One rotation / 60 s | Loading and live brand lockup |

All motion honors `prefers-reduced-motion`. Reduced motion removes rotation, pulsing, route dashes, and transform-based transitions while preserving state changes.

## 8. Responsive behavior

Every product change is verified at:

- Desktop: 1440 × 900
- iPad: 1024 × 1366
- Mobile: 390 × 844

Desktop uses persistent navigation and multi-column evidence. iPad moves secondary controls to a drawer. Mobile prioritizes the map or current decision, uses a bottom sheet for supporting controls, and keeps touch targets at least 44 px.

Responsive design is not desktop shrinkage. Information order changes by role and task.

## 9. Accessibility and trust

- WCAG 2.2 AA is the minimum, including focus visibility, keyboard order, naming, and contrast.
- Do not rely on hover for critical evidence.
- Every icon-only action has an accessible name.
- Loading, empty, stale, partial, error, and success states are designed components—not incidental copy.
- Provenance is part of the product UI. Every modeled claim exposes source, method, scope, and freshness.
- Executive screenshots use real UI and clearly label mock carrier or market data.

## 10. Governance

### Locked

The FleetVolt mark geometry, Arcline wordmark, Carbon/Electric core palette, typography roles, and loading signature are locked. Changes require product-owner approval and a system version bump.

### Controlled

Component variants, density, responsive behavior, and data-visualization extensions may evolve through reviewed implementation receipts and viewport evidence.

### Deliberate refusals

- No generic white SaaS card grids.
- No glassmorphism as a visual theme.
- No glow except live energy, selected route, focus, or verified system state.
- No decorative AI imagery inside operational product surfaces.
- No new display font without replacing an existing role.
- No semantic color without text or icon reinforcement.
- No fake precision and no unlabeled mock data.

## 11. Migration order

1. Foundation tokens, live component showroom, role selection, application shell.
2. Dashboard family: Fleet Manager, Driver, CaaS summary, status.
3. Forms and setup family: fleet, driver, CaaS, load, unit.
4. Catalog and planner family.
5. Workbench rails, inspectors, cards, overlays, and route chooser without changing map readability.
6. Executive report and export parity, including print.

Each migration wave requires lint, typecheck/build, and visual evidence at all three required viewports before it is marked complete.
