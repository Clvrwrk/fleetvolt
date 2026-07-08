# FleetVolt Route — UI/UX Screen PRDs
## Technical Brand Geometry System (Light Blueprint / Skeuomorphic Engineering Aesthetic)

**Version**: 1.0  
**Date**: July 1, 2026  
**Design System Source**: `technical-brand-geometry-1-DESIGN.md` + `technical-brand-geometry-1.html` (source of truth)  
**Brand Application**: Premium technical / engineering simulation tool for Class 8 EV freight planning. Heavy emphasis on precise geometry, dimensioned technical drawings, skeuomorphic depth, subtle animated blueprint grids, and restrained motion.

**Core Visual Language (Strict Adherence)**:
- **Background**: Clean light technical (#EFEFF5 or close) with subtle diagonal blueprint grid overlay + very low-opacity animated WebGL faint grid (Three.js lines, slow pan/scroll, fogged edges, z-0, pointer-events-none, opacity ~0.15-0.25).
- **Main Frame**: Large rounded-3xl container with multi-layered heavy shadow, skeuomorphic gradient border (top white highlight → bottom subtle shadow), inset L-shaped corner brackets (16px, cool gray #8A8A93 or rgba(0,0,0,0.25)).
- **Internal Guides**: Very faint internal grid lines and structural references.
- **Typography**: Inter (display & body), JetBrains Mono (labels, dimensions, technical metadata). Embossed text shadows for tactile premium feel.
- **Components**: Skeuomorphic cards/panels with same gradient border treatment. Precise 0.5px strokes on SVGs. Dimension lines, ticks, and callout text in technical style.
- **Central Visualization**: Large technical SVG or canvas (truck profile, route elevation, network schematic) with drop-shadow lift, precise vector lines, dimension annotations, and subtle hover scale.
- **Motion**: GSAP masked text reveals (staggered), SVG path/polygon drawing on load, subtle hover lift on diagrams, restrained easing (power2/power3).
- **Density & Hierarchy**: Deliberate spacing (8px base, 16px gap, 24px card padding, generous section breathing). Preserve first-viewport focal technical diagram + supporting metadata in top-left / bottom-right.
- **Guardrails**: Never flatten into generic SaaS cards. Keep engineering drawing language. Effects are always secondary and performant.

All screens below strictly follow this language. The aesthetic is that of a high-end CAD / simulation workstation for zero-emission freight engineering.

---

## Screen 1: Home Page / Dashboard Landing

**Purpose**  
First impression and command center. Quickly communicate FleetVolt’s precision engineering value for POLB drayage & hinterland EV planning. Enable instant entry into core workflows while showcasing the technical aesthetic.

**Layout & Composition (Strictly follows source HTML)**  
- Full-bleed subtle WebGL blueprint grid background (faint animated diagonal lines, very low opacity).  
- Centered large framed main content area (max-w-4xl, aspect-video on desktop, rounded-3xl, heavy layered shadow + skeuomorphic gradient border + inset L-brackets).  
- **Top-left metadata block** (JetBrains Mono, embossed): “Core Framework / Quantum Grid*” style → “FleetVolt Route / EV Freight Modeler v2.1”.  
- **Central focal element**: Large technical SVG composite — stylized Class 8 EV truck profile merged with route elevation diagram and dimension callouts (inspired directly by the geometric “N” construction in source). Subtle drop shadow, precise 0.5px strokes, dimension lines (78px, 240px, 48px style).  
- **Bottom-right metadata**: “DEVELOPED BY NEXUS.LABS” → adapted to “POWERED BY CLEVERWORK / ZERO EMISSION ADVISORS”.  
- Supporting quick-action skeuomorphic cards below or as floating inset panels (New Simulation, Open Saved Corridor, View SoCal Network).

**Key Components**
- Central technical diagram (SVG): Truck + route schematic with live key metrics overlaid as dimension callouts (e.g., “Typical Drayage Leg 42 mi”, “Cajon Pass Grade 3.8%”).
- Three primary action buttons in skeuomorphic style (pill or control radius): “Start New Route Simulation”, “Configure Truck Unit”, “Explore SoCal Charger Network”.
- Subtle KPI strip (small dimensioned cards): “Active Corridors: 14”, “Avg. Energy Savings vs Diesel: 62%”, “Chargers Modeled: 1,847”.

**Interactions & Motion**
- Page load: GSAP staggered masked reveal on metadata + dimension text.
- Central SVG: Drawing animation (polygons/rects/lines appear sequentially) + subtle hover scale (1.02).
- Quick actions: Hover lift with inner shadow emphasis.
- Background WebGL: Extremely slow subtle pan/scroll (non-distracting).

**Data & State**
- Personalized last-used corridor summary (if logged in).
- System status badge (data freshness: “SoCal Charger Network — Updated 4h ago”).

**Technical Notes**
- WebGL layer exactly as in source (Three.js LineSegments, fog, slow animation).
- SVG constructed with same class system (svg-stroke, svg-fill-light, svg-dimension-line, svg-tick, svg-text).
- All text uses Inter / JetBrains Mono pairing.

**Success Criteria**
User immediately understands this is a precision engineering tool, not generic SaaS. Can enter any core workflow in <2 clicks.

---

## Screen 2: Route Planner

**Purpose**  
Primary working screen for defining origin → drayage → long-haul corridor, running physics simulation, and reviewing energy, charging, emissions, and TCO results.

**Layout**
- Same framed main container treatment.
- **Left sidebar panel** (skeuomorphic card): Origin (POLB terminal selector with technical dropdown), Destination (hinterland presets or lat/lon with coordinate dimension callout), Departure time/weather scenario, Truck preset selector (links to Unit Configurator).
- **Central large area**: Technical route visualization — hybrid SVG + canvas elevation profile + map schematic. Precise dimension lines for segments, grade % callouts, charger stop annotations with power (kW) and dwell estimates. Subtle animated “energy flow” along route on simulation complete.
- **Right results panel** (stacked skeuomorphic cards): 
  - Energy & SoC profile (technical line chart with dimension overlays).
  - Charging Plan table (location, arrival SoC, charge time, power).
  - Emissions & TCO summary (ton-mile comparison + cumulative cost curve sparkline).

**Key Components**
- Technical route SVG: Multi-segment polyline with elevation ticks, grade dimension callouts, charger nodes sized by kW, dashed “optimal stop” lines.
- Simulation controls at bottom of central area: “Run Physics Simulation” (primary), “What-If: +10% Payload”, “Compare to Diesel Baseline”.
- Live updating dimension callouts that change with inputs (e.g., “Total Energy: 312 kWh”, “Net Regen Credit: +47 kWh”).

**Interactions**
- Changing inputs → immediate subtle SVG update (or on “Run” for heavier physics).
- Hover on route segment → highlight corresponding energy profile point + dimension popup.
- Results panel: Tab between “Energy”, “Charging”, “Emissions & TCO”.
- GSAP: Drawing of new route on simulation complete, masked reveal on new KPI values.

**Data**
- Full simulation outputs from Python engine (kWh/mi, SoC array, charge events, ton-mile emissions, cumulative TCO).
- Comparison mode support (side-by-side or diff view).

**Technical Notes**
- Central viz uses same SVG engineering drawing language + lightweight canvas/WebGL overlay for animated energy pulse if needed.
- All numbers use JetBrains Mono for precision feel.

---

## Screen 3: Unit (Truck) Configurator

**Purpose**  
Detailed technical configuration of Class 8 EV truck (battery, powertrain, aero, regen, aux). Live preview of impact on efficiency and range.

**Layout**
- Framed container.
- **Left panel**: Form controls (Inter labels + JetBrains Mono values) — Battery usable kWh, Curb weight, CdA, Rolling resistance coeff, Regen efficiency, Aux kW (base + thermal), Max charge rate.
- **Central dominant element**: Large technical SVG side-view or 3/4 technical drawing of the truck (eCascadia / T680E inspired geometry). Battery pack highlighted with dimension callouts, axle load distribution lines, center-of-gravity marker. Live updates when parameters change.
- **Right panel**: Live calculated outputs in dimensioned cards (Base kWh/mi at 40k lb payload, Range estimate, Grade performance delta on Cajon Pass example).

**Key Components**
- Truck SVG: Modular construction (cab, battery box, e-axle) with precise strokes and fills matching source style. Dimension lines for key specs (battery length, ground clearance, etc.).
- Parameter sliders or numeric inputs with immediate SVG feedback (e.g., battery box size scales slightly, weight distribution lines move).
- Presets row (eCascadia 438 kWh, T680E 500 kWh, Custom) as technical pills.

**Interactions**
- Slider/input change → GSAP smooth update of relevant SVG elements (scale, position, color intensity for “stress” on components) + recalc of right-panel metrics.
- Hover on SVG component → highlight + tooltip with editable param.
- “Save as Preset” action with embossed feedback.

**Data**
- Full truck config object synced with backend.
- Real-time physics impact preview (uses simplified segment model or cached).

**Technical Notes**
- SVG built with same vector precision and class naming as source geometry SVG.
- Optional lightweight Three.js inset for rotatable 3D truck view (secondary, behind main 2D technical drawing).

---

## Screen 4: Load Configurator

**Purpose**  
Define payload, container type, weight distribution, and see direct impact on energy consumption and vehicle dynamics.

**Layout**
- Same premium framed treatment.
- **Top / Left controls**: Payload weight (lbs or % GCW), Container type (40ft dry, reefer, tank), Axle load distribution mode (even, forward bias, rear bias), Special cargo notes (reefer temp set point).
- **Central technical diagram**: Side-view or top-down technical drawing of truck + chassis + container. Dynamic load blocks with weight labels, center-of-gravity vertical line with dimension callout (distance from kingpin or axle), axle load % callouts. Color intensity or pattern indicates load stress.
- **Right / Bottom results**: Impact summary — Δ kWh/mi vs baseline, Grade performance change, Recommended regen / brake bias, Stability note.

**Key Components**
- Dynamic load SVG: Rectangles/polygons for container and cargo blocks that resize/ reposition based on inputs. Precise dimension lines and ticks exactly as in source.
- “Auto-balance” button that adjusts distribution for optimal efficiency/stability.
- Warning callouts (technical red-line style) if axle weights exceed limits or CG too high.

**Interactions**
- Drag on load blocks (if advanced) or sliders → live SVG morph + metric update.
- GSAP: Smooth transition of load blocks and CG line when distribution changes.
- Preset load profiles (Typical POLB 40k lb container, Reefer full, etc.).

**Data**
- Load config object that feeds directly into physics engine (affects rolling resistance, grade force, aux for reefer).

---

## Screen 5: Driver Preference Configurator

**Purpose**  
Capture driver / fleet policy preferences that influence charging strategy, comfort, and operational constraints (HOS, dwell tolerance).

**Layout**
- Cleaner but still technical framed panels (less diagram-heavy, more precise form + small technical viz).
- **Main area**: Grouped sections in skeuomorphic cards:
  - Charging Strategy (visual preference curve or radar — min stops vs min total time vs min energy).
  - Thermal & Comfort (cabin temp target, battery preconditioning aggressiveness).
  - Operational (Max single dwell time, HOS buffer, Preferred charger power minimum).
  - Regen & Braking (Aggressiveness slider with small efficiency vs brake wear trade-off diagram).
- **Side / Bottom technical element**: Small “Preference Envelope” SVG (spider/radar or multi-axis technical plot) showing how current settings trade off key outcomes (time, energy, comfort, infrastructure risk).

**Key Components**
- Sliders and segmented controls with JetBrains Mono values.
- Small technical preference visualization (SVG lines + fills matching source geometry language).
- “Apply to Current Route” and “Save as Policy Template” actions.

**Interactions**
- Changing any preference → immediate subtle update to the envelope SVG + live recalc of example route metrics if a route is active.
- GSAP masked reveals on section headers and envelope updates.

**Data**
- Preference profile stored per user/fleet and applied as multipliers or constraints to simulation/optimizer.

---

## Screen 6: Overview of SoCal Charger Network

**Purpose**  
Strategic / infrastructure view of Southern California (POLB-centric) high-power charging landscape. Identify gaps, coverage, and utilization for planning and stakeholder discussions.

**Layout**
- Framed container.
- **Dominant central element**: Large technical network schematic / stylized map of SoCal. Nodes (chargers) sized by power output (kW), color by operator or status. Connection lines along key freight corridors with distance dimension callouts. Faint background grid + corridor highlights. Subtle density or coverage overlay.
- **Surrounding / inset panels** (skeuomorphic cards with corner brackets):
  - Top-left: Network stats (Total MW available, % coverage on primary NHFN corridors, Avg. gap between 350+ kW sites).
  - Bottom-right: Selected corridor or site detail (power, connectors, known constraints, modeled utilization).
  - Filters bar: Power threshold, Connector type, Operator, Corridor focus (POLB–Inland Empire, I-15, etc.).

**Key Components**
- Technical network SVG / canvas: Precise node styling, dashed or solid corridor lines, dimension callouts on key gaps (e.g., “142 mi gap — Barstow to Baker”).
- Hover / click on node → detail card pops with technical metadata style.
- “Highlight Infrastructure Gaps” toggle that emphasizes long stretches without adequate charging.

**Interactions**
- Pan/zoom on network (smooth, technical feel).
- Filter changes → animated fade/highlight of relevant nodes and lines.
- “Export Gap Report” action (PDF with the same technical drawing language).

**Data**
- Aggregated from NREL + internal modeled data. Real-time or cached status indicators.
- Corridor-level analytics (feasibility % under different payload/weather scenarios).

**Technical Notes**
- Network viz uses same vector precision and dimension annotation system as the source geometry SVG.
- WebGL layer can add very subtle flowing “energy” particles along major corridors on demand (low intensity).

---

## Implementation & Consistency Notes (All Screens)

- **Design Token Usage**: Strictly follow spacing (base 8px, gap 16px, card-padding 24px), rounded (card 16px or 24px for main frame, control 8px, pill 9999px), typography scale, and color roles from the source (adapted to light technical palette of the HTML).
- **Motion System**: GSAP for all reveals, drawing, and subtle interactions. Never use heavy or distracting animation.
- **Accessibility**: High contrast on technical lines and text, proper ARIA on interactive SVGs, keyboard-accessible dimension callouts where relevant.
- **Responsiveness**: Desktop-first (framed aspect behavior). Mobile collapses side panels into bottom sheets while preserving central technical diagram priority.
- **Performance**: WebGL and complex SVGs optimized (low poly/count, requestAnimationFrame throttling). Effects are always optional and low-intensity.
- **Content Adaptation**: All copy, labels, and metadata use precise, engineering tone. JetBrains Mono for all numeric/technical values and dimension callouts.

These six screens form a cohesive, premium product experience that feels like a professional-grade engineering workstation for zero-emission freight planning. The Technical Brand Geometry language is preserved and amplified across every view.

**Next Steps Recommendation**  
1. Build a shared component library (FramedContainer, TechnicalSVGDiagram, DimensionCallout, SkeuomorphicCard) based on the source HTML.  
2. Prototype Screen 1 + Screen 3 first (highest visual impact).  
3. Validate with domain experts (drayage planners, POLB stakeholders) on the technical drawing metaphors.

This system positions FleetVolt as the most precise, credible, and visually distinctive tool in the EV freight planning space.