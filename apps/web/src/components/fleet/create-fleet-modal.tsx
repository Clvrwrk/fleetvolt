"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { TechnicalLabel } from "@/components/design/technical-label";
import type { FleetStatus, SavedFleetVehicle } from "@/lib/fleet/saved-fleets";
import { cn } from "@/lib/utils";

export type CreateFleetModalProps = {
  open: boolean;
  vehicles: SavedFleetVehicle[];
  onClose: () => void;
  onSave: (input: {
    name: string;
    routeName: string;
    status: FleetStatus;
  }) => void | Promise<void>;
};

export function CreateFleetModal({
  open,
  vehicles,
  onClose,
  onSave,
}: CreateFleetModalProps) {
  const [name, setName] = useState("");
  const [routeName, setRouteName] = useState("");
  const [status, setStatus] = useState<FleetStatus>("planned");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const totalUnits = vehicles.reduce((sum, v) => sum + v.qty, 0);

  async function handleSave() {
    if (!name.trim() || !routeName.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        routeName: routeName.trim(),
        status,
      });
      setName("");
      setRouteName("");
      setStatus("planned");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-fleet-title"
      data-testid="create-fleet-modal"
    >
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-[var(--fv-paper)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/8 px-5 py-4">
          <div>
            <TechnicalLabel>NEW FLEET</TechnicalLabel>
            <h2
              id="create-fleet-title"
              className="text-lg font-bold text-[var(--fv-graphite)]"
            >
              Save fleet
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--fv-steel)] hover:bg-black/5 hover:text-[var(--fv-graphite)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-xs text-[var(--fv-text-muted)]">
            {vehicles.length} model{vehicles.length === 1 ? "" : "s"} ·{" "}
            {totalUnits} unit{totalUnits === 1 ? "" : "s"} selected
          </p>

          <label className="block space-y-1.5">
            <TechnicalLabel>Fleet name</TechnicalLabel>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Drayage Co."
              className="fv-input w-full"
              autoFocus
            />
          </label>

          <label className="block space-y-1.5">
            <TechnicalLabel>Route name</TechnicalLabel>
            <input
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="POLB → Inland Empire"
              className="fv-input w-full"
            />
          </label>

          <label className="block space-y-1.5">
            <TechnicalLabel>Status</TechnicalLabel>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as FleetStatus)}
              className="fv-input w-full"
            >
              <option value="active">Active</option>
              <option value="planned">Planned</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-black/8 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold text-[var(--fv-graphite)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !name.trim() || !routeName.trim()}
            className={cn(
              "rounded-xl bg-[var(--fv-graphite)] px-4 py-2.5 text-sm font-bold text-white",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
            data-testid="save-fleet-button"
          >
            {saving ? "Saving…" : "Save Fleet"}
          </button>
        </div>
      </div>
    </div>
  );
}
