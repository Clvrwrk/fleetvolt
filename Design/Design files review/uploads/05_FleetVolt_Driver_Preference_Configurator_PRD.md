# FleetVolt Route — Driver Preference Configurator
## UI/UX Screen PRD (Technical Brand Geometry)

**Version**: 1.0  
**Date**: July 1, 2026  
**Design System**: Technical Brand Geometry (light blueprint / skeuomorphic engineering aesthetic)  
**Source of Truth**: `technical-brand-geometry-1.html` + DESIGN.md

### Purpose & User Goals
Capture driver and fleet policy preferences that influence charging strategy, comfort, HOS compliance, and operational trade-offs. Provide visual feedback on how preferences affect outcomes (time vs energy vs infrastructure risk).

### Visual Language & Design System Adherence
- Clean light technical background with subtle WebGL grid.
- Framed skeuomorphic panels and cards with gradient borders and L-brackets.
- Small but precise technical visualization (preference envelope / radar or multi-axis plot) using SVG engineering style.
- GSAP masked reveals and subtle updates.
- JetBrains Mono for all values and technical labels.

### Layout & Composition
- Grouped sections inside skeuomorphic cards:
  - **Charging Strategy**: Visual preference controls (min stops / balanced / min total time) with small technical curve or slider + outcome preview.
  - **Thermal & Comfort**: Cabin temp target, preconditioning aggressiveness, battery thermal management mode.
  - **Operational Constraints**: Max single dwell time, HOS safety buffer, Minimum charger power preference.
  - **Regen & Braking**: Aggressiveness slider with small efficiency vs component wear trade-off diagram.
- **Side or bottom technical visualization**: “Preference Envelope” SVG (radar/spider or multi-axis technical plot) showing current settings’ impact on key outcomes (trip time, energy use, comfort, infrastructure dependency).

### Key Components
1. **Preference Controls**  
   - Clean sliders, segmented buttons, and numeric inputs in technical style.  
   - Outcome preview numbers (JetBrains Mono) next to each control.

2. **Preference Envelope Visualization (SVG)**  
   - Technical multi-axis plot or radar with precise strokes and fills.  
   - Live updating shaded area or lines as user adjusts preferences.  
   - Dimension or callout labels for key trade-off points.

3. **Actions**  
   - “Apply to Current Route”, “Save as Policy Template”, “Reset to Fleet Default”.

### Interactions & Motion
- Any preference change → immediate GSAP update to the envelope SVG (smooth line/area morph) + recalc of example outcome metrics.
- Hover on envelope axes → highlight corresponding control + technical tooltip.
- Preset policy templates load with animated envelope transition.
- Masked text reveals on section headers and new metric values.

### Data & State
- Preference profile object (per user or fleet) that applies multipliers/constraints to simulation and optimizer.
- Example route impact preview (lightweight).
- Template library support.

### Technical Implementation Notes
- Envelope visualization built as small reusable TechnicalSVG component (same dimension/callout system).
- All controls and values maintain engineering precision feel.
- Low computational cost — updates are visual + simple calculations.

### Success Criteria
- Users clearly understand trade-offs through the technical envelope visualization.
- Preferences feel actionable and directly linked to simulation outcomes.
- Consistent premium technical aesthetic with other configurators.

### Open Questions
- Default envelope axes (time, energy, comfort, risk)?
- How many presets to seed initially?

---

**Ready for Development Handoff**  
Form + visualization hybrid screen. Envelope SVG adds strong technical character.