import { cn } from "@/lib/utils";

type FleetVoltBrandProps = {
  className?: string;
  size?: "compact" | "standard" | "rail";
  showTagline?: boolean;
};

function FleetVoltBrandMark() {
  return (
    <svg className="fv-brand-mark" viewBox="0 0 112 120" aria-hidden="true">
      <circle className="fv-brand-orbit" cx="56" cy="60" r="44" />
      <circle className="fv-brand-tracer" cx="56" cy="60" r="44" />
      <path className="fv-brand-corner" d="M14 26V14h12M86 14h12v12M14 94v12h12M98 94v12H86" />
      <path className="fv-brand-bolt" d="M63 16 34 64h18l-6 40 32-54H58z" />
    </svg>
  );
}

export function FleetVoltBrand({
  className,
  size = "standard",
  showTagline = true,
}: FleetVoltBrandProps) {
  return (
    <span
      className={cn("fv-brand", `fv-brand--${size}`, className)}
      aria-label="FleetVolt — EV Freight Intelligence"
    >
      <FleetVoltBrandMark />
      {size !== "compact" ? (
        <span className="fv-brand-copy" aria-hidden="true">
          <span className="fv-brand-wordmark">FLEET<span>VOLT</span></span>
          {showTagline ? <span className="fv-brand-tagline">EV FREIGHT INTELLIGENCE</span> : null}
        </span>
      ) : null}
    </span>
  );
}
