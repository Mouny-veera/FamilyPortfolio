#!/usr/bin/env python3
"""
Generate a Fyers access token via OAuth and save it to config.

Usage:
    python3 scripts/fyers_token.py

Opens a browser for Fyers login. After you log in, the token is
automatically captured and saved to data/config.json.
"""

import json
import os
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

APP_ID = os.environ["FYERS_APP_ID"]
SECRET = os.environ["FYERS_SECRET"]
REDIRECT_URI = "http://127.0.0.1:8901"

CONFIG_PATH = Path(__file__).resolve().parent.parent / "data" / "config.json"

captured_code = None


class CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global captured_code
        query = parse_qs(urlparse(self.path).query)
        auth_code = query.get("auth_code", [None])[0]
        s = query.get("s", [None])[0]

        if s == "error" or not auth_code:
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<h2>Login failed or was cancelled.</h2><p>Close this tab and try again.</p>")
            return

        captured_code = auth_code
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(b"<h2>Login successful!</h2><p>You can close this tab. Token is being generated...</p>")

    def log_message(self, format, *args):
        pass


def generate_token():
    global captured_code
    from fyers_apiv3 import fyersModel

    session = fyersModel.SessionModel(
        client_id=APP_ID,
        secret_key=SECRET,
        redirect_uri=REDIRECT_URI,
        response_type="code",
        grant_type="authorization_code",
    )

    auth_url = session.generate_authcode()
    print(f"\n  Opening browser for Fyers login...\n")
    print(f"  If browser doesn't open, visit:\n  {auth_url}\n")
    webbrowser.open(auth_url)

    server = HTTPServer(("127.0.0.1", 8901), CallbackHandler)
    print("  Waiting for login callback...")
    while captured_code is None:
        server.handle_request()
    server.server_close()

    print(f"  Auth code received. Generating access token...")

    session.set_token(captured_code)
    resp = session.generate_token()

    if resp.get("s") != "ok" and resp.get("code") != 200:
        print(f"\n  ERROR: Token generation failed")
        print(f"  Response: {json.dumps(resp, indent=2)}")
        return

    access_token = resp.get("access_token")
    if not access_token:
        print(f"\n  ERROR: No access_token in response")
        print(f"  Response: {json.dumps(resp, indent=2)}")
        return

    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    config = json.loads(CONFIG_PATH.read_text()) if CONFIG_PATH.exists() else {}
    if "fyers" not in config:
        config["fyers"] = {}
    config["fyers"]["client_id"] = APP_ID
    config["fyers"]["access_token"] = access_token
    CONFIG_PATH.write_text(json.dumps(config, indent=2))

    print(f"\n  Access token saved to data/config.json")
    print(f"  Provider is now: Fyers API (real-time)")
    print(f"\n  Note: Token expires daily. Run this script again each trading day.\n")


if __name__ == "__main__":
    print("\n  === Fyers Access Token Generator ===")
    generate_token()
