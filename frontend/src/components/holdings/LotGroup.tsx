import { useState, useRef, useEffect, useCallback, Fragment } from "react"
import { ChevronRight, TrendingUp, CheckCircle2, AlertTriangle, Search, Trash2 } from "lucide-react"
import type { LotGroup as LotGroupType, NseSearchResult } from "@/lib/api"
import { api } from "@/lib/api"
import { cn, formatCurrency, formatNumber, formatDate, formatPct } from "@/lib/utils"
import { EditForm } from "./EditForm"
import { SellForm } from "./SellForm"
import { SellGroupForm } from "./SellGroupForm"
import { DeleteConfirm } from "./DeleteConfirm"

const ALERT_THRESHOLD = 10

function RemapBar({
  suggestions,
  remapping,
  onRemap,
}: {
  suggestions: { symbol: string; company_name: string; score: number }[]
  remapping: boolean
  onRemap: (sym: string) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<NseSearchResult[]>([])
  const [showDrop, setShowDrop] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const wrapRef = useRef<HTMLDivElement>(null)

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setShowDrop(false); return }
    try {
      const r = await api.searchNse(q)
      setResults(r)
      setShowDrop(r.length > 0)
    } catch { setResults([]) }
  }, [])

  const handleChange = (v: string) => {
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(v), 150)
  }

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener("mousedown", h)
    return () => { document.removeEventListener("mousedown", h); if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  return (
    <div
      className="px-4 py-2.5 flex items-center gap-3 flex-wrap"
      style={{
        backgroundColor: "rgba(245, 158, 11, 0.04)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
        Map to:
      </span>
      {suggestions.map((s) => (
        <button
          key={s.symbol}
          onClick={() => onRemap(s.symbol)}
          disabled={remapping}
          className="text-[11px] px-2.5 py-1 min-h-[44px] sm:min-h-0 rounded-md font-medium cursor-pointer transition-all duration-150 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            color: "var(--text-primary)",
          }}
        >
          {s.symbol}
          <span className="ml-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
            {s.company_name.length > 20 ? s.company_name.slice(0, 20) + "..." : s.company_name}
          </span>
        </button>
      ))}
      <div ref={wrapRef} className="relative">
        <div className="relative">
          <Search
            size={12}
            strokeWidth={2}
            className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => { if (results.length > 0) setShowDrop(true) }}
            placeholder="Search NSE symbol..."
            aria-label="Search NSE symbol for remapping"
            disabled={remapping}
            className="text-[11px] pl-7 pr-2 py-1.5 min-h-[44px] sm:min-h-0 rounded-md bg-transparent outline-none w-40 disabled:opacity-40"
            style={{
              border: "1px solid var(--border-color)",
              color: "var(--text-primary)",
            }}
          />
        </div>
        {showDrop && (
          <div
            className="absolute z-20 w-56 mt-1 rounded-lg overflow-hidden max-h-44 overflow-y-auto"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              boxShadow: "var(--shadow-elevated)",
            }}
          >
            {results.map((r) => (
              <button
                key={r.symbol}
                type="button"
                onClick={() => { onRemap(r.symbol); setShowDrop(false); setQuery("") }}
                className="w-full text-left px-3 py-2 min-h-[44px] sm:min-h-0 cursor-pointer transition-colors duration-75 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
              >
                <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {r.symbol}
                </span>
                <span className="text-[10px] ml-2" style={{ color: "var(--text-muted)" }}>
                  {r.company_name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface LotGroupProps {
  group: LotGroupType
  memberId: number
  onRefresh: () => void
}

export function LotGroup({ group, memberId, onRefresh }: LotGroupProps) {
  const [open, setOpen] = useState(true)
  const [sellingLotId, setSellingLotId] = useState<number | null>(null)
  const [editingLotId, setEditingLotId] = useState<number | null>(null)
  const [deletingLotId, setDeletingLotId] = useState<number | null>(null)
  const [sellingGroup, setSellingGroup] = useState(false)
  const [remapping, setRemapping] = useState(false)

  const isAlert = group.unrealized_pnl_pct != null && group.unrealized_pnl_pct >= ALERT_THRESHOLD
  const isUnmatched = group.mapping_status === "unmatched"

  const handleRemap = async (newSymbol: string) => {
    setRemapping(true)
    try {
      await api.remapTicker(group.ticker, newSymbol)
      onRefresh()
    } catch (e) {
      console.error("Remap failed:", e)
    } finally {
      setRemapping(false)
    }
  }

  return (
    <div
      className="rounded-xl mb-3 overflow-hidden animate-fade-in"
      style={{
        border: isAlert ? "1px solid var(--alert-row-border)" : "1px solid var(--border-color)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 transition-colors duration-150 max-md:hidden"
        style={{
          backgroundColor: isAlert
            ? "var(--alert-row-bg)"
            : open ? "var(--bg-elevated)" : "var(--bg-card)",
        }}
      >
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
        >
          <ChevronRight
            size={14}
            strokeWidth={2}
            className={cn("transition-transform duration-200 shrink-0", open && "rotate-90")}
            style={{ color: "var(--text-muted)" }}
          />
          <span className="font-semibold text-[13px] tracking-tight" style={{ color: "var(--text-primary)" }}>
            {group.ticker}
          </span>
          {group.mapping_status === "verified" && (
            <CheckCircle2 size={12} strokeWidth={2.5} style={{ color: "var(--color-profit)" }} className="shrink-0" />
          )}
          {isUnmatched && (
            <span
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-semibold shrink-0"
              style={{ backgroundColor: "rgba(245, 158, 11, 0.12)", color: "var(--color-amber)" }}
            >
              <AlertTriangle size={10} strokeWidth={2.5} />
              Unmatched
            </span>
          )}
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
            style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)" }}
          >
            {group.lot_count} lot{group.lot_count !== 1 ? "s" : ""}
          </span>
          {group.scanner_badge && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
              style={{ backgroundColor: "rgba(245, 158, 11, 0.1)", color: "var(--color-amber)" }}
            >
              {group.scanner_badge}
            </span>
          )}
          {isAlert && (
            <span
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-semibold animate-pulse-subtle"
              style={{ backgroundColor: "rgba(16, 185, 129, 0.12)", color: "var(--color-profit)" }}
            >
              <TrendingUp size={10} strokeWidth={2.5} />
              ≥10% Profit
            </span>
          )}
        </button>

        <div className="flex items-center gap-6 text-right shrink-0">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Qty</p>
            <p className="text-[13px] font-mono font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
              {formatNumber(group.total_qty)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Invested</p>
            <p className="text-[13px] font-mono font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
              {formatCurrency(group.total_invested)}
            </p>
          </div>
          {group.current_value != null && (
            <>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Current</p>
                <p className="text-[13px] font-mono font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {formatCurrency(group.current_value)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Profit %</p>
                <p
                  className={cn(
                    "text-[13px] font-mono font-semibold tabular-nums",
                    isAlert && "inline-flex items-center px-1.5 py-0.5 rounded-md"
                  )}
                  style={{
                    color: (group.unrealized_pnl_pct ?? 0) >= 0 ? "var(--color-profit)" : "var(--color-loss)",
                    backgroundColor: isAlert ? "rgba(16, 185, 129, 0.1)" : undefined,
                  }}
                >
                  {formatPct(group.unrealized_pnl_pct)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>P/L</p>
                <p
                  className="text-[13px] font-mono font-semibold tabular-nums"
                  style={{
                    color: (group.unrealized_pnl ?? 0) >= 0 ? "var(--color-profit)" : "var(--color-loss)",
                  }}
                >
                  {formatCurrency(group.unrealized_pnl)}
                </p>
              </div>
            </>
          )}
          <div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSellingGroup(!sellingGroup)
                setSellingLotId(null)
              }}
              className="text-[11px] px-2.5 py-1.5 min-h-[44px] sm:min-h-0 rounded-md font-medium cursor-pointer transition-all duration-200"
              style={{
                color: sellingGroup ? "white" : "var(--color-loss)",
                backgroundColor: sellingGroup ? "var(--color-loss)" : "transparent",
                border: `1px solid ${sellingGroup ? "var(--color-loss)" : "rgba(244, 63, 94, 0.3)"}`,
              }}
            >
              {sellingGroup ? "Cancel" : "Sell All"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile: two-row layout */}
      <div
        className="px-4 py-3 transition-colors duration-150 md:hidden"
        style={{
          backgroundColor: isAlert
            ? "var(--alert-row-bg)"
            : open ? "var(--bg-elevated)" : "var(--bg-card)",
        }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
          >
            <ChevronRight
              size={14}
              strokeWidth={2}
              className={cn("transition-transform duration-200 shrink-0", open && "rotate-90")}
              style={{ color: "var(--text-muted)" }}
            />
            <span className="font-semibold text-sm tracking-tight truncate" style={{ color: "var(--text-primary)" }}>
              {group.ticker}
            </span>
            {group.mapping_status === "verified" && (
              <CheckCircle2 size={12} strokeWidth={2.5} style={{ color: "var(--color-profit)" }} className="shrink-0" />
            )}
            {isUnmatched && (
              <span
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-semibold shrink-0"
                style={{ backgroundColor: "rgba(245, 158, 11, 0.12)", color: "var(--color-amber)" }}
              >
                <AlertTriangle size={10} strokeWidth={2.5} />
                Unmatched
              </span>
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              setSellingGroup(!sellingGroup)
              setSellingLotId(null)
            }}
            className="text-[11px] px-2.5 py-1.5 min-h-[44px] sm:min-h-0 rounded-md font-medium cursor-pointer transition-all duration-200 shrink-0 ml-2"
            style={{
              color: sellingGroup ? "white" : "var(--color-loss)",
              backgroundColor: sellingGroup ? "var(--color-loss)" : "transparent",
              border: `1px solid ${sellingGroup ? "var(--color-loss)" : "rgba(244, 63, 94, 0.3)"}`,
            }}
          >
            {sellingGroup ? "Cancel" : "Sell All"}
          </button>
        </div>

        <div className="flex items-center gap-4 mt-2 ml-6 overflow-x-auto text-right">
          <div className="shrink-0">
            <p className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Qty</p>
            <p className="text-[13px] font-mono font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
              {formatNumber(group.total_qty)}
            </p>
          </div>
          <div className="shrink-0">
            <p className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Invested</p>
            <p className="text-[13px] font-mono font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
              {formatCurrency(group.total_invested)}
            </p>
          </div>
          {group.current_value != null && (
            <>
              <div className="shrink-0">
                <p className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Current</p>
                <p className="text-[13px] font-mono font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {formatCurrency(group.current_value)}
                </p>
              </div>
              <div className="shrink-0">
                <p className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>P/L %</p>
                <p
                  className={cn(
                    "text-[13px] font-mono font-semibold tabular-nums",
                    isAlert && "inline-flex items-center px-1.5 py-0.5 rounded-md"
                  )}
                  style={{
                    color: (group.unrealized_pnl_pct ?? 0) >= 0 ? "var(--color-profit)" : "var(--color-loss)",
                    backgroundColor: isAlert ? "rgba(16, 185, 129, 0.1)" : undefined,
                  }}
                >
                  {formatPct(group.unrealized_pnl_pct)}
                </p>
              </div>
              <div className="shrink-0">
                <p className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>P/L</p>
                <p
                  className="text-[13px] font-mono font-semibold tabular-nums"
                  style={{
                    color: (group.unrealized_pnl ?? 0) >= 0 ? "var(--color-profit)" : "var(--color-loss)",
                  }}
                >
                  {formatCurrency(group.unrealized_pnl)}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {isUnmatched && <RemapBar
        suggestions={group.nse_suggestions ?? []}
        remapping={remapping}
        onRemap={handleRemap}
      />}

      {sellingGroup && (
        <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <SellGroupForm
            memberId={memberId}
            ticker={group.ticker}
            totalQty={group.total_qty}
            totalInvested={group.total_invested}
            defaultSellRate={group.current_price ?? undefined}
            onClose={() => setSellingGroup(false)}
            onSuccess={onRefresh}
          />
        </div>
      )}

      {open && (
        <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-[13px] min-w-[520px]">
              <thead>
                <tr style={{ backgroundColor: "var(--bg-card)" }}>
                  <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>S.No</th>
                  <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Buy Date</th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Qty</th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Rate</th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Value</th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {group.lots.map((lot, i) => (
                  <Fragment key={lot.id}>
                    <tr
                      className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                      style={{
                        borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined,
                      }}
                    >
                      <td className="px-4 py-2.5 font-mono text-[11px] font-medium whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                      <td className="px-4 py-2.5 font-mono text-[12px] tabular-nums whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{formatDate(lot.buy_date)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{formatNumber(lot.buy_qty)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>₹{formatNumber(lot.buy_rate)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{formatCurrency(lot.buy_value)}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingLotId(editingLotId === lot.id ? null : lot.id)
                              setSellingLotId(null)
                              setDeletingLotId(null)
                            }}
                            aria-label={editingLotId === lot.id ? `Cancel editing ${group.ticker}` : `Edit ${group.ticker} lot ${i + 1}`}
                            className="text-[11px] px-2.5 py-1.5 min-h-[44px] sm:min-h-0 rounded-md font-medium cursor-pointer transition-all duration-200"
                            style={{
                              color: editingLotId === lot.id ? "white" : "var(--color-accent)",
                              backgroundColor: editingLotId === lot.id ? "var(--color-accent)" : "transparent",
                              border: `1px solid ${editingLotId === lot.id ? "var(--color-accent)" : "rgba(16, 185, 129, 0.3)"}`,
                            }}
                          >
                            {editingLotId === lot.id ? "Cancel" : "Edit"}
                          </button>
                          <button
                            onClick={() => {
                              setSellingLotId(sellingLotId === lot.id ? null : lot.id)
                              setEditingLotId(null)
                              setDeletingLotId(null)
                            }}
                            aria-label={sellingLotId === lot.id ? `Cancel selling ${group.ticker}` : `Sell ${group.ticker} lot ${i + 1}`}
                            className="text-[11px] px-2.5 py-1.5 min-h-[44px] sm:min-h-0 rounded-md font-medium cursor-pointer transition-all duration-200"
                            style={{
                              color: sellingLotId === lot.id ? "white" : "var(--color-loss)",
                              backgroundColor: sellingLotId === lot.id ? "var(--color-loss)" : "transparent",
                              border: `1px solid ${sellingLotId === lot.id ? "var(--color-loss)" : "rgba(244, 63, 94, 0.3)"}`,
                            }}
                          >
                            {sellingLotId === lot.id ? "Cancel" : "Sell"}
                          </button>
                          <button
                            onClick={() => {
                              setDeletingLotId(deletingLotId === lot.id ? null : lot.id)
                              setEditingLotId(null)
                              setSellingLotId(null)
                            }}
                            aria-label={`Delete lot ${lot.lot_label}`}
                            className="p-1.5 min-h-[44px] sm:min-h-0 min-w-[44px] sm:min-w-0 flex items-center justify-center rounded-md cursor-pointer transition-all duration-200"
                            style={{
                              color: deletingLotId === lot.id ? "white" : "var(--text-muted)",
                              backgroundColor: deletingLotId === lot.id ? "var(--color-loss)" : "transparent",
                              border: `1px solid ${deletingLotId === lot.id ? "var(--color-loss)" : "var(--border-subtle)"}`,
                            }}
                          >
                            <Trash2 size={13} strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingLotId === lot.id && (
                      <EditForm
                        key={`edit-${lot.id}`}
                        lot={lot}
                        onClose={() => setEditingLotId(null)}
                        onSuccess={onRefresh}
                      />
                    )}
                    {sellingLotId === lot.id && (
                      <SellForm
                        key={`sell-${lot.id}`}
                        lot={lot}
                        defaultSellRate={group.current_price ?? undefined}
                        onClose={() => setSellingLotId(null)}
                        onSuccess={onRefresh}
                      />
                    )}
                    {deletingLotId === lot.id && (
                      <DeleteConfirm
                        key={`delete-${lot.id}`}
                        lot={lot}
                        onClose={() => setDeletingLotId(null)}
                        onSuccess={onRefresh}
                      />
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
