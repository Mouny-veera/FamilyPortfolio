"""Column auto-detection tests for the Excel import.

Runs standalone (no pytest needed):
    python3 backend/tests/test_excel_import.py

pytest will also collect it if you have it installed.
"""

import io
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import openpyxl

from app.services.excel_import import (
    assign_lot_labels,
    derive_financial_year,
    parse_date,
    parse_workbook,
    resolve_ticker,
)

# Stub the symbol lookup so tests don't depend on the NSE master being loaded.
STUB_SYMBOLS = {"RELIANCE", "TCS", "INFY", "HINDUNILVR", "INDUSINDBK", "TATACHEM"}


def _resolver(raw):
    return resolve_ticker(raw, symbol_set=STUB_SYMBOLS, fuzzy=lambda q, top_n=5: [])


def _workbook(sheets: dict[str, list[list]]) -> bytes:
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for name, rows in sheets.items():
        ws = wb.create_sheet(name)
        for row in rows:
            ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_family_layout():
    """Hand-maintained sheet: headers present, extra columns, a bonus row."""
    data = _workbook({"Equity 2025-26": [
        ["SNO", "LOT", "DATE", "DESCRIPTION", "QTY", "RATE", "Buy Value"],
        [1, "1", date(2025, 5, 12), "RELIANCE", 10, 2450.50, 24505],
        [2, "2", date(2025, 6, 1), "TATA CHEMICALS", 5, 1080.25, 5401.25],
        [3, "", "", "BONUS 1:1", "", "", ""],
        [4, "3", date(2025, 7, 3), "HINDUSTAN UNILEVER", 8, 2300.00, 18400],
    ]})
    (sheet,) = parse_workbook(data, resolver=_resolver)

    assert sheet.kind == "holdings"
    assert sheet.mapping["description"].index == 3
    assert sheet.mapping["qty"].index == 4
    assert sheet.mapping["buy_rate"].index == 5
    assert len(sheet.rows) == 3
    # The bonus annotation is skipped, and visibly so.
    assert len(sheet.skipped) == 1
    assert "corporate action" in sheet.skipped[0].reason
    # Company names resolve through the alias table.
    assert [r.match.ticker for r in sheet.rows] == ["RELIANCE", "TATACHEM", "HINDUNILVR"]


def test_broker_layout_with_title_rows():
    """Broker export: metadata above the header, different wording, sell side."""
    data = _workbook({"Capital Gain Statement": [
        ["HDFC Securities Ltd"],
        ["Client: XXXXX   Period: 01-Apr-2025 to 31-Mar-2026"],
        [],
        ["Scrip Name", "Trade Date", "Quantity", "Purchase Price",
         "Sale Date", "Qty Sold", "Sale Price"],
        ["TCS", date(2025, 4, 10), 12, 3400.00, date(2025, 9, 2), 12, 3900.00],
        ["INFY", date(2025, 5, 20), 25, 1500.00, date(2025, 11, 8), 25, 1720.50],
    ]})
    (sheet,) = parse_workbook(data, resolver=_resolver)

    assert sheet.header_row == 3, "must skip the title rows"
    assert sheet.kind == "realized"
    assert sheet.mapping["sell_date"].index == 4
    assert sheet.mapping["sell_rate"].index == 6
    assert len(sheet.rows) == 2
    assert sheet.rows[0].sell_date == date(2025, 9, 2)
    assert sheet.rows[0].sell_rate == 3900.00


def test_headerless_falls_back_to_type_inference():
    data = _workbook({"Sheet1": [
        [date(2025, 4, 10), "RELIANCE", 10, 2450.50],
        [date(2025, 5, 11), "TCS", 20, 3400.00],
        [date(2025, 6, 12), "INFY", 30, 1500.25],
        [date(2025, 7, 13), "HINDUNILVR", 40, 2300.75],
    ]})
    (sheet,) = parse_workbook(data, resolver=_resolver)

    assert sheet.header_row is None
    assert sheet.mapping["buy_date"].index == 0
    assert sheet.mapping["description"].index == 1
    assert sheet.mapping["qty"].index == 2
    assert sheet.mapping["buy_rate"].index == 3
    assert len(sheet.rows) == 4
    # Inferred mappings must read as uncertain so the UI asks for confirmation.
    assert all(g.confidence <= 0.5 for g in sheet.mapping.values())


def test_junk_sheets_are_dropped():
    data = _workbook({"Disclaimer": [
        ["This report is computer generated."],
        ["No signature required."],
    ]})
    assert parse_workbook(data, resolver=_resolver) == []


def test_rows_missing_required_fields_are_reported_not_silently_dropped():
    data = _workbook({"Equity": [
        ["DATE", "DESCRIPTION", "QTY", "RATE"],
        [date(2025, 5, 12), "RELIANCE", 10, 2450.50],
        [date(2025, 5, 13), "TCS", None, 3400.00],      # no qty
        [date(2025, 5, 14), "", 5, 100.0],               # no description
        ["not a date", "INFY", 5, 100.0],                # unreadable date
    ]})
    (sheet,) = parse_workbook(data, resolver=_resolver)

    assert len(sheet.rows) == 1
    reasons = sorted(s.reason for s in sheet.skipped)
    assert reasons == ["missing quantity or rate", "no description", "unreadable buy date"]


def test_financial_year_boundary():
    assert derive_financial_year(date(2025, 4, 1)) == "2025-26"
    assert derive_financial_year(date(2025, 3, 31)) == "2024-25"
    assert derive_financial_year(date(2026, 1, 15)) == "2025-26"


def test_lot_labels_follow_sublot_convention():
    labels = assign_lot_labels(["RELIANCE", "TCS", "RELIANCE", "RELIANCE", "TCS"])
    assert labels == ["1", "2", "1A", "1B", "2A"]


def test_date_parsing_variants():
    assert parse_date("12/05/2025") == date(2025, 5, 12)     # dd/mm/yyyy
    assert parse_date("12-05-2025") == date(2025, 5, 12)
    assert parse_date(date(2025, 5, 12)) == date(2025, 5, 12)
    assert parse_date("garbage") is None
    assert parse_date(None) is None


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
        print(f"  ok  {fn.__name__}")
    print(f"\n{len(tests)} tests passed")
