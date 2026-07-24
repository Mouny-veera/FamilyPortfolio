from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from ..services.price_service import refresh_prices
from ..services.market_data import load_config, save_config, get_active_provider, FyersProvider
from ..services.fyers_auth import generate_fyers_token, exchange_auth_code
from ..services.scan_scheduler import get_auto_scan_status, set_auto_scan_enabled

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
    import os
    config = load_config()
    fyers_cfg = config.get("fyers", {})
    provider = get_active_provider()
    active = "fyers" if isinstance(provider, FyersProvider) else "yfinance"
    auto_login = bool(fyers_cfg.get("totp_secret"))
    app_id = os.environ.get("FYERS_APP_ID", "")
    redirect_uri = os.environ.get("FYERS_REDIRECT_URI", "http://127.0.0.1:8901")
    auth_url = f"https://api-t1.fyers.in/api/v3/generate-authcode?client_id={app_id}&redirect_uri={redirect_uri}&response_type=code&state=none" if app_id else ""
    needs_browser_login = bool(fyers_cfg.get("fy_id")) and not fyers_cfg.get("access_token")
    return {
        "active": active,
        "fyers_configured": bool(fyers_cfg.get("client_id")),
        "fyers_client_id": fyers_cfg.get("client_id", ""),
        "fyers_fy_id": fyers_cfg.get("fy_id", ""),
        "auto_login": auto_login,
        "ticker_search_source": "Fyers Symbols Master",
        "scanner_universe": "Nifty 200 via Fyers API",
        "auth_url": auth_url,
        "needs_browser_login": needs_browser_login,
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
        return {
            "status": "ok",
            "message": "Credentials saved. Click 'Login to Fyers' to complete the connection.",
            "needs_browser_login": True,
        }


@router.get("/fyers/status")
async def fyers_token_status():
    config = load_config()
    fyers_cfg = config.get("fyers", {})
    if not fyers_cfg.get("client_id") or not fyers_cfg.get("access_token"):
        return {"connected": False, "token_valid": False, "message": "Fyers not configured"}

    try:
        from fyers_apiv3 import fyersModel
        import asyncio
        fyers = fyersModel.FyersModel(
            client_id=fyers_cfg["client_id"],
            token=fyers_cfg["access_token"],
            is_async=False,
            log_path="",
        )
        resp = await asyncio.to_thread(fyers.get_profile)
        if resp.get("s") == "ok":
            return {
                "connected": True,
                "token_valid": True,
                "fy_id": resp.get("data", {}).get("fy_id", fyers_cfg.get("fy_id", "")),
                "message": "Token is valid",
            }
        else:
            return {
                "connected": True,
                "token_valid": False,
                "message": resp.get("message", "Token expired or invalid"),
            }
    except Exception as e:
        return {
            "connected": True,
            "token_valid": False,
            "message": f"Could not verify: {str(e)}",
        }


@router.post("/fyers/refresh-token")
async def manual_token_refresh():
    result = await generate_fyers_token()
    return result


class ManualAuthCode(BaseModel):
    auth_code: str


@router.post("/fyers/manual-token")
async def manual_token_from_auth_code(payload: ManualAuthCode):
    result = await exchange_auth_code(payload.auth_code)
    return result


@router.get("/fyers/callback")
async def fyers_callback(request: Request):
    auth_code = request.query_params.get("auth_code", "")
    if not auth_code:
        return HTMLResponse(
            '<html><body><h2>Login failed</h2><p>No auth code received.</p>'
            '<a href="/settings">Back to Settings</a></body></html>',
            status_code=400,
        )
    result = await exchange_auth_code(auth_code)
    if result["status"] == "ok":
        return HTMLResponse(
            '<html><body><script>window.location.href="/settings?fyers=connected";</script></body></html>'
        )
    return HTMLResponse(
        f'<html><body><h2>Token exchange failed</h2><p>{result["message"]}</p>'
        f'<a href="/settings">Back to Settings</a></body></html>',
        status_code=500,
    )


@router.delete("/fyers")
async def remove_fyers():
    config = load_config()
    config.pop("fyers", None)
    save_config(config)
    return {"status": "ok", "message": "Switched back to yfinance"}


@router.get("/auto-scan")
async def get_auto_scan():
    return get_auto_scan_status()


class AutoScanConfig(BaseModel):
    enabled: bool


@router.post("/auto-scan")
async def update_auto_scan(cfg: AutoScanConfig):
    set_auto_scan_enabled(cfg.enabled)
    return get_auto_scan_status()
