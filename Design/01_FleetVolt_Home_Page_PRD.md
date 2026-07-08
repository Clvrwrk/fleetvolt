# FleetVolt Route — Home Page / Dashboard Landing
## UI/UX Screen PRD (Technical Brand Geometry)

**Version**: 1.0  
**Date**: July 1, 2026  
**Design System**: Technical Brand Geometry (light blueprint / skeuomorphic engineering aesthetic)  
**Source of Truth**: `technical-brand-geometry-1.html` + DESIGN.md

### Purpose & User Goals
- Deliver immediate brand recognition as a premium engineering-grade tool for Class 8 EV freight planning.
- Allow users (fleet analysts, dispatch planners, consultants) to instantly start core workflows or explore key insights.
- Establish visual credibility for POLB drayage and zero-emission strategy work.

### Visual Language & Design System Adherence
Strictly follows the attached source:
- Light technical background with subtle animated WebGL blueprint grid (Three.js diagonal lines, very low opacity ~0.15–0.25, fog, slow non-distracting motion).
- Large centered framed main content area (rounded-3xl, heavy multi-layered shadow, skeuomorphic gradient border with top highlight and bottom shadow, inset L-shaped corner brackets).
- Precise technical SVG as focal element with dimension lines, ticks, and callouts.
- Typography: Inter (body/display) + JetBrains Mono (labels, dimensions, metadata).
- Embossed text shadows, deliberate spacing, engineering density.
- GSAP masked text reveals and SVG drawing animations on load.
- All effects secondary and performant.

### Layout & Composition
- **Top-left metadata block** (JetBrains Mono, embossed, uppercase): “Core Framework / Quantum Grid*” → “FleetVolt Route / EV Freight Modeler v2.1 — POLB Focus”.
- **Central focal visualization**: Large technical SVG composite (EV truck profile + route elevation schematic merged in the spirit of the source geometric construction). Includes dimension callouts (e.g., “Typical Drayage 42 mi”, “Cajon Pass 3.8% Grade”, “Net Energy 312 kWh”).
- **Bottom-right metadata**: “POWERED BY CLEVERWORK / ZERO EMISSION ADVISORS” with version and data freshness.
- Supporting quick-action skeuomorphic cards or floating panels below the frame for primary CTAs.
- Very faint internal structural grid lines inside the main frame.

### Key Components
1. **Central Technical Diagram (SVG)**  
   - Stylized Class 8 EV truck + multi-segment route with elevation profile.  
   - Precise vector construction, drop shadow lift, 0.5px strokes.  
   - Live dimension callouts that can update with system data.  
   - Subtle hover scale (1.02x).

2. **Primary Action Buttons** (skeuomorphic, control or pill radius)  
   - “Start New Route Simulation” (primary)  
   - “Configure Truck Unit”  
   - “Explore SoCal Charger Network”  
   - “Load Saved Corridor”

3. **KPI Strip** (small dimensioned cards)  
   - Active Corridors modeled  
   - Average Energy Savings vs Diesel  
   - Chargers in Network  
   - Last Simulation timestamp

4. **System Status**  
   - Subtle badge: “SoCal Charger Network — Updated 4h ago” (JetBrains Mono).

### Interactions & Motion
- **Page Load**: GSAP staggered masked reveal on metadata text + dimension labels. SVG elements draw sequentially (polygons, lines, text).
- **Central SVG**: Subtle hover lift + scale. Optional very light animated energy pulse along route on hover.
- **Action Buttons**: Hover emphasis with inner shadow; click triggers navigation with smooth transition.
- **Background WebGL**: Extremely slow subtle pan/scroll (non-distracting, z-0).

### Data & State
- Personalized (if logged in): Last used corridor summary + quick “Resume” action.
- Global system metrics (lightweight, cached).
- No heavy computation on this screen — defers to Route Planner.

### Technical Implementation Notes
- WebGL background exactly matches source pattern (LineSegments, fog, slow animation).
- Central visualization built as reusable TechnicalSVGDiagram component with dimension annotation system.
- All numeric values and labels rendered in JetBrains Mono for precision feel.
- Responsive: Desktop framed aspect behavior; mobile collapses to stacked with diagram priority.

### Success Criteria
- User instantly perceives FleetVolt as a serious engineering tool, not generic SaaS.
- Primary workflows reachable in ≤ 2 clicks.
- Visual hierarchy and density match the source HTML reference exactly.

### Open Questions
- Should the central diagram be static hero or lightly dynamic (e.g., random corridor on load)?
- Personalization depth on first visit vs logged-in state?

---

**Ready for Development Handoff**  
This screen sets the premium technical tone for the entire product. Build the shared FramedContainer + TechnicalSVGDiagram components first.