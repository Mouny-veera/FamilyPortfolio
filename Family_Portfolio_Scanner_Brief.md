# Family Stock Portfolio Scanner & Tracker — Project Brief (v4)

A private, local-first Family Stock Portfolio Scanner & Tracker for the **Indian stock market (NSE)**, running at **$0/month**. Built for 5 family members: **Veerakumar, Sneeha, Mouny, Mani, Devi**.

---

## TECH STACK (Final)

| Layer | Choice |
|---|---|
| Backend | Python 3.12+ / FastAPI / uvicorn |
| ORM | SQLAlchemy (async) via aiosqlite |
| Database | SQLite — `data/portfolio.db` |
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS v4 + custom CSS variables |
| Icons | lucide-react |
| Charts | Recharts (FY profit bar chart + member allocation donut) |
| Fonts | Inter (sans) + JetBrains Mono (mono) via Google Fonts |
| Market Data | yfinance (.NS suffix for NSE tickers) |
| Live Quotes | NseIndiaApi (rate-throttled 3 req/sec) |
| Excel Import | openpyxl (via `scripts/import_excel.py`) |
| Excel Export | openpyxl (planned — `services/export_service.py`) |
| Alerts | Telegram Bot API (deferred) |

## ARCHITECTURE

- **One-time Excel seeding**: Excel sheets are for initial DB migration only. Once seeded, the app operates independently of Excel files.
- **Local DB as source of truth**: All invested values, P&L calculations, and holdings data come from the local SQLite database — not derived from external APIs.
- **Hybrid live tracking**: Portfolio math uses local DB; live market prices from yfinance provide dynamic Live Profit % and flag stocks at ≥10% profit.
- **Auto-polling pipeline**: Backend `price_service.py` runs an async polling loop every 60 seconds. Frontend `usePolling` hook triggers `api.refreshPrices()` every 60 seconds during NSE market hours (9:15 AM – 3:30 PM IST, weekdays). The `prices-refreshed` event propagates updates across all mounted components.
- **Sell architecture**: Individual lots via `POST /api/holdings/sell`, or all lots of a ticker for a member via `POST /api/holdings/sell-group`. Both move lot(s) from active holdings to realized_pnl table.

## PROJECT STRUCTURE

```
FamilyPortfolio/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app, CORS, startup (seeds members, starts price polling)
│   │   ├── database.py             # SQLite async engine + session
│   │   ├── models.py               # SQLAlchemy: Member, Lot, RealizedPnL, ScanResult, PriceCache
│   │   ├── schemas.py              # Pydantic schemas (incl. SellGroupRequest)
│   │   ├── routers/
│   │   │   ├── dashboard.py        # GET /api/dashboard, /api/profit-trend
│   │   │   ├── holdings.py         # GET/POST holdings, buy, sell, sell-group endpoints
│   │   │   ├── members.py          # GET /api/members
│   │   │   ├── scanner.py          # GET/POST scanner results
│   │   │   └── settings.py         # GET/POST settings, price refresh
│   │   ├── services/
│   │   │   ├── market_data.py      # Data-fetching abstraction layer
│   │   │   └── price_service.py    # yfinance batch price fetcher + 60s auto-polling loop
│   │   └── scanner/
│   │       ├── base_strategy.py    # Abstract strategy interface
│   │       ├── engine.py           # Scanner runner (iterates strategies)
│   │       └── fibonacci_strategy.py # 3-month Fib retracement scoring
│   └── requirements.txt
├── frontend/
│   ├── index.html                  # Google Fonts preconnect (Inter + JetBrains Mono)
│   ├── src/
│   │   ├── App.tsx                 # BrowserRouter, routes, isMarketHours(), auto-polling (60s)
│   │   ├── main.tsx                # React entry point
│   │   ├── index.css               # Full design system (CSS variables, themes, animations)
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx     # Desktop (240px fixed) + mobile overlay (280px slide-in, backdrop blur)
│   │   │   │   └── TopBar.tsx      # Hamburger menu (mobile), refresh button, dark/light toggle
│   │   │   ├── dashboard/
│   │   │   │   ├── DashboardPage.tsx        # 4 metric cards + 2 charts (lg:grid-cols-3 layout)
│   │   │   │   ├── ProfitTrendChart.tsx     # Recharts bar chart with SVG gradient fills + custom tooltip
│   │   │   │   └── MemberAllocationChart.tsx # Recharts donut chart (per-member portfolio allocation)
│   │   │   ├── holdings/
│   │   │   │   ├── HoldingsPage.tsx     # Active/P&L tabs + PnLSummary component
│   │   │   │   ├── MetricCards.tsx      # Invested / Current Value / Unrealized P/L
│   │   │   │   ├── LotGroup.tsx         # Grouped-by-ticker with expand/collapse, "Sell All" parent button, Profit % column
│   │   │   │   ├── BuyForm.tsx          # Modal form with backdrop blur
│   │   │   │   ├── SellForm.tsx         # Inline sell form per lot (rose gradient button)
│   │   │   │   └── SellGroupForm.tsx    # Batch sell form for all lots of a ticker
│   │   │   ├── scanner/
│   │   │   │   └── ScannerPage.tsx      # Fib retracement results table
│   │   │   ├── alerts/
│   │   │   │   └── AlertsPage.tsx       # Placeholder with Telegram coming-soon
│   │   │   └── settings/
│   │   │       └── SettingsPage.tsx      # Market data refresh, data sources, about
│   │   ├── lib/
│   │   │   ├── api.ts              # Fetch wrapper (sellLot + sellGroup endpoints)
│   │   │   └── utils.ts            # formatCurrency, formatPct, formatDate, formatNumber, cn
│   │   └── hooks/
│   │       └── usePolling.ts       # Auto-refresh hook (interval + enabled flag)
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── scripts/
│   └── import_excel.py             # One-time Excel → SQLite importer
├── data/
│   └── portfolio.db                # SQLite database (gitignored)
├── exports/                        # EOD Excel files (planned)
├── .claude/
│   ├── launch.json                 # Dev server config (frontend on port 5173)
│   └── skills/                     # Installed: frontend-design, ui-ux-pro-max
└── Family_Portfolio_Scanner_Brief.md
```

