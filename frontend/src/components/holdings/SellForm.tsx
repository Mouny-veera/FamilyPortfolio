import { useState } from "react"
import { api, type Lot } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"

interface SellFormProps {
  lot: Lot
  defaultSellRate?: number
  onClose: () => void
  onSuccess: () => void
}

export function SellForm({ lot, defaultSellRate, onClose, onSuccess }: SellFormProps) {
  const [sellDate, setSellDate] = useState(new Date().toISOString().split("T")[0])
  const [sellQty, setSellQty] = useState(lot.buy_qty.toString())
  const [sellRate, setSellRate] = useState(defaultSellRate ? String(defaultSellRate) : "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const sellValue = sellQty && sellRate ? (parseFloat(sellQty) * parseFloat(sellRate)).toFixed(2) : "0.00"
  const proportionalBuyValue = sellQty ? ((parseFloat(sellQty) / lot.buy_qty) * lot.buy_value).toFixed(2) : "0.00"
  const pnl = sellValue && proportionalBuyValue ? (parseFloat(sellValue) - parseFloat(proportionalBuyValue)).toFixed(2) : "0.00"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      await api.sellLot({
        lot_id: lot.id,
        sell_date: sellDate,
        sell_qty: parseFloat(sellQty),
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
    <tr>
      <td colSpan={6}>
        <form
          onSubmit={handleSubmit}
          className="mx-4 my-2 p-4 rounded-xl animate-fade-in"
          style={{
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Sell {lot.ticker} — Lot {lot.lot_label}
              <span className="font-normal ml-1.5" style={{ color: "var(--text-muted)" }}>
                ({lot.buy_qty} qty @ ₹{lot.buy_rate})
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
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Sell Qty</label>
              <input
                type="number"
                value={sellQty}
                onChange={(e) => setSellQty(e.target.value)}
                min="0.01"
                max={lot.buy_qty}
                step="0.01"
                required
                className={inputClasses}
                style={{ border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              />
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
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>P/L</label>
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
            {saving ? "Processing..." : "Confirm Sell"}
          </button>
        </form>
      </td>
    </tr>
  )
}
