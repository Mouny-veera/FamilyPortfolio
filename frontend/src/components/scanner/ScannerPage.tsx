import { useEffect, useState, useCallback } from "react"
import { Play, Loader2, Search } from "lucide-react"
import { api, type ScanResult } from "@/lib/api"
import { formatNumber } from "@/lib/utils"
import { PageError } from "@/components/ui/PageError"

export function ScannerPage() {
  const [results, setResults] = useState<ScanResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  const fetchResults = useCallback(() => {
    api.getScanResults()
      .then((r) => { setResults(r); setError(null) })
      .catch((e) => { console.error(e); setError(e?.message || "Failed to load scanner results") })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

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
            Fibonacci retracement analysis (6-month) on Nifty 200
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
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" }}
        >
          <div
            className="px-5 py-3"
            style={{ backgroundColor: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)" }}
          >
            <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Top Picks
              <span className="font-normal ml-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                {results.length} results
              </span>
            </h2>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-[13px] min-w-[780px]">
              <thead>
                <tr style={{ backgroundColor: "var(--bg-card)" }}>
                  <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>#</th>
                  <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Ticker</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Score</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Current</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>6M High</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>6M Low</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Fib 0.618</th>
                  <th className="text-center px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Signal</th>
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
                      <td className="px-5 py-2.5 font-mono text-[11px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                      <td className="px-5 py-2.5 font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{r.ticker}</td>
                      <td className="px-5 py-2.5 text-right font-mono font-semibold tabular-nums whitespace-nowrap" style={{ color: "var(--color-profit)" }}>
                        {r.score.toFixed(1)}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                        ₹{formatNumber(m.current as number)}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                        ₹{formatNumber(m.high_6m as number)}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                        ₹{formatNumber(m.low_6m as number)}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                        ₹{formatNumber(m.fib_618 as number)}
                      </td>
                      <td className="px-5 py-2.5 text-center whitespace-nowrap">
                        {m.near_618 ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold"
                            style={{ backgroundColor: "rgba(245, 158, 11, 0.1)", color: "var(--color-warning)" }}
                          >
                            Near 0.618
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
