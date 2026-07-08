# FleetVolt Route — Technical Brand Geometry
## Component Library & Token Implementation Spec

**Version**: 1.0  
**Date**: July 1, 2026  
**Design System Source**: `technical-brand-geometry-1.html` (primary visual truth) + DESIGN.md  
**Application**: Premium engineering-grade UI for Class 8 EV freight modeling and infrastructure planning

---

## 1. Design Principles (Non-Negotiable)

- **Engineering Precision**: Every element must feel like a technical drawing or CAD interface. Use precise 0.5px strokes, dimension lines, ticks, and callouts.
- **Skeuomorphic Depth**: Heavy layered shadows, gradient borders that simulate physical edges (top highlight, bottom shadow), inset L-shaped corner brackets.
- **Light Blueprint Aesthetic** (from HTML source of truth): Clean light background (#EFEFF5 or close), cool gray lines (#8A8A93), subtle technical grid, embossed text.
- **Restrained Motion**: GSAP-powered, purposeful, never distracting. Masked reveals, SVG drawing, subtle hover lifts.
- **Focal Technical Diagrams**: Central SVG or canvas visualizations always take visual priority.
- **Consistency**: All screens share the same framed container treatment, typography pairing, and annotation system.
- **Performance First**: WebGL and complex SVGs must remain lightweight and optional in intensity.

---

## 2. Design Tokens

### 2.1 Colors (Light Technical Blueprint)

```css
--color-bg: #EFEFF5;                    /* Main background */
--color-surface: #FFFFFF;               /* Cards / framed areas */
--color-line: #8A8A93;                  /* Primary technical lines, strokes */
--color-line-subtle: rgba(0,0,0,0.08);  /* Faint grid / guides */
--color-text-primary: #111827;          /* Slate-900 equivalent */
--color-text-secondary: #4B5563;        /* Slate-600 */
--color-embossed: rgba(255,255,255,0.8);/* Text shadow for embossed effect */
--color-accent: #0F766E;                /* Subtle teal for highlights (optional, use sparingly) */
--color-warning: #DC2626;               /* Technical red for warnings */
--color-success: #059669;               /* Subtle green for positive deltas */
```

**Usage**:
- Backgrounds: `--color-bg` + subtle blueprint grid overlay.
- Lines & SVGs: `--color-line` at 0.5px stroke-width.
- Text: Primary for labels, Secondary for supporting info. Always embossed on light surfaces.

### 2.2 Typography

- **Display / Body**: `Inter` (weights 400, 500)
- **Technical Labels, Dimensions, Metadata**: `JetBrains Mono` (weight 600 for labels, 400 for values)
- **Scale** (aligned with source):
  - Large display: 64px / 1.04 line-height
  - Section headers: 24–32px Inter 500
  - Body: 16px Inter 400 / 1.6
  - Technical labels & dimensions: 12px JetBrains Mono 600
  - Small metadata: 10–11px JetBrains Mono

### 2.3 Spacing & Layout

```css
--spacing-base: 8px;
--spacing-gap: 16px;
--spacing-card-padding: 24px;
--spacing-section: 48–80px;
```

- Main framed container: generous internal padding + breathing room.
- Deliberate, stable rhythm — avoid cramping technical diagrams.

### 2.4 Rounded & Borders

```css
--radius-card: 24px;        /* Main framed areas (or 16–20px) */
--radius-control: 8px;
--radius-pill: 9999px;
```

- Gradient border treatment on framed containers and cards (top white highlight → bottom subtle shadow via pseudo-element or multiple shadows).

### 2.5 Shadows (Skeuomorphic Layered)

Heavy multi-layer shadow for main frame (inspired by source):
```css
shadow-[0_2.8px_2.2px_rgba(0,0,0,0.034),_0_6.7px_5.3px_rgba(0,0,0,0.048),_0_12.5px_10px_rgba(0,0,0,0.06),_0_22.3px_17.9px_rgba(0,0,0,0.072),_0_41.8px_33.4px_rgba(0,0,0,0.086),_0_100px_80px_rgba(0,0,0,0.12)]
```

Plus inner highlight/shadow for skeuomorphic depth:
```css
after:shadow-[inset_0_1px_1px_rgba(255,255,255,1),_inset_0_-1px_2px_rgba(0,0,0,0.1)]
```

### 2.6 Motion Tokens (GSAP)

- **Reveals**: `power3.out`, duration 0.6–0.8s, stagger 0.1s
- **SVG Drawing**: `power2.inOut` or `power2.out`, 0.4–0.6s
- **Hover Lift**: `power2.out`, scale 1.02–1.03, duration 0.3–0.4s
- **Diagram Updates**: Smooth morphs, 0.3–0.5s

---

## 3. Core Components

### 3.1 WebGLBackground

**Purpose**: Subtle animated technical grid behind all content.

**Implementation**:
- Three.js `LineSegments` with diagonal lines.
- `FogExp2` for edge fading.
- Very low opacity (0.15–0.25).
- Slow position animation (`sin(time)` + infinite scroll on one axis).
- `pointer-events: none`, `z-index: 0`.
- Resize handler + DPR cap at 2.

**Props**: `intensity` (default low), `speed` (very slow).

**Usage**: Mount once at root or per page. Consistent across all 6 screens.

### 3.2 FramedMainContainer

**Purpose**: The signature skeuomorphic framed area that contains the main content of every screen.

**HTML Structure** (Tailwind + custom):
```html
<div class="gradient-border-wrapper relative w-full max-w-[90vw] lg:max-w-4xl aspect-[4/5] lg:aspect-video rounded-3xl shadow-[...heavy layers...] bg-white">
  <!-- Inset L-brackets -->
  <div class="corner-bracket corner-tl"></div>
  ... (4 brackets)
  
  <!-- Internal faint grid guides (optional) -->
  <div class="absolute inset-0 pointer-events-none opacity-10 ..."></div>
  
  <!-- Content -->
  <div class="relative z-10 p-8 ...">
    <!-- Top-left MetadataBlock -->
    <!-- Central Technical Visualization -->
    <!-- Bottom-right MetadataBlock -->
  </div>
</div>
```

**CSS for gradient border** (from source):
Use `::before` pseudo with `linear-gradient` + mask for the physical edge effect.

**Variants**:
- `default` (large hero/dashboard)
- `compact` (for side panels or smaller cards)

### 3.3 TechnicalSVGDiagram (Base Class)

**Purpose**: Reusable base for all technical drawings (truck, route, load, network, envelope).

**Key Features**:
- Precise `vector-effect: non-scaling-stroke`
- Classes: `svg-stroke`, `svg-stroke-dashed`, `svg-fill-light`, `svg-fill-dark`, `svg-dimension-line`, `svg-tick`, `svg-text`
- Drop shadow group (`svg-drop-shadow`)
- Dimension annotation system (lines + ticks + `<text>` callouts)

**Recommended SVG Structure**:
```svg
<svg viewBox="..." class="w-full h-full overflow-visible">
  <!-- Background construction lines -->
  <!-- Main geometry group with drop-shadow -->
  <g id="main-shape" class="svg-drop-shadow">
    <!-- Rects, polygons, lines for the technical object -->
  </g>
  <!-- Dimension annotations group -->
  <g class="dimensions">
    <!-- line + ticks + text for each measurement -->
  </g>
</svg>
```

**Props / Data-Driven**:
- `data` object that drives positions, sizes, labels, and visibility of elements.
- On parameter change → update attributes + GSAP morph where appropriate.

### 3.4 DimensionAnnotation / Callout

**Purpose**: Precise engineering-style measurements.

**Pattern** (repeatable):
- Horizontal or vertical `<line class="svg-dimension-line">`
- Two small tick marks at ends
- `<text class="svg-text">` centered with value + unit (e.g., "78px", "3.8% Grade", "438 kWh")
- Optional dashed leader line to the measured feature

**Implementation Tip**: Create a small helper component or SVG fragment that takes `x1, y1, x2, y2, label, orientation`.

### 3.5 SkeuomorphicCard / Panel

**Purpose**: Secondary containers inside or beside the main frame.

**Treatment**:
- Same gradient border + inner shadow as main frame (lighter version).
- `rounded-2xl` or `rounded-3xl`
- Generous `p-6` or `p-8`
- Optional small L-brackets on larger panels.

### 3.6 TechnicalButton

**Variants**:
- Primary: Dark fill or strong border, pill or rounded control radius.
- Secondary / Ghost: Subtle border, hover lift.
- Technical pill: For presets and quick actions.

**States**: Default, hover (lift + shadow emphasis), active, disabled.

### 3.7 MetadataBlock

**Purpose**: Top-left and bottom-right technical labels (as seen in source HTML).

**Style**:
- Small JetBrains Mono, uppercase where appropriate.
- Embossed text shadow.
- Often two lines: Category + specific value.
- Positioned absolutely inside the framed container.

**Example**:
```html
<div class="absolute top-8 left-8 flex flex-col gap-0.5">
  <span class="text-xs tracking-tight font-normal text-slate-800">Core Framework</span>
  <span class="text-xs tracking-tight text-slate-500">Quantum Grid*</span>
</div>
```

### 3.8 Additional Supporting Components

- **TechnicalTable**: Clean rows with JetBrains Mono values, subtle borders.
- **KPI / Metric Card**: Small dimensioned cards showing single key number + label.
- **WarningCallout**: Technical red-line style for validation issues (e.g., axle overload, large gap).
- **PreferenceEnvelope / Radar**: Specialized small SVG for Driver Preference screen (multi-axis technical plot).

---

## 4. Implementation Guidelines

### 4.1 Tech Stack Alignment

- **Framework**: Next.js 15 + TypeScript + Tailwind
- **SVG**: Native `<svg>` with React state/props driving attributes (or a small SVG component library)
- **WebGL**: Three.js r134 (as in source) — keep one shared instance or lightweight per-screen
- **Animation**: GSAP 3.12 + ScrollTrigger (only where needed)
- **Charts / Complex Viz**: Prefer custom SVG or lightweight Canvas over heavy charting libs to maintain technical drawing language.

### 4.2 File / Component Organization (Recommended)

```
components/
  technical-brand/
    WebGLBackground.tsx
    FramedMainContainer.tsx
    TechnicalSVGDiagram.tsx          # Base + dimension helpers
    SkeuomorphicCard.tsx
    TechnicalButton.tsx
    MetadataBlock.tsx
    DimensionAnnotation.tsx
  fleetvolt-specific/
    TruckDiagram.tsx                 # Extends TechnicalSVGDiagram
    RouteVisualization.tsx
    LoadDiagram.tsx
    ChargerNetworkSchematic.tsx
    PreferenceEnvelope.tsx
```

### 4.3 Performance & Best Practices

- WebGL: Low poly count, cap DPR, pause when tab hidden.
- SVG: Use `requestAnimationFrame` sparingly; prefer CSS transforms or GSAP for simple morphs.
- Re-renders: Memoize expensive diagram updates. Use `inputs_hash` style caching where possible.
- Accessibility: Proper `aria-label` on interactive SVGs, keyboard support for controls, high contrast on lines/text.

### 4.4 Responsive Behavior

- Desktop: Full framed aspect + generous internal space.
- Tablet/Mobile: Collapse side panels into bottom sheets or accordions. Keep central technical diagram prominent and zoomable where appropriate.

---

## 5. Usage Across the 6 Screens (Quick Reference)

| Screen | Primary Reusable Components | Central Visualization |
|--------|-----------------------------|-----------------------|
| Home Page | FramedMainContainer, TechnicalSVGDiagram, MetadataBlock, TechnicalButton | Truck + Route composite SVG |
| Route Planner | FramedMainContainer, RouteVisualization (extends TechnicalSVGDiagram), SkeuomorphicCard | Multi-segment route + elevation with dimensions |
| Unit Configurator | FramedMainContainer, TruckDiagram, SkeuomorphicCard | Live parametric truck side-view SVG |
| Load Configurator | FramedMainContainer, LoadDiagram, SkeuomorphicCard | Dynamic cargo + CG technical drawing |
| Driver Preference | FramedMainContainer, SkeuomorphicCard, PreferenceEnvelope | Small multi-axis technical plot |
| SoCal Charger Network | FramedMainContainer, ChargerNetworkSchematic, SkeuomorphicCard | Large technical network schematic with gap dimensions |

---

## 6. Next Steps & Recommendations

1. **Build Order**:
   - WebGLBackground + FramedMainContainer (foundational)
   - TechnicalSVGDiagram + DimensionAnnotation (core visual language)
   - Then screen-specific extensions (TruckDiagram, RouteVisualization, etc.)

2. **Validation**:
   - Compare every implemented screen against the original `technical-brand-geometry-1.html` for spacing, stroke weight, shadow depth, and animation feel.

3. **Documentation**:
   - Keep this spec as the single source of truth for the component library.
   - Update when new patterns emerge from the 6 screens.

This Component Library & Token Spec provides everything needed to implement a consistent, high-quality, engineering-grade interface for FleetVolt Route while staying 100% faithful to the Technical Brand Geometry system you provided.

---

**Files Status Note**  
All previous individual screen PRDs and the comprehensive document remain in `/home/workdir/artifacts/FleetVolt/UI_PRDs/` and the root FleetVolt folder. If they are not rendering in your current view, they are still available on the filesystem for download or agent access. Let me know if you need any of them re-output here or converted to another format. 

Ready for the next artifact (e.g., starter component code, Figma tokens export plan, or detailed interaction flows). Just say the word.