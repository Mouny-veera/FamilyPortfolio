import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams } from "react-router-dom"
import { Plus, Search, X } from "lucide-react"
import { api, type MemberHoldings, type RealizedPnL } from "@/lib/api"
import { formatCurrency, formatPct, formatDate, formatNumber, filterAndSortByTicker } from "@/lib/utils"
import { MetricCards } from "./MetricCards"
import { LotGroup } from "./LotGroup"
import { BuyForm } from "./BuyForm"
import { PageError } from "@/components/ui/PageError"

function PnLSummary({ data }: { data: RealizedPnL[] }) {
  if (data.length === 0) return null
  const totalBuyValue = data.reduce((s, p) => s + p.buy_value, 0)
  const totalPnL = data.reduce((s, p) => s + p.profit_loss, 0)
  const totalPnLPct = totalBuyValue ? (totalPnL / totalBuyValue) * 100 : 0
  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
      <div className="rounded-xl p-4" style={cardStyle}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Total Buy Value</p>
        <p className="text-xl font-mono font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {formatCurrency(totalBuyValue)}
        </p>
      </div>
      <div className="rounded-xl p-4" style={cardStyle}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Total Realized P/L</p>
        <p className="text-xl font-mono font-semibold tabular-nums" style={{ color: totalPnL >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}>
          {formatCurrency(totalPnL)}
        </p>
      </div>
      <div className="rounded-xl p-4" style={cardStyle}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Total P/L %</p>
        <p className="text-xl font-mono font-semibold tabular-nums" style={{ color: totalPnLPct >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}>
          {formatPct(totalPnLPct)}
        </p>
      </div>
    </div>
  )
}

export function HoldingsPage() {
  const { memberId } = useParams<{ memberId: string }>()
  const [data, setData] = useState<MemberHoldings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"active" | "pnl">("active")
  const [showBuy, setShowBuy] = useState(false)
  const [search, setSearch] = useState("")

  const id = parseInt(memberId || "0")

  const fetchData = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }
    try {
      const holdings = await api.getHoldings(id)
      setData(holdings)
      setError(null)
    } catch (e: any) {
      console.error(e)
      setError(e?.message || "Failed to load holdings")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    setLoading(true)
    setSearch("")
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const handler = () => fetchData()
    window.addEventListener("prices-refreshed", handler)
    return () => window.removeEventListener("prices-refreshed", handler)
  }, [fetchData])

  const q = search.trim()
  const filteredHoldings = useMemo(
    () => data ? filterAndSortByTicker(data.holdings, q) : [],
    [data, q],
  )
  const filteredPnl = useMemo(
    () => data ? filterAndSortByTicker(data.realized_pnl, q) : [],
    [data, q],
  )

  if (loading) {
    return (
      <div className="animate-page-enter">
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 w-28 rounded-md" style={{ backgroundColor: "var(--bg-elevated)" }} />
          <div className="h-9 w-24 rounded-lg" style={{ backgroundColor: "var(--bg-elevated)" }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl px-5 py-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div className="h-3 w-16 rounded mb-3" style={{ backgroundColor: "var(--bg-elevated)" }} />
              <div className="h-6 w-24 rounded" style={{ backgroundColor: "var(--bg-elevated)" }} />
            </div>
          ))}
        </div>
        <div className="h-10 rounded-lg mb-5" style={{ backgroundColor: "var(--bg-secondary)" }} />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl mb-3 px-4 py-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="h-5 w-32 rounded mb-2" style={{ backgroundColor: "var(--bg-elevated)" }} />
            <div className="h-4 w-48 rounded" style={{ backgroundColor: "var(--bg-elevated)" }} />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return <PageError error={error} onRetry={() => { setLoading(true); fetchData() }} />
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Member not found</p>
      </div>
    )
  }

  return (
    <div className="animate-page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {data.member.name}
          </h1>
        </div>
        <button
          onClick={() => setShowBuy(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-all duration-150 hover:brightness-110"
          style={{
            background: "var(--gradient-accent)",
            boxShadow: "var(--shadow-accent)",
          }}
        >
          <Plus size={15} strokeWidth={2} />
          Add Buy
        </button>
      </div>

      <MetricCards summary={data.summary} />

      <div
        className="flex gap-0.5 mb-5 p-0.5 rounded-lg"
        style={{ backgroundColor: "var(--bg-secondary)" }}
        role="tablist"
        aria-label="Holdings view"
      >
        {[
          { key: "active" as const, label: `Active Holdings (${data.holdings.length})` },
          { key: "pnl" as const, label: `Realized P/L (${data.realized_pnl.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            role="tab"
            aria-selected={tab === t.key}
            className="flex-1 py-2 rounded-md text-[13px] font-medium cursor-pointer transition-all duration-150"
            style={{
              backgroundColor: tab === t.key ? "var(--bg-card)" : "transparent",
              color: tab === t.key ? "var(--text-primary)" : "var(--text-muted)",
              boxShadow: tab === t.key ? "var(--shadow-card)" : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search
          size={14}
          strokeWidth={2}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--text-muted)" }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by ticker..."
          aria-label="Filter holdings by ticker"
          className="w-full pl-9 pr-8 py-2 rounded-lg text-[13px] bg-transparent outline-none transition-all duration-150"
          style={{
            border: "1px solid var(--border-color)",
            color: "var(--text-primary)",
          }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            aria-label="Clear filter"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg cursor-pointer hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors"
          >
            <X size={14} strokeWidth={2} style={{ color: "var(--text-muted)" }} />
          </button>
        )}
      </div>

      {tab === "active" && (
        <div key="active" className="animate-tab-content">
          {filteredHoldings.length === 0 ? (
            <div
              className="text-center py-16 rounded-xl"
              style={{ border: "1px dashed var(--border-color)" }}
            >
              <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>
                {search ? "No holdings match your search" : "No active holdings"}
              </p>
              {!search && (
                <button
                  onClick={() => setShowBuy(true)}
                  className="text-[13px] text-accent hover:text-accent-dark font-medium cursor-pointer transition-colors duration-150"
                >
                  Add your first buy
                </button>
              )}
            </div>
          ) : (
            filteredHoldings.map((group, i) => (
              <div key={group.ticker} className="animate-stagger" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                <LotGroup group={group} memberId={id} onRefresh={fetchData} />
              </div>
            ))
          )}
        </div>
      )}

      {tab === "pnl" && (
        <div key="pnl" className="animate-tab-content">
          <PnLSummary data={filteredPnl} />
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" }}
          >
            {filteredPnl.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {search ? "No P/L records match your search" : "No realized P/L yet"}
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-[13px] min-w-[900px]">
                <thead>
                  <tr style={{ backgroundColor: "var(--bg-elevated)" }}>
                    <th scope="col" className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Ticker</th>
                    <th scope="col" className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Buy Date</th>
                    <th scope="col" className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Buy Qty</th>
                    <th scope="col" className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Buy Rate</th>
                    <th scope="col" className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Buy Value</th>
                    <th scope="col" className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Sell Date</th>
                    <th scope="col" className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Sell Rate</th>
                    <th scope="col" className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Sell Value</th>
                    <th scope="col" className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>P/L</th>
                    <th scope="col" className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPnl.map((pnl, i) => {
                    const isProfitAlert = pnl.profit_loss_pct >= 10
                    return (
                      <tr
                        key={pnl.id}
                        className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                        style={{
                          borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined,
                          backgroundColor: isProfitAlert ? "var(--alert-row-bg)" : undefined,
                        }}
                      >
                        <td className="px-4 py-2.5 font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{pnl.ticker}</td>
                        <td className="px-4 py-2.5 font-mono text-[12px] tabular-nums whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{formatDate(pnl.buy_date)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{formatNumber(pnl.buy_qty)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>₹{formatNumber(pnl.buy_rate)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{formatCurrency(pnl.buy_value)}</td>
                        <td className="px-4 py-2.5 font-mono text-[12px] tabular-nums whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{formatDate(pnl.sell_date)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>₹{formatNumber(pnl.sell_rate)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{formatCurrency(pnl.sell_value)}</td>
                        <td
                          className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums whitespace-nowrap"
                          style={{ color: pnl.profit_loss >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}
                        >
                          {formatCurrency(pnl.profit_loss)}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <span
                            className={`font-mono font-semibold tabular-nums ${isProfitAlert ? "inline-flex items-center px-1.5 py-0.5 rounded-md" : ""}`}
                            style={{
                              color: pnl.profit_loss_pct >= 0 ? "var(--color-profit)" : "var(--color-loss)",
                              backgroundColor: isProfitAlert ? "var(--accent-10)" : undefined,
                            }}
                          >
                            {formatPct(pnl.profit_loss_pct)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </div>
      )}

      {showBuy && (
        <BuyForm
          memberId={id}
          onClose={() => setShowBuy(false)}
          onSuccess={fetchData}
        />
      )}
    </div>
  )
}
