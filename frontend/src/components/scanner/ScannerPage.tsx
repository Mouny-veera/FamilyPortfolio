import { useEffect, useState, useCallback } from "react"
import { Play, Loader2, Search } from "lucide-react"
import { api, type ScanResult } from "@/lib/api"
import { formatNumber } from "@/lib/utils"
import { PageError } from "@/components/ui/PageError"

type StrategyKey = "fibonacci_retracement" | "pivot_point" | "macd" | "rsi"

const STRATEGY_TABS: { key: StrategyKey; label: string }[] = [
  { key: "fibonacci_retracement", label: "Fibonacci" },
  { key: "pivot_point", label: "Pivot Point" },
  { key: "macd", label: "MACD" },
  { key: "rsi", label: "RSI" },
]

export function ScannerPage() {
  const [results, setResults] = useState<ScanResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [activeTab, setActiveTab] = useState<StrategyKey>("fibonacci_retracement")

  const fetchResults = useCallback(() => {
    api.getScanResults()
      .then((r) => { setResults(r); setError(null) })
      .catch((e) => { console.error(e); setError(e?.message || "Failed to load scanner results") })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchResults() }, [fetchResults])

  useEffect(() => {
    const handler = () => fetchResults()
    window.addEventListener("prices-refreshed", handler)
    return () => window.removeEventListener("prices-refreshed", handler)
  }, [fetchResults])

  const handleScan = async () => {
    setScanning(true)
    try {
      await api.runScanner()
      const fresh = await api.getScanResults()
      setResults(fresh)
    } catch (e) {
      console.error(e)
    } finally {
      setScanning(false)
    }
  }

  const filtered = results.filter((r) => r.strategy_name === activeTab)

  if (error && !scanning) {
    return <PageError error={error} onRetry={() => { setLoading(true); fetchResults() }} />
  }

  return (
    <div className="animate-page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Scanner
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            Technical analysis on Nifty 200 (6-month data)
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-all duration-150 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: "var(--gradient-accent)",
            boxShadow: "var(--shadow-accent)",
          }}
        >
          {scanning ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} strokeWidth={2} />}
          {scanning ? "Scanning..." : "Run Scanner"}
        </button>
      </div>

      {scanning && (
        <div
          className="text-center py-12 rounded-xl mb-4"
          style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}
        >
          <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: "rgba(16, 185, 129, 0.3)", borderTopColor: "var(--color-profit)" }} />
          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
            Scanning stocks...
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            This may take a few minutes due to rate limits.
          </p>
        </div>
      )}

      {!loading && results.length === 0 && !scanning && (
        <div
          className="text-center py-16 rounded-xl"
          style={{ border: "1px dashed var(--border-color)", backgroundColor: "var(--bg-card)" }}
        >
          <Search size={28} strokeWidth={1.5} className="mx-auto mb-3" style={{ color: "var(--text-muted)", opacity: 0.5 }} />
          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>No scan results yet</p>
          <p className="text-[12px] mt-1 mb-4" style={{ color: "var(--text-muted)" }}>Run the scanner to find top picks.</p>
          <button
            onClick={handleScan}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-all duration-150 hover:brightness-110"
            style={{
              background: "var(--gradient-accent)",
              boxShadow: "var(--shadow-accent)",
            }}
          >
            <Play size={15} strokeWidth={2} />
            Run Scanner
          </button>
        </div>
      )}

      {results.length > 0 && (
        <>
          {/* Strategy Tabs */}
          <div
            className="flex gap-1 p-1 rounded-lg mb-4"
            style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
          >
            {STRATEGY_TABS.map((tab) => {
              const count = results.filter((r) => r.strategy_name === tab.key).length
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] sm:min-h-0 rounded-md text-[12px] font-medium cursor-pointer transition-all duration-200 flex-1 justify-center"
                  style={{
                    backgroundColor: isActive ? "var(--bg-card)" : "transparent",
                    color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                    boxShadow: isActive ? "var(--shadow-card)" : "none",
                    border: isActive ? "1px solid var(--border-color)" : "1px solid transparent",
                  }}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                      style={{
                        backgroundColor: isActive ? "rgba(16, 185, 129, 0.1)" : "var(--bg-secondary)",
                        color: isActive ? "var(--color-profit)" : "var(--text-muted)",
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Results Table */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" }}
          >
            <div
              className="px-5 py-3"
              style={{ backgroundColor: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)" }}
            >
              <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {STRATEGY_TABS.find((t) => t.key === activeTab)?.label} Results
                <span className="font-normal ml-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {filtered.length} results
                </span>
              </h2>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-10" style={{ backgroundColor: "var(--bg-card)" }}>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  No results for this indicator. Run the scanner to generate data.
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                {activeTab === "fibonacci_retracement" && <FibTable results={filtered} />}
                {activeTab === "pivot_point" && <PivotTable results={filtered} />}
                {activeTab === "macd" && <MACDTable results={filtered} />}
                {activeTab === "rsi" && <RSITable results={filtered} />}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function TH({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th
      className={`text-${align} px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap`}
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </th>
  )
}

function TD({ children, mono, align = "left", color }: { children: React.ReactNode; mono?: boolean; align?: "left" | "right" | "center"; color?: string }) {
  return (
    <td
      className={`px-5 py-2.5 ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${mono ? "font-mono tabular-nums" : ""} whitespace-nowrap`}
      style={{ color: color || "var(--text-primary)" }}
    >
      {children}
    </td>
  )
}

function SignalBadge({ signal, variant }: { signal: string; variant: "bullish" | "bearish" | "neutral" | "warning" }) {
  const colors = {
    bullish: { bg: "rgba(16, 185, 129, 0.1)", color: "var(--color-profit)" },
    bearish: { bg: "rgba(244, 63, 94, 0.1)", color: "var(--color-loss)" },
    neutral: { bg: "var(--bg-secondary)", color: "var(--text-muted)" },
    warning: { bg: "rgba(245, 158, 11, 0.1)", color: "var(--color-warning)" },
  }
  const c = colors[variant]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      {signal}
    </span>
  )
}

function FibTable({ results }: { results: ScanResult[] }) {
  return (
    <table className="w-full text-[13px] min-w-[780px]">
      <thead>
        <tr style={{ backgroundColor: "var(--bg-card)" }}>
          <TH>#</TH>
          <TH>Ticker</TH>
          <TH align="right">Score</TH>
          <TH align="right">Current</TH>
          <TH align="right">6M High</TH>
          <TH align="right">6M Low</TH>
          <TH align="right">Fib 0.618</TH>
          <TH align="center">Signal</TH>
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const m = (r.metrics || {}) as Record<string, unknown>
          return (
            <tr
              key={r.id}
              className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}
            >
              <TD mono color="var(--text-muted)">{i + 1}</TD>
              <td className="px-5 py-2.5 font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{r.ticker}</td>
              <TD mono align="right" color="var(--color-profit)">{r.score.toFixed(1)}</TD>
              <TD mono align="right">₹{formatNumber(m.current as number)}</TD>
              <TD mono align="right">₹{formatNumber(m.high_6m as number)}</TD>
              <TD mono align="right">₹{formatNumber(m.low_6m as number)}</TD>
              <TD mono align="right">₹{formatNumber(m.fib_618 as number)}</TD>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                {m.near_618 ? (
                  <SignalBadge signal="Near 0.618" variant="warning" />
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>—</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function PivotTable({ results }: { results: ScanResult[] }) {
  return (
    <table className="w-full text-[13px] min-w-[850px]">
      <thead>
        <tr style={{ backgroundColor: "var(--bg-card)" }}>
          <TH>#</TH>
          <TH>Ticker</TH>
          <TH align="right">Score</TH>
          <TH align="right">Current</TH>
          <TH align="right">Pivot</TH>
          <TH align="right">S1</TH>
          <TH align="right">S2</TH>
          <TH align="right">R1</TH>
          <TH align="right">R2</TH>
          <TH align="center">Signal</TH>
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const m = (r.metrics || {}) as Record<string, unknown>
          const signal = m.signal as string
          const variant = signal === "near_s2" || signal === "near_s1" || signal === "below_pivot"
            ? "bullish"
            : signal === "near_r1" || signal === "above_pivot"
              ? "neutral"
              : "neutral"
          const label = {
            near_s2: "Near S2",
            near_s1: "Near S1",
            at_pivot: "At Pivot",
            below_pivot: "Below Pivot",
            above_pivot: "Above Pivot",
            near_r1: "Near R1",
            neutral: "Neutral",
          }[signal] || signal
          return (
            <tr
              key={r.id}
              className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}
            >
              <TD mono color="var(--text-muted)">{i + 1}</TD>
              <td className="px-5 py-2.5 font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{r.ticker}</td>
              <TD mono align="right" color="var(--color-profit)">{r.score.toFixed(1)}</TD>
              <TD mono align="right">₹{formatNumber(m.current as number)}</TD>
              <TD mono align="right">₹{formatNumber(m.pivot as number)}</TD>
              <TD mono align="right">₹{formatNumber(m.s1 as number)}</TD>
              <TD mono align="right">₹{formatNumber(m.s2 as number)}</TD>
              <TD mono align="right">₹{formatNumber(m.r1 as number)}</TD>
              <TD mono align="right">₹{formatNumber(m.r2 as number)}</TD>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                <SignalBadge signal={label} variant={variant} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function MACDTable({ results }: { results: ScanResult[] }) {
  return (
    <table className="w-full text-[13px] min-w-[780px]">
      <thead>
        <tr style={{ backgroundColor: "var(--bg-card)" }}>
          <TH>#</TH>
          <TH>Ticker</TH>
          <TH align="right">Score</TH>
          <TH align="right">Current</TH>
          <TH align="right">MACD</TH>
          <TH align="right">Signal</TH>
          <TH align="right">Histogram</TH>
          <TH align="center">Trend</TH>
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const m = (r.metrics || {}) as Record<string, unknown>
          const signal = m.signal as string
          const variant = signal === "bullish_cross" || signal === "bullish_momentum"
            ? "bullish"
            : signal === "bearish_cross" || signal === "bearish_momentum"
              ? "bearish"
              : signal === "bullish_weakening"
                ? "warning"
                : "neutral"
          const label = {
            bullish_cross: "Bullish Cross",
            bearish_cross: "Bearish Cross",
            bullish_momentum: "Bullish",
            bullish_weakening: "Weakening",
            bearish_momentum: "Bearish",
            bearish_weakening: "Recovering",
            neutral: "Neutral",
          }[signal] || signal
          const histVal = m.histogram as number
          const histColor = histVal > 0 ? "var(--color-profit)" : histVal < 0 ? "var(--color-loss)" : "var(--text-muted)"
          return (
            <tr
              key={r.id}
              className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}
            >
              <TD mono color="var(--text-muted)">{i + 1}</TD>
              <td className="px-5 py-2.5 font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{r.ticker}</td>
              <TD mono align="right" color="var(--color-profit)">{r.score.toFixed(1)}</TD>
              <TD mono align="right">₹{formatNumber(m.current as number)}</TD>
              <TD mono align="right">{(m.macd as number).toFixed(2)}</TD>
              <TD mono align="right">{(m.signal_line as number).toFixed(2)}</TD>
              <td className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: histColor }}>
                {histVal > 0 ? "+" : ""}{histVal.toFixed(2)}
              </td>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                <SignalBadge signal={label} variant={variant} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function RSITable({ results }: { results: ScanResult[] }) {
  return (
    <table className="w-full text-[13px] min-w-[680px]">
      <thead>
        <tr style={{ backgroundColor: "var(--bg-card)" }}>
          <TH>#</TH>
          <TH>Ticker</TH>
          <TH align="right">Score</TH>
          <TH align="right">Current</TH>
          <TH align="right">RSI</TH>
          <TH align="center">Trend</TH>
          <TH align="center">Signal</TH>
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const m = (r.metrics || {}) as Record<string, unknown>
          const signal = m.signal as string
          const rsiVal = m.rsi as number
          const rsiColor = rsiVal <= 30 ? "var(--color-profit)" : rsiVal >= 70 ? "var(--color-loss)" : "var(--text-primary)"
          const variant = signal === "oversold" || signal === "recovering"
            ? "bullish"
            : signal === "overbought"
              ? "bearish"
              : signal === "weak"
                ? "warning"
                : "neutral"
          const label = {
            oversold: "Oversold",
            recovering: "Recovering",
            weak: "Weak",
            neutral: "Neutral",
            strong: "Strong",
            overbought: "Overbought",
          }[signal] || signal
          return (
            <tr
              key={r.id}
              className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}
            >
              <TD mono color="var(--text-muted)">{i + 1}</TD>
              <td className="px-5 py-2.5 font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{r.ticker}</td>
              <TD mono align="right" color="var(--color-profit)">{r.score.toFixed(1)}</TD>
              <TD mono align="right">₹{formatNumber(m.current as number)}</TD>
              <td className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: rsiColor }}>
                {rsiVal.toFixed(1)}
              </td>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                {m.rsi_rising ? (
                  <span className="text-[11px] font-medium" style={{ color: "var(--color-profit)" }}>▲</span>
                ) : (
                  <span className="text-[11px] font-medium" style={{ color: "var(--color-loss)" }}>▼</span>
                )}
              </td>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                <SignalBadge signal={label} variant={variant} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
