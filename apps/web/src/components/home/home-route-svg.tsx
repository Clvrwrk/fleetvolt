/**
 * HomeRouteSvg — Central technical SVG composite for the homepage (Screen 1 PRD).
 *
 * Stylized Class 8 EV truck side profile merged with route elevation diagram
 * and dimension callouts. Precise 0.5px strokes, Steel construction lines,
 * Mono annotations, Blueprint Blue for energy data only.
 *
 * Follows Brand Guide §07 "Annotate like a drawing" and §06 "Diagram".
 */
export function HomeRouteSvg() {
  return (
    <svg
      viewBox="0 0 900 320"
      className="h-auto w-full"
      aria-label="Route schematic: POLB to Bakersfield corridor with truck profile, elevation, and charge stops"
      role="img"
    >
      {/* ── Ground line ── */}
      <line
        x1="40"
        y1="260"
        x2="860"
        y2="260"
        stroke="var(--fv-steel)"
        strokeWidth="0.5"
        strokeDasharray="4 4"
        opacity="0.5"
      />

      {/* ── Elevation profile polyline ── */}
      <polyline
        points="60,250 140,210 240,140 340,80 440,120 540,60 640,100 740,70 840,90"
        fill="none"
        stroke="var(--fv-blueprint-blue)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* ── Elevation fill (subtle) ── */}
      <polygon
        points="60,250 140,210 240,140 340,80 440,120 540,60 640,100 740,70 840,90 840,260 60,260"
        fill="var(--fv-blueprint-blue)"
        opacity="0.05"
      />

      {/* ── Charger stop nodes ── */}
      {[
        { cx: 140, cy: 210, r: 6, label: "POLB" },
        { cx: 440, cy: 120, r: 8, label: "CAJON 350kW" },
        { cx: 740, cy: 70, r: 8, label: "BAKERSFIELD 500kW" },
      ].map((node) => (
        <g key={node.label}>
          <circle
            cx={node.cx}
            cy={node.cy}
            r={node.r}
            fill="#FBFBFD"
            stroke="var(--fv-graphite)"
            strokeWidth="1.5"
          />
          <text
            x={node.cx}
            y={node.cy - node.r - 6}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="8"
            fontWeight="600"
            fill="var(--fv-slate)"
            letterSpacing="0.5"
          >
            {node.label}
          </text>
        </g>
      ))}

      {/* ── Truck side profile (simplified technical drawing) ── */}
      <g transform="translate(180, 195)">
        {/* Cab */}
        <path
          d="M 0 30 L 0 55 L 8 55 L 8 62 L 45 62 L 45 30 L 38 30 L 38 15 L 15 15 Z"
          fill="var(--fv-paper)"
          stroke="var(--fv-graphite)"
          strokeWidth="1"
        />
        {/* Windshield */}
        <line x1="15" y1="15" x2="38" y2="30" stroke="var(--fv-steel)" strokeWidth="0.5" />

        {/* Battery box */}
        <rect
          x="45"
          y="20"
          width="90"
          height="42"
          fill="var(--fv-paper)"
          stroke="var(--fv-graphite)"
          strokeWidth="1"
          rx="2"
        />
        {/* Battery cell lines */}
        <line x1="60" y1="20" x2="60" y2="62" stroke="var(--fv-steel)" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="75" y1="20" x2="75" y2="62" stroke="var(--fv-steel)" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="90" y1="20" x2="90" y2="62" stroke="var(--fv-steel)" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="105" y1="20" x2="105" y2="62" stroke="var(--fv-steel)" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="120" y1="20" x2="120" y2="62" stroke="var(--fv-steel)" strokeWidth="0.5" strokeDasharray="2 2" />

        {/* Trailer */}
        <rect
          x="135"
          y="10"
          width="180"
          height="52"
          fill="none"
          stroke="var(--fv-steel)"
          strokeWidth="0.75"
          strokeDasharray="3 2"
        />

        {/* Wheels */}
        <circle cx="20" cy="62" r="8" fill="var(--fv-paper)" stroke="var(--fv-graphite)" strokeWidth="1" />
        <circle cx="20" cy="62" r="3" fill="var(--fv-steel)" />
        <circle cx="100" cy="62" r="8" fill="var(--fv-paper)" stroke="var(--fv-graphite)" strokeWidth="1" />
        <circle cx="100" cy="62" r="3" fill="var(--fv-steel)" />
        <circle cx="260" cy="62" r="8" fill="var(--fv-paper)" stroke="var(--fv-graphite)" strokeWidth="1" />
        <circle cx="260" cy="62" r="3" fill="var(--fv-steel)" />
        <circle cx="285" cy="62" r="8" fill="var(--fv-paper)" stroke="var(--fv-graphite)" strokeWidth="1" />
        <circle cx="285" cy="62" r="3" fill="var(--fv-steel)" />
      </g>

      {/* ── Dimension callouts ── */}
      {/* Truck length dimension */}
      <g>
        <line x1="180" y1="280" x2="495" y2="280" stroke="var(--fv-steel)" strokeWidth="0.5" strokeDasharray="3 3" />
        <line x1="180" y1="275" x2="180" y2="285" stroke="var(--fv-steel)" strokeWidth="0.5" />
        <line x1="495" y1="275" x2="495" y2="285" stroke="var(--fv-steel)" strokeWidth="0.5" />
        <text
          x="337"
          y="295"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="8.5"
          fill="var(--fv-slate)"
        >
          315″ OVERALL
        </text>
      </g>

      {/* Grade dimension at Cajon */}
      <g>
        <line x1="340" y1="50" x2="440" y2="50" stroke="var(--fv-steel)" strokeWidth="0.5" strokeDasharray="3 3" />
        <line x1="340" y1="45" x2="340" y2="55" stroke="var(--fv-steel)" strokeWidth="0.5" />
        <line x1="440" y1="45" x2="440" y2="55" stroke="var(--fv-steel)" strokeWidth="0.5" />
        <text
          x="390"
          y="44"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="8.5"
          fill="var(--fv-blueprint-blue)"
          fontWeight="600"
        >
          3.8% GRADE
        </text>
      </g>

      {/* Energy flow annotation */}
      <g>
        <line x1="60" y1="250" x2="840" y2="250" stroke="var(--fv-blueprint-blue)" strokeWidth="0.5" strokeDasharray="6 4" opacity="0.4" />
        <text
          x="450"
          y="246"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="8.5"
          fill="var(--fv-blueprint-blue)"
          opacity="0.6"
        >
          312 kWh NET — 2.44 kWh/mi
        </text>
      </g>

      {/* ── X-axis mileage markers ── */}
      {[0, 32, 64, 96, 128].map((mi, i) => {
        const x = 60 + i * 195;
        return (
          <g key={mi}>
            <line x1={x} y1="260" x2={x} y2="265" stroke="var(--fv-steel)" strokeWidth="0.5" />
            <text
              x={x}
              y="275"
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize="7.5"
              fill="var(--fv-steel)"
            >
              {mi} mi
            </text>
          </g>
        );
      })}

      {/* ── Title block (top-left metadata) ── */}
      <g transform="translate(40, 20)">
        <text
          fontFamily="var(--font-mono)"
          fontSize="9"
          fontWeight="600"
          fill="var(--fv-graphite)"
          letterSpacing="1.5"
        >
          FLEETVOLT ROUTE
        </text>
        <text
          y="12"
          fontFamily="var(--font-mono)"
          fontSize="7.5"
          fill="var(--fv-steel)"
          letterSpacing="1"
        >
          EV FREIGHT MODELER v2.1
        </text>
      </g>

      {/* ── Bottom-right metadata ── */}
      <g transform="translate(700, 310)">
        <text
          textAnchor="end"
          fontFamily="var(--font-mono)"
          fontSize="7.5"
          fill="var(--fv-steel)"
          letterSpacing="1"
        >
          POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
        </text>
      </g>
    </svg>
  );
}
