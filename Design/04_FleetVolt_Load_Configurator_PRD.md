# FleetVolt Route — Load Configurator
## UI/UX Screen PRD (Technical Brand Geometry)

**Version**: 1.0  
**Date**: July 1, 2026  
**Design System**: Technical Brand Geometry (light blueprint / skeuomorphic engineering aesthetic)  
**Source of Truth**: `technical-brand-geometry-1.html` + DESIGN.md

### Purpose & User Goals
Define payload weight, container type, and weight distribution. See immediate technical impact on energy consumption, grade performance, stability, and recommended settings. Critical for accurate drayage simulation.

### Visual Language & Design System Adherence
- Light technical blueprint background with WebGL grid.
- Framed skeuomorphic main area with gradient border, shadow, and L-brackets.
- Central technical load diagram (side or top-down view) using precise SVG engineering drawing language with dynamic dimension callouts.
- GSAP smooth transitions for load block movement and CG line.
- JetBrains Mono for all weights, percentages, and dimensions.

### Layout & Composition
- **Left / Top controls** (skeuomorphic panels): Payload weight (lbs or % of GCW), Container type selector (40ft dry, reefer, tank), Distribution mode (even, forward bias, rear bias, custom), Special notes (reefer setpoint, hazmat).
- **Central dominant technical diagram**: Side-view or top-down technical drawing of truck + chassis + container. Dynamic cargo blocks, weight labels, center-of-gravity vertical line with dimension callout (distance from reference point), axle load percentage callouts. Color or pattern intensity indicates load stress.
- **Right / Bottom impact panel**: Δ kWh/mi vs baseline, Grade performance change (Cajon example), Stability / CG warning, Recommended regen/brake bias.

### Key Components
1. **Dynamic Load SVG Diagram**  
   - Precise vector construction for truck, chassis, and container.  
   - Movable/resizable cargo blocks with live weight annotations.  
   - CG vertical line + dimension ticks.  
   - Axle load % callouts that update in real time.  
   - Warning indicators in technical red-line style when limits exceeded.

2. **Distribution Controls**  
   - Sliders or segmented controls for bias.  
   - “Auto-Balance for Efficiency” and “Auto-Balance for Stability” actions.

3. **Impact Metrics**  
   - Dimensioned cards showing before/after deltas.  
   - Small technical sparkline or bar for sensitivity.

### Interactions & Motion
- Slider or input change → GSAP smooth morph of cargo blocks, CG line movement, and axle load callouts + instant metric recalc.
- Drag interaction on cargo blocks (advanced mode) with snap-to-grid or physics feel.
- Hover on diagram elements → technical tooltip with exact values.
- Warning states trigger subtle pulse or color shift on affected callouts.
- Preset load profiles (Typical POLB 40k lb, Reefer Full, etc.) with animated transition.

### Data & State
- Load configuration object that directly feeds physics engine (affects rolling resistance, grade forces, aux loads for reefer).
- Real-time simplified impact preview.
- Validation rules (axle weight limits, CG height).

### Technical Implementation Notes
- SVG uses same class system and dimension annotation logic as source geometry.
- Dynamic elements driven by parameters (positions, sizes, line coordinates).
- Performance optimized for smooth live updates.

### Success Criteria
- Users immediately understand load impact through the technical diagram.
- Changes feel precise and engineering-accurate.
- Seamless integration with Unit Configurator and Route Planner.

### Open Questions
- Top-down vs side-view as primary (or toggle)?
- Advanced drag-and-drop vs slider-only for distribution?

---

**Ready for Development Handoff**  
Strong visual + functional screen. Parametric load SVG is key reusable component.