# Phase 20 UI Design Contract — Route Manifest Selector

## Subject and job

**Subject:** a freight planner choosing a known port-to-generator road route inside the FleetVolt map workbench.

**Single job:** choose a trustworthy cached route faster than rebuilding endpoints, then understand in one glance whether road, traffic, and Class-8 charging intelligence are ready.

## Existing system contract

- Preserve FleetVolt black/graphite sidebar, paper/canvas surfaces, bolt blue accent, technical uppercase labels, and current type stack.
- Do not introduce gradients, decorative hero treatment, new global typography, or a second card language.
- Reuse existing 11–14px sidebar scale, 12px technical labels, 12–16px radii, and blue focus outline.

## Compact token set

| Token | Value | Use |
| --- | --- | --- |
| `manifest-ink` | `var(--fv-graphite)` | primary route/name text |
| `manifest-steel` | `var(--fv-steel)` | metadata and unavailable values |
| `manifest-blue` | `var(--fv-accent)` | selection/focus/ready signal |
| `manifest-paper` | `rgba(255,255,255,.82)` | selector surface |
| `manifest-rule` | `rgba(0,0,0,.10)` | separators |
| `manifest-warn` | existing warning/red token | stale/unavailable only |

## Layout

```text
ROUTE CATALOG
┌──────────────────────────────────┐
│ Choose a cached road route     ▾ │
│  PRECONFIGURED                   │
│   Port of Long Beach → K-PAC     │
│  RECENT                          │
│   Oakland → Tracy                │
└──────────────────────────────────┘
┌──────────┬──────────┬───────────┐
│ ROAD     │ TRAFFIC  │ CHARGE    │
│ 153 mi   │ p90 13k  │ 3 Class 8 │
└──────────┴──────────┴───────────┘

Origin [..........................]
                 ⇅ Swap
Destination [.....................]
```

## Signature element

The route manifest is a single instrument-like strip, not three cards. Hairline dividers encode three distinct data contracts: cached road truth, daily truck-traffic proxy, and Class-8 availability. It is the only new visual motif.

## Interaction states

- **Loading:** select is disabled and says `Loading route catalog…`; manifest is absent.
- **Empty shared catalog:** select remains present and says `No preconfigured routes yet`; manual entry remains fully usable.
- **Selected:** endpoints and cached road geometry apply immediately; map enters route-analysis mode.
- **Road unavailable:** route option may remain visible but disabled; manifest ROAD says `Not ready`; selecting never draws a chord.
- **Intelligence stale:** route remains selectable; TRAFFIC/CHARGE value uses `Stale` with existing warning treatment.
- **Recents unavailable/anonymous:** omit the Recent optgroup and show no accusatory login error.
- **Keyboard:** native select behavior; visible focus ring; manifest is descriptive, not interactive.

## Copy contract

- Label: `Route catalog`
- Placeholder: `Choose a cached road route`
- Groups: `Preconfigured`, `Recent`
- Manifest labels: `ROAD`, `TRAFFIC`, `CHARGE`
- No term `POI` in primary route names; show the actual generator/site name.
- Empty: `No preconfigured routes yet — enter endpoints below.`

## Responsive contract

- Desktop/iPad sidebar: selector and three-cell strip fit the existing rail width; values ellipsize, labels never wrap.
- Mobile bottom sheet: same selector; manifest remains three equal cells at 390px with 10–11px values.
- Do not widen the sidebar, move panels, or introduce a modal in this phase.

## Accessibility and motion

- Native `<select>` with associated visible label.
- Minimum 44px select target.
- `aria-live="polite"` announces applied route name.
- No new continuous motion. Respect current reduced-motion behavior.

## Visual review checklist

1. Dropdown clearly exposes both groups when recents exist.
2. Selecting a preconfigured route changes endpoints and road geometry.
3. Manifest contains no amenities or carrier clutter.
4. Text fits at desktop, iPad, and 390px mobile.
5. ScreenshotOne captures default catalog and selected manifest states after approved private-preview exposure.
