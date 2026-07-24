import type { HoldingsSummary } from "@/lib/api"
import { formatCurrency, formatPct } from "@/lib/utils"

export function MetricCards({ summary }: { summary: HoldingsSummary }) {
  const cards = [
    {
      label: "Invested",
      value: formatCurrency(summary.invested),
      sub: null,
      gradient: "var(--accent-gradient-08)",
      borderAccent: "var(--accent-15)",
    },
    {
      label: "Current Value",
      value: formatCurrency(summary.current_value),
      sub: null,
      gradient: "var(--info-gradient-08)",
      borderAccent: "var(--info-15)",
    },
    {
      label: "Unrealized P/L",
      value: formatCurrency(summary.unrealized_pnl),
      sub: summary.unrealized_pnl_pct != null ? formatPct(summary.unrealized_pnl_pct) : null,
      color:
        summary.unrealized_pnl != null
          ? summary.unrealized_pnl >= 0
            ? "var(--color-profit)"
            : "var(--color-loss)"
          : undefined,
      gradient:
        summary.unrealized_pnl != null
          ? summary.unrealized_pnl >= 0
            ? "var(--accent-gradient-08)"
            : "var(--loss-gradient-08)"
          : "var(--muted-gradient-05)",
      borderAccent:
        summary.unrealized_pnl != null
          ? summary.unrealized_pnl >= 0
            ? "var(--accent-15)"
            : "var(--loss-15)"
          : "var(--border-color)",
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl px-3 py-3 sm:px-5 sm:py-4 transition-all duration-200 animate-fade-in"
          style={{
            backgroundColor: "var(--bg-card)",
            border: `1px solid ${card.borderAccent}`,
            backgroundImage: card.gradient,
            boxShadow: "var(--shadow-card)",
          }}
        >
          <p
            className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.08em] mb-1 sm:mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            {card.label}
          </p>
          <p
            className="text-[13px] sm:text-[22px] font-semibold font-mono tracking-tight tabular-nums"
            style={{ color: card.color || "var(--text-primary)" }}
          >
            {card.value}
          </p>
          {card.sub && (
            <p className="text-xs sm:text-sm font-mono mt-0.5 font-medium tabular-nums" style={{ color: card.color }}>
              {card.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
