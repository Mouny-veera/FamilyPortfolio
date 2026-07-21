import { useState, useEffect, useRef, useCallback, useId } from "react"
import { X, Search, CheckCircle2, Loader2 } from "lucide-react"
import { api, type NseSearchResult } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { FormError, SubmitButton } from "@/components/ui/form"

interface BuyFormProps {
  memberId: number
  onClose: () => void
  onSuccess: () => void
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>
  const idx = text.toUpperCase().indexOf(query.toUpperCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: "var(--color-profit)", fontWeight: 700 }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  )
}

export function BuyForm({ memberId, onClose, onSuccess }: BuyFormProps) {
  const [ticker, setTicker] = useState("")
  const [buyDate, setBuyDate] = useState(new Date().toISOString().split("T")[0])
  const [qty, setQty] = useState("")
  const [rate, setRate] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<NseSearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState("")
  const [searching, setSearching] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const uid = useId()

  const buyValue = qty && rate ? (parseFloat(qty) * parseFloat(rate)).toFixed(2) : "0.00"

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      setSearching(false)
      return
    }

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSearching(true)
    try {
      const results = await api.searchNse(q)
      if (controller.signal.aborted) return
      setSuggestions(results)
      setShowDropdown(results.length > 0)
      setActiveIndex(-1)
    } catch {
      if (!controller.signal.aborted) setSuggestions([])
    } finally {
      if (!controller.signal.aborted) setSearching(false)
    }
  }, [])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setTicker("")
    setSelectedCompany("")
    setActiveIndex(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 150)
  }

  const handleSelect = (result: NseSearchResult) => {
    setTicker(result.symbol)
    setQuery(result.symbol)
    setSelectedCompany(result.company_name)
    setShowDropdown(false)
    setSuggestions([])
    setActiveIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      const next = activeIndex < suggestions.length - 1 ? activeIndex + 1 : 0
      setActiveIndex(next)
      scrollToItem(next)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      const prev = activeIndex > 0 ? activeIndex - 1 : suggestions.length - 1
      setActiveIndex(prev)
      scrollToItem(prev)
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[activeIndex])
    } else if (e.key === "Escape") {
      setShowDropdown(false)
      setActiveIndex(-1)
    }
  }

  const scrollToItem = (index: number) => {
    if (!listRef.current) return
    const items = listRef.current.children
    if (items[index]) {
      ;(items[index] as HTMLElement).scrollIntoView({ block: "nearest" })
    }
  }

  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modalRef.current) return
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleEsc)
    document.addEventListener("keydown", handleTab)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleEsc)
      document.removeEventListener("keydown", handleTab)
    }
  }, [onClose])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const finalTicker = ticker || query.toUpperCase().trim()
    if (!finalTicker) {
      setError("Please select a stock from the suggestions")
      return
    }

    setSaving(true)
    try {
      await api.addBuy({
        member_id: memberId,
        ticker: finalTicker,
        buy_date: buyDate,
        buy_qty: parseFloat(qty),
        buy_rate: parseFloat(rate),
        notes: notes || undefined,
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add buy")
    } finally {
      setSaving(false)
    }
  }

  const inputClasses = "w-full px-3 py-2 rounded-lg text-[13px] bg-transparent transition-all duration-150 outline-none"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)" }} role="dialog" aria-modal="true" aria-label="Add Buy">
      <div
        ref={modalRef}
        className="rounded-xl w-full max-w-md mx-4 animate-slide-in"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-elevated)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Add Buy</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg cursor-pointer transition-colors duration-150 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
          >
            <X size={16} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div ref={dropdownRef} className="relative">
            <label htmlFor={`${uid}-ticker`} className="block text-[11px] font-semibold uppercase tracking-[0.06em] mb-1.5" style={{ color: "var(--text-muted)" }}>
              Stock (NSE Symbol)
            </label>
            <div className="relative">
              {searching ? (
                <Loader2
                  size={14}
                  strokeWidth={2}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none animate-spin"
                  style={{ color: "var(--color-profit)" }}
                />
              ) : (
                <Search
                  size={14}
                  strokeWidth={2}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--text-muted)" }}
                />
              )}
              <input
                ref={inputRef}
                id={`${uid}-ticker`}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowDropdown(true) }}
                onKeyDown={handleKeyDown}
                placeholder="Type to search e.g. RELIANCE, Infosys..."
                required
                autoComplete="off"
                role="combobox"
                aria-expanded={showDropdown}
                aria-controls={`${uid}-listbox`}
                aria-activedescendant={activeIndex >= 0 ? `${uid}-option-${activeIndex}` : undefined}
                className={`${inputClasses} pl-8 pr-8`}
                style={{
                  border: ticker ? "1px solid var(--color-profit)" : "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
              />
              {ticker && (
                <CheckCircle2
                  size={14}
                  strokeWidth={2.5}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--color-profit)" }}
                />
              )}
            </div>
            {selectedCompany && (
              <p className="text-[11px] mt-1 truncate" style={{ color: "var(--text-muted)" }}>
                {selectedCompany}
              </p>
            )}

            {showDropdown && (
              <div
                id={`${uid}-listbox`}
                role="listbox"
                className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden max-h-56 overflow-y-auto"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  boxShadow: "var(--shadow-elevated)",
                }}
                ref={listRef}
              >
                {suggestions.map((s, i) => (
                  <button
                    key={s.symbol}
                    id={`${uid}-option-${i}`}
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    onClick={() => handleSelect(s)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className="w-full text-left px-4 py-2.5 cursor-pointer transition-colors duration-75"
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      backgroundColor: i === activeIndex ? "var(--bg-elevated)" : "transparent",
                    }}
                  >
                    <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      <HighlightMatch text={s.symbol} query={query} />
                    </span>
                    <span className="text-[11px] ml-2" style={{ color: "var(--text-muted)" }}>
                      <HighlightMatch text={s.company_name} query={query} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${uid}-date`} className="block text-[11px] font-semibold uppercase tracking-[0.06em] mb-1.5" style={{ color: "var(--text-muted)" }}>
                Buy Date
              </label>
              <input
                id={`${uid}-date`}
                type="date"
                value={buyDate}
                onChange={(e) => setBuyDate(e.target.value)}
                required
                className={`${inputClasses} font-mono`}
                style={{
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label htmlFor={`${uid}-qty`} className="block text-[11px] font-semibold uppercase tracking-[0.06em] mb-1.5" style={{ color: "var(--text-muted)" }}>
                Quantity
              </label>
              <input
                id={`${uid}-qty`}
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                min="0.01"
                step="0.01"
                required
                className={`${inputClasses} font-mono tabular-nums`}
                style={{
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${uid}-rate`} className="block text-[11px] font-semibold uppercase tracking-[0.06em] mb-1.5" style={{ color: "var(--text-muted)" }}>
                Buy Rate (₹)
              </label>
              <input
                id={`${uid}-rate`}
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                min="0.01"
                step="0.01"
                required
                className={`${inputClasses} font-mono tabular-nums`}
                style={{
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] mb-1.5" style={{ color: "var(--text-muted)" }}>
                Buy Value (₹)
              </label>
              <div
                className="px-3 py-2 rounded-lg text-[13px] font-mono font-semibold tabular-nums"
                style={{
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--bg-elevated)",
                }}
              >
                {formatCurrency(parseFloat(buyValue))}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor={`${uid}-notes`} className="block text-[11px] font-semibold uppercase tracking-[0.06em] mb-1.5" style={{ color: "var(--text-muted)" }}>
              Notes (optional)
            </label>
            <input
              id={`${uid}-notes`}
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. IGL 1:1 BONUS"
              className={inputClasses}
              style={{
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {error && <FormError message={error} />}

          <SubmitButton loading={saving} label="Add Buy" loadingLabel="Adding..." fullWidth />
        </form>
      </div>
    </div>
  )
}
