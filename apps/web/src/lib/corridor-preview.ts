/** Static preview metrics aligned with Design/Design files review/FleetVolt Home.dc.html */
export type CorridorPreview = {
  key: string;
  short: string;
  distMi: number;
  gradePct: number;
  energyKwh: number;
  regenKwh: number;
  stops: number;
  savingsPct: number;
};

const PREVIEWS: Record<string, Omit<CorridorPreview, "key">> = {
  polb_inland_empire: {
    short: "Inland Empire",
    distMi: 62,
    gradePct: 2.1,
    energyKwh: 198,
    regenKwh: 31,
    stops: 1,
    savingsPct: 64,
  },
  polb_cajon_pass: {
    short: "Barstow",
    distMi: 128,
    gradePct: 3.8,
    energyKwh: 312,
    regenKwh: 47,
    stops: 2,
    savingsPct: 62,
  },
  polb_las_vegas: {
    short: "Las Vegas",
    distMi: 272,
    gradePct: 4.5,
    energyKwh: 648,
    regenKwh: 58,
    stops: 3,
    savingsPct: 59,
  },
};

export function corridorPreview(
  corridorKey: string,
  fallbackName: string,
): CorridorPreview {
  const base = PREVIEWS[corridorKey];
  if (base) {
    return { key: corridorKey, ...base };
  }
  return {
    key: corridorKey,
    short: fallbackName.split("→").pop()?.trim() ?? fallbackName,
    distMi: 0,
    gradePct: 0,
    energyKwh: 0,
    regenKwh: 0,
    stops: 0,
    savingsPct: 0,
  };
}
