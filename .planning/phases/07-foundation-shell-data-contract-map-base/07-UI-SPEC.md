---
phase: 7
slug: foundation-shell-data-contract-map-base
status: approved
shadcn_initialized: false
preset: none
created: 2026-07-06
---

# Phase 7 — UI Design Contract

> Visual and interaction contract for the Freight Pulse `/pulse` foundation. Locked strictly against the Technical Brand Geometry design system (`Design/Technical_Brand_Geometry_Component_Library_Spec.md` + `Design/technical-brand-geometry-1.html`, the primary visual truth). Covers only what Phase 7 ships: the CAD shell, framed map container, port anchors, control-panel chrome, sources footer, and the Data Quality Inspector drawer shell. Flow animation, hotspot popups, market-sizing, and time controls are contracted in their own phases (8–10).

---

## Source of Truth

- **Primary visual truth:** `Design/technical-brand-geometry-1.html`
- **Token/component spec:** `Design/Technical_Brand_Geometry_Component_Library_Spec.md`
- **Screen PRDs:** `Design/UI_UX_Screen_PRDs_Technical_Brand_Geometry.md`
- **⚠ Aesthetic reconciliation:** design system is a **LIGHT technical blueprint** (#EFEFF5 background, cool-gray 0.5px lines), NOT a dark blueprint. The "blueprint grid" in CONTEXT.md refers to this light, faint technical grid. Follow the design MD.
- **⚠ Framework note:** design MD says "Next.js 15" and "GSAP 3.12 / Three.js r134"; repo is on **Next 16.2.9** and STACK research pins **GSAP 3.15**. Use the repo/research versions — the design MD versions are indicative, its *tokens* are authoritative.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (bespoke Technical Brand Geometry component library — not shadcn presets) |
| Preset | not applicable |
| Component library | radix (already installed: dropdown-menu, select, slider, collapsible, checkbox, label, slot) — used as unstyled primitives under the CAD skin |
| Icon library | lucide-react (already installed) — rendered as thin/technical where possible |
| Font | Inter (display/body, weights 400/500) + JetBrains Mono (labels/dimensions/metadata, 600 label / 400 value) — both already loaded via `next/font` in `layout.tsx` |

---

## Spacing Scale

Declared values (multiples of 4; derived from design MD `--spacing-*`):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, tick spacing, inline dimension padding |
| sm | 8px | `--spacing-base`; compact control spacing, metadata line gaps |
| md | 16px | `--spacing-gap`; default element spacing |
| lg | 24px | `--spacing-card-padding`; card/panel internal padding, section padding |
| xl | 32px | Framed-container internal padding (`p-8`), layout gaps |
| 2xl | 48px | `--spacing-section` min; major section breaks |
| 3xl | 64px | Page-level spacing, large display rhythm |
| 4xl | 80px | `--spacing-section` max; hero/framed breathing room |

Exceptions: none — all values are 4px multiples.

---

## Typography

| Role | Size | Weight | Line Height | Family |
|------|------|--------|-------------|--------|
| Body | 16px | 400 | 1.6 | Inter |
| Label (technical) | 12px | 600 | 1.3 | JetBrains Mono |
| Metadata (small) | 10–11px | 400 | 1.3 | JetBrains Mono |
| Heading (section) | 24–32px | 500 | 1.2 | Inter |
| Display | 64px | 500 | 1.04 | Inter |

Notes: technical labels, dimensions, port codes, and the sources footer all use JetBrains Mono, uppercase where appropriate, with an embossed text-shadow (`--color-embossed: rgba(255,255,255,0.8)`) on light surfaces.

---

## Color

Brand 60/30/10 (from design MD `--color-*`):

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#EFEFF5` | Main background + faint blueprint grid overlay |
| Secondary (30%) | `#FFFFFF` | Framed container, cards, panels, control surfaces |
| Accent (10%) | `#0F766E` (teal) | Sparingly — active control state, focused port anchor, selected toggle. NEVER all interactive elements. |
| Destructive/Warning | `#DC2626` | Validation warnings, "Simulated"/stale-data badge outline, error callouts only |

Technical line/text tokens: `--color-line: #8A8A93` (0.5px strokes, grid, SVG dimension lines), `--color-line-subtle: rgba(0,0,0,0.08)` (faint guides), `--color-text-primary: #111827`, `--color-text-secondary: #4B5563`, `--color-success: #059669` (positive deltas).

**Accent reserved for:** active/selected control state (port selector, matching-mode toggle), focused map anchor, primary CTA border. Not for body text, not for every hover.

**⚠ Functional data palette (separate from brand color, defined here, consumed in Phase 8):** freight-flow R/Y/G is a *data-encoding* palette, not brand accent — Green `#059669` (free-flow, aligns with `--color-success`), Amber `#D97706` (moderate), Red `#DC2626` (congested, aligns with `--color-warning`). Kept distinct so the 10% accent budget is not blown by data viz. Phase 7 only needs these declared as tokens; flows render in Phase 8.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Nav tab label | `Freight Pulse` |
| Page metadata (top-left block) | `SURFACE` / `FREIGHT PULSE — WEST COAST` |
| Page metadata (bottom-right block) | `DATASET` / `{active source} · {year}` |
| Primary CTA (port focus) | `Focus Port` |
| Empty state heading (no data yet) | `No corridor data loaded` |
| Empty state body | `Freight datasets are still ingesting. Corridors appear as sources finish loading.` |
| Error state (map/data load fail) | `Couldn't load {layer}. Showing last cached data.` + orange `Simulated` badge |
| Sources footer | `Sources: FAF5 (BTS/FHWA) · Caltrans PeMS/AADT · FHWA · FMCSA · port authorities. Flow animation is illustrative, scaled from annual tonnage.` |
| Data Quality Inspector trigger | `Data Quality` (collapsed drawer handle) |
| Provenance badge (per layer) | `{SOURCE} · {year} · usefulness {n}/10` |

---

## Screen / Component Contract (Phase 7 scope)

| Component | Contract | Ships in P7 |
|-----------|----------|-------------|
| `TechnicalFrame` (FramedMainContainer) | `rounded-3xl` (24px), white surface, heavy layered skeuomorphic shadow (design MD §2.5 exact stack), gradient border via `::before`, 4 inset L-corner brackets, `p-8` internal | ✓ full |
| `BlueprintGrid` (WebGLBackground) | Faint light technical grid, opacity 0.15–0.25, `pointer-events:none`, `z-index:0`, rendered OFF the Google GL canvas (DOM/canvas layer behind the frame per architecture research); DPR cap 2; pause when tab hidden | ✓ full |
| `SkeuomorphicCard` | Lighter gradient border + inner shadow, `rounded-2xl`, `p-6`/`p-8` | ✓ shell |
| `MetadataBlock` | Absolute top-left + bottom-right JetBrains Mono labels, embossed, 2-line (category + value) | ✓ full |
| `DimensionCallout` | Base component defined (line + 2 ticks + JetBrains Mono `<text>`), used for provenance readouts in P7; full popup use in P9 | ✓ base only |
| `PulseMap` (framed Google vector map) | Google vector map (mapId, cloud CAD styling so default Google style doesn't leak), West-Coast framing on load, contained inside `TechnicalFrame` | ✓ base map + framing |
| Port anchors | `AdvancedMarkerElement`, technical marker style, JetBrains Mono port codes (POLA/POLB/HUE/OAK/SF/SD); focused state uses accent | ✓ full |
| Control panel | Houses port selector, (P10) time filter, (P9) overlay toggles + matching-mode toggle; `TechnicalButton`/technical-pill styling, radix primitives under CAD skin | ✓ shell + port selector |
| Sources footer | Persistent, always-visible, JetBrains Mono, cites datasets + illustrative-data disclaimer | ✓ full |
| Data Quality Inspector | Collapsed-by-default skeuomorphic technical drawer; P7 ships the drawer shell + provenance badge rendering; raw-sample/column-audit content lands in P9 (DINT-04) | ✓ shell + provenance badge |

---

## Motion Tokens (GSAP 3.15)

| Interaction | Ease | Duration | Notes |
|-------------|------|----------|-------|
| Reveals (frame/panel entrance) | `power3.out` | 0.6–0.8s | stagger 0.1s |
| SVG drawing (dimension lines, brackets) | `power2.inOut` | 0.4–0.6s | DrawSVG (free in 3.15) |
| Hover lift (buttons/cards) | `power2.out` | 0.3–0.4s | scale 1.02–1.03 |
| Blueprint grid drift | linear/`sin(time)` | very slow | infinite, off GL canvas |

Restrained, purposeful only. No motion on the map render loop (that's deck/Google's concern in later phases).

---

## Responsive Behavior

- Desktop / large display (primary demo target): full framed aspect + generous internal space.
- Tablet: collapse control panel / inspector into bottom sheets or accordions; keep the framed map prominent.
- Phone: out of scope for this milestone (demo runs on laptop/large display).

---

## Accessibility Basics (SHELL-05, contracted here, verified in P10)

- Keyboard-focusable controls (port selector, drawer handle, toggles) with visible focus ring (accent teal).
- ≥4.5:1 contrast on callout/label text (verify `#4B5563` secondary on `#FFFFFF`/`#EFEFF5` — passes; `#8A8A93` lines are non-text).
- `aria-label` on interactive SVG/map controls and the legend; alt text on iconography.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none (not using shadcn presets) | not required |
| Bespoke Technical Brand Geometry library | TechnicalFrame, BlueprintGrid, SkeuomorphicCard, MetadataBlock, DimensionCallout, TechnicalButton | authored in-repo from design MD; no third-party registry pull |
| radix-ui primitives | dropdown-menu, select, slider, collapsible, checkbox, label, slot | already vendored in package.json; unstyled, skinned by CAD library |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-07-06 (gsd-ui-checker, 6/6, no blocking issues)

### Non-blocking FLAGs (carry into Phase 8 flow-engine spec — do not gate P7)
1. **Amber `#D97706` is a net-new token** not in the design MD (which carries only success `#059669`, warning `#DC2626`, accent `#0F766E`). Add it to the design MD token set before flows render, so the palette stays single-source-of-truth.
2. **Data R/G reuse brand semantic tokens** (green=`--color-success`, red=`--color-warning`). Separate from the *accent* budget (holds), but not from success/warning semantics — confirm intentional when flows land in P8.
3. **STACK Variant A specifies vivid flow colors** (green `#00d17a`, yellow `#ffc400`, red `#ff3b30`) that differ from this contract's muted brand-aligned values. The muted CAD values are preferred; explicitly reconcile/overwrite the STACK values in the Phase 8 spec to avoid drift.
4. STACK recommends shadcn/ui; this contract intentionally goes bespoke-CAD-over-radix per CONTEXT D-08. Intentional deviation, noted.
