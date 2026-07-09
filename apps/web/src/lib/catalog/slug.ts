export function catalogSlug(
  oem: string,
  model: string,
  packKwh: number | null,
): string {
  const base = `${oem}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return packKwh != null ? `${base}-${packKwh}` : base;
}
