import hmac
import os
import time
from collections import defaultdict

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

load_dotenv()

API_TOKEN = os.environ.get("API_TOKEN", "")
GOOGLE_AUTH_ENABLED = bool(os.environ.get("GOOGLE_CLIENT_ID", ""))

if not API_TOKEN and not GOOGLE_AUTH_ENABLED:
    import warnings
    warnings.warn(
        "Neither API_TOKEN nor GOOGLE_CLIENT_ID is set — all endpoints are unauthenticated! "
        "Set at least one in your .env file for production use.",
        stacklevel=1,
    )

_bearer = HTTPBearer(auto_error=False)

PUBLIC_PATHS = {"/api/health", "/api/auth/google", "/api/settings/fyers/callback"}


async def require_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
):
    if request.url.path in PUBLIC_PATHS:
        return

    if not API_TOKEN and not GOOGLE_AUTH_ENABLED:
        return

    if credentials:
        # Try API_TOKEN first
        if API_TOKEN and hmac.compare_digest(credentials.credentials, API_TOKEN):
            return

        # Try JWT session token
        if GOOGLE_AUTH_ENABLED:
            from .routers.google_auth import verify_session_token
            payload = verify_session_token(credentials.credentials)
            if payload:
                return

    raise HTTPException(status_code=401, detail="Invalid or missing authentication")


class RateLimiter:
    def __init__(self, max_calls: int, window_seconds: int):
        self._max = max_calls
        self._window = window_seconds
        self._calls: defaultdict[str, list[float]] = defaultdict(list)

    def check(self, key: str = "global"):
        now = time.monotonic()
        calls = self._calls[key]
        self._calls[key] = [t for t in calls if now - t < self._window]
        if len(self._calls[key]) >= self._max:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Try again in {self._window} seconds.",
            )
        self._calls[key].append(now)


scanner_limiter = RateLimiter(max_calls=1, window_seconds=300)
