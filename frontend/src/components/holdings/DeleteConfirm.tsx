import { useState, useRef, useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { api, type Lot } from "@/lib/api"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { FormError, SubmitButton } from "@/components/ui/form"

interface DeleteConfirmProps {
  lot: Lot
  onClose: () => void
  onSuccess: () => void
}

export function DeleteConfirm({ lot, onClose, onSuccess }: DeleteConfirmProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  const handleDelete = async () => {
    setError("")
    setDeleting(true)
    try {
      await api.deleteLot(lot.id)
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <tr>
      <td colSpan={6}>
        <div
          className="mx-4 my-2 p-4 rounded-xl animate-fade-in"
          style={{
            backgroundColor: "rgba(244, 63, 94, 0.04)",
            border: "1px solid rgba(244, 63, 94, 0.2)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{
                background: "linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, rgba(244, 63, 94, 0) 100%)",
                border: "1px solid rgba(244, 63, 94, 0.15)",
              }}
            >
              <AlertTriangle size={15} strokeWidth={2} style={{ color: "var(--color-loss)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
                Delete {lot.ticker}?
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {formatNumber(lot.buy_qty)} qty @ ₹{formatNumber(lot.buy_rate)} = {formatCurrency(lot.buy_value)}
              </p>
              <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                This lot will be permanently removed. This cannot be undone.
              </p>

              {error && <FormError message={error} />}

              <div className="flex items-center gap-2 mt-3">
                <SubmitButton loading={deleting} label="Confirm Delete" loadingLabel="Deleting..." variant="destructive" onClick={handleDelete} />
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={onClose}
                  className="text-[11px] px-3 py-2 min-h-[44px] sm:min-h-0 rounded-md font-medium cursor-pointer transition-all duration-200"
                  style={{
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}
