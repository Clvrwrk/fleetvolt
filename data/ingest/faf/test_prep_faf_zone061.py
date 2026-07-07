"""Unit test for the FAF zone-061 prep aggregation (P12-03).

Tests the PURE aggregate_rows() reduction in isolation (no 695MB CSV, no
Convex) — the filter/aggregation logic that produces faf_zone061.json.

Run:  python -m pytest data/ingest/faf/test_prep_faf_zone061.py -q
  or: python data/ingest/faf/test_prep_faf_zone061.py
"""
from __future__ import annotations

import sys
from pathlib import Path

# import the prep module (sibling file)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from prep_faf_zone061 import aggregate_rows, ZONE_061  # noqa: E402


def _row(orig, dest, mode, sctg2, **tons_val):
    r = {"dms_orig": orig, "dms_dest": dest, "dms_mode": mode, "sctg2": sctg2}
    r.update(tons_val)
    return r


def test_only_zone_061_contributes():
    rows = [
        _row("061", "064", "1", "17", tons_2024="100.0", value_2024="500.0"),
        _row("062", "064", "1", "17", tons_2024="999.0", value_2024="999.0"),  # ignored
    ]
    out = aggregate_rows(iter(rows))
    assert out["matched"] == 1, "only the 061-origin row should match"
    assert (2024, "064", "1", "17") in out["acc"]
    assert out["acc"][(2024, "064", "1", "17")]["tons"] == 100.0
    assert out["acc"][(2024, "064", "1", "17")]["value"] == 500.0


def test_zero_padded_string_trap():
    # The dtype-string pitfall: "61" must NOT match the zero-padded "061".
    assert ZONE_061 == "061"
    rows = [_row("61", "064", "1", "17", tons_2024="100.0")]
    out = aggregate_rows(iter(rows))
    assert out["matched"] == 0, '"61" must not match zero-padded "061"'


def test_aggregation_sums_across_matching_keys():
    # Two raw rows with the SAME (year,dest,mode,sctg2) key sum together.
    rows = [
        _row("061", "064", "1", "17", tons_2024="100.0", value_2024="500.0"),
        _row("061", "064", "1", "17", tons_2024="50.0", value_2024="250.0"),
    ]
    out = aggregate_rows(iter(rows))
    b = out["acc"][(2024, "064", "1", "17")]
    assert b["tons"] == 150.0
    assert b["value"] == 750.0


def test_multi_year_and_blank_handling():
    rows = [
        _row("061", "063", "2", "31", tons_2018="10.0", tons_2024="20.0",
             value_2018="", value_2024="99.0"),
    ]
    out = aggregate_rows(iter(rows))
    assert out["acc"][(2018, "063", "2", "31")]["tons"] == 10.0
    assert out["acc"][(2018, "063", "2", "31")]["value"] == 0.0  # blank -> 0
    assert out["acc"][(2024, "063", "2", "31")]["tons"] == 20.0
    assert out["acc"][(2024, "063", "2", "31")]["value"] == 99.0


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"PASS {fn.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL {fn.__name__}: {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    sys.exit(1 if failed else 0)
