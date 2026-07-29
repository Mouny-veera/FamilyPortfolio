import { useEffect, useState, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Play, Loader2, Search, TrendingUp, TrendingDown, Minus, GripVertical, SlidersHorizontal, Check, RotateCcw } from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { api, type ScanResult } from "@/lib/api"
import { formatNumber } from "@/lib/utils"
import { PageError } from "@/components/ui/PageError"

/* ────────────────────────────────────────────────────────────────
   Static style constants (hoisted to avoid re-creating objects
   on every render — only for style objects with no dynamic values)
   ──────────────────────────────────────────────────────────────── */

const textPrimary = { color: "var(--text-primary)" } as const
const textMuted = { color: "var(--text-muted)" } as const
const accentText = { color: "var(--color-accent)" } as const
const checkIconColor = { color: "var(--bg-card)" } as const
const dragHandle = { color: "var(--text-muted)", opacity: 0.4 } as const
const mutedIconFaded = { color: "var(--text-muted)", opacity: 0.5 } as const
const accentButton = { background: "var(--gradient-accent)", boxShadow: "var(--shadow-accent)" } as const
const cardPanel = { border: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)", boxShadow: "var(--shadow-card)" } as const
const dashedCardPanel = { border: "1px dashed var(--border-color)", backgroundColor: "var(--bg-card)" } as const
const spinnerBorder = { borderColor: "var(--accent-15)", borderTopColor: "var(--color-profit)" } as const
const noScrollbar = { scrollbarWidth: "none" } as const
const tabsRail = { backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" } as const
const tablePanel = { border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" } as const
const bgCard = { backgroundColor: "var(--bg-card)" } as const
const bgSecondary = { backgroundColor: "var(--bg-secondary)" } as const
const dropdownPanel = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-elevated)" } as const
const borderBottomSubtle = { borderBottom: "1px solid var(--border-subtle)" } as const
const accentTextTransparentBg = { color: "var(--color-accent)", backgroundColor: "transparent" } as const
const mutedTextTransparentBg = { color: "var(--text-muted)", backgroundColor: "transparent" } as const
const accentBadgeStrong = { backgroundColor: "var(--accent-20)", color: "var(--color-accent)" } as const
const accentProfitBadge = { backgroundColor: "var(--accent-10)", color: "var(--color-profit)" } as const
const secondaryMutedBadge = { backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)" } as const
const lossBadge = { backgroundColor: "var(--loss-10)", color: "var(--color-loss)" } as const
const warningBadge = { backgroundColor: "var(--warning-10)", color: "var(--color-warning)" } as const

function num(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null
}

function fmt(v: unknown, decimals = 2): string {
  const n = num(v)
  return n !== null ? n.toFixed(decimals) : "—"
}

function fmtPrice(v: unknown): string {
  const n = num(v)
  return n !== null ? `₹${formatNumber(n)}` : "—"
}

function fmtPct(v: unknown, decimals = 1, showSign = false): string {
  const n = num(v)
  if (n === null) return "—"
  const prefix = showSign && n > 0 ? "+" : ""
  return `${prefix}${n.toFixed(decimals)}%`
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : ""
}

/* ────────────────────────────────────────────────────────────────
   Column visibility system
   ──────────────────────────────────────────────────────────────── */

type ColDef = { id: string; label: string; defaultVisible?: boolean }

const STRATEGY_COLUMNS: Record<StrategyKey, ColDef[]> = {
  composite: [
    { id: "rank", label: "#" },
    { id: "ticker", label: "Ticker" },
    { id: "pe", label: "P/E" },
    { id: "peg", label: "PEG" },
    { id: "rating", label: "Rating" },
    { id: "score", label: "Score" },
    { id: "current", label: "Current" },
    { id: "breakdown", label: "Breakdown" },
    { id: "strategies", label: "Strategies" },
  ],
  supertrend: [
    { id: "rank", label: "#" },
    { id: "ticker", label: "Ticker" },
    { id: "pe", label: "P/E" },
    { id: "peg", label: "PEG" },
    { id: "score", label: "Score" },
    { id: "current", label: "Current" },
    { id: "st_level", label: "ST Level" },
    { id: "direction", label: "Direction" },
    { id: "streak", label: "Streak" },
    { id: "signal", label: "Signal" },
  ],
  adx: [
    { id: "rank", label: "#" },
    { id: "ticker", label: "Ticker" },
    { id: "pe", label: "P/E" },
    { id: "peg", label: "PEG" },
    { id: "score", label: "Score" },
    { id: "current", label: "Current" },
    { id: "adx", label: "ADX" },
    { id: "plus_di", label: "+DI" },
    { id: "minus_di", label: "-DI" },
    { id: "trend", label: "Trend" },
    { id: "signal", label: "Signal" },
  ],
  rsi: [
    { id: "rank", label: "#" },
    { id: "ticker", label: "Ticker" },
    { id: "pe", label: "P/E" },
    { id: "peg", label: "PEG" },
    { id: "score", label: "Score" },
    { id: "current", label: "Current" },
    { id: "rsi", label: "RSI" },
    { id: "trend", label: "Trend" },
    { id: "signal", label: "Signal" },
  ],
  macd: [
    { id: "rank", label: "#" },
    { id: "ticker", label: "Ticker" },
    { id: "pe", label: "P/E" },
    { id: "peg", label: "PEG" },
    { id: "score", label: "Score" },
    { id: "current", label: "Current" },
    { id: "macd", label: "MACD" },
    { id: "signal_line", label: "Signal" },
    { id: "histogram", label: "Histogram" },
    { id: "trend", label: "Trend" },
  ],
  stochastic: [
    { id: "rank", label: "#" },
    { id: "ticker", label: "Ticker" },
    { id: "pe", label: "P/E" },
    { id: "peg", label: "PEG" },
    { id: "score", label: "Score" },
    { id: "current", label: "Current" },
    { id: "pct_k", label: "%K" },
    { id: "pct_d", label: "%D" },
    { id: "zone", label: "Zone" },
    { id: "signal", label: "Signal" },
  ],
  fibonacci_retracement: [
    { id: "rank", label: "#" },
    { id: "ticker", label: "Ticker" },
    { id: "pe", label: "P/E" },
    { id: "peg", label: "PEG" },
    { id: "score", label: "Score" },
    { id: "current", label: "Current" },
    { id: "high", label: "52W High" },
    { id: "low", label: "52W Low" },
    { id: "fib_618", label: "Fib 0.618" },
    { id: "signal", label: "Signal" },
  ],
  bollinger: [
    { id: "rank", label: "#" },
    { id: "ticker", label: "Ticker" },
    { id: "pe", label: "P/E" },
    { id: "peg", label: "PEG" },
    { id: "score", label: "Score" },
    { id: "current", label: "Current" },
    { id: "upper", label: "Upper" },
    { id: "sma", label: "SMA(20)" },
    { id: "lower", label: "Lower" },
    { id: "pct_b", label: "%B" },
    { id: "squeeze", label: "Squeeze" },
    { id: "signal", label: "Signal" },
  ],
  "52w_high": [
    { id: "rank", label: "#" },
    { id: "ticker", label: "Ticker" },
    { id: "pe", label: "P/E" },
    { id: "peg", label: "PEG" },
    { id: "score", label: "Score" },
    { id: "current", label: "Current" },
    { id: "high_52w", label: "52W High" },
    { id: "low_52w", label: "52W Low" },
    { id: "from_high", label: "From High" },
    { id: "range", label: "Range %" },
    { id: "signal", label: "Signal" },
  ],
  "52w_low": [
    { id: "rank", label: "#" },
    { id: "ticker", label: "Ticker" },
    { id: "pe", label: "P/E" },
    { id: "peg", label: "PEG" },
    { id: "score", label: "Score" },
    { id: "current", label: "Current" },
    { id: "low_52w", label: "52W Low" },
    { id: "high_52w", label: "52W High" },
    { id: "from_low", label: "From Low" },
    { id: "range", label: "Range %" },
    { id: "signal", label: "Signal" },
  ],
  pivot_point: [
    { id: "rank", label: "#" },
    { id: "ticker", label: "Ticker" },
    { id: "pe", label: "P/E" },
    { id: "peg", label: "PEG" },
    { id: "score", label: "Score" },
    { id: "current", label: "Current" },
    { id: "pivot", label: "Pivot" },
    { id: "s1", label: "S1" },
    { id: "s2", label: "S2" },
    { id: "r1", label: "R1" },
    { id: "r2", label: "R2" },
    { id: "signal", label: "Signal" },
  ],
}

const COL_VIS_KEY = "fp-scanner-col-vis"

function loadColumnVisibility(strategy: StrategyKey): Set<string> {
  try {
    const saved = localStorage.getItem(COL_VIS_KEY)
    if (saved) {
      const all = JSON.parse(saved) as Record<string, string[]>
      if (all[strategy]) return new Set(all[strategy])
    }
  } catch { /* ignore */ }
  const cols = STRATEGY_COLUMNS[strategy]
  return new Set(cols.filter(c => c.defaultVisible !== false).map(c => c.id))
}

function saveColumnVisibility(strategy: StrategyKey, visible: Set<string>) {
  try {
    const saved = localStorage.getItem(COL_VIS_KEY)
    const all = saved ? JSON.parse(saved) as Record<string, string[]> : {}
    all[strategy] = [...visible]
    localStorage.setItem(COL_VIS_KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

function useColumnVisibility(strategy: StrategyKey) {
  const [visible, setVisible] = useState<Set<string>>(() => loadColumnVisibility(strategy))
  const [prevStrategy, setPrevStrategy] = useState(strategy)

  if (strategy !== prevStrategy) {
    setPrevStrategy(strategy)
    setVisible(loadColumnVisibility(strategy))
  }

  const toggle = useCallback((colId: string) => {
    setVisible(prev => {
      const next = new Set(prev)
      if (next.has(colId)) {
        if (next.size > 2) next.delete(colId)
      } else {
        next.add(colId)
      }
      saveColumnVisibility(strategy, next)
      return next
    })
  }, [strategy])

  const reset = useCallback(() => {
    const cols = STRATEGY_COLUMNS[strategy]
    const defaults = new Set(cols.filter(c => c.defaultVisible !== false).map(c => c.id))
    setVisible(defaults)
    saveColumnVisibility(strategy, defaults)
  }, [strategy])

  const showAll = useCallback(() => {
    const cols = STRATEGY_COLUMNS[strategy]
    const all = new Set(cols.map(c => c.id))
    setVisible(all)
    saveColumnVisibility(strategy, all)
  }, [strategy])

  return { visible, toggle, reset, showAll }
}

function ColumnToggle({
  strategy,
  visible,
  onToggle,
  onReset,
  onShowAll,
}: {
  strategy: StrategyKey
  visible: Set<string>
  onToggle: (id: string) => void
  onReset: () => void
  onShowAll: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const cols = STRATEGY_COLUMNS[strategy]
  const totalCols = cols.length
  const visibleCount = cols.filter(c => visible.has(c.id)).length
  const allVisible = visibleCount === totalCols

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition-all duration-150"
        style={{
          backgroundColor: !allVisible ? "var(--accent-15)" : "var(--bg-secondary)",
          color: !allVisible ? "var(--color-accent)" : "var(--text-muted)",
          border: !allVisible ? "1px solid var(--accent-20)" : "1px solid var(--border-color)",
        }}
      >
        <SlidersHorizontal size={13} strokeWidth={2} />
        Columns
        {!allVisible && (
          <span
            className="text-[10px] font-semibold px-1 py-0 rounded"
            style={accentBadgeStrong}
          >
            {visibleCount}/{totalCols}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 rounded-xl py-1.5 min-w-[200px] animate-fade-in"
          style={dropdownPanel}
        >
          <div className="px-3 py-2 flex items-center justify-between" style={borderBottomSubtle}>
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={textMuted}>
              Toggle Columns
            </span>
            <div className="flex gap-1">
              <button
                onClick={onShowAll}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                style={accentTextTransparentBg}
              >
                All
              </button>
              <button
                onClick={onReset}
                className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                style={mutedTextTransparentBg}
              >
                <RotateCcw size={9} strokeWidth={2} />
                Reset
              </button>
            </div>
          </div>
          {cols.map(col => {
            const isVisible = visible.has(col.id)
            const isLocked = col.id === "ticker"
            return (
              <button
                key={col.id}
                onClick={() => !isLocked && onToggle(col.id)}
                disabled={isLocked}
                className="flex items-center gap-2.5 w-full px-3 py-1.5 min-h-[44px] text-left text-[12px] cursor-pointer transition-colors duration-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] disabled:opacity-40 disabled:cursor-default"
                style={{ color: isVisible ? "var(--text-primary)" : "var(--text-muted)" }}
              >
                <span
                  className="flex items-center justify-center w-4 h-4 rounded shrink-0"
                  style={{
                    backgroundColor: isVisible ? "var(--color-accent)" : "transparent",
                    border: isVisible ? "none" : "1.5px solid var(--border-color)",
                  }}
                >
                  {isVisible && <Check size={10} strokeWidth={3} style={checkIconColor} />}
                </span>
                {col.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

type FundamentalsMap = Record<string, { pe_ratio: number | null; peg_ratio: number | null }>

function PECell({ ticker, fundamentals }: { ticker: string; fundamentals: FundamentalsMap }) {
  const f = fundamentals[ticker]
  const pe = f?.pe_ratio
  if (pe == null) return <TD mono align="right" color="var(--text-muted)">—</TD>
  const color = pe < 0 ? "var(--color-loss)" : pe > 40 ? "var(--color-warning, var(--text-muted))" : "var(--text-primary)"
  return <TD mono align="right" color={color}>{pe.toFixed(1)}</TD>
}

function PEGCell({ ticker, fundamentals }: { ticker: string; fundamentals: FundamentalsMap }) {
  const f = fundamentals[ticker]
  const peg = f?.peg_ratio
  if (peg == null) return <TD mono align="right" color="var(--text-muted)">—</TD>
  const color = peg < 1 ? "var(--color-profit)" : peg > 2 ? "var(--color-loss)" : "var(--text-primary)"
  return <TD mono align="right" color={color}>{peg.toFixed(2)}</TD>
}

type StrategyKey =
  | "composite"
  | "supertrend"
  | "adx"
  | "rsi"
  | "macd"
  | "stochastic"
  | "fibonacci_retracement"
  | "bollinger"
  | "52w_high"
  | "52w_low"
  | "pivot_point"

const DEFAULT_TAB_ORDER: StrategyKey[] = [
  "fibonacci_retracement",
  "bollinger",
  "pivot_point",
  "rsi",
  "macd",
  "52w_high",
  "52w_low",
  "supertrend",
  "adx",
  "composite",
  "stochastic",
]

const TAB_META: Record<StrategyKey, { label: string }> = {
  fibonacci_retracement: { label: "Fibonacci" },
  bollinger: { label: "Bollinger" },
  pivot_point: { label: "Pivot Point" },
  rsi: { label: "RSI" },
  macd: { label: "MACD" },
  "52w_high": { label: "52W High" },
  "52w_low": { label: "52W Low" },
  supertrend: { label: "SuperTrend" },
  adx: { label: "ADX" },
  composite: { label: "Composite" },
  stochastic: { label: "Stochastic" },
}

const TAB_ORDER_KEY = "fp-scanner-tab-order"

function loadTabOrder(): StrategyKey[] {
  try {
    const saved = localStorage.getItem(TAB_ORDER_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as StrategyKey[]
      if (Array.isArray(parsed) && parsed.length === DEFAULT_TAB_ORDER.length && parsed.every(k => k in TAB_META)) {
        return parsed
      }
    }
  } catch { /* ignore */ }
  return [...DEFAULT_TAB_ORDER]
}

function saveTabOrder(order: StrategyKey[]) {
  localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(order))
}

function SortableTab({ id, label, count, isActive, onClick }: {
  id: StrategyKey
  label: string
  count: number
  isActive: boolean
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center">
      <button
        id={`tab-${id}`}
        role="tab"
        aria-selected={isActive}
        aria-controls={`tabpanel-${id}`}
        onClick={onClick}
        className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] lg:min-h-0 rounded-md text-[12px] font-medium cursor-pointer transition-all duration-200 whitespace-nowrap"
        style={{
          backgroundColor: isActive ? "var(--bg-card)" : "transparent",
          color: isActive ? "var(--text-primary)" : "var(--text-muted)",
          boxShadow: isActive ? "var(--shadow-card)" : "none",
          border: isActive ? "1px solid var(--border-color)" : "1px solid transparent",
        }}
      >
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none flex items-center"
          style={dragHandle}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} strokeWidth={2} />
        </span>
        {id === "composite" && <TrendingUp size={13} strokeWidth={2} />}
        {label}
        {count > 0 && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
            style={{
              backgroundColor: isActive ? "var(--accent-10)" : "var(--bg-secondary)",
              color: isActive ? "var(--color-profit)" : "var(--text-muted)",
            }}
          >
            {count}
          </span>
        )}
      </button>
    </div>
  )
}

export function ScannerPage() {
  const [results, setResults] = useState<ScanResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [activeTab, setActiveTab] = useState<StrategyKey>("fibonacci_retracement")
  const [tabOrder, setTabOrder] = useState<StrategyKey[]>(loadTabOrder)
  const [fundamentals, setFundamentals] = useState<FundamentalsMap>({})
  const { visible: visibleCols, toggle: toggleCol, reset: resetCols, showAll: showAllCols } = useColumnVisibility(activeTab)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setTabOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as StrategyKey)
        const newIndex = prev.indexOf(over.id as StrategyKey)
        const next = arrayMove(prev, oldIndex, newIndex)
        saveTabOrder(next)
        return next
      })
    }
  }

  const fetchResults = useCallback(() => {
    api.getScanResults()
      .then((r) => { setResults(r); setError(null) })
      .catch((e) => { console.error(e); setError(e?.message || "Failed to load scanner results") })
      .finally(() => setLoading(false))
  }, [])

  const fetchFundamentals = useCallback(() => {
    api.getFundamentals()
      .then((data) => setFundamentals(data))
      .catch(() => { /* fundamentals are supplementary, don't block UI */ })
  }, [])

  useEffect(() => { fetchResults(); fetchFundamentals() }, [fetchResults, fetchFundamentals])

  useEffect(() => {
    const handler = () => fetchResults()
    window.addEventListener("prices-refreshed", handler)
    return () => window.removeEventListener("prices-refreshed", handler)
  }, [fetchResults])

  const handleScan = async () => {
    setScanning(true)
    try {
      await api.runScanner()
      const poll = setInterval(async () => {
        try {
          const status = await api.getScanStatus()
          if (!status.running) {
            clearInterval(poll)
            if (status.error) {
              console.error("Scan error:", status.error)
            }
            const fresh = await api.getScanResults()
            setResults(fresh)
            setScanning(false)
          }
        } catch {
          clearInterval(poll)
          setScanning(false)
        }
      }, 5000)
    } catch (e) {
      console.error(e)
      setScanning(false)
    }
  }

  const filtered = results.filter((r) => r.strategy_name === activeTab)
  const lastScan = results.length > 0 ? results[0].scanned_at : null

  if (error && !scanning) {
    return <PageError error={error} onRetry={() => { setLoading(true); fetchResults() }} />
  }

  return (
    <div className="animate-page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={textPrimary}>
            Scanner
          </h1>
          <p className="text-[12px] mt-0.5" style={textMuted}>
            Technical analysis on Nifty 500 — 11 strategies, composite scoring
            {lastScan && (
              <span className="ml-2">
                · Last scan {new Date(lastScan).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-all duration-150 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          style={accentButton}
        >
          {scanning ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} strokeWidth={2} />}
          {scanning ? "Scanning..." : "Run Scanner"}
        </button>
      </div>

      {scanning && (
        <div
          className="text-center py-12 rounded-xl mb-4"
          style={cardPanel}
        >
          <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto mb-3" style={spinnerBorder} />
          <p className="text-[13px] font-medium" style={textPrimary}>
            Scanning Nifty 500 across 11 strategies...
          </p>
          <p className="text-[11px] mt-1" style={textMuted}>
            This may take a few minutes due to rate limits.
          </p>
        </div>
      )}

      {!loading && results.length === 0 && !scanning && (
        <div
          className="text-center py-16 rounded-xl"
          style={dashedCardPanel}
        >
          <Search size={28} strokeWidth={1.5} className="mx-auto mb-3" style={mutedIconFaded} />
          <p className="text-[13px] font-medium" style={textPrimary}>No scan results yet</p>
          <p className="text-[12px] mt-1 mb-4" style={textMuted}>Run the scanner to find top picks across 11 strategies.</p>
          <button
            onClick={handleScan}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-all duration-150 hover:brightness-110"
            style={accentButton}
          >
            <Play size={15} strokeWidth={2} />
            Run Scanner
          </button>
        </div>
      )}

      {results.length > 0 && (
        <>
          {/* Strategy Tabs — drag to reorder */}
          <div className="mb-4 overflow-x-auto" style={noScrollbar}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={tabOrder} strategy={horizontalListSortingStrategy}>
                <div
                  className="flex gap-1 p-1 rounded-lg w-max min-w-full"
                  role="tablist"
                  aria-label="Scanner strategies"
                  style={tabsRail}
                >
                  {tabOrder.map((key) => (
                    <SortableTab
                      key={key}
                      id={key}
                      label={TAB_META[key].label}
                      count={results.filter((r) => r.strategy_name === key).length}
                      isActive={activeTab === key}
                      onClick={() => setActiveTab(key)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Result count + column toggle */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px]" style={textMuted}>
              {filtered.length} results
            </span>
            <ColumnToggle
              strategy={activeTab}
              visible={visibleCols}
              onToggle={toggleCol}
              onReset={resetCols}
              onShowAll={showAllCols}
            />
          </div>

          {/* Results Table */}
          <div
            className="rounded-xl overflow-hidden"
            style={tablePanel}
          >
            {filtered.length === 0 ? (
              <div className="text-center py-10" style={bgCard}>
                <p className="text-[12px]" style={textMuted}>
                  No results for this indicator. Run the scanner to generate data.
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto" id={`tabpanel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
                {activeTab === "composite" && <CompositeTable results={filtered} fundamentals={fundamentals} vis={visibleCols} />}
                {activeTab === "supertrend" && <SuperTrendTable results={filtered} fundamentals={fundamentals} vis={visibleCols} />}
                {activeTab === "adx" && <ADXTable results={filtered} fundamentals={fundamentals} vis={visibleCols} />}
                {activeTab === "rsi" && <RSITable results={filtered} fundamentals={fundamentals} vis={visibleCols} />}
                {activeTab === "macd" && <MACDTable results={filtered} fundamentals={fundamentals} vis={visibleCols} />}
                {activeTab === "stochastic" && <StochasticTable results={filtered} fundamentals={fundamentals} vis={visibleCols} />}
                {activeTab === "fibonacci_retracement" && <FibTable results={filtered} fundamentals={fundamentals} vis={visibleCols} />}
                {activeTab === "bollinger" && <BollingerTable results={filtered} fundamentals={fundamentals} vis={visibleCols} />}
                {activeTab === "52w_high" && <High52WTable results={filtered} fundamentals={fundamentals} vis={visibleCols} />}
                {activeTab === "52w_low" && <Low52WTable results={filtered} fundamentals={fundamentals} vis={visibleCols} />}
                {activeTab === "pivot_point" && <PivotTable results={filtered} fundamentals={fundamentals} vis={visibleCols} />}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────
   Shared table primitives
   ──────────────────────────────────────────────────────────────── */

type TableProps = { results: ScanResult[]; fundamentals: FundamentalsMap; vis: Set<string> }

function TH({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th
      scope="col"
      className={`text-${align} px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap`}
      style={textMuted}
    >
      {children}
    </th>
  )
}

function TD({ children, mono, align = "left", color }: { children: React.ReactNode; mono?: boolean; align?: "left" | "right" | "center"; color?: string }) {
  return (
    <td
      className={`px-5 py-2.5 ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${mono ? "font-mono tabular-nums" : ""} whitespace-nowrap`}
      style={{ color: color || "var(--text-primary)" }}
    >
      {children}
    </td>
  )
}

function TickerCell({ ticker }: { ticker: string }) {
  const navigate = useNavigate()
  return (
    <td className="px-5 py-2.5 whitespace-nowrap">
      <button
        onClick={() => navigate(`/stock/${ticker}`)}
        className="font-semibold cursor-pointer transition-colors bg-transparent border-none p-0"
        style={accentText}
      >
        {ticker}
      </button>
    </td>
  )
}

function SignalBadge({ signal, variant }: { signal: string; variant: "bullish" | "bearish" | "neutral" | "warning" }) {
  const colors = {
    bullish: { bg: "var(--accent-10)", color: "var(--color-profit)" },
    bearish: { bg: "var(--loss-10)", color: "var(--color-loss)" },
    neutral: { bg: "var(--bg-secondary)", color: "var(--text-muted)" },
    warning: { bg: "var(--warning-10)", color: "var(--color-warning)" },
  }
  const c = colors[variant]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      {signal}
    </span>
  )
}

function ScoreCell({ score }: { score: number }) {
  const n = num(score)
  const color = n !== null && n >= 70 ? "var(--color-profit)" : n !== null && n <= 30 ? "var(--color-loss)" : "var(--text-primary)"
  return <TD mono align="right" color={color}>{fmt(score, 1)}</TD>
}

function RatingBadge({ rating }: { rating: string }) {
  const config: Record<string, { bg: string; color: string }> = {
    "Strong Buy": { bg: "var(--accent-10)", color: "var(--color-profit)" },
    "Buy": { bg: "var(--accent-10)", color: "var(--color-profit)" },
    "Neutral": { bg: "var(--bg-secondary)", color: "var(--text-muted)" },
    "Sell": { bg: "var(--loss-10)", color: "var(--color-loss)" },
    "Strong Sell": { bg: "var(--loss-10)", color: "var(--color-loss)" },
  }
  const c = config[rating] || config["Neutral"]
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      {rating === "Strong Buy" || rating === "Buy" ? (
        <TrendingUp size={12} strokeWidth={2.5} />
      ) : rating === "Strong Sell" || rating === "Sell" ? (
        <TrendingDown size={12} strokeWidth={2.5} />
      ) : (
        <Minus size={12} strokeWidth={2.5} />
      )}
      {rating}
    </span>
  )
}

function CategoryBar({ score, label }: { score: number; label: string }) {
  const n = num(score) ?? 0
  const color = n >= 60 ? "var(--color-profit)" : n <= 40 ? "var(--color-loss)" : "var(--text-muted)"
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <span className="text-[10px] font-medium w-16 text-right" style={textMuted}>
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={bgSecondary}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(2, n)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-mono tabular-nums w-8" style={{ color }}>
        {fmt(score, 0)}
      </span>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────
   Composite Table
   ──────────────────────────────────────────────────────────────── */

function CompositeTable({ results, fundamentals, vis }: TableProps) {
  const sorted = [...results].sort((a, b) => b.score - a.score)
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr style={bgCard}>
          {vis.has("rank") && <TH>#</TH>}
          {vis.has("ticker") && <TH>Ticker</TH>}
          {vis.has("pe") && <TH align="right">P/E</TH>}
          {vis.has("peg") && <TH align="right">PEG</TH>}
          {vis.has("rating") && <TH align="center">Rating</TH>}
          {vis.has("score") && <TH align="right">Score</TH>}
          {vis.has("current") && <TH align="right">Current</TH>}
          {vis.has("breakdown") && <TH align="center">Category Breakdown</TH>}
          {vis.has("strategies") && <TH align="right">Strategies</TH>}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r, i) => {
          const m = (r.metrics || {}) as Record<string, unknown>
          const cats = (m.category_scores || {}) as Record<string, number>
          return (
            <tr
              key={r.id}
              className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}
            >
              {vis.has("rank") && <TD mono color="var(--text-muted)">{i + 1}</TD>}
              {vis.has("ticker") && <TickerCell ticker={r.ticker} />}
              {vis.has("pe") && <PECell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("peg") && <PEGCell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("rating") && <td className="px-5 py-2.5 text-center whitespace-nowrap"><RatingBadge rating={safeStr(m.rating) || "Neutral"} /></td>}
              {vis.has("score") && <ScoreCell score={r.score} />}
              {vis.has("current") && <TD mono align="right">{fmtPrice(m.current)}</TD>}
              {vis.has("breakdown") && <td className="px-4 py-2.5"><div className="flex flex-col gap-1">{Object.entries(cats).map(([cat, score]) => (<CategoryBar key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)} score={score} />))}</div></td>}
              {vis.has("strategies") && <TD mono align="right" color="var(--text-muted)">{num(m.strategies_used) ?? 0}/11</TD>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ────────────────────────────────────────────────────────────────
   SuperTrend Table
   ──────────────────────────────────────────────────────────────── */

function SuperTrendTable({ results, fundamentals, vis }: TableProps) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr style={bgCard}>
          {vis.has("rank") && <TH>#</TH>}
          {vis.has("ticker") && <TH>Ticker</TH>}
          {vis.has("pe") && <TH align="right">P/E</TH>}
          {vis.has("peg") && <TH align="right">PEG</TH>}
          {vis.has("score") && <TH align="right">Score</TH>}
          {vis.has("current") && <TH align="right">Current</TH>}
          {vis.has("st_level") && <TH align="right">ST Level</TH>}
          {vis.has("direction") && <TH align="center">Direction</TH>}
          {vis.has("streak") && <TH align="right">Streak</TH>}
          {vis.has("signal") && <TH align="center">Signal</TH>}
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const m = (r.metrics || {}) as Record<string, unknown>
          const dir = safeStr(m.direction)
          const signal = safeStr(m.signal)
          const variant = signal === "bullish_flip" ? "bullish"
            : signal === "bearish_flip" ? "bearish"
            : dir === "bullish" ? "bullish" : "bearish"
          const signalLabel: Record<string, string> = {
            bullish_flip: "Bullish Flip",
            bearish_flip: "Bearish Flip",
            bullish: "Bullish",
            bearish: "Bearish",
          }
          return (
            <tr
              key={r.id}
              className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}
            >
              {vis.has("rank") && <TD mono color="var(--text-muted)">{i + 1}</TD>}
              {vis.has("ticker") && <TickerCell ticker={r.ticker} />}
              {vis.has("pe") && <PECell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("peg") && <PEGCell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("score") && <ScoreCell score={r.score} />}
              {vis.has("current") && <TD mono align="right">{fmtPrice(m.current)}</TD>}
              {vis.has("st_level") && <TD mono align="right">{fmtPrice(m.supertrend)}</TD>}
              {vis.has("direction") && <td className="px-5 py-2.5 text-center whitespace-nowrap"><span className="text-[11px] font-medium" style={{ color: dir === "bullish" ? "var(--color-profit)" : "var(--color-loss)" }}>{dir === "bullish" ? "▲" : "▼"} {dir ? dir.charAt(0).toUpperCase() + dir.slice(1) : "—"}</span></td>}
              {vis.has("streak") && <TD mono align="right">{num(m.streak) ?? "—"}</TD>}
              {vis.has("signal") && <td className="px-5 py-2.5 text-center whitespace-nowrap"><SignalBadge signal={signalLabel[signal] || signal} variant={variant} /></td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ────────────────────────────────────────────────────────────────
   ADX Table
   ──────────────────────────────────────────────────────────────── */

function ADXTable({ results, fundamentals, vis }: TableProps) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr style={bgCard}>
          {vis.has("rank") && <TH>#</TH>}
          {vis.has("ticker") && <TH>Ticker</TH>}
          {vis.has("pe") && <TH align="right">P/E</TH>}
          {vis.has("peg") && <TH align="right">PEG</TH>}
          {vis.has("score") && <TH align="right">Score</TH>}
          {vis.has("current") && <TH align="right">Current</TH>}
          {vis.has("adx") && <TH align="right">ADX</TH>}
          {vis.has("plus_di") && <TH align="right">+DI</TH>}
          {vis.has("minus_di") && <TH align="right">-DI</TH>}
          {vis.has("trend") && <TH align="center">Trend</TH>}
          {vis.has("signal") && <TH align="center">Signal</TH>}
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const m = (r.metrics || {}) as Record<string, unknown>
          const trending = !!m.trending
          const signal = safeStr(m.signal)
          const variant = signal.includes("bullish") || signal === "strong_uptrend" || signal === "uptrend"
            ? "bullish"
            : signal.includes("bearish") || signal === "downtrend"
              ? "bearish"
              : signal === "ranging" ? "warning" : "neutral"
          const signalLabel: Record<string, string> = {
            strong_bullish_cross: "Strong Bull Cross",
            strong_uptrend: "Strong Uptrend",
            uptrend: "Uptrend",
            weak_bullish_cross: "Weak Bull Cross",
            ranging: "Ranging",
            strong_bearish_cross: "Strong Bear Cross",
            downtrend: "Downtrend",
            neutral: "Neutral",
          }
          return (
            <tr
              key={r.id}
              className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}
            >
              {vis.has("rank") && <TD mono color="var(--text-muted)">{i + 1}</TD>}
              {vis.has("ticker") && <TickerCell ticker={r.ticker} />}
              {vis.has("pe") && <PECell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("peg") && <PEGCell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("score") && <ScoreCell score={r.score} />}
              {vis.has("current") && <TD mono align="right">{fmtPrice(m.current)}</TD>}
              {vis.has("adx") && <td className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: trending ? "var(--color-profit)" : "var(--text-muted)" }}>{fmt(m.adx, 1)}</td>}
              {vis.has("plus_di") && <TD mono align="right" color="var(--color-profit)">{fmt(m.plus_di, 1)}</TD>}
              {vis.has("minus_di") && <TD mono align="right" color="var(--color-loss)">{fmt(m.minus_di, 1)}</TD>}
              {vis.has("trend") && <td className="px-5 py-2.5 text-center whitespace-nowrap">{trending ? (<span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={accentProfitBadge}>TRENDING</span>) : (<span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={secondaryMutedBadge}>RANGING</span>)}</td>}
              {vis.has("signal") && <td className="px-5 py-2.5 text-center whitespace-nowrap"><SignalBadge signal={signalLabel[signal] || signal} variant={variant} /></td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ────────────────────────────────────────────────────────────────
   Stochastic Table
   ──────────────────────────────────────────────────────────────── */

function StochasticTable({ results, fundamentals, vis }: TableProps) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr style={bgCard}>
          {vis.has("rank") && <TH>#</TH>}
          {vis.has("ticker") && <TH>Ticker</TH>}
          {vis.has("pe") && <TH align="right">P/E</TH>}
          {vis.has("peg") && <TH align="right">PEG</TH>}
          {vis.has("score") && <TH align="right">Score</TH>}
          {vis.has("current") && <TH align="right">Current</TH>}
          {vis.has("pct_k") && <TH align="right">%K</TH>}
          {vis.has("pct_d") && <TH align="right">%D</TH>}
          {vis.has("zone") && <TH align="center">Zone</TH>}
          {vis.has("signal") && <TH align="center">Signal</TH>}
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const m = (r.metrics || {}) as Record<string, unknown>
          const k = num(m.pct_k)
          const signal = safeStr(m.signal)
          const kColor = k !== null && k <= 20 ? "var(--color-profit)" : k !== null && k >= 80 ? "var(--color-loss)" : "var(--text-primary)"
          const variant = signal.includes("bullish") || signal === "oversold_recovering" || signal === "oversold"
            ? "bullish"
            : signal.includes("bearish") || signal === "overbought"
              ? "bearish"
              : "neutral"
          const signalLabel: Record<string, string> = {
            bullish_cross_oversold: "Bull Cross (OS)",
            bullish_cross: "Bullish Cross",
            oversold_recovering: "OS Recovering",
            oversold: "Oversold",
            bearish_cross_overbought: "Bear Cross (OB)",
            bearish_cross: "Bearish Cross",
            overbought: "Overbought",
            bullish_zone: "Bullish Zone",
            bearish_zone: "Bearish Zone",
          }
          return (
            <tr
              key={r.id}
              className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}
            >
              {vis.has("rank") && <TD mono color="var(--text-muted)">{i + 1}</TD>}
              {vis.has("ticker") && <TickerCell ticker={r.ticker} />}
              {vis.has("pe") && <PECell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("peg") && <PEGCell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("score") && <ScoreCell score={r.score} />}
              {vis.has("current") && <TD mono align="right">{fmtPrice(m.current)}</TD>}
              {vis.has("pct_k") && <td className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: kColor }}>{fmt(m.pct_k, 1)}</td>}
              {vis.has("pct_d") && <TD mono align="right">{fmt(m.pct_d, 1)}</TD>}
              {vis.has("zone") && <td className="px-5 py-2.5 text-center whitespace-nowrap">{m.oversold ? (<span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={accentProfitBadge}>OVERSOLD</span>) : m.overbought ? (<span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={lossBadge}>OVERBOUGHT</span>) : (<span className="text-[10px]" style={textMuted}>—</span>)}</td>}
              {vis.has("signal") && <td className="px-5 py-2.5 text-center whitespace-nowrap"><SignalBadge signal={signalLabel[signal] || signal} variant={variant} /></td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ────────────────────────────────────────────────────────────────
   Bollinger Table
   ──────────────────────────────────────────────────────────────── */

function BollingerTable({ results, fundamentals, vis }: TableProps) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr style={bgCard}>
          {vis.has("rank") && <TH>#</TH>}
          {vis.has("ticker") && <TH>Ticker</TH>}
          {vis.has("pe") && <TH align="right">P/E</TH>}
          {vis.has("peg") && <TH align="right">PEG</TH>}
          {vis.has("score") && <TH align="right">Score</TH>}
          {vis.has("current") && <TH align="right">Current</TH>}
          {vis.has("upper") && <TH align="right">Upper</TH>}
          {vis.has("sma") && <TH align="right">SMA(20)</TH>}
          {vis.has("lower") && <TH align="right">Lower</TH>}
          {vis.has("pct_b") && <TH align="right">%B</TH>}
          {vis.has("squeeze") && <TH align="center">Squeeze</TH>}
          {vis.has("signal") && <TH align="center">Signal</TH>}
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const m = (r.metrics || {}) as Record<string, unknown>
          const pctB = num(m.pct_b)
          const signal = safeStr(m.signal)
          const variant = signal.includes("bounce") || signal.includes("near_lower") || signal === "below_lower"
            ? "bullish"
            : signal === "above_upper" || signal === "near_upper"
              ? "bearish"
              : signal === "squeeze" ? "warning" : "neutral"
          const signalLabel: Record<string, string> = {
            bounce_below_lower: "Bounce Below",
            below_lower: "Below Lower",
            near_lower_recovering: "Near Lower ↑",
            squeeze: "Squeeze",
            above_upper: "Above Upper",
            near_upper: "Near Upper",
            mid_band: "Mid Band",
            lower_half: "Lower Half",
            upper_half: "Upper Half",
          }
          return (
            <tr
              key={r.id}
              className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}
            >
              {vis.has("rank") && <TD mono color="var(--text-muted)">{i + 1}</TD>}
              {vis.has("ticker") && <TickerCell ticker={r.ticker} />}
              {vis.has("pe") && <PECell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("peg") && <PEGCell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("score") && <ScoreCell score={r.score} />}
              {vis.has("current") && <TD mono align="right">{fmtPrice(m.current)}</TD>}
              {vis.has("upper") && <TD mono align="right">{fmtPrice(m.upper)}</TD>}
              {vis.has("sma") && <TD mono align="right">{fmtPrice(m.sma)}</TD>}
              {vis.has("lower") && <TD mono align="right">{fmtPrice(m.lower)}</TD>}
              {vis.has("pct_b") && <td className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: pctB !== null && pctB < 0.2 ? "var(--color-profit)" : pctB !== null && pctB > 0.8 ? "var(--color-loss)" : "var(--text-primary)" }}>{fmt(m.pct_b, 3)}</td>}
              {vis.has("squeeze") && <td className="px-5 py-2.5 text-center whitespace-nowrap">{m.squeeze ? (<span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={warningBadge}>SQUEEZE</span>) : (<span className="text-[10px]" style={textMuted}>—</span>)}</td>}
              {vis.has("signal") && <td className="px-5 py-2.5 text-center whitespace-nowrap"><SignalBadge signal={signalLabel[signal] || signal} variant={variant} /></td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ────────────────────────────────────────────────────────────────
   52W High Table
   ──────────────────────────────────────────────────────────────── */

function High52WTable({ results, fundamentals, vis }: TableProps) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr style={bgCard}>
          {vis.has("rank") && <TH>#</TH>}
          {vis.has("ticker") && <TH>Ticker</TH>}
          {vis.has("pe") && <TH align="right">P/E</TH>}
          {vis.has("peg") && <TH align="right">PEG</TH>}
          {vis.has("score") && <TH align="right">Score</TH>}
          {vis.has("current") && <TH align="right">Current</TH>}
          {vis.has("high_52w") && <TH align="right">52W High</TH>}
          {vis.has("low_52w") && <TH align="right">52W Low</TH>}
          {vis.has("from_high") && <TH align="right">From High</TH>}
          {vis.has("range") && <TH align="right">Range %</TH>}
          {vis.has("signal") && <TH align="center">Signal</TH>}
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const m = (r.metrics || {}) as Record<string, unknown>
          const pctFromHigh = num(m.pct_from_high)
          const rangePos = num(m.range_position)
          const rangePosVal = rangePos ?? 0
          const signal = safeStr(m.signal)
          const variant = signal.includes("new_high") || signal === "near_high"
            ? "bullish"
            : signal.includes("near_low") && !signal.includes("recovering")
              ? "bearish"
              : signal === "near_low_recovering" ? "warning" : "neutral"
          const signalLabel: Record<string, string> = {
            new_high_volume: "New High + Vol",
            new_high: "New High",
            near_high: "Near High",
            within_10pct: "Within 10%",
            upper_range: "Upper Range",
            near_low_recovering: "Near Low ↑",
            near_low: "Near Low",
            lower_half: "Lower Half",
            mid_range: "Mid Range",
          }
          return (
            <tr
              key={r.id}
              className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}
            >
              {vis.has("rank") && <TD mono color="var(--text-muted)">{i + 1}</TD>}
              {vis.has("ticker") && <TickerCell ticker={r.ticker} />}
              {vis.has("pe") && <PECell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("peg") && <PEGCell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("score") && <ScoreCell score={r.score} />}
              {vis.has("current") && <TD mono align="right">{fmtPrice(m.current)}</TD>}
              {vis.has("high_52w") && <TD mono align="right">{fmtPrice(m.high_52w)}</TD>}
              {vis.has("low_52w") && <TD mono align="right">{fmtPrice(m.low_52w)}</TD>}
              {vis.has("from_high") && <td className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: pctFromHigh !== null && pctFromHigh >= -5 ? "var(--color-profit)" : pctFromHigh !== null && pctFromHigh <= -20 ? "var(--color-loss)" : "var(--text-primary)" }}>{fmtPct(m.pct_from_high, 1, true)}</td>}
              {vis.has("range") && <td className="px-5 py-2.5 text-right whitespace-nowrap"><div className="flex items-center gap-2 justify-end"><div className="w-16 h-1.5 rounded-full overflow-hidden" style={bgSecondary}><div className="h-full rounded-full" style={{ width: `${Math.max(2, rangePosVal * 100)}%`, backgroundColor: rangePosVal > 0.7 ? "var(--color-profit)" : rangePosVal < 0.3 ? "var(--color-loss)" : "var(--text-muted)" }} /></div><span className="text-[11px] font-mono tabular-nums" style={textMuted}>{fmt(rangePos !== null ? rangePos * 100 : null, 0)}%</span></div></td>}
              {vis.has("signal") && <td className="px-5 py-2.5 text-center whitespace-nowrap"><SignalBadge signal={signalLabel[signal] || signal} variant={variant} /></td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ────────────────────────────────────────────────────────────────
   52W Low Table
   ──────────────────────────────────────────────────────────────── */

function Low52WTable({ results, fundamentals, vis }: TableProps) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr style={bgCard}>
          {vis.has("rank") && <TH>#</TH>}
          {vis.has("ticker") && <TH>Ticker</TH>}
          {vis.has("pe") && <TH align="right">P/E</TH>}
          {vis.has("peg") && <TH align="right">PEG</TH>}
          {vis.has("score") && <TH align="right">Score</TH>}
          {vis.has("current") && <TH align="right">Current</TH>}
          {vis.has("low_52w") && <TH align="right">52W Low</TH>}
          {vis.has("high_52w") && <TH align="right">52W High</TH>}
          {vis.has("from_low") && <TH align="right">From Low</TH>}
          {vis.has("range") && <TH align="right">Range %</TH>}
          {vis.has("signal") && <TH align="center">Signal</TH>}
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const m = (r.metrics || {}) as Record<string, unknown>
          const pctFromLow = num(m.pct_from_low)
          const rangePos = num(m.range_position)
          const rangePosVal = rangePos ?? 0
          const signal = safeStr(m.signal)
          const variant = signal.includes("new_low") || signal === "near_low"
            ? "bearish"
            : signal === "near_low_recovering"
              ? "warning"
              : signal === "within_10pct" || signal === "lower_range"
                ? "bullish"
                : "neutral"
          const signalLabel: Record<string, string> = {
            new_low_volume: "New Low + Vol",
            new_low: "New Low",
            near_low: "Near Low",
            near_low_recovering: "Near Low ↑",
            within_10pct: "Within 10%",
            lower_range: "Lower Range",
            lower_half: "Lower Half",
            upper_half: "Upper Half",
          }
          return (
            <tr
              key={r.id}
              className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}
            >
              {vis.has("rank") && <TD mono color="var(--text-muted)">{i + 1}</TD>}
              {vis.has("ticker") && <TickerCell ticker={r.ticker} />}
              {vis.has("pe") && <PECell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("peg") && <PEGCell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("score") && <ScoreCell score={r.score} />}
              {vis.has("current") && <TD mono align="right">{fmtPrice(m.current)}</TD>}
              {vis.has("low_52w") && <TD mono align="right">{fmtPrice(m.low_52w)}</TD>}
              {vis.has("high_52w") && <TD mono align="right">{fmtPrice(m.high_52w)}</TD>}
              {vis.has("from_low") && <td className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: pctFromLow !== null && pctFromLow <= 5 ? "var(--color-loss)" : pctFromLow !== null && pctFromLow >= 20 ? "var(--color-profit)" : "var(--text-primary)" }}>{fmtPct(m.pct_from_low, 1, true)}</td>}
              {vis.has("range") && <td className="px-5 py-2.5 text-right whitespace-nowrap"><div className="flex items-center gap-2 justify-end"><div className="w-16 h-1.5 rounded-full overflow-hidden" style={bgSecondary}><div className="h-full rounded-full" style={{ width: `${Math.max(2, rangePosVal * 100)}%`, backgroundColor: rangePosVal < 0.3 ? "var(--color-loss)" : rangePosVal > 0.7 ? "var(--color-profit)" : "var(--text-muted)" }} /></div><span className="text-[11px] font-mono tabular-nums" style={textMuted}>{fmt(rangePos !== null ? rangePos * 100 : null, 0)}%</span></div></td>}
              {vis.has("signal") && <td className="px-5 py-2.5 text-center whitespace-nowrap"><SignalBadge signal={signalLabel[signal] || signal} variant={variant} /></td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ────────────────────────────────────────────────────────────────
   Original 4 strategies
   ──────────────────────────────────────────────────────────────── */

function FibTable({ results, fundamentals, vis }: TableProps) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr style={bgCard}>
          {vis.has("rank") && <TH>#</TH>}
          {vis.has("ticker") && <TH>Ticker</TH>}
          {vis.has("pe") && <TH align="right">P/E</TH>}
          {vis.has("peg") && <TH align="right">PEG</TH>}
          {vis.has("score") && <TH align="right">Score</TH>}
          {vis.has("current") && <TH align="right">Current</TH>}
          {vis.has("high") && <TH align="right">52W High</TH>}
          {vis.has("low") && <TH align="right">52W Low</TH>}
          {vis.has("fib_618") && <TH align="right">Fib 0.618</TH>}
          {vis.has("signal") && <TH align="center">Signal</TH>}
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const m = (r.metrics || {}) as Record<string, unknown>
          return (
            <tr
              key={r.id}
              className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}
            >
              {vis.has("rank") && <TD mono color="var(--text-muted)">{i + 1}</TD>}
              {vis.has("ticker") && <TickerCell ticker={r.ticker} />}
              {vis.has("pe") && <PECell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("peg") && <PEGCell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("score") && <ScoreCell score={r.score} />}
              {vis.has("current") && <TD mono align="right">{fmtPrice(m.current)}</TD>}
              {vis.has("high") && <TD mono align="right">{fmtPrice(m.high_6m)}</TD>}
              {vis.has("low") && <TD mono align="right">{fmtPrice(m.low_6m)}</TD>}
              {vis.has("fib_618") && <TD mono align="right">{fmtPrice(m.fib_618)}</TD>}
              {vis.has("signal") && <td className="px-5 py-2.5 text-center whitespace-nowrap">{m.near_618 ? (<SignalBadge signal="Near 0.618" variant="warning" />) : (<span style={textMuted}>—</span>)}</td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function PivotTable({ results, fundamentals, vis }: TableProps) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr style={bgCard}>
          {vis.has("rank") && <TH>#</TH>}
          {vis.has("ticker") && <TH>Ticker</TH>}
          {vis.has("pe") && <TH align="right">P/E</TH>}
          {vis.has("peg") && <TH align="right">PEG</TH>}
          {vis.has("score") && <TH align="right">Score</TH>}
          {vis.has("current") && <TH align="right">Current</TH>}
          {vis.has("pivot") && <TH align="right">Pivot</TH>}
          {vis.has("s1") && <TH align="right">S1</TH>}
          {vis.has("s2") && <TH align="right">S2</TH>}
          {vis.has("r1") && <TH align="right">R1</TH>}
          {vis.has("r2") && <TH align="right">R2</TH>}
          {vis.has("signal") && <TH align="center">Signal</TH>}
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const m = (r.metrics || {}) as Record<string, unknown>
          const signal = safeStr(m.signal)
          const variant = signal === "near_s2" || signal === "near_s1" || signal === "below_pivot"
            ? "bullish"
            : signal === "near_r1" || signal === "above_pivot"
              ? "neutral"
              : "neutral"
          const label = {
            near_s2: "Near S2",
            near_s1: "Near S1",
            at_pivot: "At Pivot",
            below_pivot: "Below Pivot",
            above_pivot: "Above Pivot",
            near_r1: "Near R1",
            neutral: "Neutral",
          }[signal] || signal
          return (
            <tr
              key={r.id}
              className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}
            >
              {vis.has("rank") && <TD mono color="var(--text-muted)">{i + 1}</TD>}
              {vis.has("ticker") && <TickerCell ticker={r.ticker} />}
              {vis.has("pe") && <PECell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("peg") && <PEGCell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("score") && <ScoreCell score={r.score} />}
              {vis.has("current") && <TD mono align="right">{fmtPrice(m.current)}</TD>}
              {vis.has("pivot") && <TD mono align="right">{fmtPrice(m.pivot)}</TD>}
              {vis.has("s1") && <TD mono align="right">{fmtPrice(m.s1)}</TD>}
              {vis.has("s2") && <TD mono align="right">{fmtPrice(m.s2)}</TD>}
              {vis.has("r1") && <TD mono align="right">{fmtPrice(m.r1)}</TD>}
              {vis.has("r2") && <TD mono align="right">{fmtPrice(m.r2)}</TD>}
              {vis.has("signal") && <td className="px-5 py-2.5 text-center whitespace-nowrap"><SignalBadge signal={label} variant={variant} /></td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function MACDTable({ results, fundamentals, vis }: TableProps) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr style={bgCard}>
          {vis.has("rank") && <TH>#</TH>}
          {vis.has("ticker") && <TH>Ticker</TH>}
          {vis.has("pe") && <TH align="right">P/E</TH>}
          {vis.has("peg") && <TH align="right">PEG</TH>}
          {vis.has("score") && <TH align="right">Score</TH>}
          {vis.has("current") && <TH align="right">Current</TH>}
          {vis.has("macd") && <TH align="right">MACD</TH>}
          {vis.has("signal_line") && <TH align="right">Signal</TH>}
          {vis.has("histogram") && <TH align="right">Histogram</TH>}
          {vis.has("trend") && <TH align="center">Trend</TH>}
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const m = (r.metrics || {}) as Record<string, unknown>
          const signal = safeStr(m.signal)
          const variant = signal === "bullish_cross" || signal === "bullish_momentum"
            ? "bullish"
            : signal === "bearish_cross" || signal === "bearish_momentum"
              ? "bearish"
              : signal === "bullish_weakening"
                ? "warning"
                : "neutral"
          const label = {
            bullish_cross: "Bullish Cross",
            bearish_cross: "Bearish Cross",
            bullish_momentum: "Bullish",
            bullish_weakening: "Weakening",
            bearish_momentum: "Bearish",
            bearish_weakening: "Recovering",
            neutral: "Neutral",
          }[signal] || signal
          const histVal = num(m.histogram) ?? 0
          const histColor = histVal > 0 ? "var(--color-profit)" : histVal < 0 ? "var(--color-loss)" : "var(--text-muted)"
          return (
            <tr
              key={r.id}
              className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}
            >
              {vis.has("rank") && <TD mono color="var(--text-muted)">{i + 1}</TD>}
              {vis.has("ticker") && <TickerCell ticker={r.ticker} />}
              {vis.has("pe") && <PECell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("peg") && <PEGCell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("score") && <ScoreCell score={r.score} />}
              {vis.has("current") && <TD mono align="right">{fmtPrice(m.current)}</TD>}
              {vis.has("macd") && <TD mono align="right">{fmt(m.macd, 2)}</TD>}
              {vis.has("signal_line") && <TD mono align="right">{fmt(m.signal_line, 2)}</TD>}
              {vis.has("histogram") && <td className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: histColor }}>{histVal > 0 ? "+" : ""}{fmt(m.histogram, 2)}</td>}
              {vis.has("trend") && <td className="px-5 py-2.5 text-center whitespace-nowrap"><SignalBadge signal={label} variant={variant} /></td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function RSITable({ results, fundamentals, vis }: TableProps) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr style={bgCard}>
          {vis.has("rank") && <TH>#</TH>}
          {vis.has("ticker") && <TH>Ticker</TH>}
          {vis.has("pe") && <TH align="right">P/E</TH>}
          {vis.has("peg") && <TH align="right">PEG</TH>}
          {vis.has("score") && <TH align="right">Score</TH>}
          {vis.has("current") && <TH align="right">Current</TH>}
          {vis.has("rsi") && <TH align="right">RSI</TH>}
          {vis.has("trend") && <TH align="center">Trend</TH>}
          {vis.has("signal") && <TH align="center">Signal</TH>}
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const m = (r.metrics || {}) as Record<string, unknown>
          const signal = safeStr(m.signal)
          const rsiVal = num(m.rsi)
          const rsiColor = rsiVal !== null && rsiVal <= 30 ? "var(--color-profit)" : rsiVal !== null && rsiVal >= 70 ? "var(--color-loss)" : "var(--text-primary)"
          const variant = signal === "oversold" || signal === "recovering"
            ? "bullish"
            : signal === "overbought"
              ? "bearish"
              : signal === "weak"
                ? "warning"
                : "neutral"
          const label = {
            oversold: "Oversold",
            recovering: "Recovering",
            weak: "Weak",
            neutral: "Neutral",
            strong: "Strong",
            overbought: "Overbought",
          }[signal] || signal
          return (
            <tr
              key={r.id}
              className="transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined }}
            >
              {vis.has("rank") && <TD mono color="var(--text-muted)">{i + 1}</TD>}
              {vis.has("ticker") && <TickerCell ticker={r.ticker} />}
              {vis.has("pe") && <PECell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("peg") && <PEGCell ticker={r.ticker} fundamentals={fundamentals} />}
              {vis.has("score") && <ScoreCell score={r.score} />}
              {vis.has("current") && <TD mono align="right">{fmtPrice(m.current)}</TD>}
              {vis.has("rsi") && <td className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: rsiColor }}>{fmt(m.rsi, 1)}</td>}
              {vis.has("trend") && <td className="px-5 py-2.5 text-center whitespace-nowrap">{m.rsi_rising ? (<span className="text-[11px] font-medium" style={{ color: "var(--color-profit)" }}>▲</span>) : (<span className="text-[11px] font-medium" style={{ color: "var(--color-loss)" }}>▼</span>)}</td>}
              {vis.has("signal") && <td className="px-5 py-2.5 text-center whitespace-nowrap"><SignalBadge signal={label} variant={variant} /></td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
