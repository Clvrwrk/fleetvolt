#!/usr/bin/env python3
"""Create new truck configs from HVIP CSV — Part 1: Battle Motors + Janus + Hyundai."""
import json, csv, os

TRUCKS_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "trucks")
CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "HVIP Vehicle Data", "eligible-hvip-vehicles-070826.csv")

CARB_VALIDATION = {
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
        "eligible": True,
        "incentiveAmount": f"${row['Vehicle Incentive']}",
        "category": row["Category"],
        "gvwr": row["GVWR"],
        "modelYear": row["Model Year"],
        "dealers": row["Dealers"],
        "vehicleType": row["Vehicle Type"],
        "url": row["URL"],
        "batteryOptions": [b.strip() for b in row["Battery"].split(",")] if row["Battery"] else []
    }

def save(name, data):
    path = os.path.join(TRUCKS_DIR, name)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print(f"  created {name}")

def base_truck(name, kwh, usable_factor=0.90, curb=27000, cd=0.67, fa=9.8, crr=0.0068,
               regen=0.69, aux=10, drivetrain=0.91, charge_curve=None, notes="", street=None, hvip=None, carb=None):
    if charge_curve is None:
        charge_curve = [
            {"soc_pct": 10, "max_kw": 150},
            {"soc_pct": 40, "max_kw": 140},
            {"soc_pct": 70, "max_kw": 100},
            {"soc_pct": 90, "max_kw": 50}
        ]
    if street is None:
        street = {
            "vehicleClass": 8, "axleConfig": "6x4", "batteryNameplateKwh": kwh,
            "batteryChemistry": "NMC",
            "streetEfficiencyKwhPerMi": {"min": 2.2, "max": 2.6, "typical": 2.4},
            "ratedRangeMiles": {"typical": 120, "max": 160},
            "recommendedMilesPerCharge": {"healthMin": 60, "healthMax": 120},
            "batteryHealthGuidance": {
                "dailyChargeTargetPct": 80, "operatingWindowMinPct": 20,
                "operatingWindowMaxPct": 80, "dodMaxPct": 60,
                "notes": "No fleet pilot data. Efficiency estimated from same-class averages."
            },
            "streetDataSources": ["same-class average (CARB 2.0-2.4 kWh/mi)"],
            "streetDataConfidence": "low"
        }
    return {
        "name": name, "nameplate_kwh": kwh, "usable_kwh": round(kwh * usable_factor, 1),
        "bms_reserve_kwh": 0.5, "curb_weight_lbs": curb,
        "drag_coefficient": cd, "frontal_area_m2": fa, "C_rr": crr,
        "regen_efficiency": regen, "aux_kw_base": aux, "drivetrain_efficiency": drivetrain,
        "charge_curve": charge_curve, "source_notes": notes,
        "street_metadata": street, "hvip": hvip, "carbValidation": carb
    }

created = []

# Battle Motors BEV Raider (240 kWh)
r = find_row("BEV Raider", "battle")
t = base_truck("Battle Motors BEV Raider 240 kWh", 240, curb=25000, cd=0.68, fa=9.8, crr=0.0070,
    regen=0.69, notes="Battle Motors BEV Raider (240 kWh pack). Class 8 drayage tractor. Derived from HVIP specs; no public OEM spec sheet.",
    hvip=hvip_section(r), carb=CARB_VALIDATION)
save("battle_raider_240.json", t); created.append("battle_raider_240.json")

# Battle Motors BEV Raider (396 kWh)
t = base_truck("Battle Motors BEV Raider 396 kWh", 396, curb=25000, cd=0.68, fa=9.8, crr=0.0070,
    regen=0.69, notes="Battle Motors BEV Raider (396 kWh pack). Class 8 drayage tractor. Derived from HVIP specs.",
    hvip=hvip_section(r), carb=CARB_VALIDATION)
t["street_metadata"]["ratedRangeMiles"] = {"typical": 150, "max": 200}
t["street_metadata"]["recommendedMilesPerCharge"] = {"healthMin": 70, "healthMax": 170}
save("battle_raider_396.json", t); created.append("battle_raider_396.json")

