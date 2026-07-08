#!/usr/bin/env python3
"""Merge HVIP CSV data into existing truck JSONs + create new truck configs."""
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

# Load CSV
with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
    rows = list(csv.DictReader(f))

def find_hvip_row(model_substr, oem_substr=None, tech="Battery Electric"):
    """Find first matching HVIP CSV row."""
    for r in rows:
        if model_substr.lower() in r["Model"].lower():
            if oem_substr and oem_substr.lower() not in r["OEM"].lower():
                continue
            if tech and r.get("Technology Type", "").strip() != tech:
                continue
            return r
    return None

def build_hvip_section(row, battery_filter=None):
    """Build hvip section from CSV row."""
    batteries = [b.strip() for b in row["Battery"].split(",")] if row["Battery"] else []
    if battery_filter:
        batteries = [b for b in batteries if battery_filter.lower() in b.lower()]
        if not batteries:
            batteries = [b.strip() for b in row["Battery"].split(",")] if row["Battery"] else []
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

def load_truck(filename):
    with open(os.path.join(TRUCKS_DIR, filename)) as f:
        return json.load(f)

def save_truck(filename, data):
    with open(os.path.join(TRUCKS_DIR, filename), "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

# ============================================================
# A. UPDATE EXISTING 10 TRUCKS
# ============================================================
updated = []

# 1. eCascadia 291
t = load_truck("ecascadia_291.json")
r = find_hvip_row("eCascadia")
t["hvip"] = build_hvip_section(r, "291")
t["carbValidation"] = CARB_VALIDATION
save_truck("ecascadia_291.json", t)
updated.append("ecascadia_291.json")

# 2. eCascadia 438
t = load_truck("ecascadia_438.json")
t["hvip"] = build_hvip_section(r, "438")
t["carbValidation"] = CARB_VALIDATION
save_truck("ecascadia_438.json", t)
updated.append("ecascadia_438.json")

# 3. BYD 8TT
t = load_truck("byd_8tt.json")
r = find_hvip_row("BYD 8TT")
t["hvip"] = build_hvip_section(r)
t["carbValidation"] = CARB_VALIDATION
save_truck("byd_8tt.json", t)
updated.append("byd_8tt.json")

# 4. Nikola Tre BEV (not in HVIP — mark as not eligible)
t = load_truck("nikola_tre_bev.json")
t["hvip"] = {
    "eligible": False,
    "notes": "Nikola Tre BEV not found in HVIP eligible vehicles list as of 2026-07-08. Nikola not listed as an HVIP-eligible OEM."
}
t["carbValidation"] = CARB_VALIDATION
save_truck("nikola_tre_bev.json", t)
updated.append("nikola_tre_bev.json")

# 5. Peterbilt 579EV (500 kWh — we have this)
t = load_truck("peterbilt_579ev.json")
r = find_hvip_row("579EV", "peterbilt")
t["hvip"] = build_hvip_section(r, "500")
t["carbValidation"] = CARB_VALIDATION
save_truck("peterbilt_579ev.json", t)
updated.append("peterbilt_579ev.json")

# 6. Kenworth T680E 375
t = load_truck("t680e_375.json")
r = find_hvip_row("T680E", "kenworth")
t["hvip"] = build_hvip_section(r, "375")
t["carbValidation"] = CARB_VALIDATION
save_truck("t680e_375.json", t)
updated.append("t680e_375.json")

# 7. Tesla Semi LR
t = load_truck("tesla_semi_lr.json")
r = find_hvip_row("Tesla Semi")
t["hvip"] = build_hvip_section(r)
t["carbValidation"] = CARB_VALIDATION
save_truck("tesla_semi_lr.json", t)
updated.append("tesla_semi_lr.json")

# 8. Tesla Semi SR
t = load_truck("tesla_semi_sr.json")
t["hvip"] = build_hvip_section(r)
t["carbValidation"] = CARB_VALIDATION
save_truck("tesla_semi_sr.json", t)
updated.append("tesla_semi_sr.json")

# 9. Volvo VNR 375
t = load_truck("volvo_vnr_375.json")
r = find_hvip_row("VNRe", "volvo")
t["hvip"] = build_hvip_section(r, "375")
t["carbValidation"] = CARB_VALIDATION
save_truck("volvo_vnr_375.json", t)
updated.append("volvo_vnr_375.json")

# 10. Volvo VNR 565
t = load_truck("volvo_vnr_565.json")
t["hvip"] = build_hvip_section(r, "565")
t["carbValidation"] = CARB_VALIDATION
save_truck("volvo_vnr_565.json", t)
updated.append("volvo_vnr_565.json")

print(f"Updated {len(updated)} existing trucks: {updated}")
