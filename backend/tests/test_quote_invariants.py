"""Invariants the quote endpoint must hold regardless of what a provider returns.

Run standalone:  python3 tests/test_quote_invariants.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.routers.stocks import _widen_52w_range


def test_lagging_provider_high_is_widened_to_todays_high():
    # A provider whose 52W fields are a session behind reported a high below the
    # live price, which rendered a 52W range that excluded the price beside it.
    q = _widen_52w_range({
        "last_price": 1280.05, "high": 1374.00, "low": 1233.00,
        "high_52w": 1224.50, "low_52w": 700.80,
    })
    assert q["high_52w"] == 1374.00
    assert q["low_52w"] == 700.80


def test_fresh_provider_data_is_left_alone():
    q = _widen_52w_range({
        "last_price": 1000.0, "high": 1010.0, "low": 990.0,
        "high_52w": 1500.0, "low_52w": 800.0,
    })
    assert q["high_52w"] == 1500.0
    assert q["low_52w"] == 800.0


def test_a_new_52w_low_today_lowers_the_floor():
    q = _widen_52w_range({
        "last_price": 650.0, "high": 660.0, "low": 640.0,
        "high_52w": 1224.5, "low_52w": 700.8,
    })
    assert q["low_52w"] == 640.0
    assert q["high_52w"] == 1224.5


def test_missing_day_range_falls_back_to_last_price():
    q = _widen_52w_range({
        "last_price": 1280.05, "high": None, "low": None,
        "high_52w": 1224.5, "low_52w": 700.8,
    })
    assert q["high_52w"] == 1280.05


def test_absent_52w_fields_stay_absent():
    q = _widen_52w_range({
        "last_price": 1280.05, "high": 1374.0, "low": 1200.0,
        "high_52w": None, "low_52w": None,
    })
    assert q["high_52w"] is None
    assert q["low_52w"] is None


def test_no_price_at_all_does_not_raise():
    q = _widen_52w_range({
        "last_price": None, "high": None, "low": None,
        "high_52w": 1224.5, "low_52w": 700.8,
    })
    assert q["high_52w"] == 1224.5


def test_the_range_always_contains_the_price():
    # The property that matters, over the shapes a provider can hand us.
    cases = [
        {"last_price": 1280.05, "high": 1374.0, "low": 1233.0, "high_52w": 1224.5, "low_52w": 700.8},
        {"last_price": 650.0, "high": 660.0, "low": 640.0, "high_52w": 1224.5, "low_52w": 700.8},
        {"last_price": 1000.0, "high": None, "low": None, "high_52w": 900.0, "low_52w": 1100.0},
    ]
    for case in cases:
        q = _widen_52w_range(dict(case))
        assert q["high_52w"] >= q["last_price"], case
        assert q["low_52w"] <= q["last_price"], case


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
        print(f"  ok  {fn.__name__}")
    print(f"\n{len(tests)} tests passed")
