# Fyers Token Refresh

Generate a fresh Fyers API access token via OAuth. Tokens expire daily, so this needs to run each trading morning.

## When to use

Use when the user says: "refresh token", "fyers token", "new token", "token expired", "renew fyers", "login fyers", or when a Fyers API call fails with an authentication error.

## Credentials

- **App ID**: `P6K7CBODO7-100`
- **Secret ID**: `IJHTC72QIB`
- **Redirect URI**: `http://127.0.0.1:8901`

These are stored in the token generator script at `scripts/fyers_token.py`.

## Steps

### 1. Check current token status

First, check if the current token is still valid:

```bash
cd /Users/mounyveera/FamilyPortfolio
python3 -c "
import json
from pathlib import Path
config = json.loads(Path('data/config.json').read_text()) if Path('data/config.json').exists() else {}
fyers = config.get('fyers', {})
if fyers.get('access_token'):
    print(f'Current token: {fyers[\"access_token\"][:20]}...')
    print(f'Client ID: {fyers.get(\"client_id\", \"not set\")}')
    # Try a test call
    from fyers_apiv3 import fyersModel
    f = fyersModel.FyersModel(client_id=fyers['client_id'], token=fyers['access_token'], is_async=False, log_path='')
    resp = f.quotes({'symbols': 'NSE:SBIN-EQ'})
    if resp.get('s') == 'ok':
        lp = resp['d'][0]['v']['lp']
        print(f'Token is VALID (SBIN: ₹{lp})')
    else:
        print(f'Token is EXPIRED or INVALID: {resp.get(\"message\", resp)}')
else:
    print('No Fyers token configured')
"
```

### 2. Generate new token

If the token is expired or missing, run the token generator:

```bash
cd /Users/mounyveera/FamilyPortfolio
python3 scripts/fyers_token.py
```

This will:
1. Open the user's browser to the Fyers login page
2. Start a local server on port 8901 to capture the OAuth callback
3. After the user logs in, capture the auth code
4. Exchange it for an access token
5. Save the token to `data/config.json`

**Important**: The user must complete the browser login manually (enter credentials + OTP). Wait for the script to confirm the token was saved.

### 3. Verify the new token

After the script completes, verify the token works:

```bash
curl -s http://localhost:8000/api/settings/data-provider | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Active provider: {d[\"active\"]}')
print(f'Fyers configured: {d[\"fyers_configured\"]}')
"
```

Then trigger a price refresh:

```bash
curl -s -X POST http://localhost:8000/api/settings/refresh-prices | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Updated {d[\"updated\"]} ticker prices via Fyers')
"
```

### 4. Report

Tell the user:
- Token was refreshed successfully
- Number of tickers updated with fresh prices
- Remind them the token expires at end of day and they'll need to refresh again tomorrow

## Troubleshooting

- **Port 8901 in use**: Kill the process using `lsof -ti:8901 | xargs kill` then retry
- **Browser doesn't open**: Copy the auth URL from the terminal output and open manually
- **Token generation fails**: Check that the App ID and Secret match what's in the Fyers dashboard at myapi.fyers.in
- **"Invalid client_id"**: The Fyers app may not be approved yet — check app status at myapi.fyers.in
