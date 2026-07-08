# FleetVolt Brand Bible
**Version 1.0 · July 2026 · Powered by Cleverwork / Zero Emission Advisors**

The single source of truth for the FleetVolt brand across product, marketing, print, and partner communications. The interactive edition lives in `FleetVolt Brand Guide.dc.html`; logo assets live in `/assets`.

---

## 01 · Brand Foundation

### What FleetVolt is
FleetVolt is an engineering-grade planning platform for zero-emission Class 8 freight. It answers hard operational questions — energy, grades, axle loads, charger gaps — with physics, not marketing.

### Design idea: **Technical Brand Geometry**
Every surface borrows from the engineering drawing: light blueprint fields, precise 0.5 px construction lines, dimension callouts, monospaced annotation, corner registration brackets, and skeuomorphic instrument-panel depth. If it wouldn't appear on a title block or a dyno chart, it doesn't belong.

### Personality (in order of priority)
1. **Precise** — measured, dimensioned, never approximate.
2. **Credible** — engineering candor; we show the limit lines.
3. **Calm** — quiet surfaces, restrained color, no urgency theater.
4. **Purposeful** — every element earns its place; zero decoration.

---

## 02 · Logo System

### The Bolt Mark
A lightning bolt constructed inside a blueprint frame: construction circle, four registration brackets, and a geometric bolt in Blueprint Blue. It represents electric power treated as an engineering quantity.

### Files
| File | Use |
|---|---|
| `fleetvolt-logo-horizontal-light.svg` | Primary lockup on light backgrounds (Paper/Fog) |
| `fleetvolt-logo-horizontal-dark.svg` | Primary lockup on dark backgrounds (Graphite) |
| `fleetvolt-logo-vertical-light.svg` | 1:1 square lockup, light backgrounds |
| `fleetvolt-logo-vertical-dark.svg` | 1:1 square lockup, dark backgrounds |
| `fleetvolt-favicon.svg` | Favicon / app icon (dark tile, works everywhere) |

### Rules
- **Clear space:** keep a margin equal to the bolt's width on all sides.
- **Minimum sizes:** horizontal — 96 px digital / 24 mm print. Vertical — 64 px / 16 mm. Favicon ≥ 16 px.
- **Color:** the bolt is always Blueprint Blue (PMS 646 C in print). Wordmark is Graphite on light, Paper on dark. One-color fallback: all-Graphite (light) or all-Paper (dark).
- **Production note:** convert wordmark text to outlines before sending to print vendors.

### Logo don'ts
- ✕ Don't rotate, skew, or add drop shadows / glows.
- ✕ Don't recolor the bolt (no green, no red, no gradients).
- ✕ Don't place the light lockup on photography or mid-tone fields — use the dark lockup on Graphite scrim.
- ✕ Don't set the wordmark in any typeface other than Inter Bold.
- ✕ Don't detach or redraw the bolt, or use the wordmark without clear space.

---

## 03 · Color

Every color is specified for **digital (HEX/RGB)** and **print (CMYK + Pantone)**. All CMYK values sit safely inside coated-stock gamut — nothing in this palette relies on RGB-only luminosity.

### Core neutrals
| Name | HEX | RGB | CMYK | Pantone | Role |
|---|---|---|---|---|---|
| Graphite | `#141416` | 20 20 22 | 0/0/0/92 † | Black 6 C | Primary text, dark surfaces, primary buttons |
| Slate | `#4A4A52` | 74 74 82 | 10/10/0/68 | Cool Gray 11 C | Secondary text |
| Steel | `#8A8A93` | 138 138 147 | 6/6/0/42 | Cool Gray 7 C | Construction lines, muted labels |
| Fog | `#DEDEE6` | 222 222 230 | 3/3/0/10 | Cool Gray 1 C | Canvas background |
| Paper | `#EFEFF5` | 239 239 245 | 2/2/0/4 | 663 C | Panels, cards |

† Large solid Graphite areas in print: use rich black **C60 M50 Y40 K100**. Body text: 100 K only.

### Functional color
| Name | HEX | RGB | CMYK | Pantone | Role |
|---|---|---|---|---|---|
| Blueprint Blue | `#4C8FB8` | 76 143 184 | 59/22/0/28 | 646 C | Brand accent, energy data, active states |
| Signal Green | `#3F9B6B` | 63 155 107 | 59/0/31/39 | 7724 C | Positive status, within-limit |
| Caution Amber | `#B8874C` | 184 135 76 | 0/27/59/28 | 729 C | Warnings, near-limit |
| Alert Red | `#C0392B` | 192 57 43 | 0/70/78/25 | 7580 C | Limit exceeded, constrained |

