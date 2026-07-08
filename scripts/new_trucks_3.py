#!/usr/bin/env python3
"""Create new truck configs from HVIP CSV — Part 3: Tern RC8 + Windrose + BYD variants."""
import json, csv, os

TRUCKS_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "trucks")
CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "HVIP Vehicle Data", "eligible-hvip-vehicles-070826.csv")

CARB = {
    "source": "CARB 180124hdbevefficiency (May 2018)",
    "testVehicle": "TransPower Class 8 drayage prototype @ 72,000 lbs GCW",
    "eerRange": {"min": 3.2, "max": 5.5},
    "mpdgeRange": {"min": 15.5, "max": 19.2},
    "derivedKwhPerMi": {"min": 1.76, "max": 2.17, "typical": 2.0},
    "testCycles": ["near-dock drayage", "local drayage", "delivery drayage", "regional drayage", "UDDS", "cruise", "7% grade"],
    "notes": "UCR chassis dynamometer + in-use study at POLB. Loaded to 72,000 lbs (average fully loaded drayage weight). EER = battery electric efficiency vs diesel."
}

with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
    rows = list(csv.DictReader(f))

def find_row(model_substr, oem_substr=None, tech="Battery Electric"):
    for r in rows:
        if model_substr.lower() in r["Model"].lower():
            if oem_substr and oem_substr.lower() not in r["OEM"].lower():
                continue
            if tech and r.get("Technology Type", "").strip() != tech:
                continue
            return r
    return None

def hvip_section(row):
    return {
        "eligible": True, "incentiveAmount": f"${row['Vehicle Incentive']}",
        "category": row["Category"], "gvwr": row["GVWR"], "modelYear": row["Model Year"],
        "dealers": row["Dealers"], "vehicleType": row["Vehicle Type"], "url": row["URL"],
        "batteryOptions": [b.strip() for b in row["Battery"].split(",")] if row["Battery"] else []
    }

def save(name, data):
    path = os.path.join(TRUCKS_DIR, name)
    with open(path, "w") as f:
        json.dump(data, f, indent=2); f.write("\n")
    print(f"  created {name}")

def make_truck(name, kwh, cd, fa, crr, regen, dt, curb, charge_curve, notes, street, hvip_row, carb=None):
    if carb is None: carb = CARB
    return {
        "name": name, "nameplate_kwh": kwh, "usable_kwh": round(kwh * 0.90, 1),
        "bms_reserve_kwh": 0.5, "curb_weight_lbs": curb,
        "drag_coefficient": cd, "frontal_area_m2": fa, "C_rr": crr,
        "regen_efficiency": regen, "aux_kw_base": 10, "drivetrain_efficiency": dt,
        "charge_curve": charge_curve, "source_notes": notes,
        "street_metadata": street, "hvip": hvip_section(hvip_row), "carbValidation": carb
    }

def std_street(kwh, chem, eff_min, eff_max, eff_typ, range_typ, range_max, health_min, health_max, sources, confidence="low", notes=""):
    return {
        "vehicleClass": 8, "axleConfig": "6x4", "batteryNameplateKwh": kwh,
        "batteryChemistry": chem,
        "streetEfficiencyKwhPerMi": {"min": eff_min, "max": eff_max, "typical": eff_typ},
        "ratedRangeMiles": {"typical": range_typ, "max": range_max},
        "recommendedMilesPerCharge": {"healthMin": health_min, "healthMax": health_max},
        "batteryHealthGuidance": {
            "dailyChargeTargetPct": 80, "operatingWindowMinPct": 20,
            "operatingWindowMaxPct": 80, "dodMaxPct": 60, "notes": notes or "No fleet pilot data. Efficiency estimated from same-class averages."
        },
        "streetDataSources": sources, "streetDataConfidence": confidence
    }

created = []

# Tern RC8 (269 kWh)
r = find_row("Tern RC8", "hexagon")
tern_cc = [{"soc_pct": 10, "max_kw": 150}, {"soc_pct": 40, "max_kw": 140}, {"soc_pct": 70, "max_kw": 100}, {"soc_pct": 90, "max_kw": 50}]
t = make_truck("Tern RC8 269 kWh", 269, 0.65, 9.8, 0.0068, 0.70, 0.92, 25000, tern_cc,
    "Tern RC8 (269 kWh pack). Hexagon Purus Class 8 drayage tractor. Derived from HVIP specs.",
    std_street(269, "NMC", 2.1, 2.5, 2.3, 100, 130, 50, 100, ["same-class average (CARB 2.0-2.4 kWh/mi)"]), r)
