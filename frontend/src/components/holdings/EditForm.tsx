import { useState, useRef, useEffect, useId } from "react"
import { api, type Lot } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { FormError, SubmitButton, INLINE_INPUT_CLASSES } from "@/components/ui/form"

interface EditFormProps {
  lot: Lot
  onClose: () => void
  onSuccess: () => void
}

export function EditForm({ lot, onClose, onSuccess }: EditFormProps) {
  const [buyDate, setBuyDate] = useState(lot.buy_date)
  const [buyQty, setBuyQty] = useState(lot.buy_qty.toString())
  const [buyRate, setBuyRate] = useState(lot.buy_rate.toString())
  const [notes, setNotes] = useState(lot.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const firstInputRef = useRef<HTMLInputElement>(null)
  const uid = useId()

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  const buyValue = buyQty && buyRate ? (parseFloat(buyQty) * parseFloat(buyRate)).toFixed(2) : "0.00"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      await api.editLot(lot.id, {
        buy_date: buyDate,
        buy_qty: parseFloat(buyQty),
        buy_rate: parseFloat(buyRate),
        notes: notes.trim() || null,
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const inputClasses = INLINE_INPUT_CLASSES

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
              Edit {lot.ticker} — Lot {lot.lot_label}
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

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
            <div>
              <label htmlFor={`${uid}-date`} className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Buy Date</label>
              <input
                ref={firstInputRef}
                id={`${uid}-date`}
                type="date"
                value={buyDate}
                onChange={(e) => setBuyDate(e.target.value)}
                required
                className={inputClasses}
                style={{ border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label htmlFor={`${uid}-qty`} className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Qty</label>
              <input
                id={`${uid}-qty`}
                type="number"
                value={buyQty}
                onChange={(e) => setBuyQty(e.target.value)}
                min="0.01"
                step="0.01"
                required
                className={inputClasses}
                style={{ border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label htmlFor={`${uid}-rate`} className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Rate (₹)</label>
              <input
                id={`${uid}-rate`}
                type="number"
                value={buyRate}
                onChange={(e) => setBuyRate(e.target.value)}
                min="0.01"
                step="0.01"
                required
                className={inputClasses}
                style={{ border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Value</label>
              <div
                className="px-2.5 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-lg text-[12px] font-mono font-semibold tabular-nums flex items-center"
                style={{
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--bg-card)",
                }}
              >
                {formatCurrency(parseFloat(buyValue))}
              </div>
            </div>
            <div>
              <label htmlFor={`${uid}-notes`} className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Notes</label>
              <input
                id={`${uid}-notes`}
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
                className={inputClasses}
                style={{ border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>
          </div>

          {error && <FormError message={error} />}

          <SubmitButton loading={saving} label="Save Changes" loadingLabel="Saving..." />
        </form>
      </td>
    </tr>
  )
}
