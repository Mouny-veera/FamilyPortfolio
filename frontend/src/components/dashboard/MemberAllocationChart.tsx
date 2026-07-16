import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
} from "recharts"
import type { DashboardMemberSnapshot } from "@/lib/api"

const COLORS = ["#10B981", "#6366F1", "#F59E0B", "#EC4899", "#3B82F6"]

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const { name, value, payload: data } = payload[0]
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-elevated)",
      }}
    >
      <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        {name}
      </p>
      <p className="text-[13px] font-mono font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
        {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value as number)}
      </p>
      <p className="text-[10px] font-mono tabular-nums mt-0.5" style={{ color: "var(--text-muted)" }}>
        {data.pct.toFixed(1)}% of total
      </p>
    </div>
  )
}

interface Props {
  members: DashboardMemberSnapshot[]
}

export function MemberAllocationChart({ members }: Props) {
  const totalInvested = members.reduce((s, m) => s + m.invested, 0)
  const chartData = members
    .filter((m) => m.invested > 0)
    .map((m) => ({
      name: m.member.name,
      value: m.invested,
      pct: totalInvested ? (m.invested / totalInvested) * 100 : 0,
    }))

  if (chartData.length === 0) return null

  return (
    <div className="flex items-center gap-6">
      <div className="w-[180px] h-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {COLORS.map((color, i) => (
                <linearGradient key={i} id={`pieGrad-${i}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.65} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              animationDuration={800}
              animationEasing="ease-out"
              stroke="none"
            >
              {chartData.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={`url(#pieGrad-${index % COLORS.length})`} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-2.5">
        {chartData.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-2.5">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-[12px] font-medium flex-1" style={{ color: "var(--text-secondary)" }}>
              {entry.name}
            </span>
            <span className="text-[12px] font-mono tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
              {entry.pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
