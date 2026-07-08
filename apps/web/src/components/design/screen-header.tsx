import Link from "next/link";
import type { ReactNode } from "react";

type ScreenHeaderProps = {
  title: string;
  subtitle: string;
  backHref?: string;
  backLabel?: string;
  status?: { text: string; color: string };
  rightSlot?: ReactNode;
};

export function ScreenHeader({
  title,
  subtitle,
  backHref,
  backLabel = "← HOME",
  status,
  rightSlot,
}: ScreenHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-black/8 pb-4">
      <div className="flex items-baseline gap-3.5">
        {backHref ? (
          <Link href={backHref} className="fv-nav-pill">
            {backLabel}
          </Link>
        ) : null}
        <span className="text-[19px] font-bold tracking-tight text-[#111116]">
          {title}
        </span>
        <span className="font-mono text-[11px] tracking-wide text-[#8a8a92]">
          {subtitle}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {rightSlot}
        {status ? (
          <div className="fv-status-pill" data-testid="job-status">
            <span
              className="fv-status-dot"
              style={{ background: status.color, color: status.color }}
            />
            {status.text}
          </div>
        ) : null}
      </div>
    </header>
  );
}
