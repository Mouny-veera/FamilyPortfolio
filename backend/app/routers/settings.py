from fastapi import APIRouter
from pydantic import BaseModel
from ..services.price_service import refresh_prices
from ..services.market_data import load_config, save_config, get_active_provider, FyersProvider
from ..services.fyers_auth import generate_fyers_token

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.post("/refresh-prices")
async def manual_refresh():
    result = await refresh_prices()
    return result


class FyersLoginConfig(BaseModel):
    fy_id: str
    pin: str
    totp_secret: str


@router.get("/data-provider")
async def get_data_provider():
    config = load_config()
    fyers_cfg = config.get("fyers", {})
    provider = get_active_provider()
    active = "fyers" if isinstance(provider, FyersProvider) else "yfinance"
    auto_login = bool(fyers_cfg.get("totp_secret"))
    return {
        "active": active,
        "fyers_configured": bool(fyers_cfg.get("client_id")),
        "fyers_client_id": fyers_cfg.get("client_id", ""),
        "fyers_fy_id": fyers_cfg.get("fy_id", ""),
        "auto_login": auto_login,
        "ticker_search_source": "Fyers Symbols Master",
        "scanner_universe": "Nifty 200 via Fyers API",
    }


@router.post("/fyers/setup")
async def setup_fyers_auto_login(cfg: FyersLoginConfig):
    config = load_config()
    if "fyers" not in config:
        config["fyers"] = {}
    config["fyers"]["fy_id"] = cfg.fy_id.strip().upper()
    config["fyers"]["pin"] = cfg.pin.strip()
    config["fyers"]["totp_secret"] = cfg.totp_secret.strip().replace(" ", "")
    save_config(config)

    result = await generate_fyers_token()
    if result["status"] == "ok":
        return {
            "status": "ok",
            "message": "Auto-login configured and token generated! Token will refresh automatically on each app startup.",
        }
    else:
        config = load_config()
        fyers = config.get("fyers", {})
        fyers.pop("totp_secret", None)
        fyers.pop("pin", None)
        fyers.pop("fy_id", None)
        config["fyers"] = fyers
        save_config(config)
        return {
            "status": "error",
            "message": f"Credentials failed: {result['message']}. Nothing was saved.",
        }


@router.post("/fyers/refresh-token")
async def manual_token_refresh():
    result = await generate_fyers_token()
    return result


@router.delete("/fyers")
async def remove_fyers():
    config = load_config()
    config.pop("fyers", None)
    save_config(config)
    return {"status": "ok", "message": "Switched back to yfinance"}
