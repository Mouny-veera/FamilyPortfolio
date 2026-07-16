import { useState } from "react"
import { api } from "@/lib/api"
import { formatNumber, formatCurrency, formatPct } from "@/lib/utils"

interface SellGroupFormProps {
  memberId: number
  ticker: string
  totalQty: number
  totalInvested: number
  defaultSellRate?: number
  onClose: () => void
  onSuccess: () => void
}

export function SellGroupForm({ memberId, ticker, totalQty, totalInvested, defaultSellRate, onClose, onSuccess }: SellGroupFormProps) {
  const [sellDate, setSellDate] = useState(new Date().toISOString().split("T")[0])
  const [sellRate, setSellRate] = useState(defaultSellRate ? String(defaultSellRate) : "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const sellValue = sellRate ? (totalQty * parseFloat(sellRate)).toFixed(2) : "0.00"
  const pnl = sellRate ? (parseFloat(sellValue) - totalInvested).toFixed(2) : "0.00"
  const pnlPct = totalInvested && sellRate ? (((parseFloat(sellValue) - totalInvested) / totalInvested) * 100).toFixed(2) : "0.00"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      await api.sellGroup({
        member_id: memberId,
        ticker,
        sell_date: sellDate,
        sell_rate: parseFloat(sellRate),
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sell")
    } finally {
      setSaving(false)
    }
  }

  const inputClasses = "w-full px-2.5 py-1.5 rounded-lg text-[12px] bg-transparent font-mono tabular-nums transition-all duration-150 outline-none"

  return (
    <div
      className="mx-4 my-2 p-4 rounded-xl animate-fade-in"
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Sell All — {ticker}
          <span className="font-normal ml-1.5" style={{ color: "var(--text-muted)" }}>
            ({formatNumber(totalQty)} qty · Invested {formatNumber(totalInvested)})
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] px-2 py-1 rounded-md font-medium cursor-pointer transition-colors duration-150 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
          style={{ color: "var(--text-muted)" }}
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Sell Date</label>
            <input
              type="date"
              value={sellDate}
              onChange={(e) => setSellDate(e.target.value)}
              required
              className={inputClasses}
              style={{ border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Total Qty</label>
            <div
              className="px-2.5 py-1.5 rounded-lg text-[12px] font-mono tabular-nums"
              style={{ border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", backgroundColor: "var(--bg-card)" }}
            >
              {formatNumber(totalQty)}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Sell Rate (₹)</label>
            <input
              type="number"
              value={sellRate}
              onChange={(e) => setSellRate(e.target.value)}
              min="0.01"
              step="0.01"
              required
              className={inputClasses}
              style={{ border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>P/L ({formatPct(parseFloat(pnlPct))})</label>
            <div
              className="px-2.5 py-1.5 rounded-lg text-[12px] font-mono font-semibold tabular-nums"
              style={{
                border: "1px solid var(--border-subtle)",
                color: parseFloat(pnl) >= 0 ? "var(--color-profit)" : "var(--color-loss)",
                backgroundColor: "var(--bg-card)",
              }}
            >
              {formatCurrency(parseFloat(pnl))}
            </div>
          </div>
        </div>

        {error && (
          <p className="text-[11px] font-medium mb-2 px-2 py-1.5 rounded-md" style={{ color: "var(--color-loss)", backgroundColor: "rgba(244, 63, 94, 0.08)" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-1.5 rounded-lg text-[12px] font-semibold text-white cursor-pointer transition-all duration-150 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)",
            boxShadow: "0 2px 6px rgba(244, 63, 94, 0.2)",
          }}
        >
          {saving ? "Processing..." : "Confirm Sell All Lots"}
        </button>
      </form>
    </div>
  )
}
