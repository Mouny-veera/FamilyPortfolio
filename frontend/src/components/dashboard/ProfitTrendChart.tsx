import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  type TooltipProps,
} from "recharts"
import type { ProfitTrend } from "@/lib/api"

function CustomTooltip(props: TooltipProps<number, string>) {
  const { active, payload, label } = props as { active?: boolean; payload?: Array<{ value?: unknown }>; label?: string }
  if (!active || !payload?.length) return null
  const value = payload[0].value as number
  const isProfit = value >= 0
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-elevated)",
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
        FY {label}
      </p>
      <p
        className="text-[15px] font-mono font-semibold tabular-nums"
        style={{ color: isProfit ? "var(--color-profit)" : "var(--color-loss)" }}
      >
        {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value)}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
        Realized {isProfit ? "Profit" : "Loss"}
      </p>
    </div>
  )
}

export function ProfitTrendChart({ data }: { data: ProfitTrend[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
          </linearGradient>
          <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#E11D48" stopOpacity={0.7} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis
          dataKey="financial_year"
          tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "Inter, sans-serif" }}
          axisLine={{ stroke: "var(--border-subtle)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) =>
            new Intl.NumberFormat("en-IN", { notation: "compact", compactDisplay: "short" }).format(v)
          }
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg-elevated)", opacity: 0.4 }} />
        <Bar dataKey="total_pnl" radius={[8, 8, 0, 0]} maxBarSize={52} animationDuration={800} animationEasing="ease-out">
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.total_pnl >= 0 ? "url(#profitGradient)" : "url(#lossGradient)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
