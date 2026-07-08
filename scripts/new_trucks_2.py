#!/usr/bin/env python3
"""Create new truck configs from HVIP CSV — Part 2: Kenworth + Peterbilt + Tern."""
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

# PACCAR shared params (Kenworth/Peterbilt)
PACCAR_CD, PACCAR_FA, PACCAR_CRR = 0.67, 9.6, 0.0068
PACCAR_REGEN, PACCAR_AUX, PACCAR_DT = 0.68, 10, 0.91
PACCAR_CHARGE = [
    {"soc_pct": 10, "max_kw": 250}, {"soc_pct": 40, "max_kw": 220},
    {"soc_pct": 70, "max_kw": 130}, {"soc_pct": 90, "max_kw": 65}
]

def paccar_street(kwh, range_typ, range_max, health_min, health_max):
    return {
        "vehicleClass": 8, "axleConfig": "6x4", "batteryNameplateKwh": kwh,
        "batteryChemistry": "NMC",
        "streetEfficiencyKwhPerMi": {"min": 2.2, "max": 2.6, "typical": 2.4},
        "ratedRangeMiles": {"typical": range_typ, "max": range_max},
        "recommendedMilesPerCharge": {"healthMin": health_min, "healthMax": health_max},
        "batteryHealthGuidance": {
            "dailyChargeTargetPct": 80, "operatingWindowMinPct": 20,
            "operatingWindowMaxPct": 80, "dodMaxPct": 60,
            "notes": "PACCAR platform (shared Kenworth/Peterbilt). BEDT range 2.1-2.5 kWh/mi. No fleet pilot data for this variant."
        },
        "streetDataSources": ["PACCAR platform shared with T680E/579EV", "BEDT 2.1-2.5 kWh/mi range"],
        "streetDataConfidence": "low"
    }

def make_truck(name, kwh, oem_notes, hvip_row, charge_curve=None, street=None, carb=None):
    if charge_curve is None: charge_curve = PACCAR_CHARGE
    if street is None: street = paccar_street(kwh, 150, 180, 80, 150)
    if carb is None: carb = CARB
    return {
        "name": name, "nameplate_kwh": kwh, "usable_kwh": round(kwh * 0.90, 1),
        "bms_reserve_kwh": 0.5, "curb_weight_lbs": 25500,
        "drag_coefficient": PACCAR_CD, "frontal_area_m2": PACCAR_FA, "C_rr": PACCAR_CRR,
        "regen_efficiency": PACCAR_REGEN, "aux_kw_base": PACCAR_AUX,
        "drivetrain_efficiency": PACCAR_DT, "charge_curve": charge_curve,
        "source_notes": oem_notes, "street_metadata": street,
        "hvip": hvip_section(hvip_row), "carbValidation": carb
    }

created = []

# Kenworth T480E (250 kWh)
r = find_row("T480E", "kenworth")
t = make_truck("Kenworth T480E 250 kWh", 250, "Kenworth T480E (250 kWh pack). Class 8 straight truck/tractor. PACCAR platform.", r)
save("kenworth_t480e_250.json", t); created.append("kenworth_t480e_250.json")

# Kenworth T480E (375 kWh)
t = make_truck("Kenworth T480E 375 kWh", 375, "Kenworth T480E (375 kWh pack). Class 8 straight truck/tractor. PACCAR platform.", r)
save("kenworth_t480e_375.json", t); created.append("kenworth_t480e_375.json")

# Kenworth T880E (250 kWh)
r = find_row("T880E", "kenworth")
t = make_truck("Kenworth T880E 250 kWh", 250, "Kenworth T880E (250 kWh pack). Class 8 tractor. PACCAR platform.", r)
save("kenworth_t880e_250.json", t); created.append("kenworth_t880e_250.json")

# Kenworth T880E (375 kWh)
t = make_truck("Kenworth T880E 375 kWh", 375, "Kenworth T880E (375 kWh pack). Class 8 tractor. PACCAR platform.", r)
save("kenworth_t880e_375.json", t); created.append("kenworth_t880e_375.json")

