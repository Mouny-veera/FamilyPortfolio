import { useEffect, useState, useCallback, useMemo } from "react"
import { Bell, Send, TrendingUp, ChevronRight, User } from "lucide-react"
import { api, type Alert } from "@/lib/api"
import { formatCurrency, formatPct, formatNumber } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { SellGroupForm } from "@/components/holdings/SellGroupForm"

interface MemberGroup {
  memberId: number
  memberName: string
  alerts: Alert[]
  totalProfit: number
  totalInvested: number
  totalCurrent: number
  profitPct: number
}

function MemberAlertGroup({ group, onSellSuccess }: { group: MemberGroup; onSellSuccess: () => void }) {
  const [open, setOpen] = useState(true)
  const [sellingTicker, setSellingTicker] = useState<string | null>(null)

  return (
    <div
      className="rounded-xl mb-3 overflow-hidden animate-fade-in"
      style={{
        border: "1px solid var(--alert-row-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Parent row */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-colors duration-150"
        style={{ backgroundColor: "var(--alert-row-bg)" }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ChevronRight
            size={14}
            strokeWidth={2}
            className={cn("transition-transform duration-200 shrink-0", open && "rotate-90")}
            style={{ color: "var(--text-muted)" }}
          />
          <User size={15} strokeWidth={1.5} style={{ color: "var(--color-profit)" }} className="shrink-0" />
          <span className="font-semibold text-[14px] tracking-tight" style={{ color: "var(--text-primary)" }}>
            {group.memberName}
          </span>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0"
            style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", color: "var(--color-profit)" }}
          >
            {group.alerts.length} alert{group.alerts.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-6 text-right shrink-0">
          <div className="hidden sm:block">
            <p className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Invested</p>
            <p className="text-[13px] font-mono font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
              {formatCurrency(group.totalInvested)}
            </p>
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Current</p>
            <p className="text-[13px] font-mono font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
              {formatCurrency(group.totalCurrent)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Profit</p>
            <p className="text-[13px] font-mono font-semibold tabular-nums" style={{ color: "var(--color-profit)" }}>
              {formatCurrency(group.totalProfit)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Profit %</p>
            <span
              className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded-md text-[12px]"
              style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", color: "var(--color-profit)" }}
            >
              <TrendingUp size={10} strokeWidth={2.5} />
              {formatPct(group.profitPct)}
            </span>
          </div>
        </div>
      </button>

      {/* Child rows */}
      {open && (
        <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-[13px] min-w-[800px]">
              <thead>
                <tr style={{ backgroundColor: "var(--bg-card)" }}>
                  <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>S.No</th>
                  <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Ticker</th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Qty</th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Buy Value</th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>CMP</th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Current Value</th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Profit</th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Profit %</th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}></th>
                </tr>
              </thead>
              <tbody>
                {group.alerts.map((alert, i) => (
                  <tr
                    key={alert.ticker}
                    className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                    style={{
                      borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined,
                    }}
                  >
                    <td className="px-4 py-2.5 font-mono text-[11px] font-medium whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                    <td className="px-4 py-2.5 font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{alert.ticker}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{formatNumber(alert.total_qty)}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{formatCurrency(alert.total_buy_value)}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>₹{formatNumber(alert.current_price)}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{formatCurrency(alert.current_value)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums whitespace-nowrap" style={{ color: "var(--color-profit)" }}>
                      {formatCurrency(alert.profit)}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded-md text-[12px]"
                        style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", color: "var(--color-profit)" }}
                      >
                        <TrendingUp size={10} strokeWidth={2.5} />
                        {formatPct(alert.profit_pct)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSellingTicker(sellingTicker === alert.ticker ? null : alert.ticker)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-all duration-150"
                        style={{
                          color: sellingTicker === alert.ticker ? "white" : "var(--color-loss)",
                          border: "1px solid rgba(244, 63, 94, 0.3)",
                          backgroundColor: sellingTicker === alert.ticker ? "var(--color-loss)" : "transparent",
                        }}
                      >
                        {sellingTicker === alert.ticker ? "Cancel" : "Sell All"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sellingTicker && (() => {
            const alert = group.alerts.find(a => a.ticker === sellingTicker)
            if (!alert) return null
            return (
              <SellGroupForm
                memberId={group.memberId}
                ticker={alert.ticker}
                totalQty={alert.total_qty}
                totalInvested={alert.total_buy_value}
                defaultSellRate={alert.current_price}
                onClose={() => setSellingTicker(null)}
                onSuccess={onSellSuccess}
              />
            )
          })()}
        </div>
      )}
    </div>
  )
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await api.getAlerts()
      setAlerts(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  useEffect(() => {
    const handler = () => fetchAlerts()
    window.addEventListener("prices-refreshed", handler)
    return () => window.removeEventListener("prices-refreshed", handler)
  }, [fetchAlerts])

  const groups: MemberGroup[] = useMemo(() => {
    const map = new Map<number, MemberGroup>()
    for (const alert of alerts) {
      let group = map.get(alert.member.id)
      if (!group) {
        group = {
          memberId: alert.member.id,
          memberName: alert.member.name,
          alerts: [],
          totalProfit: 0,
          totalInvested: 0,
          totalCurrent: 0,
          profitPct: 0,
        }
        map.set(alert.member.id, group)
      }
      group.alerts.push(alert)
      group.totalProfit += alert.profit
      group.totalInvested += alert.total_buy_value
      group.totalCurrent += alert.current_value
    }
    for (const group of map.values()) {
      group.profitPct = group.totalInvested > 0
        ? (group.totalProfit / group.totalInvested) * 100
        : 0
    }
    return Array.from(map.values())
  }, [alerts])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-page-enter">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Profit Alerts
        </h1>
        {alerts.length > 0 && (
          <span
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-lg"
            style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", color: "var(--color-profit)" }}
          >
            <TrendingUp size={13} strokeWidth={2.5} />
            {alerts.length} stock{alerts.length !== 1 ? "s" : ""} at ≥10%
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div
          className="text-center py-20 rounded-xl"
          style={{
            border: "1px dashed var(--border-color)",
            backgroundColor: "var(--bg-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0) 100%)",
              border: "1px solid rgba(245, 158, 11, 0.15)",
            }}
          >
            <Bell size={22} strokeWidth={1.5} style={{ color: "#F59E0B" }} />
          </div>
          <p className="text-[14px] font-semibold tracking-tight mb-1" style={{ color: "var(--text-primary)" }}>
            No Active Alerts
          </p>
          <p className="text-[13px] max-w-xs mx-auto" style={{ color: "var(--text-muted)" }}>
            Holdings at 10%+ aggregated profit will appear here automatically when prices update.
          </p>

          <div
            className="inline-flex items-center gap-2 mt-6 px-3.5 py-2 rounded-lg text-[12px] font-medium"
            style={{
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-muted)",
            }}
          >
            <Send size={13} strokeWidth={1.5} />
            Telegram push notifications — coming soon
          </div>
        </div>
      ) : (
        <div>
          {groups.map((group, i) => (
            <div key={group.memberId} className="animate-stagger" style={{ animationDelay: `${i * 50}ms` }}>
              <MemberAlertGroup group={group} onSellSuccess={fetchAlerts} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