### Proportion rule — 80 / 15 / 5
~80% neutrals (Fog/Paper), ~15% Graphite/Slate (text & primary actions), ≤5% Blueprint Blue. Status colors appear **only** on data that has a status. 

### Color don'ts
- ✕ Never use status colors decoratively (green headline, red pill for emphasis).
- ✕ Never fill large areas with Blueprint Blue — it's an annotation color, not a wall paint.
- ✕ Never place Blueprint Blue text on Graphite at small sizes (contrast fails) — use Paper text.
- ✕ Never introduce new hues. Tints of the palette are allowed at 4–18% opacity for fills.
- ✕ Never use pure `#000` or `#FFF` — Graphite and Paper replace them.

---

## 04 · Typography

| Role | Face | Weight | Size (digital) | Tracking |
|---|---|---|---|---|
| Display / page titles | Inter | 700 | 19–26 px | −0.3 px |
| Component names, body | Inter | 400–600 | 11–13 px | 0 |
| Section labels | JetBrains Mono | 500–600 | 9.5–10 px CAPS | +1.5 px |
| Data values | JetBrains Mono | 600 | 13–26 px | 0 |
| Metadata / footnotes | JetBrains Mono | 400 | 8.5–10 px CAPS | +0.5–1 px |

**The two-voice rule:** Inter *names* things; JetBrains Mono *measures* things. Any number a fleet manager might act on — kWh, %, lb, mi, kW — is set in Mono. No third typeface, ever.

**Print:** both faces are OFL-licensed — embed freely. Body minimum 9.5 pt; mono captions minimum 7 pt. Fallbacks (email/office only): Helvetica ↔ Inter, Courier New ↔ JetBrains Mono.

**Embossed text** (light UI only): `text-shadow: 0 1px 1px rgba(255,255,255,0.8)` on Graphite text over Paper. Never on dark surfaces, never in print.

---

## 05 · Layout & Structure

### The Framed Instrument
Every screen is one centered Paper frame on a Fog canvas:
- Radius **24 px**, 1 px border `rgba(0,0,0,0.06)`
- Top-sheen gradient + 22 px diagonal check pattern at 2% black
- Multi-layer elevation shadow (4 stacked shadows, 2.8 → 100 px)
- Inset **corner brackets**: 14 px L-shapes, 1 px `rgba(0,0,0,0.25)`, 18 px from corners — top-level frames only
- Content grid: 3 columns (rail ≈ 250–320 px · center flex · rail ≈ 268–300 px), 20 px gaps

### Radius scale
`6 / 8 / 9 / 11 / 12 / 14 / 24 px` — pills and toasts use `9999px`. Nothing else.

### Print layout
Title block (mono metadata top-left, version bottom-right), 0.5 pt construction rules, generous margins ≥ 12 mm. The corner-bracket device translates directly to print as registration marks.

---

## 06 · Component Library (spec summary)

| Component | Surface | Border | Radius | Type |
|---|---|---|---|---|
| Primary button | Graphite gradient `#2A2A2E→#141416` + inset top light | 1px `#000` | 12 px | Inter 600, Paper |
| Secondary button / pill | `#FBFBFD→#E9E9EF` + inset top light | 1px `rgba(0,0,0,0.1)` | 9999 px | Inter 600, Graphite, embossed |
| Card / panel | `#FBFBFD→#EDEDF2` | 1px `rgba(0,0,0,0.06)` | 12 px | label Mono caps + value Mono 600 |
| KPI cell | as card, padding 9–12 px | — | 9 px | 8.5px label / 15–22px value |
| Segmented control | track `#E4E4EA` inset shadow; thumb `#FBFBFD→#E4E4EA` | 1px `rgba(0,0,0,0.08)` | 8–9 px | Mono 9.5px 600 |
| Selector row (active) | Graphite gradient, Paper text | 1px `rgba(0,0,0,0.08)` | 11 px | Inter 600 + Mono meta |
| Status badge | dot 6–8 px + Mono 10.5px | pill | 9999 px | dot glows `0 0 6px` at 70% |
| Table | header Mono 8.5px caps Steel; rows 10.5px; 1px `rgba(0,0,0,0.05)` dividers | — | — | Δ columns Green/Red |
| Slider | 4px track gradient; 15px thumb `#FBFBFD→#d4d4da` | thumb 1px `rgba(0,0,0,0.25)` | round | value in Mono right-aligned |
| Toast | Graphite pill, bottom-center | 1px `#000` | 9999 px | Mono 12px Paper |
| Modal | Paper, radius 18, brackets, scrim `rgba(40,40,46,0.32)` + 3px blur | 1px `rgba(0,0,0,0.1)` | 18 px | — |
| Diagram | 0.5–1px strokes, Steel construction, Mono annotations, dimension ticks | — | — | accent = data only |