## DATABASE SCHEMA

### members
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| name | TEXT UNIQUE | Pre-seeded: Veerakumar, Sneeha, Mouny, Mani, Devi |

### lots (active holdings)
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| member_id | FK → members | |
| ticker | TEXT | NSE symbol (e.g., "COLPAL") |
| buy_date | DATE | |
| buy_qty | REAL | |
| buy_rate | REAL | |
| buy_value | REAL | Auto: qty × rate |
| lot_label | TEXT | "1", "1A", "1B" — auto-assigned per ticker per member |
| financial_year | TEXT | "2025-26" — auto-derived from buy_date |
| notes | TEXT | Optional (e.g., "IGL 1:1 BONUS") |
| created_at | DATETIME | |

### realized_pnl (sold lots)
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| member_id | FK → members | |
| ticker | TEXT | |
| buy_date | DATE | |
| buy_qty | REAL | |
| buy_rate | REAL | |
| buy_value | REAL | |
| sell_date | DATE | |
| sell_qty | REAL | |
| sell_rate | REAL | |
| sell_value | REAL | Auto: sell_qty × sell_rate |
| profit_loss | REAL | Auto: sell_value − buy_value |
| profit_loss_pct | REAL | Auto: (profit_loss / buy_value) × 100 |
| financial_year | TEXT | FY of the sell_date |
| lot_label | TEXT | |
| notes | TEXT | |
| created_at | DATETIME | |

### scan_results
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| ticker | TEXT | |
| score | REAL | Strategy-computed score |
| strategy_name | TEXT | e.g., "fibonacci_retracement" |
| metrics | JSON | Key-value metrics (fib levels, etc.) |
| scanned_at | DATETIME | |

### price_cache
| Column | Type | Notes |
|---|---|---|
| ticker | TEXT PK | |
| last_price | REAL | |
| change_pct | REAL | |
| updated_at | DATETIME | |

## DESIGN SYSTEM (Implemented)

