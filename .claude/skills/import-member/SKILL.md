# Import Member Holdings from Excel

Import a family member's Excel file into the portfolio database. Handles Equity sheets (active holdings) and P&L sheets (realized trades).

## When to use

Use when the user says: "import", "import member", "import excel", "import holdings", "load excel", "add member data", or names a family member + excel file.

## Input

The user provides:
- **Excel file path** — e.g. `~/Downloads/VEERAKUMAR Equity.xlsx`
- **Member name** — one of: Veerakumar, Sneeha, Mouny, Mani, Devi

If the user only provides a file path, infer the member name from the filename (e.g. "VEERAKUMAR Equity.xlsx" → Veerakumar). If ambiguous, ask.

## Steps

### 1. Validate inputs

- Confirm the Excel file exists at the given path
- Confirm the member name matches one of the 5 family members (case-insensitive)
- Check if the member already has data in the database:
  ```bash
  python3 -c "
  import sqlite3
  conn = sqlite3.connect('data/portfolio.db')
  lots = conn.execute('SELECT COUNT(*) FROM lots WHERE member_id = (SELECT id FROM members WHERE LOWER(name) = LOWER(\"MEMBER_NAME\"))').fetchone()[0]
  pnl = conn.execute('SELECT COUNT(*) FROM realized_pnl WHERE member_id = (SELECT id FROM members WHERE LOWER(name) = LOWER(\"MEMBER_NAME\"))').fetchone()[0]
  print(f'Existing: {lots} lots, {pnl} P&L records')
  "
  ```
- If data exists, warn the user and ask whether to clear and re-import or abort

### 2. Preview the Excel file

Before importing, read the Excel file to show the user what will be imported:

```bash
python3 -c "
import openpyxl, warnings
warnings.filterwarnings('ignore')
wb = openpyxl.load_workbook('FILE_PATH')
for name in wb.sheetnames:
    ws = wb[name]
    rows = sum(1 for r in ws.iter_rows(min_row=2) if any(c.value for c in r))
    print(f'  {name}: ~{rows} rows')
"
```

Show the user:
- Sheet names found (Equity vs P&L)
- Approximate row counts
- Which sheet will be used for active holdings (most recent Equity sheet)
- Which sheets will be used for P&L (all P&L sheets)

### 3. Run the import

```bash
cd /Users/mounyveera/FamilyPortfolio
python3 scripts/import_excel.py "FILE_PATH" "MEMBER_NAME" <<< "y"
```

The script handles:
- Parsing dates (multiple formats: DD/MM/YYYY, DD/MM/YY, YYYY-MM-DD)
- Normalizing ticker names (e.g. "APOLLO TYRES" → "APOLLOTYRE")
- Skipping annotation rows (BONUS, SPLIT notes)
- Auto-assigning lot labels (1, 1A, 1B per ticker)
- Deriving financial year from dates (Apr 1+ = current FY)
- Importing active holdings from the most recent Equity sheet
- Importing realized P&L from all P&L sheets

### 4. Verify the import

After import, verify the data:

```bash
python3 -c "
import sqlite3
conn = sqlite3.connect('data/portfolio.db')
mid = conn.execute('SELECT id FROM members WHERE LOWER(name) = LOWER(\"MEMBER_NAME\")').fetchone()[0]
lots = conn.execute('SELECT COUNT(*) FROM lots WHERE member_id = ?', (mid,)).fetchone()[0]
pnl = conn.execute('SELECT COUNT(*) FROM realized_pnl WHERE member_id = ?', (mid,)).fetchone()[0]
tickers = conn.execute('SELECT COUNT(DISTINCT ticker) FROM lots WHERE member_id = ?', (mid,)).fetchone()[0]
invested = conn.execute('SELECT COALESCE(SUM(buy_value), 0) FROM lots WHERE member_id = ?', (mid,)).fetchone()[0]
print(f'Imported: {lots} active lots across {tickers} tickers')
print(f'Imported: {pnl} realized P&L records')
print(f'Total invested: ₹{invested:,.2f}')
"
```

### 5. Refresh prices

After a successful import, trigger a price refresh so the new holdings get live prices:

```bash
curl -s -X POST http://localhost:8000/api/settings/refresh-prices | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Refreshed {d[\"updated\"]} ticker prices')"
```

### 6. Report results

Show the user a summary:
- Number of active lots imported
- Number of P&L records imported
- Total invested value
- Number of unique tickers
- Any tickers that may need remapping (check the Holdings page for unmapped warnings)

## Excel Format Reference

The family's Excel files follow this structure:

**Filename**: `{MEMBER} Equity.xlsx` (e.g. "VEERAKUMAR Equity.xlsx")

**Equity sheets** (named "Equity_2024-25", "Equity_2025-26", etc.):
- Column C: Buy Date
- Column D: Description (ticker name, may need normalization)
- Column E: Buy Quantity
- Column F: Buy Rate

**P&L sheets** (named "P&L_2024-25", "P&L_2025-26", etc.):
- Column C: Buy Date
- Column D: Description
- Column E: Buy Quantity
- Column F: Buy Rate
- Column H: Sell Date
- Column I: Sell Quantity
- Column J: Sell Rate

## Ticker Normalization

Common mappings are handled automatically by `scripts/import_excel.py`:
- "APOLLO TYRES" → "APOLLOTYRE"
- "INDUSIND BANK" → "INDUSINDBK"
- "HINDUSTAN UNILEVER" → "HINDUNILVR"
- "RELIANCE INDUSTRIES" → "RELIANCE"
- etc.

If a new ticker isn't recognized, it gets cleaned (spaces removed, uppercased). The user can remap it later via the Holdings page ticker mapping feature.

## Error Handling

- If the Excel file has unexpected sheet names, list them and ask the user which to import
- If date parsing fails for some rows, report the count of skipped rows
- If the database is locked, remind the user to ensure the backend isn't writing to it simultaneously
- Never silently skip errors — always report what was skipped and why
