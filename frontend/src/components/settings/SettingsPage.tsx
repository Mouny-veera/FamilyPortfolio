import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { RefreshCw, Database, Info, CheckCircle2, AlertTriangle, X, Zap, KeyRound, Shield } from "lucide-react"

interface ProviderInfo {
  active: string
  fyers_configured: boolean
  fyers_client_id: string
  fyers_fy_id: string
  auto_login: boolean
}

export function SettingsPage() {
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<string | null>(null)

  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null)

  const [showFyersForm, setShowFyersForm] = useState(false)
  const [fyerId, setFyerId] = useState("")
  const [fyerPin, setFyerPin] = useState("")
  const [totpSecret, setTotpSecret] = useState("")
  const [fyersSaving, setFyersSaving] = useState(false)
  const [fyersMsg, setFyersMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null)
  const [tokenRefreshing, setTokenRefreshing] = useState(false)

  useEffect(() => {
    api.getDataProvider().then(setProviderInfo).catch(console.error)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    setRefreshResult(null)
    try {
      const result = await api.refreshPrices()
      setRefreshResult(`Updated ${result.updated} ticker prices`)
      window.dispatchEvent(new Event("prices-refreshed"))
    } catch {
      setRefreshResult("Failed to refresh prices")
    } finally {
      setRefreshing(false)
    }
  }

  const handleFyersSetup = async () => {
    if (!fyerId.trim() || !fyerPin.trim() || !totpSecret.trim()) {
      setFyersMsg({ type: "error", text: "All three fields are required" })
      return
    }
    setFyersSaving(true)
    setFyersMsg(null)
    try {
      const result = await api.setupFyersAutoLogin({
        fy_id: fyerId.trim(),
        pin: fyerPin.trim(),
        totp_secret: totpSecret.trim(),
      })
      if (result.status === "ok") {
        setFyersMsg({ type: "ok", text: result.message })
        setShowFyersForm(false)
        setFyerPin("")
        setTotpSecret("")
        api.getDataProvider().then(setProviderInfo)
      } else {
        setFyersMsg({ type: "error", text: result.message })
      }
    } catch (e) {
      setFyersMsg({ type: "error", text: e instanceof Error ? e.message : "Setup failed" })
    } finally {
      setFyersSaving(false)
    }
  }

  const handleTokenRefresh = async () => {
    setTokenRefreshing(true)
    setFyersMsg(null)
    try {
      const result = await api.refreshFyersToken()
      if (result.status === "ok") {
        setFyersMsg({ type: "ok", text: "Token refreshed automatically" })
        api.getDataProvider().then(setProviderInfo)
      } else {
        setFyersMsg({ type: "error", text: result.message })
      }
    } catch (e) {
      setFyersMsg({ type: "error", text: e instanceof Error ? e.message : "Refresh failed" })
    } finally {
      setTokenRefreshing(false)
    }
  }

  const handleFyersRemove = async () => {
    try {
      await api.removeFyers()
      setFyersMsg({ type: "ok", text: "Switched back to yfinance" })
      setFyerId("")
      setFyerPin("")
      setTotpSecret("")
      api.getDataProvider().then(setProviderInfo)
    } catch (e) {
      setFyersMsg({ type: "error", text: e instanceof Error ? e.message : "Failed" })
    }
  }

  const cardStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-color)",
    boxShadow: "var(--shadow-card)",
  }

  const inputClasses = "w-full px-3 py-2 rounded-lg text-[13px] bg-transparent transition-all duration-150 outline-none font-mono"

  return (
    <div className="animate-page-enter">
      <h1 className="text-xl font-semibold tracking-tight mb-6" style={{ color: "var(--text-primary)" }}>
        Settings
      </h1>

      <div className="space-y-4">
        {/* Market Data */}
        <div className="rounded-xl p-5" style={cardStyle}>
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0) 100%)", border: "1px solid rgba(16, 185, 129, 0.15)" }}
            >
              <RefreshCw size={14} strokeWidth={1.5} style={{ color: "#10B981" }} />
            </div>
            <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Market Data
            </h2>
            {providerInfo && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-md ml-auto"
                style={{
                  backgroundColor: providerInfo.active === "fyers" ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
                  color: providerInfo.active === "fyers" ? "var(--color-profit)" : "var(--color-amber)",
                }}
              >
                {providerInfo.active === "fyers" ? "Fyers API (real-time)" : "yfinance (delayed)"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-all duration-150 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)",
              }}
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh Prices"}
            </button>
            {refreshResult && (
              <span
                className="text-[12px] font-medium px-2.5 py-1 rounded-md"
                style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-elevated)" }}
              >
                {refreshResult}
              </span>
            )}
          </div>
        </div>

        {/* Fyers API */}
        <div className="rounded-xl p-5" style={cardStyle}>
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0) 100%)", border: "1px solid rgba(99, 102, 241, 0.15)" }}
            >
              <Zap size={14} strokeWidth={1.5} style={{ color: "#6366F1" }} />
            </div>
            <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Fyers API
            </h2>
          </div>

          <p className="text-[12px] mb-4" style={{ color: "var(--text-muted)" }}>
            Real-time NSE prices with automatic daily token refresh. Configure once — the app handles token renewal on every startup.
          </p>

          {/* Connected state */}
          {providerInfo?.active === "fyers" && !showFyersForm && (
            <div className="space-y-3 mb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
                  style={{ backgroundColor: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.15)" }}
                >
                  <CheckCircle2 size={14} strokeWidth={2} style={{ color: "var(--color-profit)" }} />
                  <span style={{ color: "var(--text-primary)" }}>
                    Connected as <span className="font-mono font-medium">{providerInfo.fyers_fy_id || providerInfo.fyers_client_id}</span>
                  </span>
                </div>
                {providerInfo.auto_login && (
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium"
                    style={{ backgroundColor: "rgba(99, 102, 241, 0.08)", color: "#818CF8" }}
                  >
                    <Shield size={11} />
                    Auto-refresh enabled
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {providerInfo.auto_login && (
                  <button
                    onClick={handleTokenRefresh}
                    disabled={tokenRefreshing}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md font-medium cursor-pointer transition-all duration-200 disabled:opacity-50"
                    style={{
                      color: "var(--color-accent)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    <KeyRound size={12} />
                    {tokenRefreshing ? "Refreshing..." : "Refresh Token Now"}
                  </button>
                )}
                {!providerInfo.auto_login && (
                  <button
                    onClick={() => setShowFyersForm(true)}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md font-medium cursor-pointer transition-all duration-200"
                    style={{
                      color: "#818CF8",
                      border: "1px solid rgba(99, 102, 241, 0.3)",
                    }}
                  >
                    <Shield size={12} />
                    Enable Auto-Refresh
                  </button>
                )}
                <button
                  onClick={handleFyersRemove}
                  className="text-[11px] px-2.5 py-1.5 rounded-md font-medium cursor-pointer transition-all duration-200"
                  style={{
                    color: "var(--color-loss)",
                    border: "1px solid rgba(244, 63, 94, 0.3)",
                  }}
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}

          {/* Not connected — show setup button */}
          {providerInfo?.active !== "fyers" && !showFyersForm && (
            <button
              onClick={() => setShowFyersForm(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-all duration-150 hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
                boxShadow: "0 2px 8px rgba(99, 102, 241, 0.25)",
              }}
            >
              <Zap size={14} />
              Connect Fyers
            </button>
          )}

          {/* Setup form */}
          {showFyersForm && (
            <div
              className="rounded-lg p-4 space-y-3 animate-fade-in"
              style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  Fyers Auto-Login Setup
                </span>
                <button
                  onClick={() => { setShowFyersForm(false); setFyersMsg(null) }}
                  className="p-1 rounded cursor-pointer hover:bg-black/[0.05] dark:hover:bg-white/[0.05]"
                >
                  <X size={14} style={{ color: "var(--text-muted)" }} />
                </button>
              </div>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Enter your Fyers login credentials. The app will generate and refresh tokens automatically — no manual login needed.
              </p>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: "var(--text-muted)" }}>
                  Fyers ID
                </label>
                <input
                  type="text"
                  value={fyerId}
                  onChange={(e) => setFyerId(e.target.value)}
                  placeholder="e.g. FAK18165"
                  className={inputClasses}
                  style={{ border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: "var(--text-muted)" }}>
                  4-digit PIN
                </label>
                <input
                  type="password"
                  value={fyerPin}
                  onChange={(e) => setFyerPin(e.target.value)}
                  placeholder="Your trading PIN"
                  maxLength={4}
                  className={inputClasses}
                  style={{ border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: "var(--text-muted)" }}>
                  TOTP Secret Key
                </label>
                <input
                  type="password"
                  value={totpSecret}
                  onChange={(e) => setTotpSecret(e.target.value)}
                  placeholder="Base32 key from authenticator setup"
                  className={inputClasses}
                  style={{ border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                />
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  The secret key shown when you set up TOTP in your Fyers account (e.g. from the QR code setup page).
                </p>
              </div>
              <div
                className="flex items-start gap-2 px-3 py-2 rounded-lg text-[11px]"
                style={{ backgroundColor: "rgba(99, 102, 241, 0.06)", border: "1px solid rgba(99, 102, 241, 0.12)" }}
              >
                <Shield size={13} className="mt-0.5 shrink-0" style={{ color: "#818CF8" }} />
                <span style={{ color: "var(--text-secondary)" }}>
                  Credentials are stored locally in <span className="font-mono">data/config.json</span> and never leave your machine.
                </span>
              </div>
              <button
                onClick={handleFyersSetup}
                disabled={fyersSaving}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-all duration-150 hover:brightness-110 disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
                  boxShadow: "0 2px 8px rgba(99, 102, 241, 0.25)",
                }}
              >
                {fyersSaving ? "Connecting & generating token..." : "Connect & Auto-Login"}
              </button>
            </div>
          )}

          {fyersMsg && (
            <div
              className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-[12px] font-medium"
              style={{
                backgroundColor: fyersMsg.type === "ok" ? "rgba(16, 185, 129, 0.08)" : "rgba(244, 63, 94, 0.08)",
                color: fyersMsg.type === "ok" ? "var(--color-profit)" : "var(--color-loss)",
              }}
            >
              {fyersMsg.type === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {fyersMsg.text}
            </div>
          )}
        </div>

        {/* Data sources */}
        <div className="rounded-xl p-5" style={cardStyle}>
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0) 100%)", border: "1px solid rgba(99, 102, 241, 0.15)" }}
            >
              <Database size={14} strokeWidth={1.5} style={{ color: "#6366F1" }} />
            </div>
            <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Data sources
            </h2>
          </div>
          <div className="space-y-2">
            {[
              { label: "Live prices", value: providerInfo?.active === "fyers" ? "Fyers API (real-time)" : "yfinance (15-20 min delay)" },
              { label: "Historical OHLC", value: providerInfo?.active === "fyers" ? "Fyers API" : "yfinance (.NS suffix)" },
              { label: "Ticker search", value: "Fyers Symbols Master (public.fyers.in)" },
              { label: "Scanner universe", value: "Nifty 200 via Fyers API" },
            ].map((item) => (
              <div key={item.label} className="flex items-baseline gap-2 text-[12px]">
                <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{item.label}:</span>
                <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* About */}
        <div className="rounded-xl p-5" style={cardStyle}>
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(148, 163, 184, 0.12) 0%, rgba(148, 163, 184, 0) 100%)", border: "1px solid rgba(148, 163, 184, 0.15)" }}
            >
              <Info size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
            </div>
            <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              About
            </h2>
          </div>
          <div className="space-y-1.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
            <p className="font-medium">Family Portfolio Scanner & Tracker v1.0</p>
            <p>Local-first · $0/month · SQLite</p>
            <p style={{ color: "var(--text-muted)" }}>Members: Veerakumar, Sneeha, Mouny, Mani, Devi</p>
          </div>
        </div>
      </div>
    </div>
  )
}
