import type { HoldingsSummary } from "@/lib/api"
import { formatCurrency, formatPct } from "@/lib/utils"

export function MetricCards({ summary }: { summary: HoldingsSummary }) {
  const cards = [
    {
      label: "Invested",
      value: formatCurrency(summary.invested),
      sub: null,
      gradient: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0) 60%)",
      borderAccent: "rgba(16, 185, 129, 0.15)",
    },
    {
      label: "Current Value",
      value: formatCurrency(summary.current_value),
      sub: null,
      gradient: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0) 60%)",
      borderAccent: "rgba(99, 102, 241, 0.15)",
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
            ? "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0) 60%)"
            : "linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(244, 63, 94, 0) 60%)"
          : "linear-gradient(135deg, rgba(148, 163, 184, 0.05) 0%, transparent 60%)",
      borderAccent:
        summary.unrealized_pnl != null
          ? summary.unrealized_pnl >= 0
            ? "rgba(16, 185, 129, 0.15)"
            : "rgba(244, 63, 94, 0.15)"
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