save("tern_rc8_269.json", t); created.append("tern_rc8_269.json")

# Tern RC8 (404 kWh)
t = make_truck("Tern RC8 404 kWh", 404, 0.65, 9.8, 0.0068, 0.70, 0.92, 25000, tern_cc,
    "Tern RC8 (404 kWh pack). Hexagon Purus Class 8 drayage tractor.",
    std_street(404, "NMC", 2.1, 2.5, 2.3, 160, 200, 70, 160, ["same-class average (CARB 2.0-2.4 kWh/mi)"]), r)
save("tern_rc8_404.json", t); created.append("tern_rc8_404.json")

# Tern RC8 (538 kWh)
t = make_truck("Tern RC8 538 kWh", 538, 0.65, 9.8, 0.0068, 0.70, 0.92, 25000, tern_cc,
    "Tern RC8 (538 kWh pack). Hexagon Purus Class 8 drayage tractor.",
    std_street(538, "NMC", 2.1, 2.5, 2.3, 220, 260, 90, 220, ["same-class average (CARB 2.0-2.4 kWh/mi)"]), r)
save("tern_rc8_538.json", t); created.append("tern_rc8_538.json")

# Windrose WDR4B0EV (705 kWh)
r = find_row("WDR4B0EV", "windrose")
wind_cc = [{"soc_pct": 10, "max_kw": 350}, {"soc_pct": 40, "max_kw": 320}, {"soc_pct": 70, "max_kw": 200}, {"soc_pct": 90, "max_kw": 100}]
t = make_truck("Windrose WDR4B0EV 705 kWh", 705, 0.60, 9.8, 0.0065, 0.72, 0.92, 26000, wind_cc,
    "Windrose WDR4B0EV (705 kWh pack). Class 8 tractor. Chinese OEM, long-range BEV.",
    std_street(705, "NMC", 1.9, 2.3, 2.1, 300, 360, 120, 300, ["same-class average", "OEM range claim derived"]), r)
save("windrose_wdr4b0ev_705.json", t); created.append("windrose_wdr4b0ev_705.json")

# Windrose WDR4B1EV (436 kWh)
r = find_row("WDR4B1EV", "windrose")
t = make_truck("Windrose WDR4B1EV 436 kWh", 436, 0.60, 9.8, 0.0065, 0.72, 0.92, 26000, wind_cc,
    "Windrose WDR4B1EV (436 kWh pack). Class 8 tractor. Chinese OEM.",
    std_street(436, "NMC", 1.9, 2.3, 2.1, 180, 220, 80, 180, ["same-class average", "OEM range claim derived"]), r)
save("windrose_wdr4b1ev_436.json", t); created.append("windrose_wdr4b1ev_436.json")

# BYD 8TT (422 kWh variant)
r = find_row("BYD 8TT", "byd")
byd_cc = [{"soc_pct": 10, "max_kw": 150}, {"soc_pct": 40, "max_kw": 140}, {"soc_pct": 70, "max_kw": 100}, {"soc_pct": 90, "max_kw": 50}]
t = make_truck("BYD 8TT 422 kWh", 422, 0.70, 10.0, 0.0070, 0.68, 0.91, 27000, byd_cc,
    "BYD 8TT (422 kWh pack). LFP chemistry. Heavier/less aerodynamic than competitors.",
    std_street(422, "LFP", 2.4, 2.8, 2.6, 120, 160, 60, 120, ["port deployments common", "heavier/less aero platform"], "medium"), r)
save("byd_8tt_422.json", t); created.append("byd_8tt_422.json")

# BYD 8TT (563 kWh variant)
t = make_truck("BYD 8TT 563 kWh", 563, 0.70, 10.0, 0.0070, 0.68, 0.91, 27000, byd_cc,
    "BYD 8TT (563 kWh pack). LFP chemistry. Heavier/less aerodynamic than competitors.",
    std_street(563, "LFP", 2.4, 2.8, 2.6, 180, 220, 80, 180, ["port deployments common", "heavier/less aero platform"], "medium"), r)
save("byd_8tt_563.json", t); created.append("byd_8tt_563.json")

print(f"Created {len(created)}: {created}")