### Interaction rules
- Hover: `translateY(-1/-2px)` lift, 0.15–0.18 s ease. No color swaps, no glows.
- Selected = Graphite inversion (never blue fills).
- Every metric animates ≤ 0.35 s ease when data changes.

---

## 07 · Building New Components — the recipe

1. **Start with the surface:** light gradient `#FBFBFD → #ECECF1`, 1 px `rgba(0,0,0,0.06–0.1)` border, `inset 0 1px 0 rgba(255,255,255,0.9)` top highlight, soft 1–2 px drop.
2. **Label in Mono, name in Inter:** every region gets a Mono caps label (8.5–10 px, Steel, +0.5–1.5 tracking).
3. **Measure, don't decorate:** if the component shows a quantity, show its unit, and set both in Mono.
4. **Pick from the radius scale** — never invent a new radius.
5. **Status via the three functional colors only,** and only when the data has a status.
6. **Depth is physical:** inset highlights above, inset shade below, shadow scale with elevation. No flat Material cards, no glassmorphism.
7. **Annotate like a drawing:** callouts use 0.5 px dashed leaders + Mono labels; corners of top-level frames get brackets — nothing else does.

**Ship checklist:** □ palette-only colors □ two typefaces only □ Mono for all numbers □ radius from scale □ inset top highlight □ hover = lift □ works on Fog and Paper □ CMYK-safe if printed □ no emoji, no new hues, no left-border accent cards.

---

## 08 · Brand Voice

### Principles
1. **Precision over persuasion.** Say "312 kWh net, 47 kWh regen credit," not "amazing efficiency."
2. **Engineering candor.** Show limit lines and failure states plainly: "Exceeds 82,000 lb GCW. Not dispatch-legal."
3. **Numbers carry the message.** Claims are always dimensioned — no naked adjectives.
4. **Calm authority.** No exclamation marks, no urgency theater, no "🚀 supercharge your fleet!"

### Vocabulary
Say: *corridor, unit, modeled, actual, envelope, headroom, margin, constraint, dwell, regen credit.*
Avoid: *game-changing, revolutionary, seamless, supercharge, unlock, blazing-fast, AI-powered (as a benefit).* 

### Microcopy rules
- Buttons are verbs: "Run Physics Simulation," "Apply to Route" — never "Go!" or "Let's do this."
- Status is factual: "Within limit ✓ / Near limit / Over limit ⚠" — severity comes from data, not adjectives.
- Timestamps are honest: "Updated 4h ago," never "just now" if it wasn't.
- Empty states instruct: "Select a charger node to inspect power and utilization."

### Voice do / don't
| ✓ Do | ✕ Don't |
|---|---|
| "Net energy 312 kWh — within battery envelope." | "Incredible range you can trust!" |
| "142 mi gap on I-15. Nearest ≥350 kW site: Barstow." | "Uh oh! No chargers nearby 😬" |
| "62% cost savings vs diesel, ton-mile basis." | "Massive savings guaranteed." |
| "Simulation current." | "You're all set!!!" |

---

## 09 · Master Do & Don't

**Do**
- Anchor every layout to one Paper frame on Fog.
- Dimension everything: units, ticks, callouts, datums.
- Use Graphite inversion for selection and primary actions.
- Keep motion under 0.4 s and purposeful (state change, not delight).
- Give print vendors Pantone + CMYK from §03 and outlined logos.

**Don't**
- ✕ Emoji in product UI or print (voice examples above show why).
- ✕ Gradient backgrounds beyond the sanctioned surface gradients.
- ✕ Rounded cards with left accent borders (generic SaaS pattern).
- ✕ New hues, neon, or RGB-only colors that die on press.
- ✕ Fonts beyond Inter + JetBrains Mono.
- ✕ Decorative icons or illustration; diagrams only, drawn to spec.
- ✕ Dark mode improvisation — dark surfaces are Graphite panels within the light system, not a separate theme.

---

## 10 · Asset Index

```
assets/
  fleetvolt-favicon.svg                 app icon / favicon (dark tile)
  fleetvolt-logo-horizontal-light.svg   primary lockup · light bg
  fleetvolt-logo-horizontal-dark.svg    primary lockup · dark bg
  fleetvolt-logo-vertical-light.svg     1:1 lockup · light bg
  fleetvolt-logo-vertical-dark.svg      1:1 lockup · dark bg
FleetVolt Brand Guide.dc.html           interactive brand bible (this doc, HTML)
FleetVolt-Brand-Guide.md                this file
```

Questions → Brand & Design, Cleverwork / Zero Emission Advisors.
