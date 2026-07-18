import { useState, useRef, useEffect, useId } from "react"
import { api } from "@/lib/api"
import { formatNumber, formatCurrency, formatPct } from "@/lib/utils"
import { FormError, SubmitButton, INLINE_INPUT_CLASSES } from "@/components/ui/form"

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
  const firstInputRef = useRef<HTMLInputElement>(null)
  const uid = useId()

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

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

  const inputClasses = INLINE_INPUT_CLASSES

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
          className="text-[11px] px-2 py-1 min-h-[44px] sm:min-h-0 rounded-md font-medium cursor-pointer transition-colors duration-150 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
          style={{ color: "var(--text-muted)" }}
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div>
            <label htmlFor={`${uid}-date`} className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Sell Date</label>
            <input
              ref={firstInputRef}
              id={`${uid}-date`}
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
              className="px-2.5 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-lg text-[12px] font-mono tabular-nums flex items-center"
              style={{ border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", backgroundColor: "var(--bg-card)" }}
            >
              {formatNumber(totalQty)}
            </div>
          </div>
          <div>
            <label htmlFor={`${uid}-rate`} className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Sell Rate (₹)</label>
            <input
              id={`${uid}-rate`}
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
              className="px-2.5 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-lg text-[12px] font-mono font-semibold tabular-nums flex items-center"
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

        {error && <FormError message={error} />}

        <SubmitButton loading={saving} label="Confirm Sell All Lots" loadingLabel="Processing..." variant="destructive" />
      </form>
    </div>
  )
}