# Kenworth T880E (500 kWh)
t = make_truck("Kenworth T880E 500 kWh", 500, "Kenworth T880E (500 kWh pack). Class 8 tractor. PACCAR platform.", r)
t["street_metadata"]["ratedRangeMiles"] = {"typical": 180, "max": 220}
t["street_metadata"]["recommendedMilesPerCharge"] = {"healthMin": 90, "healthMax": 200}
save("kenworth_t880e_500.json", t); created.append("kenworth_t880e_500.json")

# Kenworth T880E (625 kWh)
t = make_truck("Kenworth T880E 625 kWh", 625, "Kenworth T880E (625 kWh pack). Class 8 tractor. PACCAR platform.", r)
t["street_metadata"]["ratedRangeMiles"] = {"typical": 230, "max": 280}
t["street_metadata"]["recommendedMilesPerCharge"] = {"healthMin": 100, "healthMax": 250}
save("kenworth_t880e_625.json", t); created.append("kenworth_t880e_625.json")

# Peterbilt 567EV (250 kWh)
r = find_row("567EV", "peterbilt")
t = make_truck("Peterbilt 567EV 250 kWh", 250, "Peterbilt 567EV (250 kWh pack). Class 8 tractor. PACCAR platform.", r)
save("peterbilt_567ev_250.json", t); created.append("peterbilt_567ev_250.json")

# Peterbilt 567EV (375 kWh)
t = make_truck("Peterbilt 567EV 375 kWh", 375, "Peterbilt 567EV (375 kWh pack). Class 8 tractor. PACCAR platform.", r)
save("peterbilt_567ev_375.json", t); created.append("peterbilt_567ev_375.json")

# Peterbilt 567EV (500 kWh)
t = make_truck("Peterbilt 567EV 500 kWh", 500, "Peterbilt 567EV (500 kWh pack). Class 8 tractor. PACCAR platform.", r)
t["street_metadata"]["ratedRangeMiles"] = {"typical": 180, "max": 220}
t["street_metadata"]["recommendedMilesPerCharge"] = {"healthMin": 90, "healthMax": 200}
save("peterbilt_567ev_500.json", t); created.append("peterbilt_567ev_500.json")

# Peterbilt 567EV (625 kWh)
t = make_truck("Peterbilt 567EV 625 kWh", 625, "Peterbilt 567EV (625 kWh pack). Class 8 tractor. PACCAR platform.", r)
t["street_metadata"]["ratedRangeMiles"] = {"typical": 230, "max": 280}
t["street_metadata"]["recommendedMilesPerCharge"] = {"healthMin": 100, "healthMax": 250}
save("peterbilt_567ev_625.json", t); created.append("peterbilt_567ev_625.json")

# Peterbilt 579EV (250 kWh)
r = find_row("579EV", "peterbilt")
t = make_truck("Peterbilt 579EV 250 kWh", 250, "Peterbilt 579EV (250 kWh pack). Class 8 tractor. PACCAR platform shared with T680E.", r)
save("peterbilt_579ev_250.json", t); created.append("peterbilt_579ev_250.json")

# Peterbilt 579EV (375 kWh)
t = make_truck("Peterbilt 579EV 375 kWh", 375, "Peterbilt 579EV (375 kWh pack). Class 8 tractor. PACCAR platform shared with T680E.", r)
save("peterbilt_579ev_375.json", t); created.append("peterbilt_579ev_375.json")

# Peterbilt 579EV (396 kWh)
t = make_truck("Peterbilt 579EV 396 kWh", 396, "Peterbilt 579EV (396 kWh pack). Class 8 tractor. PACCAR platform shared with T680E.", r)
save("peterbilt_579ev_396.json", t); created.append("peterbilt_579ev_396.json")

print(f"Created {len(created)}: {created}")
