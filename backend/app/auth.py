import os
import time
from collections import defaultdict

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

load_dotenv()

API_TOKEN = os.environ.get("API_TOKEN", "")

_bearer = HTTPBearer(auto_error=False)


async def require_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
):
    if not API_TOKEN:
        return

    if credentials and credentials.credentials == API_TOKEN:
        return

    raise HTTPException(status_code=401, detail="Invalid or missing API token")


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
