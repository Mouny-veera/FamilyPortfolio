# Family Portfolio Scanner & Tracker

## Quick Start

```bash
# Backend (port 8000)
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend (port 5173)
cd frontend && npm run dev
```

Frontend proxies `/api/*` to `http://localhost:8000` via Vite config.

## Tech Stack

- **Backend**: Python 3.12+ / FastAPI / SQLAlchemy (async) / aiosqlite / SQLite
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS v4 + Recharts + lucide-react
- **Fonts**: Inter (sans) + JetBrains Mono (mono) via Google Fonts
- **Market Data**: Fyers API (primary, real-time) with yfinance per-ticker fallback for symbols Fyers can't resolve. Provider pattern in `services/market_data.py`.
- **Fyers Auth**: Headless login via TOTP + PIN in `services/fyers_auth.py`. Uses base64-encoded credentials, `validate-authcode` endpoint with appIdHash. Env vars: `FYERS_APP_ID`, `FYERS_SECRET`, `FYERS_REDIRECT_URI` in `.env`. Credentials in `data/config.json`.
- **Ticker Search**: Fyers public symbols master (`NSE_CM.csv`), parsed on startup into in-memory cache. Includes all tradeable series (EQ, BE, ST, etc.), not just EQ.
- **Scanner Universe**: Nifty 200 from `data/nifty200.json` (editable JSON file).
- **Database**: `data/portfolio.db` (SQLite). Config in `data/config.json`.

## Architecture Principles

- **One-time Excel seeding**: Excel sheets are strictly for initial DB migration. Once seeded, the app operates independently of Excel files.
- **Local DB as source of truth**: All invested values, P&L calculations, and holdings data are read from the local SQLite database.
- **Hybrid live tracking**: Portfolio math relies on local DB, but live market data is fetched for holdings to calculate dynamic Live Profit % and flag stocks at ≥10% profit.
- **Provider pattern**: `MarketDataProvider` ABC with `FyersProvider` and `YFinanceProvider`. `get_active_provider()` reads `data/config.json` and returns Fyers if configured, else yfinance. `FyersProvider` falls back to yfinance per-ticker for symbols not in the Fyers master (delisted, etc.).
- **Auto-polling**: Backend polls active provider every 60 seconds. Frontend auto-refreshes during NSE market hours (9:15 AM – 3:30 PM IST, weekdays).
- **Fyers auto-login**: On startup, `ensure_valid_token()` tests the Fyers API directly (no yfinance fallback) and refreshes via headless login (TOTP + PIN) if expired. Credentials stored in `data/config.json`. Note: `generate-authcode` POST is currently Cloudflare-blocked, so headless auto-refresh may fail — manual browser auth is the workaround.

## Domain Rules (MUST follow)

- **Lot-based tracking**: Each buy is a separate lot, NEVER merged. Sub-lots: 1, 1A, 1B per ticker per member.
- **Financial year**: Apr 1+ = "{year}-{year+1}", before Apr = "{year-1}-{year}". Sell date determines P&L FY.
- **Terminology**: Use "Invested" (NOT "Total Value") — this is a family convention.
- **Dynamic members**: Members are managed via Settings > Family Members (add/edit/rename/delete). Initial seed: Veerakumar, Sneeha, Mouny, Manikandan, Devi. Users can add members for multiple demat accounts (e.g. "Mouny Axis", "Mouny HDFC").
- **NSE tickers**: Store WITHOUT suffix in DB/UI. Add `.NS` for yfinance calls. For Fyers, use `get_fyers_symbol()` from `nse_master.py` to look up the correct series (e.g. `NSE:RELIANCE-EQ`, `NSE:FCSSOFT-BE`). Do NOT hardcode `-EQ` — symbols exist in multiple series (EQ, BE, ST, etc.).
- **Selling**: Individual lots via `POST /api/holdings/sell`, or all lots of a ticker via `POST /api/holdings/sell-group`. Moves lot(s) from active holdings to realized_pnl table. Partial sells split the lot.
- **Currency**: All prices in INR (₹) with Indian number formatting (en-IN locale).
- **Alert threshold**: 10% unrealized P&L triggers visual indicators (badges, green-tinted rows, pulse animation).

## Design System

- **Accent**: #10B981 (emerald). Gradient buttons: `linear-gradient(135deg, #10B981, #059669)`
- **Sell/destructive buttons**: Rose/crimson — `color: var(--color-loss)`, `border: 1px solid rgba(244, 63, 94, 0.3)`
- **Dark bg**: #020617 → #0B1120 → #131B2E (three-tier depth)
- **Light bg**: #FAFAF9 → #F1F0EE → #F5F5F4
- **Profit**: #10B981 (dark) / #059669 (light). **Loss**: #F43F5E / #E11D48
- **Borders**: rgba-based (never solid colors). Shadows: --shadow-card, --shadow-elevated
- **Typography**: Inter with cv02/cv03/cv04/cv11 features. JetBrains Mono for all numbers (`font-mono tabular-nums`).
- **Labels**: 10-11px uppercase semibold with 0.06-0.08em tracking
- **CSS variables** defined in `index.css` — use `var(--token)` in inline styles, not raw colors
- **Charts**: Recharts with gradient fills, custom tooltips, 800ms ease-out animations
- **Animations**: `animate-fade-in` on pages, `animate-slide-in` on modals, backdrop blur on overlays
- **Mobile/Tablet**: sidebar hidden below `lg:` (1024px), hamburger in TopBar, slide-in overlay with backdrop blur
- **Frontend event**: `prices-refreshed` dispatched after price updates to trigger UI refreshes

## Remaining Work

- EOD Excel export (per-member files matching existing format)
- Import other family members' Excel files (Veerakumar, Sneeha, Mani, Devi)
- Telegram push alerts (≥10% profit threshold)
- Scanner badge on held stocks matching scanner results
