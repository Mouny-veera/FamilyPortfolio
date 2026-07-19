import json
import logging
import os
import secrets
import time
from pathlib import Path

import httpx
import jwt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "")
JWT_EXPIRY_SECONDS = 7 * 24 * 3600  # 7 days

if not JWT_SECRET:
    DATA_DIR_INIT = Path(__file__).resolve().parent.parent.parent.parent / "data"
    SECRET_FILE = DATA_DIR_INIT / ".jwt_secret"
    if SECRET_FILE.exists():
        JWT_SECRET = SECRET_FILE.read_text().strip()
    else:
        JWT_SECRET = secrets.token_hex(32)
        SECRET_FILE.parent.mkdir(parents=True, exist_ok=True)
        SECRET_FILE.write_text(JWT_SECRET)
        logger.warning("Generated and persisted JWT_SECRET to %s", SECRET_FILE)

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
CONFIG_PATH = DATA_DIR / "config.json"


def _load_config() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return {}


def _save_config(config: dict):
    CONFIG_PATH.write_text(json.dumps(config, indent=2))


def get_allowed_emails() -> list[str]:
    config = _load_config()
    return [e.lower() for e in config.get("allowed_emails", [])]


class GoogleLoginRequest(BaseModel):
    credential: str


class AuthResponse(BaseModel):
    token: str
    email: str
    name: str
    picture: str | None = None


def create_session_token(email: str, name: str) -> str:
    payload = {
        "email": email,
        "name": name,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRY_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def verify_session_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


@router.post("/google", response_model=AuthResponse)
async def google_login(body: GoogleLoginRequest):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(500, "Google OAuth not configured. Set GOOGLE_CLIENT_ID in .env")

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": body.credential},
                timeout=10,
            )
        if resp.status_code != 200:
            raise HTTPException(401, "Invalid Google token")
        idinfo = resp.json()
        if idinfo.get("aud") != GOOGLE_CLIENT_ID:
            raise HTTPException(401, "Token audience mismatch")
    except httpx.HTTPError:
        raise HTTPException(502, "Failed to verify token with Google")

    email = idinfo.get("email", "").lower()
    name = idinfo.get("name", "")
    picture = idinfo.get("picture")

    if not idinfo.get("email_verified"):
        raise HTTPException(401, "Email not verified by Google")

    allowed = get_allowed_emails()
    if not allowed:
        raise HTTPException(
            403,
            "No authorized emails configured. Add emails to data/config.json.",
        )
    if email not in allowed:
        raise HTTPException(
            403,
            "Access denied. Your email is not in the allowed list. "
            "Contact the app administrator to get access.",
        )

    token = create_session_token(email, name)
    return AuthResponse(token=token, email=email, name=name, picture=picture)


@router.get("/me")
async def get_current_user():
    # This endpoint is protected by the global auth dependency.
    # If we reach here, the user is authenticated.
    return {"status": "ok"}
