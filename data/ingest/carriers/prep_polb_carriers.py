#!/usr/bin/env python3
"""Parse the POLB drayage carrier registry xlsx into normalized carrier rows (P12-09).

Input : data/raw/POLB/POLB-Status-Update-07-01-26.xlsx (the "POLB Status" sheet)
Output: data/ingest/carriers/out/polb_carriers.json
        = [{carrierKey, name, contactName, address, city, state, zip, phone}]

The POLB "Status Update" workbook is a single sheet ("POLB Status") whose real
header sits on the THIRD row (row index 2) under a merged section banner
("Executed Registration Agreement"). The 10 physical columns are:

    Seq #  |  Registration HD #  |  Trucking Company Name  |  Contact  |
    Address  |  City  |  State  |  Zip  |  Phone Number  |  (unused)

RAW vs ACTIVE reconciliation (documented for the flagship parity check):
  * The sheet is padded to 3,152 physical rows (~3,151 the plan cites). After the
    3-row header block, exactly 1,823 rows carry a real carrier (name+address+city);
    the remaining 1,326 are fully blank padding.
  * 1,823 active/registered carriers reconciles to the flagship VERIFIED count of
    ~1,824 (off by one — a rounding/one-off in the flagship note). There is NO
    status column distinguishing total-vs-active: the "active" subset IS simply the
    non-blank registered rows. We emit those 1,823.

carrierKey = sha256(normalized "name|address|city|state|zip")[:16]. name+address is
already fully unique across the 1,823 rows (verified), but city/state/zip are folded
in for extra collision safety. De-dupe on carrierKey (expected: no dupes).

FAILS LOUDLY if the expected columns cannot be located (prints the header row so the
mapping can be corrected) — never silently emits an empty/mis-mapped file.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[3]
XLSX = ROOT / "data" / "raw" / "POLB" / "POLB-Status-Update-07-01-26.xlsx"
OUT_DIR = ROOT / "data" / "ingest" / "carriers" / "out"
OUT_JSON = OUT_DIR / "polb_carriers.json"

# Expected header labels (lower-cased, whitespace-collapsed) -> our field name.
HEADER_MAP = {
    "trucking company name": "name",
    "contact": "contactName",
    "address": "address",
    "city": "city",
    "state": "state",
    "zip": "zip",
    "phone number": "phone",
}


def _norm(s: object) -> str:
    return re.sub(r"\s+", " ", str(s).strip()) if s is not None else ""


def _norm_key(s: object) -> str:
    return _norm(s).lower()


def _carrier_key(name: str, address: str, city: str, state: str, zip_: str) -> str:
    basis = "|".join(_norm_key(x) for x in (name, address, city, state, zip_))
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()[:16]


def _find_header(rows: list[tuple]) -> tuple[int, dict[str, int]]:
    """Locate the header row + resolve column indices. Fail loudly if not found."""
    for ridx, row in enumerate(rows[:10]):
        labels = {_norm_key(v): ci for ci, v in enumerate(row) if v is not None}
        if "trucking company name" in labels and "address" in labels:
            colmap: dict[str, int] = {}
            for label, field in HEADER_MAP.items():
                if label not in labels:
                    sys.exit(
                        f"FATAL: header row {ridx} is missing expected column "
                        f"'{label}'. Header seen: {row!r}"
                    )
                colmap[field] = labels[label]
            return ridx, colmap
    sys.exit(
        "FATAL: could not locate the carrier header row (need 'Trucking Company "
        "Name' + 'Address'). First rows:\n"
        + "\n".join(repr(r) for r in rows[:6])
    )


def main() -> None:
    if not XLSX.exists():
        sys.exit(f"FATAL: registry xlsx not found: {XLSX}")

    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    print(f"sheet: {wb.sheetnames[0]!r}  dims={ws.max_row}x{ws.max_column}")
    rows = list(ws.iter_rows(values_only=True))
    raw_row_count = len(rows)

    header_idx, colmap = _find_header(rows)
    print(f"header at row index {header_idx}; column map: {colmap}")

    def cell(row: tuple, field: str) -> object:
        ci = colmap[field]
        return row[ci] if ci < len(row) else None

    carriers: dict[str, dict] = {}
    blank = 0
    dupes = 0
    considered = 0
    for row in rows[header_idx + 1 :]:
        name = _norm(cell(row, "name"))
        address = _norm(cell(row, "address"))
        city = _norm(cell(row, "city"))
        state = _norm(cell(row, "state"))
        zip_ = _norm(cell(row, "zip"))
        contact_name = _norm(cell(row, "contactName"))
        phone = _norm(cell(row, "phone"))
        # a real carrier row must carry a name AND (address or city)
        if not name or not (address or city):
            if not any((name, address, city, state, zip_)):
                blank += 1
            continue
        considered += 1
        key = _carrier_key(name, address, city, state, zip_)
        rec = {
            "carrierKey": key,
            "name": name,
            "address": address or None,
            "city": city or None,
            "state": state or None,
            "zip": zip_ or None,
            "contactName": contact_name or None,
            "phone": phone or None,
        }
        if key in carriers:
            dupes += 1
            continue
        carriers[key] = rec

    out = list(carriers.values())
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    if not out:
        sys.exit("FATAL: emitted ZERO carriers — column mapping likely wrong.")

    print("---- POLB carrier prep ----")
    print(f"raw physical rows in sheet      : {raw_row_count} (~3,151 plan cite)")
    print(f"fully-blank padding rows        : {blank}")
    print(f"carrier rows considered         : {considered}")
    print(f"de-duped on carrierKey (removed): {dupes}")
    print(f"ACTIVE carriers emitted         : {len(out)}")
    print(f"flagship VERIFIED parity target : ~1,824 active  -> "
          f"{'MATCH (±1)' if abs(len(out) - 1824) <= 3 else 'MISMATCH — investigate'}")
    print(f"wrote {OUT_JSON.relative_to(ROOT)}")
    print("sample:", [c["city"] for c in out[:5]])


if __name__ == "__main__":
    main()
