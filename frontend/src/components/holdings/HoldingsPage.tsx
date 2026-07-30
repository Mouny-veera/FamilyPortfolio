import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams } from "react-router-dom"
import { Plus, Search, X, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { api, type MemberHoldings, type LotGroup as LotGroupType, type RealizedPnL } from "@/lib/api"
import { formatCurrency, formatPct, formatDate, formatNumber, filterAndSortByTicker } from "@/lib/utils"
import { MetricCards } from "./MetricCards"
import { LotGroup } from "./LotGroup"
import { BuyForm } from "./BuyForm"
import { PageError } from "@/components/ui/PageError"

const textMuted = { color: "var(--text-muted)" } as const
const textPrimary = { color: "var(--text-primary)" } as const
const textSecondary = { color: "var(--text-secondary)" } as const
const bgElevated = { backgroundColor: "var(--bg-elevated)" } as const
const bgSecondary = { backgroundColor: "var(--bg-secondary)" } as const
const bgCardBordered = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" } as const
const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" } as const
const borderedCardShadow = { border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" } as const
const dashedBorder = { border: "1px dashed var(--border-color)" } as const
const searchInputStyle = { border: "1px solid var(--border-color)", color: "var(--text-primary)" } as const
const addBuyButtonStyle = { background: "var(--gradient-accent)", boxShadow: "var(--shadow-accent)" } as const
const arrowOpacity = { opacity: 0.4 } as const

type HoldingSortField = "ticker" | "pnl_pct" | "pnl" | "invested" | "value" | "qty"
type SortDir = "asc" | "desc"
type PnlSortField = "ticker" | "buy_date" | "buy_qty" | "buy_rate" | "buy_value" | "sell_date" | "sell_rate" | "sell_value" | "profit_loss" | "profit_loss_pct"

const HOLDING_SORT_OPTIONS: { field: HoldingSortField; label: string }[] = [
  { field: "pnl_pct", label: "Profit %" },
  { field: "pnl", label: "P/L" },
  { field: "invested", label: "Invested" },
  { field: "value", label: "Value" },
  { field: "qty", label: "Qty" },
  { field: "ticker", label: "Ticker" },
]

function getHoldingSortValue(group: LotGroupType, field: HoldingSortField): number | string {
  switch (field) {
    case "pnl_pct": return group.unrealized_pnl_pct ?? -Infinity
    case "pnl": return group.unrealized_pnl ?? -Infinity
    case "invested": return group.total_invested
    case "value": return group.current_value ?? -Infinity
    case "qty": return group.total_qty
    case "ticker": return group.ticker
  }
}

function sortHoldings(items: LotGroupType[], field: HoldingSortField, dir: SortDir): LotGroupType[] {
  return [...items].sort((a, b) => {
    const av = getHoldingSortValue(a, field)
    const bv = getHoldingSortValue(b, field)
    if (typeof av === "string" && typeof bv === "string") {
      return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    const diff = (av as number) - (bv as number)
    return dir === "asc" ? diff : -diff
  })
}

function SortChips({
  active,
  dir,
  onSort,
}: {
  active: HoldingSortField
  dir: SortDir
  onSort: (field: HoldingSortField) => void
}) {
  return (
    <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 -mx-1 px-1" role="toolbar" aria-label="Sort holdings">
      {HOLDING_SORT_OPTIONS.map((opt) => {
        const isActive = active === opt.field
        return (
          <button
            key={opt.field}
            onClick={() => onSort(opt.field)}
            aria-pressed={isActive}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-all duration-150 shrink-0"
            style={{
              backgroundColor: isActive ? "var(--accent-15)" : "var(--bg-secondary)",
              color: isActive ? "var(--color-accent)" : "var(--text-muted)",
              border: isActive ? "1px solid var(--accent-20)" : "1px solid transparent",
            }}
          >
            {opt.label}
            {isActive && (dir === "desc"
              ? <ArrowDown size={11} strokeWidth={2.5} />
              : <ArrowUp size={11} strokeWidth={2.5} />
            )}
          </button>
        )
      })}
    </div>
  )
}

function getPnlSortValue(pnl: RealizedPnL, field: PnlSortField): number | string {
  switch (field) {
    case "ticker": return pnl.ticker
    case "buy_date": return pnl.buy_date
    case "sell_date": return pnl.sell_date
    case "buy_qty": return pnl.buy_qty
    case "buy_rate": return pnl.buy_rate
    case "buy_value": return pnl.buy_value
    case "sell_rate": return pnl.sell_rate
    case "sell_value": return pnl.sell_value
    case "profit_loss": return pnl.profit_loss
    case "profit_loss_pct": return pnl.profit_loss_pct
  }
}

function sortPnl(items: RealizedPnL[], field: PnlSortField, dir: SortDir): RealizedPnL[] {
  return [...items].sort((a, b) => {
    const av = getPnlSortValue(a, field)
    const bv = getPnlSortValue(b, field)
    if (typeof av === "string" && typeof bv === "string") {
      return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    const diff = (av as number) - (bv as number)
    return dir === "asc" ? diff : -diff
  })
}

function SortableHeader({
  label,
  field,
  active,
  dir,
  align,
  onSort,
}: {
  label: string
  field: PnlSortField
  active: PnlSortField
  dir: SortDir
  align: "left" | "right"
  onSort: (field: PnlSortField) => void
}) {
  const isActive = active === field
  return (
    <th
      scope="col"
      onClick={() => onSort(field)}
      className={`${align === "right" ? "text-right" : "text-left"} px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none transition-colors duration-150`}
      style={{ color: isActive ? "var(--color-accent)" : "var(--text-muted)" }}
      aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive
          ? (dir === "desc" ? <ArrowDown size={10} strokeWidth={2.5} /> : <ArrowUp size={10} strokeWidth={2.5} />)
          : <ArrowUpDown size={10} strokeWidth={2} style={arrowOpacity} />
        }
      </span>
    </th>
  )
}

function PnLSummary({ data }: { data: RealizedPnL[] }) {
  if (data.length === 0) return null
  const totalBuyValue = data.reduce((s, p) => s + p.buy_value, 0)
  const totalPnL = data.reduce((s, p) => s + p.profit_loss, 0)
  const totalPnLPct = totalBuyValue ? (totalPnL / totalBuyValue) * 100 : 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
      <div className="rounded-xl p-4" style={cardStyle}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={textMuted}>Total Buy Value</p>
        <p className="text-xl font-mono font-semibold tabular-nums" style={textPrimary}>
          {formatCurrency(totalBuyValue)}
        </p>
      </div>
      <div className="rounded-xl p-4" style={cardStyle}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={textMuted}>Total Realized P/L</p>
        <p className="text-xl font-mono font-semibold tabular-nums" style={{ color: totalPnL >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}>
          {formatCurrency(totalPnL)}
        </p>
      </div>
      <div className="rounded-xl p-4" style={cardStyle}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={textMuted}>Total P/L %</p>
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

  const [holdingSort, setHoldingSort] = useState<HoldingSortField>("pnl_pct")
  const [holdingSortDir, setHoldingSortDir] = useState<SortDir>("desc")
  const [pnlSort, setPnlSort] = useState<PnlSortField>("sell_date")
  const [pnlSortDir, setPnlSortDir] = useState<SortDir>("desc")

  const id = parseInt(memberId || "0")

  const handleHoldingSort = useCallback((field: HoldingSortField) => {
    setHoldingSortDir((prev) => holdingSort === field ? (prev === "desc" ? "asc" : "desc") : "desc")
    setHoldingSort(field)
  }, [holdingSort])

  const handlePnlSort = useCallback((field: PnlSortField) => {
    setPnlSortDir((prev) => pnlSort === field ? (prev === "desc" ? "asc" : "desc") : "desc")
    setPnlSort(field)
  }, [pnlSort])

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
  const filteredHoldings = useMemo(() => {
    if (!data) return []
    const filtered = filterAndSortByTicker(data.holdings, q)
    return sortHoldings(filtered, holdingSort, holdingSortDir)
  }, [data, q, holdingSort, holdingSortDir])

  const filteredPnl = useMemo(() => {
    if (!data) return []
    const filtered = filterAndSortByTicker(data.realized_pnl, q)
    return sortPnl(filtered, pnlSort, pnlSortDir)
  }, [data, q, pnlSort, pnlSortDir])

  if (loading) {
    return (
      <div className="animate-page-enter">
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 w-28 rounded-md shimmer" />
          <div className="h-9 w-24 rounded-lg shimmer" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl px-5 py-4" style={bgCardBordered}>
              <div className="h-3 w-16 rounded mb-3 shimmer" />
              <div className="h-6 w-24 rounded shimmer" />
            </div>
          ))}
        </div>
        <div className="h-10 rounded-lg mb-5 shimmer" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl mb-3 px-4 py-4" style={bgCardBordered}>
            <div className="h-5 w-32 rounded mb-2 shimmer" />
            <div className="h-4 w-48 rounded shimmer" />
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
        <p className="text-sm" style={textMuted}>Member not found</p>
      </div>
    )
  }

  return (
    <div className="animate-page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={textPrimary}>
            {data.member.name}
          </h1>
        </div>
        <button
          onClick={() => setShowBuy(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-all duration-150 hover:brightness-110"
          style={addBuyButtonStyle}
        >
          <Plus size={15} strokeWidth={2} />
          Add Buy
        </button>
      </div>

      <MetricCards summary={data.summary} alertCount={data.holdings.filter((h) => h.unrealized_pnl_pct != null && h.unrealized_pnl_pct >= 10).length} />

      <div
        className="flex gap-0.5 mb-5 p-0.5 rounded-lg"
        style={bgSecondary}
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
          style={textMuted}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by ticker..."
          aria-label="Filter holdings by ticker"
          className="w-full pl-9 pr-8 py-2 rounded-lg text-[13px] bg-transparent outline-none transition-all duration-150"
          style={searchInputStyle}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            aria-label="Clear filter"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg cursor-pointer hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors"
          >
            <X size={14} strokeWidth={2} style={textMuted} />
          </button>
        )}
      </div>

      {tab === "active" && (
        <div key="active" className="animate-tab-content">
          <SortChips active={holdingSort} dir={holdingSortDir} onSort={handleHoldingSort} />
          {filteredHoldings.length === 0 ? (
            <div
              className="text-center py-16 rounded-xl"
              style={dashedBorder}
            >
              <p className="text-sm mb-2" style={textMuted}>
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
            style={borderedCardShadow}
          >
            {filteredPnl.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm" style={textMuted}>
                {search ? "No P/L records match your search" : "No realized P/L yet"}
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-[13px] min-w-[900px]">
                <thead>
                  <tr style={bgElevated}>
                    <SortableHeader label="Ticker" field="ticker" active={pnlSort} dir={pnlSortDir} align="left" onSort={handlePnlSort} />
                    <SortableHeader label="Buy Date" field="buy_date" active={pnlSort} dir={pnlSortDir} align="left" onSort={handlePnlSort} />
                    <SortableHeader label="Buy Qty" field="buy_qty" active={pnlSort} dir={pnlSortDir} align="right" onSort={handlePnlSort} />
                    <SortableHeader label="Buy Rate" field="buy_rate" active={pnlSort} dir={pnlSortDir} align="right" onSort={handlePnlSort} />
                    <SortableHeader label="Buy Value" field="buy_value" active={pnlSort} dir={pnlSortDir} align="right" onSort={handlePnlSort} />
                    <SortableHeader label="Sell Date" field="sell_date" active={pnlSort} dir={pnlSortDir} align="left" onSort={handlePnlSort} />
                    <SortableHeader label="Sell Rate" field="sell_rate" active={pnlSort} dir={pnlSortDir} align="right" onSort={handlePnlSort} />
                    <SortableHeader label="Sell Value" field="sell_value" active={pnlSort} dir={pnlSortDir} align="right" onSort={handlePnlSort} />
                    <SortableHeader label="P/L" field="profit_loss" active={pnlSort} dir={pnlSortDir} align="right" onSort={handlePnlSort} />
                    <SortableHeader label="%" field="profit_loss_pct" active={pnlSort} dir={pnlSortDir} align="right" onSort={handlePnlSort} />
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
                        <td className="px-4 py-2.5 font-semibold whitespace-nowrap" style={textPrimary}>{pnl.ticker}</td>
                        <td className="px-4 py-2.5 font-mono text-[12px] tabular-nums whitespace-nowrap" style={textSecondary}>{formatDate(pnl.buy_date)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={textPrimary}>{formatNumber(pnl.buy_qty)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={textPrimary}>₹{formatNumber(pnl.buy_rate)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={textPrimary}>{formatCurrency(pnl.buy_value)}</td>
                        <td className="px-4 py-2.5 font-mono text-[12px] tabular-nums whitespace-nowrap" style={textSecondary}>{formatDate(pnl.sell_date)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={textPrimary}>₹{formatNumber(pnl.sell_rate)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={textPrimary}>{formatCurrency(pnl.sell_value)}</td>
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
