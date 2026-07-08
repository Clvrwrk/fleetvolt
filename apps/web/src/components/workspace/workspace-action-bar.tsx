"use client";

import { ExportMenu } from "@/components/export/export-menu";
import { useScenarioStore } from "@/stores/scenario-store";

type WorkspaceActionBarProps = {
  onWhatIf: () => void;
  onCompare: () => void;
};

export function WorkspaceActionBar({
  onWhatIf,
  onCompare,
}: WorkspaceActionBarProps) {
  const comparisonCount = useScenarioStore((s) => s.comparisonScenarios.length);

  return (
    <footer className="fv-action-bar">
      <div className="fv-action-bar-actions">
        <button type="button" className="fv-btn-secondary" onClick={onWhatIf}>
          What-If Adjustments
        </button>
        <button
          type="button"
          className="fv-btn-secondary"
          onClick={onCompare}
          data-testid="compare-header-badge"
        >
          Compare Scenarios ({comparisonCount}/3)
        </button>
        <ExportMenu variant="secondary" />
      </div>
      <div className="fv-footer-credit">
        POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
      </div>
    </footer>
  );
}
