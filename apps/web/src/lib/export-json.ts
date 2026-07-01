import type { components } from "@fleetvolt/shared-types";

type SimulationJobPollResponse =
  components["schemas"]["SimulationJobPollResponse"];

export function buildJsonExport(pollResult: SimulationJobPollResponse): string {
  return JSON.stringify(pollResult, null, 2);
}

export function downloadBlob(
  content: string | Blob,
  filename: string,
  mimeType = "application/octet-stream",
): void {
  const blob =
    content instanceof Blob
      ? content
      : new Blob([content], { type: mimeType });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function hashPrefix(inputsHash: string | null | undefined): string {
  return (inputsHash ?? "unknown").slice(0, 8);
}
