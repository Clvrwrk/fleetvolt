# FleetVolt Route — Route Planner
## UI/UX Screen PRD (Technical Brand Geometry)

**Version**: 1.0  
**Date**: July 1, 2026  
**Design System**: Technical Brand Geometry (light blueprint / skeuomorphic engineering aesthetic)  
**Source of Truth**: `technical-brand-geometry-1.html` + DESIGN.md

### Purpose & User Goals
Primary working screen for defining POLB-origin drayage + hinterland corridors, running the physics simulation, reviewing energy consumption, optimal charging stops, emissions avoidance, and rolling TCO.

### Visual Language & Design System Adherence
- Light technical blueprint background with subtle animated WebGL grid.
- Main content in large framed rounded-3xl container with skeuomorphic gradient border, heavy layered shadow, and inset L-shaped corner brackets.
- Central technical visualization uses precise SVG engineering drawing language (dimension lines, ticks, callouts, drop shadows).
- Typography: Inter + JetBrains Mono for all technical values and labels.
- GSAP masked reveals, SVG drawing/animation on simulation complete, subtle hover interactions.
- High engineering density and deliberate spacing.

### Layout & Composition
- **Left skeuomorphic sidebar panel**: Origin selector (POLB terminal presets + custom), Destination (hinterland presets or coordinate input with dimension callout), Departure time + weather scenario, Truck preset (links to Unit Configurator), Payload quick adjust.
- **Central dominant area**: Large technical route visualization (SVG + lightweight canvas overlay). Multi-segment route with elevation profile, precise grade % dimension callouts, charger stop annotations (power kW, dwell), energy flow indicators.
- **Right results panel** (stacked skeuomorphic cards with corner brackets): 
  - Energy & SoC technical line chart with dimension overlays.
  - Charging Plan table (location, arrival SoC, charge time, recommended power).
  - Emissions & TCO summary (ton-mile comparison bars + cumulative cost curve).
- Bottom action bar: “Run Physics Simulation”, “What-If Adjustments”, “Compare Scenarios”, “Export Report”.

### Key Components
1. **Technical Route Visualization (SVG/Canvas)**  
   - Precise polyline route with elevation ticks and grade dimension lines.  
   - Charger nodes sized by kW output, annotated with power and dwell estimates.  
   - Dashed optimal stop recommendation lines.  
   - Subtle animated energy pulse along route after simulation.  
   - Hover on segment highlights corresponding profile point + pops dimension details.

2. **Results Cards**  
   - Energy profile chart rendered in technical drawing style (grid, axes with dimension labels).  
   - Charging table with JetBrains Mono values and status indicators.  
   - Emissions/TCO summary with ton-mile delta callouts and small cumulative cost sparkline.

3. **Control Inputs**  
   - Clean form elements inside skeuomorphic panels.  
   - Live or on-run updates to central diagram metrics.

### Interactions & Motion
- Input changes → subtle preview updates to diagram dimensions (or full re-run for physics).
- “Run Physics Simulation” → GSAP drawing animation of new route + results reveal (masked text + chart build).
- Hover interactions on route/chargers trigger highlights and detail popovers in technical style.
- Scenario comparison mode opens side-by-side or diff view within the framed area.
- Background WebGL remains subtle and non-distracting.

### Data & State
- Full simulation inputs/outputs from backend physics engine.
- Live or cached results for kWh/mi, SoC array, charge events, ton-mile emissions, cumulative TCO.
- Comparison state support (baseline vs variant).

### Technical Implementation Notes
- Central visualization reuses/extends the TechnicalSVGDiagram component with route-specific dimension annotation system.
- Charting uses technical grid + callout style (avoid generic charting libraries if possible; prefer custom SVG or lightweight canvas).
- WebGL background consistent across screens.
- Performance: Simulation results cached by inputs_hash; diagram updates optimized.

### Success Criteria
- Analysts can complete a full corridor simulation and review in under 5 minutes.
- All numbers and annotations feel precise and engineering-grade.
- Visual language remains consistent with Home and other configurator screens.

### Open Questions
- Real-time vs on-demand simulation trigger preference?
- Depth of inline what-if editing vs separate comparison mode?

---

**Ready for Development Handoff**  
Core working screen. Prioritize reusable Technical Route Visualization component.