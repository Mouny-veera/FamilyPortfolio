import { useEffect, useState, useCallback } from "react"
import { api, type Dashboard } from "@/lib/api"
import { formatCurrency, formatPct } from "@/lib/utils"
import { useNavigate } from "react-router-dom"
import { TrendingUp, Wallet, BarChart3, AlertTriangle, ChevronRight, Settings, RefreshCw, WifiOff } from "lucide-react"

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    try {
      const dash = await api.getDashboard()
      setData(dash)
      setError(null)
    } catch (e: any) {
      console.error(e)
      setError(e?.message || "Failed to load dashboard")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const handler = () => fetchData()
    window.addEventListener("prices-refreshed", handler)
    return () => window.removeEventListener("prices-refreshed", handler)
  }, [fetchData])

  if (loading) {
    return (
      <div className="animate-page-enter">
        <div className="h-7 w-32 rounded-md mb-6" style={{ backgroundColor: "var(--bg-elevated)" }} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl px-5 py-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="h-3 w-20 rounded mb-3" style={{ backgroundColor: "var(--bg-elevated)" }} />
              <div className="h-6 w-28 rounded" style={{ backgroundColor: "var(--bg-elevated)" }} />
            </div>
          ))}
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
          <div className="px-5 py-3" style={{ backgroundColor: "var(--bg-elevated)" }}>
            <div className="h-4 w-32 rounded" style={{ backgroundColor: "var(--border-color)" }} />
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5" style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}>
              <div className="h-4 w-24 rounded" style={{ backgroundColor: "var(--bg-elevated)" }} />
              <div className="flex-1" />
              <div className="h-4 w-20 rounded" style={{ backgroundColor: "var(--bg-elevated)" }} />
              <div className="h-4 w-20 rounded" style={{ backgroundColor: "var(--bg-elevated)" }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    const isConnectionError = error === "Failed to fetch" || error === "NetworkError when attempting to fetch resource."
    return (
      <div className="animate-page-enter flex flex-col items-center justify-center py-20 gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, rgba(244, 63, 94, 0) 100%)",
            border: "1px solid rgba(244, 63, 94, 0.15)",
          }}
        >
          <WifiOff size={22} strokeWidth={1.5} style={{ color: "var(--color-loss)" }} />
        </div>
        <div className="text-center max-w-sm">
          <p role="alert" className="text-[14px] font-semibold tracking-tight mb-1" style={{ color: "var(--text-primary)" }}>
            {isConnectionError ? "Backend not reachable" : "Failed to load dashboard"}
          </p>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            {isConnectionError
              ? "The backend server isn't running. Start it and try again."
              : "This could be due to an expired Fyers token. Try refreshing the token in Settings."}
          </p>
        </div>
        <div className="flex items-center gap-2.5 mt-1">
          <button
            onClick={() => { setLoading(true); fetchData() }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-all duration-150"
            style={{ background: "var(--gradient-accent)" }}
          >
            <RefreshCw size={13} strokeWidth={2} />
            Retry
          </button>
          <button
            onClick={() => navigate("/settings")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[13px] font-medium cursor-pointer transition-all duration-150"
            style={{
              color: "var(--text-secondary)",
              border: "1px solid var(--border-color)",
            }}
          >
            <Settings size={13} strokeWidth={2} />
            Go to Settings
          </button>
        </div>
      </div>
    )
  }

  const metricCards = [
    {
      label: "Total Invested",
      value: formatCurrency(data.total_invested),
      icon: Wallet,
      gradient: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0) 60%)",
      borderAccent: "rgba(16, 185, 129, 0.15)",
      iconColor: "var(--color-profit)",
    },
    {
      label: "Current Value",
      value: formatCurrency(data.total_current_value),
      icon: BarChart3,
      gradient: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0) 60%)",
      borderAccent: "rgba(99, 102, 241, 0.15)",
      iconColor: "var(--color-info)",
    },
    {
      label: "Total P/L",
      value: formatCurrency(data.total_pnl),
      sub: data.total_pnl_pct != null ? formatPct(data.total_pnl_pct) : null,
      color: data.total_pnl != null ? (data.total_pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)") : undefined,
      icon: TrendingUp,
      gradient: data.total_pnl != null && data.total_pnl >= 0
        ? "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0) 60%)"
        : "linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(244, 63, 94, 0) 60%)",
      borderAccent: data.total_pnl != null && data.total_pnl >= 0
        ? "rgba(16, 185, 129, 0.15)"
        : "rgba(244, 63, 94, 0.15)",
      iconColor: data.total_pnl != null && data.total_pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)",
    },
    {
      label: "Active Alerts",
      value: data.active_alerts.toString(),
      isCount: true,
      icon: AlertTriangle,
      gradient: "linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, rgba(245, 158, 11, 0) 60%)",
      borderAccent: "rgba(245, 158, 11, 0.12)",
      iconColor: "var(--color-warning)",
      href: "/alerts",
    },
  ]

  return (
    <div className="animate-page-enter">
      <h1 className="text-xl font-semibold tracking-tight mb-6" style={{ color: "var(--text-primary)" }}>
        Dashboard
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metricCards.map((card, idx) => {
          const content = (
            <>
              <div className="flex items-center justify-between mb-2">
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {card.label}
                </p>
                <card.icon size={14} strokeWidth={1.5} style={{ color: card.iconColor, opacity: 0.7 }} />
              </div>
              <p
                className={`text-[14px] sm:text-[22px] font-semibold tracking-tight ${card.isCount ? "" : "font-mono tabular-nums"}`}
                style={{ color: card.color || "var(--text-primary)" }}
              >
                {card.value}
              </p>
              {card.sub && (
                <p className="text-sm font-mono mt-0.5 font-medium tabular-nums" style={{ color: card.color }}>
                  {card.sub}
                </p>
              )}
            </>
          )

          const className = `animate-card-enter stagger-${idx + 1} rounded-xl px-3 sm:px-5 py-3 sm:py-4 transition-all duration-200 ${card.href ? "cursor-pointer hover:brightness-110" : ""}`
          const style = {
            backgroundColor: "var(--bg-card)",
            border: `1px solid ${card.borderAccent}`,
            backgroundImage: card.gradient,
            boxShadow: "var(--shadow-card)",
          }

          return card.href ? (
            <button
              key={card.label}
              className={`${className} text-left`}
              style={style}
              onClick={() => navigate(card.href!)}
            >
              {content}
            </button>
          ) : (
            <div key={card.label} className={className} style={style}>
              {content}
            </div>
          )
        })}
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" }}
      >
        <div
          className="px-5 py-3"
          style={{ backgroundColor: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)" }}
        >
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Family Members
          </h2>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-[13px] min-w-[640px]">
            <thead>
              <tr style={{ backgroundColor: "var(--bg-card)" }}>
                <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Member</th>
                <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Invested</th>
                <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Current Value</th>
                <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>P/L</th>
                <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Alerts</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {data.members.map((m, i) => (
                <tr
                  key={m.member.id}
                  className="group cursor-pointer transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2"
                  style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}
                  tabIndex={0}
                  role="link"
                  onClick={() => navigate(`/holdings/${m.member.id}`)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/holdings/${m.member.id}`) } }}
                >
                  <td className="px-5 py-3.5 font-medium whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{m.member.name}</td>
                  <td className="px-5 py-3.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{formatCurrency(m.invested)}</td>
                  <td className="px-5 py-3.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{formatCurrency(m.current_value)}</td>
                  <td
                    className="px-5 py-3.5 text-right font-mono font-semibold tabular-nums whitespace-nowrap"
                    style={{ color: m.pnl != null ? (m.pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)") : "var(--text-muted)" }}
                  >
                    {m.pnl != null ? `${formatCurrency(m.pnl)} (${formatPct(m.pnl_pct)})` : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    {m.alert_count > 0 ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold animate-pulse-subtle"
                        style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", color: "var(--color-profit)" }}
                      >
                        {m.alert_count}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td className="pr-3">
                    <ChevronRight
                      size={14}
                      strokeWidth={1.5}
                      className="opacity-50 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150"
                      style={{ color: "var(--text-muted)" }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