# Battle Motors BEV Striker (240 kWh)
r = find_row("BEV Striker", "battle")
t = base_truck("Battle Motors BEV Striker 240 kWh", 240, curb=25000, cd=0.68, fa=9.8, crr=0.0070,
    regen=0.69, notes="Battle Motors BEV Striker (240 kWh pack). Class 8 drayage tractor.",
    hvip=hvip_section(r), carb=CARB_VALIDATION)
save("battle_striker_240.json", t); created.append("battle_striker_240.json")

# Battle Motors BEV Striker (396 kWh)
t = base_truck("Battle Motors BEV Striker 396 kWh", 396, curb=25000, cd=0.68, fa=9.8, crr=0.0070,
    regen=0.69, notes="Battle Motors BEV Striker (396 kWh pack). Class 8 drayage tractor.",
    hvip=hvip_section(r), carb=CARB_VALIDATION)
t["street_metadata"]["ratedRangeMiles"] = {"typical": 150, "max": 200}
t["street_metadata"]["recommendedMilesPerCharge"] = {"healthMin": 70, "healthMax": 170}
save("battle_striker_396.json", t); created.append("battle_striker_396.json")

# Battle Motors LNT (240 kWh)
r = find_row("LNT Battery Electric Tractor", "battle")
t = base_truck("Battle Motors LNT 240 kWh", 240, curb=25000, cd=0.68, fa=9.8, crr=0.0070,
    regen=0.69, notes="Battle Motors LNT (240 kWh pack). Class 8 tractor.",
    hvip=hvip_section(r), carb=CARB_VALIDATION)
save("battle_lnt_240.json", t); created.append("battle_lnt_240.json")

# Janus Electric JCM 540 (650 kWh conversion)
r = find_row("JCM 540", "janus")
t = base_truck("Janus Electric JCM 540 650 kWh", 650, usable_factor=0.88, curb=28000, cd=0.68, fa=9.8, crr=0.0070,
    regen=0.70, notes="Janus Electric JCM 540 conversion kit (650 kWh pack). Class 8 drayage conversion. Battery electric repower of existing diesel tractor.",
    hvip=hvip_section(r), carb=CARB_VALIDATION)
t["street_metadata"]["ratedRangeMiles"] = {"typical": 250, "max": 300}
t["street_metadata"]["recommendedMilesPerCharge"] = {"healthMin": 100, "healthMax": 250}
save("janus_jcm540_650.json", t); created.append("janus_jcm540_650.json")

# Hyundai Xcient Fuel Cell (FCEV — not BEV)
r = find_row("Xcient", "hyundai", tech="Hydrogen Fuel Cell")
fcev_carb = dict(CARB_VALIDATION)
fcev_carb["notes"] = "CARB efficiency data is for BEV drayage (TransPower). Hyundai Xcient is FCEV; efficiency characteristics differ. Included for reference only."
t = base_truck("Hyundai Xcient Fuel Cell", 72, usable_factor=0.90, curb=26000, cd=0.67, fa=9.8, crr=0.0068,
    regen=0.0, aux=10, drivetrain=0.92,
    charge_curve=[{"soc_pct": 10, "max_kw": 0}, {"soc_pct": 50, "max_kw": 0}, {"soc_pct": 90, "max_kw": 0}],
    notes="Hyundai Xcient Fuel Cell tractor (72 kWh battery + hydrogen fuel cell). FCEV, not BEV. Hydrogen refueling, not battery charging. HVIP eligible at $240,000.",
    hvip=hvip_section(r), carb=fcev_carb)
t["hvip"]["category"] = "Tractor (FCEV)"
t["hvip"]["technologyType"] = "Hydrogen Fuel Cell"
t["street_metadata"]["batteryChemistry"] = "Hydrogen Fuel Cell"
t["street_metadata"]["batteryNameplateKwh"] = 72
t["street_metadata"]["streetEfficiencyKwhPerMi"] = {"min": 1.8, "max": 2.2, "typical": 2.0, "notes": "FCEV: fuel cell efficiency ~50%, H2 consumption ~8 kg/100mi. Battery buffer 72 kWh for regen/peak."}
t["street_metadata"]["streetDataSources"] = ["OEM spec-derived", "same-class FCEV estimates"]
t["street_metadata"]["streetDataConfidence"] = "low"
save("hyundai_xcient_fcev.json", t); created.append("hyundai_xcient_fcev.json")

print(f"Created {len(created)}: {created}")
