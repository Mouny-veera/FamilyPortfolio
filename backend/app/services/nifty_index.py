import asyncio
import csv
import io
import json
import ssl
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
NIFTY200_FILE = DATA_DIR / "nifty200.json"

NSE_URLS = [
    "https://www.niftyindices.com/IndexConstituent/ind_nifty200list.csv",
    "https://archives.nseindia.com/content/indices/ind_nifty200list.csv",
]

_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE


def _fetch_from_nse() -> list[str]:
    for url in NSE_URLS:
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/csv,text/plain,*/*",
                "Referer": "https://www.niftyindices.com/",
            })
            resp = urllib.request.urlopen(req, timeout=15, context=_ssl_ctx)
            data = resp.read().decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(data))
            symbol_col = next((c for c in (reader.fieldnames or []) if "symbol" in c.lower()), None)
            if not symbol_col:
                continue
            symbols = [row[symbol_col].strip() for row in reader if row[symbol_col].strip()]
            if len(symbols) >= 150:
                return symbols
        except Exception as e:
            print(f"[Nifty200] Fetch failed from {url}: {e}")
    return []


def _save_list(symbols: list[str]):
    NIFTY200_FILE.write_text(json.dumps({
        "constituents": symbols,
        "count": len(symbols),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": "niftyindices.com",
    }, indent=2))


def load_nifty200() -> list[str]:
    if NIFTY200_FILE.exists():
        data = json.loads(NIFTY200_FILE.read_text())
        return data.get("constituents", [])
    return []


async def refresh_nifty200() -> dict:
    symbols = await asyncio.to_thread(_fetch_from_nse)
    if not symbols:
        cached = load_nifty200()
        if cached:
            print(f"[Nifty200] Live fetch failed, using cached list ({len(cached)} stocks)")
            return {"status": "cached", "count": len(cached)}
        return {"status": "error", "count": 0, "message": "No data available"}

    _save_list(symbols)
    print(f"[Nifty200] Updated to {len(symbols)} stocks from NSE")
    return {"status": "ok", "count": len(symbols)}
