# FleetVolt Route — SoCal Charger Network Overview
## UI/UX Screen PRD (Technical Brand Geometry)

**Version**: 1.0  
**Date**: July 1, 2026  
**Design System**: Technical Brand Geometry (light blueprint / skeuomorphic engineering aesthetic)  
**Source of Truth**: `technical-brand-geometry-1.html` + DESIGN.md

### Purpose & User Goals
Strategic infrastructure view of the Southern California (POLB-centric) high-power charging landscape. Identify coverage gaps, corridor feasibility, and utilization insights for planning, stakeholder discussions, and infrastructure recommendations.

### Visual Language & Design System Adherence
- Light technical blueprint background + subtle animated WebGL grid.
- Large framed main area with skeuomorphic gradient border, heavy shadow, and L-brackets.
- Dominant central technical network schematic using precise SVG engineering drawing language (nodes, corridor lines, dimension callouts, density overlays).
- Consistent typography, motion, and component treatment across the product.

### Layout & Composition
- **Central dominant visualization**: Large technical network schematic / stylized SoCal map focused on POLB, Inland Empire, and key freight corridors (I-15, I-10, etc.). 
  - Nodes sized by charger power output (kW).
  - Connection lines along NHFN corridors with distance dimension callouts.
  - Subtle density or coverage overlay.
  - Technical annotations for known gaps.
- **Inset / surrounding skeuomorphic panels** (with corner brackets):
  - Top-left: Network summary stats (Total MW, % NHFN corridor coverage, Average gap between qualifying sites).
  - Bottom-right or slide-in: Detail panel for selected charger or corridor (power, connectors, constraints, modeled utilization).
- **Top filter bar**: Power threshold, Connector type, Operator, Corridor focus, “Highlight Gaps” toggle.

### Key Components
1. **Technical Network Schematic (SVG / Canvas)**  
   - Precise vector nodes and corridor polylines.  
   - Dimension lines and callouts on key gaps (e.g., “142 mi gap — Barstow area”).  
   - Node sizing and subtle color coding by power/operator.  
   - Hover/click reveals technical detail callout.  
   - Optional very subtle flowing energy indicators along major corridors.

2. **Stats & Filters**  
   - Dimensioned metric cards.  
   - Technical-style segmented filters and toggles.

3. **Detail Panel**  
   - Clean technical metadata layout when a node or corridor is selected.

### Interactions & Motion
- Pan/zoom on network schematic (smooth, precise feel).
- Filter or toggle changes → GSAP fade/highlight animation on relevant nodes and lines.
- Click node → detail panel slides in with masked reveal + technical annotations.
- “Highlight Infrastructure Gaps” toggle emphasizes long stretches with animated emphasis.
- Export action generates report using the same technical drawing language.

### Data & State
- Aggregated charger data (NREL + internal modeled).
- Corridor-level analytics (feasibility %, gap distances, utilization estimates under different payloads).
- Selection state and filter persistence.

### Technical Implementation Notes
- Network schematic uses/extends the same TechnicalSVGDiagram system with node/line + dimension annotation capabilities.
- WebGL background consistent; optional lightweight particle/flow layer for corridors (low intensity).
- Performance optimized for smooth pan/zoom on large network.

### Success Criteria
- Stakeholders instantly grasp coverage and gaps through the technical schematic.
- Exportable artifacts maintain the premium engineering visual language.
- Screen feels like a strategic planning workstation.

### Open Questions
- Level of real-time status vs planning-mode data?
- Integration depth with Route Planner (e.g., “Use this charger in current simulation”)?

---

**Ready for Development Handoff**  
Strategic overview screen with strong visual impact. Network schematic component is highly reusable.

---

## Summary
All six individual focused PRD files have been generated in:  
`/home/workdir/artifacts/FleetVolt/UI_PRDs/`

Each file is self-contained, strictly adheres to the Technical Brand Geometry system (light blueprint skeuomorphic engineering aesthetic from your source HTML), and is ready for development handoff or further refinement. 

The shared visual language (framed containers, technical SVG diagrams with dimension callouts, WebGL background, GSAP motion, JetBrains Mono precision) is consistent across every screen while being tailored to the specific purpose of each. 

This gives FleetVolt a distinctive, credible, high-end engineering tool identity perfectly suited for POLB drayage and zero-emission freight work. 

Let me know if you need any adjustments, additional details (e.g., wireframes descriptions, acceptance criteria tables), or the next set of artifacts (component library spec, etc.).