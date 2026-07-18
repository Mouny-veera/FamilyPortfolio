"""
Lightweight HTTP server on the Fyers redirect port (8901).

Catches the OAuth redirect from Fyers after browser login,
extracts the auth_code, exchanges it for an access token,
and shows a result page. Runs alongside the main FastAPI app.
"""

import asyncio
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from .fyers_auth import exchange_auth_code

_server = None


def _result_page(success: bool, message: str) -> str:
    color = "#10B981" if success else "#F43F5E"
    icon = "&#10003;" if success else "&#10007;"
    title = "Fyers Connected" if success else "Connection Failed"
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<style>
body {{ font-family: Inter, system-ui, sans-serif; background: #020617; color: #e2e8f0;
  display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }}
.card {{ text-align: center; max-width: 400px; padding: 48px 32px; }}
.icon {{ width: 64px; height: 64px; border-radius: 16px; display: inline-flex; align-items: center;
  justify-content: center; font-size: 28px; margin-bottom: 20px;
  background: {color}18; border: 1px solid {color}30; color: {color}; }}
h1 {{ font-size: 20px; font-weight: 600; margin: 0 0 8px; }}
p {{ font-size: 14px; color: #94a3b8; margin: 0 0 24px; line-height: 1.6; }}
.hint {{ font-size: 13px; color: #64748b; }}
</style></head><body>
<div class="card">
  <div class="icon">{icon}</div>
  <h1>{title}</h1>
  <p>{message}</p>
  <p class="hint">You can close this tab and go back to the app.</p>
</div>
</body></html>"""


class _CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        auth_code = params.get("auth_code", [None])[0]
        s = params.get("s", [""])[0]

        if s == "error" or not auth_code:
            msg = params.get("message", ["Login was cancelled or failed"])[0]
            self._respond(200, _result_page(False, msg))
            return

        loop = asyncio.new_event_loop()
        try:
            result = loop.run_until_complete(exchange_auth_code(auth_code))
        finally:
            loop.close()

        if result["status"] == "ok":
            self._respond(200, _result_page(True, "Token refreshed successfully!"))
        else:
            self._respond(200, _result_page(False, result["message"]))

    def _respond(self, code: int, html: str):
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        print(f"[Fyers callback] {args[0]}")


async def start_callback_server(port: int = 8901):
    """Start the callback listener in a background thread."""
    import threading
    from http.server import HTTPServer

    global _server
    try:
        _server = HTTPServer(("127.0.0.1", port), _CallbackHandler)
        thread = threading.Thread(target=_server.serve_forever, daemon=True)
        thread.start()
        print(f"Fyers callback listener started on port {port}")
    except OSError as e:
        print(f"Could not start Fyers callback listener on port {port}: {e}")


async def stop_callback_server():
    global _server
    if _server:
        _server.shutdown()
        _server = None
        print("Fyers callback listener stopped")
