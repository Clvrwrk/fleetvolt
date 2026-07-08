# FleetVolt Route — Unit (Truck) Configurator
## UI/UX Screen PRD (Technical Brand Geometry)

**Version**: 1.0  
**Date**: July 1, 2026  
**Design System**: Technical Brand Geometry (light blueprint / skeuomorphic engineering aesthetic)  
**Source of Truth**: `technical-brand-geometry-1.html` + DESIGN.md

### Purpose & User Goals
Detailed configuration of Class 8 EV truck parameters (battery, powertrain, aero, regen, auxiliary loads). Live technical preview of impact on efficiency, range, and grade performance. Supports presets and custom saves.

### Visual Language & Design System Adherence
- Light blueprint background + subtle WebGL grid.
- Framed skeuomorphic container with gradient border, heavy shadow, L-brackets.
- Dominant central technical SVG truck diagram with precise dimension lines, ticks, and callouts (same visual language as source geometry SVG).
- Live parameter-driven updates to the diagram.
- JetBrains Mono for all specs and dimensions; Inter for labels.
- GSAP smooth morphing and drawing animations.

### Layout & Composition
- **Left control panel** (skeuomorphic card): Form sections for Battery (usable kWh, chemistry notes), Curb Weight & Distribution, Aerodynamics (CdA), Rolling Resistance, Regen Efficiency, Auxiliary Loads (base + thermal/HVAC), Max Charge Rate (kW).
- **Central dominant visualization**: Large technical side-view or 3/4 drawing of the configured Class 8 EV truck (eCascadia or T680E geometry). Battery pack, e-axle, and weight distribution lines highlighted with live dimension callouts (e.g., “Battery 438 kWh”, “Front Axle Load %”, “CG Location”).
- **Right results panel**: Live calculated outputs in dimensioned cards — Base kWh/mi (at current payload), Estimated Range, Grade Performance Delta (Cajon Pass example), Charging Time Estimate.

### Key Components
1. **Technical Truck SVG Diagram**  
   - Modular construction (cab, battery box, chassis, e-axle).  
   - Precise vector lines and fills matching source style.  
   - Dynamic elements: Battery box size/position, axle load distribution lines, CG marker.  
   - Dimension callouts update live with parameter changes.  
   - Subtle drop shadow and hover scale.

2. **Parameter Controls**  
   - Numeric inputs + sliders inside skeuomorphic panels.  
   - Grouped logically with section headers in JetBrains Mono.

3. **Presets & Actions**  
   - Technical pill buttons for standard configs (eCascadia 438 kWh, T680E 500 kWh, Custom).  
   - “Save as Fleet Preset”, “Reset to OEM”, “Apply to Current Route”.

### Interactions & Motion
- Parameter change → immediate GSAP-smooth update of relevant SVG elements (scale, position, line movement for load distribution) + recalculation of right-panel metrics.
- Hover on SVG component → highlight + technical tooltip with current value and editable link.
- Preset selection → animated transition to new configuration with drawing emphasis on changed elements.
- “Apply to Route” triggers navigation back to Route Planner with updated truck config.

### Data & State
- Full truck configuration object synced with simulation engine.
- Real-time simplified physics preview (or cached high-fidelity results).
- Versioning for saved presets.

### Technical Implementation Notes
- Central SVG built as reusable component with parametric updates (props drive dimensions, positions, and annotations).
- Optional lightweight Three.js inset for 3D rotatable view (secondary to the primary 2D technical drawing).
- All calculations and annotations use JetBrains Mono rendering.

### Success Criteria
- Users can fine-tune a truck and immediately see credible technical impact on efficiency and performance.
- Diagram feels like a professional engineering drawing, not a cartoon.
- Seamless handoff to Route Planner and Load Configurator.

### Open Questions
- Level of 3D support (nice-to-have vs required)?
- How many parameters exposed vs advanced/hidden?

---

**Ready for Development Handoff**  
High visual impact screen. Build parametric Technical Truck SVG component early.