### Color Palette
| Token | Dark Mode | Light Mode |
|---|---|---|
| --bg-primary | #020617 (deep blue-black) | #FAFAF9 (warm off-white) |
| --bg-card | #0B1120 | #FFFFFF |
| --bg-elevated | #131B2E | #F5F5F4 |
| --bg-secondary | #0F172A | #F1F0EE |
| --color-accent | #10B981 (emerald) | #10B981 |
| --color-profit | #10B981 | #059669 |
| --color-loss | #F43F5E (rose) | #E11D48 |
| --color-amber | #F59E0B | #D97706 |
| --border-color | rgba(255,255,255,0.06) | rgba(0,0,0,0.08) |
| --border-subtle | rgba(255,255,255,0.04) | rgba(0,0,0,0.04) |

### Typography
- **Sans**: Inter (weights 300–700), font-feature-settings: "cv02", "cv03", "cv04", "cv11"
- **Mono**: JetBrains Mono (weights 400–600) — all numeric/price/date columns
- **Labels**: 10–11px uppercase, semibold, tracking 0.06–0.08em
- **Values**: 13px body, 22px metric card values
- **tabular-nums** on all numeric data for column alignment

### Visual Language
- **Gradient buttons**: Primary `linear-gradient(135deg, #10B981, #059669)` with `box-shadow: 0 2px 8px rgba(16,185,129,0.25)`; Sell buttons use rose/crimson: `color: var(--color-loss)`, `border: 1px solid rgba(244, 63, 94, 0.3)`, hover fills with rose gradient
- **Metric cards**: Each has a unique gradient background (emerald for Invested, indigo for Current Value, conditional green/red for P/L, amber for Alerts) with matching border accent at 0.15 opacity
- **Shadows**: Two tiers — `--shadow-card` (subtle) and `--shadow-elevated` (pronounced)
- **Borders**: rgba-based for subtle transparency, never solid colors
- **Animations**: `fadeIn` (0.3s) on page loads, `slideIn` (0.25s) on modals, backdrop blur on overlays
- **Scrollbar**: Custom styled (6px thin, rounded, rgba handles)
- **Hover states**: `bg-black/[0.015]` light / `bg-white/[0.015]` dark
- **Charts**: Recharts with SVG `linearGradient` fills, custom styled tooltips, 800ms ease-out bar animations, maxBarSize 52, radius-8 bars. Donut chart: innerRadius 52, outerRadius 80, 5-color palette (#10B981, #6366F1, #F59E0B, #EC4899, #3B82F6)

### Signature Elements
- **FP Logo**: Emerald gradient rounded-xl with "FP" initials + glow shadow in sidebar
- **Sidebar**: 240px fixed (desktop), 280px slide-in overlay with backdrop blur (mobile), rgba border, active items with accent glow background, member list with left border indicator, "v1.0 · Local · $0/mo" footer
- **Mobile**: Hamburger menu in TopBar (visible below 768px), sidebar overlay with close X, auto-closes on route change
- **Icon containers**: Per-section gradient backgrounds (emerald/indigo/amber/gray) at 0.12 opacity with matching border

## KEY DESIGN DECISIONS

1. **Lot-based tracking**: Each buy is a separate lot, never merged. Sub-lots: 1, 1A, 1B per ticker per member.
2. **Financial year**: Apr 1+ → "{year}-{year+1}", before Apr → "{year-1}-{year}". Sell date determines P&L FY.
3. **Terminology**: "Invested" (not "Total Value") per family convention.
4. **Data interfaces**: `market_data.py` defines abstract methods. yfinance and NseIndiaApi are separate implementations. Swapping to a paid API later = new implementation class, zero business logic changes.
5. **Scanner hot-swap**: Strategies inherit from `BaseStrategy`. Adding a new pattern = one new file + register in engine.
6. **Accent color**: #10B981 (emerald) — professional, distinct from generic blue, works in both dark and light mode.
7. **Local DB as source of truth**: Excel is a one-time seed. All runtime calculations use local SQLite data.
8. **Sell-group architecture**: Single backend endpoint iterates all lots of a ticker/member, creates P&L records, deletes each lot in one transaction.

## EXCEL IMPORT (Completed)

`scripts/import_excel.py` handles importing existing family Excel holdings:
- **Usage**: `python3 scripts/import_excel.py <excel_file> <member_name>`
- **Handles**: Mixed date formats (datetime objects, dd/mm/yyyy, dd/mm/yy, double-slash typos like "06//04/2026")
- **TICKER_NORMALIZE**: Dictionary mapping ~40 Excel ticker name variations to standardized NSE symbols (e.g., "INDUSIND BANK" → "INDUSINDBK")
- **Annotation rows**: Skips rows containing BONUS, SPLIT keywords or NOW: prefix in rate column
- **Equity sheets**: Most recent parsed as active lots
- **P&L sheets**: All parsed as realized_pnl records
- **buy_value**: Computed as `qty × rate` (not read from Excel, which may contain formula strings)
- **Fallback**: Uses buy_date when sell_date is missing
- **Result for Mouny**: 195 active lots + 70 realized P&L records imported

## API ENDPOINTS

| Method | Path | Description |
|---|---|---|
| GET | /api/members | List all family members |
| GET | /api/dashboard | Aggregated metrics across all members |
| GET | /api/profit-trend | Yearly P/L trend data for chart |
| GET | /api/holdings/{member_id} | Member holdings (grouped by ticker) + summary + P&L |
| POST | /api/holdings/buy | Add a buy lot |
| POST | /api/holdings/sell | Sell a single lot (full or partial) |
| POST | /api/holdings/sell-group | Sell all lots of a ticker for a member (batch) |
| DELETE | /api/holdings/lot/{lot_id} | Delete a lot |
| GET | /api/scanner/results | Latest scan results |
| POST | /api/scanner/run | Trigger scanner run |
| POST | /api/settings/refresh-prices | Manual price refresh |
| GET | /api/health | Health check |

## RUNNING THE APP

**Backend** (port 8000):
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend** (port 5173):
```bash
cd frontend
npm install
npm run dev
```

The frontend proxies `/api/*` requests to `http://localhost:8000` via Vite config.

## BUILD STATUS

### Completed
- [x] Backend: FastAPI + SQLAlchemy + SQLite setup
- [x] Database models: Member, Lot, RealizedPnL, ScanResult, PriceCache
- [x] All API routers: dashboard, holdings (buy/sell/sell-group/list), members, scanner, settings
- [x] Scanner engine: Fibonacci retracement strategy on Nifty 200 universe
- [x] Market data service: yfinance wrapper + price caching
- [x] Frontend: React + Vite + TypeScript + Tailwind CSS v4
- [x] All UI pages: Dashboard, Holdings, Scanner, Alerts, Settings
- [x] Full dark/light mode with theme toggle
- [x] Excel importer: Mouny's holdings imported (195 lots + 70 P&L records)
- [x] Premium UI/UX redesign: Complete design system with emerald accent, Inter + JetBrains Mono typography, gradient metric cards, backdrop blur modals, per-bar chart coloring, animated transitions
- [x] Sell group endpoint: Batch-sell all lots of a ticker for a member
- [x] "Sell All" button on LotGroup parent row with SellGroupForm
- [x] Rose/crimson sell button styling across all sell actions
- [x] Mobile hamburger menu with slide-in sidebar overlay + backdrop blur
- [x] Enhanced FY profit bar chart with SVG gradient fills + custom tooltips
- [x] Per-member portfolio allocation donut chart on Dashboard
- [x] P/L summary block on Realized P/L tab (Total Buy Value, Total Realized P/L, Total P/L %)
- [x] Auto-polling: Backend 60s price polling loop, frontend auto-refresh during market hours (9:15–15:30 IST)
- [x] Dedicated Profit % column on LotGroup parent row with ≥10% alert badge

### Remaining
- [ ] EOD Excel export: Generate per-member Excel files matching existing format (`services/export_service.py`)
- [ ] Import other family members' Excel files (currently only Mouny imported)
- [ ] Telegram push alerts: When holdings hit ≥10% profit threshold
- [ ] Scanner badge on held stocks: Show "Near 0.618" badge on lot groups matching scanner results

## CONVENTIONS

- All prices displayed in INR (₹) with Indian number formatting (en-IN locale)
- NSE ticker symbols used without .NS suffix in the database/UI (suffix added only for yfinance API calls)
- Monospace font (JetBrains Mono) for all numeric columns — deliberate "ledger" feel
- `tabular-nums` CSS class on all number displays for alignment
- Frontend event `prices-refreshed` dispatched after price updates to trigger UI refreshes
- Rate limiting: 3 requests/second max to NseIndiaApi, respectful batching for yfinance
- `isMarketHours()` function in App.tsx gates auto-polling to NSE trading hours (IST 9:15 AM – 3:30 PM, weekdays)
