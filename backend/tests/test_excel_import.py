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
    select_import_sheets,
    TICKER_ALIASES,
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
    # The bonus row isn't a trade, but it explains a quantity change — it is
    # surfaced as an annotation rather than dropped.
    assert len(sheet.annotations) == 1
    assert "BONUS" in sheet.annotations[0].text
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


def test_typod_dates_are_repaired_and_reported():
    """Real workbooks carry slips; the rows are valid trades, so recover them."""
    data = _workbook({"Equity 2026-27": [
        ["DATE", "Description", "Buy Quantity", "Buy Rate", "Buy Value"],
        ["03/112025", "RELIANCE", 10, 100.0, 1000],      # separator dropped
        ["30/03/206", "TCS", 5, 200.0, 1000],            # year missing a digit
        ["10/04/0206", "INFY", 5, 200.0, 1000],          # leading zero + short
    ]})
    (sheet,) = parse_workbook(data, resolver=_resolver)

    assert len(sheet.rows) == 3, "no row may be lost to a typo"
    assert [r.buy_date for r in sheet.rows] == [
        date(2025, 11, 3), date(2026, 3, 30), date(2026, 4, 10),
    ]
    # Every repair is declared so the user confirms rather than trusting us.
    for row in sheet.rows:
        assert len(row.repairs) == 1
        assert row.repairs[0].field == "buy_date"


def test_profit_uses_values_not_rates_when_a_bonus_changes_quantity():
    """A 1:1 bonus doubles the holding, so sell qty diverges from buy qty.

    Bought 20 at 300 (6,000). Bonus makes it 40 shares, sold at 200 (8,000) —
    a 2,000 profit. Deriving from rates gives (200 - 300) x 20 = -2,000, a loss
    of the same magnitude with the sign flipped. Only the values are correct.
    """
    data = _workbook({"P&L_2025-26": [
        ["S.No", "DATE", "Description", "Buy Quantity", "Buy Rate", "Buy Value",
         "Sell Date", "Sell Quantity", "Sell Rate", "Sell Value"],
        [1, date(2024, 11, 21), "TCS", 20, 300.0, 6000,
         date(2025, 6, 10), 40, 200.0, 8000],
    ]})
    (sheet,) = parse_workbook(data, resolver=_resolver)
    (row,) = sheet.rows

    assert sheet.kind == "realized"
    assert row.buy_value == 6000
    assert row.sell_value == 8000
    assert row.profit_loss == 2000            # not -2000
    assert row.corporate_action is not None
    assert "2x" in row.corporate_action


def test_holdings_sheet_with_empty_sell_columns_is_not_realized():
    """Both sheet types declare sell columns; only populated ones count."""
    data = _workbook({"Equity _2026-27": [
        ["DATE", "Description", "Buy Quantity", "Buy Rate", "Buy Value",
         "Sell Date", "Sell Quantity", "Sell Rate"],
        [date(2025, 5, 12), "RELIANCE", 10, 2450.5, 24505, None, None, None],
        [date(2025, 6, 1), "TCS", 5, 3400.0, 17000, None, None, None],
    ]})
    (sheet,) = parse_workbook(data, resolver=_resolver)
    assert sheet.kind == "holdings"


def test_only_the_newest_holdings_sheet_imports():
    """Holdings sheets restate every open lot, so older ones would duplicate."""
    rows = [["DATE", "Description", "Buy Quantity", "Buy Rate", "Buy Value"],
            [date(2025, 5, 12), "RELIANCE", 10, 2450.5, 24505]]
    data = _workbook({
        "Equity -OLD": rows,
        " Equity _2025-26": rows,
        "Equity _2026-27": rows,
        "P&L_2025-26": [
            ["DATE", "Description", "Buy Quantity", "Buy Rate", "Buy Value",
             "Sell Date", "Sell Quantity", "Sell Rate", "Sell Value"],
            [date(2024, 5, 1), "TCS", 5, 3000.0, 15000,
             date(2025, 6, 1), 5, 3400.0, 17000],
        ],
        "P&L_2026-27": [
            ["DATE", "Description", "Buy Quantity", "Buy Rate", "Buy Value",
             "Sell Date", "Sell Quantity", "Sell Rate", "Sell Value"],
            [date(2025, 5, 1), "INFY", 5, 1400.0, 7000,
             date(2026, 6, 1), 5, 1600.0, 8000],
        ],
    })
    previews = select_import_sheets(parse_workbook(data, resolver=_resolver))
    chosen = {p.name.strip() for p in previews if p.selected}

    assert "Equity _2026-27" in chosen
    assert "Equity _2025-26" not in chosen
    assert "Equity -OLD" not in chosen
    # Realized sheets never overlap, so every one of them imports.
    assert {"P&L_2025-26", "P&L_2026-27"} <= chosen
    # And the reason a sheet was dropped is explained, not silent.
    dropped = [p for p in previews if not p.selected]
    assert all(p.skip_reason for p in dropped)


def test_totals_row_terminates_the_sheet():
    data = _workbook({"Equity 2026-27": [
        ["DATE", "Description", "Buy Quantity", "Buy Rate", "Buy Value"],
        [date(2025, 5, 12), "RELIANCE", 10, 2450.5, 24505],
        [None, None, None, "INVESTED", 41505],
        [date(2025, 6, 1), "TCS", 5, 3400.0, 17000],   # after totals: ignored
    ]})
    (sheet,) = parse_workbook(data, resolver=_resolver)
    assert len(sheet.rows) == 1


def test_stale_alias_is_not_trusted():
    """An alias whose target no longer lists must not pass as resolved.

    Listings change — the Tata Motors DVR converted and the company demerged —
    so a mapping written once can rot. A stale alias has to come back for
    confirmation, not sail through preview and fail at commit.
    """
    live = {"RELIANCE", "TMPV"}
    # Target present: resolves.
    ok = resolve_ticker("TATA MOTORS PV", symbol_set=live,
                        fuzzy=lambda q, top_n=5: [])
    assert ok.status == "alias" and ok.ticker == "TMPV"

    # Target absent from the master: must not claim a match.
    stale = resolve_ticker("TATA MOTORS PV", symbol_set={"RELIANCE"},
                           fuzzy=lambda q, top_n=5: [{"symbol": "TMPV"}])
    assert stale.status != "alias"
    assert stale.ticker is None, "an unlisted symbol must not be handed to commit"


def test_alias_table_targets_are_all_live():
    """Guards against another mapping silently rotting.

    Uses the NSE master when it's loaded; skips rather than failing when it
    isn't, so the suite still runs standalone.
    """
    try:
        from app.services.nse_master import get_nse_symbol_set
        symbols = get_nse_symbol_set()
    except Exception:
        symbols = set()
    if not symbols:
        print("    (skipped: NSE master not loaded)")
        return
    stale = {k: v for k, v in TICKER_ALIASES.items() if v not in symbols}
    assert not stale, f"alias targets no longer listed on NSE: {stale}"


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
