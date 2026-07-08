import Link from "next/link";
import { AppActionBar } from "@/components/design/app-action-bar";
import { FvInsetCard } from "@/components/design/fv-inset-card";
import { FvVizPanel } from "@/components/design/fv-viz-panel";
import { RoutePlannerFrame } from "@/components/design/route-planner-frame";
import { ScreenHeader } from "@/components/design/screen-header";

type ScreenShellProps = {
  mockFile: string;
  title: string;
  subtitle: string;
  phaseNote: string;
  gridClass: string;
  leftLabel: string;
  centerLabel: string;
  rightLabel: string;
  status?: { text: string; color: string };
};

export function ScreenShell({
  mockFile,
  title,
  subtitle,
  phaseNote,
  gridClass,
  leftLabel,
  centerLabel,
  rightLabel,
  status,
}: ScreenShellProps) {
  const isSingleColumn = gridClass === "grid-cols-1";

  return (
    <RoutePlannerFrame maxWidthClass="max-w-[1280px]">
      <ScreenHeader
        title={title}
        subtitle={subtitle}
        backHref="/"
        status={status}
      />

      <div className={`mt-5 grid gap-5 ${gridClass}`}>
        {!isSingleColumn ? (
          <aside className="flex flex-col gap-3">
            <div className="fv-section-label">{leftLabel}</div>
            <FvInsetCard>
              <p className="font-mono text-[10px] leading-relaxed text-[#9a9aa2]">
                {phaseNote}
              </p>
              <p className="mt-3 text-[11px] text-[#3a3a3e]">
                Reference:{" "}
                <code className="text-[10px]">
                  Design/Design files review/{mockFile}
                </code>
              </p>
            </FvInsetCard>
          </aside>
        ) : null}

        <section className="flex flex-col gap-3">
          {isSingleColumn ? (
            <div className="fv-section-label">{leftLabel}</div>
          ) : null}
          <FvVizPanel title={centerLabel}>
            <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
              <p className="text-[15px] font-semibold text-[#1a1a1e]">
                Screen shell — implementation pending
              </p>
              <p className="mt-2 max-w-lg font-mono text-[10px] leading-relaxed text-[#9a9aa2]">
                {phaseNote}
              </p>
              <Link href="/planner" className="fv-btn-primary mt-6 inline-block px-8 no-underline">
                Open Route Planner
              </Link>
            </div>
          </FvVizPanel>
        </section>

        {!isSingleColumn ? (
          <aside className="flex flex-col gap-3">
            <div className="fv-section-label">{rightLabel}</div>
            <FvInsetCard>
              <p className="font-mono text-[10px] text-[#9a9aa2]">
                Results panel will mirror the mockup right rail when this phase
                ships.
              </p>
            </FvInsetCard>
          </aside>
        ) : null}
      </div>

      <AppActionBar />
    </RoutePlannerFrame>
  );
}
