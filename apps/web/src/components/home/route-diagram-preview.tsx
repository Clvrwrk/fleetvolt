type RouteDiagramPreviewProps = {
  title: string;
  accent?: string;
};

/** Static elevation schematic — Design/Design files review/RouteDiagram.dc.html style */
export function RouteDiagramPreview({
  title,
  accent = "#4c8fb8",
}: RouteDiagramPreviewProps) {
  return (
    <svg
      viewBox="0 0 900 280"
      className="h-auto w-full"
      aria-label={title}
      role="img"
    >
      <rect x="0" y="0" width="900" height="280" fill="transparent" />
      <line
        x1="40"
        y1="220"
        x2="860"
        y2="220"
        stroke="#8A8A93"
        strokeWidth="1"
        strokeDasharray="4 4"
        opacity="0.6"
      />
      <polyline
        points="60,210 180,150 320,70 480,160 620,95 780,130 840,118"
        fill="none"
        stroke={accent}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="180" cy="150" r="12" fill="#FBFBFD" stroke="#3a3a3e" strokeWidth="3" />
      <circle cx="620" cy="95" r="14" fill="#FBFBFD" stroke="#3a3a3e" strokeWidth="3" />
      <rect
        x="70"
        y="185"
        width="88"
        height="36"
        fill="#E5E5EB"
        stroke="#8A8A93"
        strokeWidth="2"
      />
      <text
        x="44"
        y="248"
        fontFamily="var(--font-mono)"
        fontSize="10"
        fill="#9a9aa2"
      >
        0 mi
      </text>
      <text
        x="856"
        y="248"
        textAnchor="end"
        fontFamily="var(--font-mono)"
        fontSize="10"
        fill="#9a9aa2"
      >
        corridor end
      </text>
    </svg>
  );
}
