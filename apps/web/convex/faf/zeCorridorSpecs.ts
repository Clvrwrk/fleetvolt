/**
 * Energy Forward zero-emission corridor planning specs.
 * Client ask: Long Beach → Shafter and Long Beach → Tijuana for a 60-truck fleet,
 * including interim charging needs and US / Mexico border capacity.
 */
import { v } from "convex/values";
import { query } from "../_generated/server";

const fleetSize = 60;

export const energyForwardZeCorridors = query({
  args: {},
  returns: v.object({
    client: v.string(),
    fleetSizeTrucks: v.number(),
    corridors: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        corridorKey: v.string(),
        origin: v.string(),
        destination: v.string(),
        borderSides: v.array(v.string()),
        interimNeeds: v.array(v.string()),
        capacityQuestions: v.array(v.string()),
        analysisHooks: v.object({
          routePreset: v.string(),
          originLat: v.number(),
          originLng: v.number(),
          destLat: v.number(),
          destLng: v.number(),
        }),
      }),
    ),
    note: v.string(),
  }),
  handler: async () => {
    return {
      client: "Energy Forward",
      fleetSizeTrucks: fleetSize,
      corridors: [
        {
          id: "lb-shafter",
          name: "Long Beach → Shafter",
          corridorKey: "polb-shafter-ze",
          origin: "Port of Long Beach",
          destination: "Shafter, CA (Central Valley)",
          borderSides: ["US"],
          interimNeeds: [
            "Depot / overnight charging for 60 Class 8 BETs at origin or Shafter yard",
            "En-route MCS or ≥350 kW stops on I-5 / CA-99 if daily cycle exceeds usable range",
            "Staging capacity near POLB for turnaround dwell",
          ],
          capacityQuestions: [
            "How many simultaneous charge bays at Long Beach vs Shafter for a 60-truck roster?",
            "What interim (pre-MCS) public HD sites cover the corridor today?",
            "Peak kW draw if 20–30% of fleet charges overnight at each end?",
          ],
          analysisHooks: {
            routePreset: "polb-shafter-ze",
            originLat: 33.7542,
            originLng: -118.2165,
            destLat: 35.5005,
            destLng: -119.2718,
          },
        },
        {
          id: "lb-tijuana",
          name: "Long Beach → Tijuana",
          corridorKey: "polb-tijuana-ze",
          origin: "Port of Long Beach",
          destination: "Tijuana via Otay Mesa POE",
          borderSides: ["US", "Mexico"],
          interimNeeds: [
            "US-side charging before Otay Mesa (San Diego / Chula Vista / Otay)",
            "Mexico-side depot or public HD charging for return legs (Tijuana industrial parks)",
            "Border wait / HOS buffer — SoC reserve for queue + inspection dwell",
            "Cross-border charger standards and access (CCS / MCS availability on MX side)",
          ],
          capacityQuestions: [
            "US interim capacity within 15 mi of Otay Mesa for a 60-truck fleet?",
            "Mexico-side sites that can host Class 8 overnight or opportunity charge?",
            "Split of charge events: US depot vs border staging vs MX yard?",
          ],
          analysisHooks: {
            routePreset: "polb-tijuana-ze",
            originLat: 33.7542,
            originLng: -118.2165,
            destLat: 32.555,
            destLng: -116.938,
          },
        },
      ],
      note:
        "Planning/feasibility only — not dispatch. Model interim vs strategic MCS; treat MX sites as capacity assumptions until verified.",
    };
  },
});
