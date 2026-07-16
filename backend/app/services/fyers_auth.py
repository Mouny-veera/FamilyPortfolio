"""
Automated Fyers token generation using headless login.

Requires: fy_id, pin, totp_secret stored in data/config.json.
Generates a fresh access token without any browser interaction.
"""

import asyncio
import os
import pyotp
import httpx
from urllib.parse import urlparse, parse_qs

from dotenv import load_dotenv

from .market_data import load_config, save_config

load_dotenv()

FYERS_APP_ID = os.environ["FYERS_APP_ID"]
FYERS_SECRET = os.environ["FYERS_SECRET"]
REDIRECT_URI = os.environ.get("FYERS_REDIRECT_URI", "https://trade.fyers.in/api-signup/redirect-uri/login")

LOGIN_OTP_URL = "https://api-t2.fyers.in/vagator/v2/send_login_otp_v2"
VERIFY_OTP_URL = "https://api-t2.fyers.in/vagator/v2/verify_otp"
VERIFY_PIN_URL = "https://api-t2.fyers.in/vagator/v2/verify_pin_v2"
AUTH_URL = "https://api-t1.fyers.in/api/v3/generate-authcode"


async def generate_fyers_token() -> dict:
    config = load_config()
    fyers_cfg = config.get("fyers", {})

    fy_id = fyers_cfg.get("fy_id")
    pin = fyers_cfg.get("pin")
    totp_secret = fyers_cfg.get("totp_secret")

    if not all([fy_id, pin, totp_secret]):
        return {"status": "error", "message": "Missing Fyers login credentials (fy_id, pin, totp_secret)"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # Step 1: Send login OTP request
            resp = await client.post(LOGIN_OTP_URL, json={
                "fy_id": fy_id,
                "app_id": "2",
            })
            data = resp.json()
            if data.get("code") != 200:
                return {"status": "error", "message": f"Login OTP failed: {data}"}
            request_key = data["request_key"]

            # Step 2: Verify with TOTP
            totp = pyotp.TOTP(totp_secret)
            otp = totp.now()
            resp = await client.post(VERIFY_OTP_URL, json={
                "request_key": request_key,
                "otp": otp,
            })
            data = resp.json()
            if data.get("code") != 200:
                return {"status": "error", "message": f"TOTP verification failed: {data}"}
            request_key = data["request_key"]

            # Step 3: Verify PIN
            resp = await client.post(VERIFY_PIN_URL, json={
                "request_key": request_key,
                "identity": fy_id,
                "identifier": "pin",
                "pin": pin,
            })
            data = resp.json()
            if data.get("code") != 200:
                return {"status": "error", "message": f"PIN verification failed: {data}"}
            access_token_interim = data["data"]["access_token"]

            # Step 4: Get auth code
            resp = await client.post(AUTH_URL, json={
                "fyers_id": fy_id,
                "app_id": FYERS_APP_ID,
                "redirect_uri": REDIRECT_URI,
                "appType": "100",
                "code_challenge": "",
                "state": "none",
                "scope": "",
                "nonce": "",
                "response_type": "code",
                "create_cookie": True,
            }, headers={"Authorization": f"Bearer {access_token_interim}"})
            data = resp.json()
            if data.get("code") != 200:
                return {"status": "error", "message": f"Auth code generation failed: {data}"}
            auth_code_url = data["Url"]
            auth_code = parse_qs(urlparse(auth_code_url).query).get("auth_code", [None])[0]
            if not auth_code:
                return {"status": "error", "message": "Could not extract auth_code from response"}

            # Step 5: Exchange auth code for access token
            from fyers_apiv3 import fyersModel
            session = fyersModel.SessionModel(
                client_id=FYERS_APP_ID,
                secret_key=FYERS_SECRET,
                redirect_uri=REDIRECT_URI,
                response_type="code",
                grant_type="authorization_code",
            )
            session.set_token(auth_code)
            token_resp = await asyncio.to_thread(session.generate_token)
            final_token = token_resp.get("access_token")
            if not final_token:
                return {"status": "error", "message": f"Token exchange failed: {token_resp}"}

            # Re-read config to avoid overwriting concurrent changes
            config = load_config()
            if "fyers" not in config:
                config["fyers"] = {}
            config["fyers"]["client_id"] = FYERS_APP_ID
            config["fyers"]["access_token"] = final_token
            save_config(config)

            return {"status": "ok", "message": "Token refreshed automatically"}

    except Exception as e:
        return {"status": "error", "message": f"Auto-refresh failed: {str(e)}"}


async def is_token_valid() -> bool:
    config = load_config()
    fyers_cfg = config.get("fyers", {})
    client_id = fyers_cfg.get("client_id")
    access_token = fyers_cfg.get("access_token")
    if not client_id or not access_token:
        return False
    try:
        from .market_data import FyersProvider
        provider = FyersProvider(client_id=client_id, access_token=access_token)
        result = await provider.get_live_price("SBIN")
        return result is not None
    except Exception:
        return False


async def ensure_valid_token():
    if await is_token_valid():
        print("Fyers token is valid")
        return True

    config = load_config()
    if not config.get("fyers", {}).get("totp_secret"):
        print("Fyers auto-login not configured (no totp_secret)")
        return False

    print("Fyers token expired, auto-refreshing...")
    result = await generate_fyers_token()
    if result["status"] == "ok":
        print(f"Fyers token refreshed: {result['message']}")
        return True
    else:
        print(f"Fyers token refresh failed: {result['message']}")
        return False
