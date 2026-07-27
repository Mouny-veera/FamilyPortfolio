import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Play, Loader2, Search, TrendingUp, TrendingDown, Minus, GripVertical } from "lucide-react"
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
          style={{ color: "var(--text-muted)", opacity: 0.4 }}
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

  useEffect(() => { fetchResults() }, [fetchResults])

  useEffect(() => {
    const handler = () => fetchResults()
    window.addEventListener("prices-refreshed", handler)
    return () => window.removeEventListener("prices-refreshed", handler)
  }, [fetchResults])

  const handleScan = async () => {
    setScanning(true)
    try {
      await api.runScanner()
      const fresh = await api.getScanResults()
      setResults(fresh)
    } catch (e) {
      console.error(e)
    } finally {
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
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Scanner
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
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
          style={{
            background: "var(--gradient-accent)",
            boxShadow: "var(--shadow-accent)",
          }}
        >
          {scanning ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} strokeWidth={2} />}
          {scanning ? "Scanning..." : "Run Scanner"}
        </button>
      </div>

      {scanning && (
        <div
          className="text-center py-12 rounded-xl mb-4"
          style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}
        >
          <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: "var(--accent-15)", borderTopColor: "var(--color-profit)" }} />
          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
            Scanning Nifty 500 across 11 strategies...
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            This may take a few minutes due to rate limits.
          </p>
        </div>
      )}

      {!loading && results.length === 0 && !scanning && (
        <div
          className="text-center py-16 rounded-xl"
          style={{ border: "1px dashed var(--border-color)", backgroundColor: "var(--bg-card)" }}
        >
          <Search size={28} strokeWidth={1.5} className="mx-auto mb-3" style={{ color: "var(--text-muted)", opacity: 0.5 }} />
          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>No scan results yet</p>
          <p className="text-[12px] mt-1 mb-4" style={{ color: "var(--text-muted)" }}>Run the scanner to find top picks across 11 strategies.</p>
          <button
            onClick={handleScan}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-all duration-150 hover:brightness-110"
            style={{
              background: "var(--gradient-accent)",
              boxShadow: "var(--shadow-accent)",
            }}
          >
            <Play size={15} strokeWidth={2} />
            Run Scanner
          </button>
        </div>
      )}

      {results.length > 0 && (
        <>
          {/* Strategy Tabs — drag to reorder */}
          <div className="mb-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={tabOrder} strategy={horizontalListSortingStrategy}>
                <div
                  className="flex gap-1 p-1 rounded-lg w-max min-w-full"
                  role="tablist"
                  aria-label="Scanner strategies"
                  style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
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

          {/* Result count */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {filtered.length} results
            </span>
          </div>

          {/* Results Table */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" }}
          >
            {filtered.length === 0 ? (
              <div className="text-center py-10" style={{ backgroundColor: "var(--bg-card)" }}>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  No results for this indicator. Run the scanner to generate data.
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto" id={`tabpanel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
                {activeTab === "composite" && <CompositeTable results={filtered} />}
                {activeTab === "supertrend" && <SuperTrendTable results={filtered} />}
                {activeTab === "adx" && <ADXTable results={filtered} />}
                {activeTab === "rsi" && <RSITable results={filtered} />}
                {activeTab === "macd" && <MACDTable results={filtered} />}
                {activeTab === "stochastic" && <StochasticTable results={filtered} />}
                {activeTab === "fibonacci_retracement" && <FibTable results={filtered} />}
                {activeTab === "bollinger" && <BollingerTable results={filtered} />}
                {activeTab === "52w_high" && <High52WTable results={filtered} />}
                {activeTab === "52w_low" && <Low52WTable results={filtered} />}
                {activeTab === "pivot_point" && <PivotTable results={filtered} />}
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

function TH({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th
      scope="col"
      className={`text-${align} px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap`}
      style={{ color: "var(--text-muted)" }}
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
        style={{ color: "var(--color-accent)" }}
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
      <span className="text-[10px] font-medium w-16 text-right" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)" }}>
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

function CompositeTable({ results }: { results: ScanResult[] }) {
  const sorted = [...results].sort((a, b) => b.score - a.score)
  return (
    <table className="w-full text-[13px] min-w-[900px]">
      <thead>
        <tr style={{ backgroundColor: "var(--bg-card)" }}>
          <TH>#</TH>
          <TH>Ticker</TH>
          <TH align="center">Rating</TH>
          <TH align="right">Score</TH>
          <TH align="right">Current</TH>
          <TH align="center">Category Breakdown</TH>
          <TH align="right">Strategies</TH>
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
              <TD mono color="var(--text-muted)">{i + 1}</TD>
              <TickerCell ticker={r.ticker} />
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                <RatingBadge rating={safeStr(m.rating) || "Neutral"} />
              </td>
              <ScoreCell score={r.score} />
              <TD mono align="right">{fmtPrice(m.current)}</TD>
              <td className="px-4 py-2.5">
                <div className="flex flex-col gap-1">
                  {Object.entries(cats).map(([cat, score]) => (
                    <CategoryBar key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)} score={score} />
                  ))}
                </div>
              </td>
              <TD mono align="right" color="var(--text-muted)">
                {num(m.strategies_used) ?? 0}/11
              </TD>
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

function SuperTrendTable({ results }: { results: ScanResult[] }) {
  return (
    <table className="w-full text-[13px] min-w-[750px]">
      <thead>
        <tr style={{ backgroundColor: "var(--bg-card)" }}>
          <TH>#</TH>
          <TH>Ticker</TH>
          <TH align="right">Score</TH>
          <TH align="right">Current</TH>
          <TH align="right">ST Level</TH>
          <TH align="center">Direction</TH>
          <TH align="right">Streak</TH>
          <TH align="center">Signal</TH>
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
              <TD mono color="var(--text-muted)">{i + 1}</TD>
              <TickerCell ticker={r.ticker} />
              <ScoreCell score={r.score} />
              <TD mono align="right">{fmtPrice(m.current)}</TD>
              <TD mono align="right">{fmtPrice(m.supertrend)}</TD>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                <span className="text-[11px] font-medium" style={{ color: dir === "bullish" ? "var(--color-profit)" : "var(--color-loss)" }}>
                  {dir === "bullish" ? "▲" : "▼"} {dir ? dir.charAt(0).toUpperCase() + dir.slice(1) : "—"}
                </span>
              </td>
              <TD mono align="right">{num(m.streak) ?? "—"}</TD>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                <SignalBadge signal={signalLabel[signal] || signal} variant={variant} />
              </td>
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

function ADXTable({ results }: { results: ScanResult[] }) {
  return (
    <table className="w-full text-[13px] min-w-[850px]">
      <thead>
        <tr style={{ backgroundColor: "var(--bg-card)" }}>
          <TH>#</TH>
          <TH>Ticker</TH>
          <TH align="right">Score</TH>
          <TH align="right">Current</TH>
          <TH align="right">ADX</TH>
          <TH align="right">+DI</TH>
          <TH align="right">-DI</TH>
          <TH align="center">Trend</TH>
          <TH align="center">Signal</TH>
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
              <TD mono color="var(--text-muted)">{i + 1}</TD>
              <TickerCell ticker={r.ticker} />
              <ScoreCell score={r.score} />
              <TD mono align="right">{fmtPrice(m.current)}</TD>
              <td
                className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap"
                style={{ color: trending ? "var(--color-profit)" : "var(--text-muted)" }}
              >
                {fmt(m.adx, 1)}
              </td>
              <TD mono align="right" color="var(--color-profit)">{fmt(m.plus_di, 1)}</TD>
              <TD mono align="right" color="var(--color-loss)">{fmt(m.minus_di, 1)}</TD>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                {trending ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent-10)", color: "var(--color-profit)" }}>TRENDING</span>
                ) : (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)" }}>RANGING</span>
                )}
              </td>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                <SignalBadge signal={signalLabel[signal] || signal} variant={variant} />
              </td>
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

function StochasticTable({ results }: { results: ScanResult[] }) {
  return (
    <table className="w-full text-[13px] min-w-[750px]">
      <thead>
        <tr style={{ backgroundColor: "var(--bg-card)" }}>
          <TH>#</TH>
          <TH>Ticker</TH>
          <TH align="right">Score</TH>
          <TH align="right">Current</TH>
          <TH align="right">%K</TH>
          <TH align="right">%D</TH>
          <TH align="center">Zone</TH>
          <TH align="center">Signal</TH>
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
              <TD mono color="var(--text-muted)">{i + 1}</TD>
              <TickerCell ticker={r.ticker} />
              <ScoreCell score={r.score} />
              <TD mono align="right">{fmtPrice(m.current)}</TD>
              <td className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: kColor }}>
                {fmt(m.pct_k, 1)}
              </td>
              <TD mono align="right">{fmt(m.pct_d, 1)}</TD>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                {m.oversold ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent-10)", color: "var(--color-profit)" }}>OVERSOLD</span>
                ) : m.overbought ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--loss-10)", color: "var(--color-loss)" }}>OVERBOUGHT</span>
                ) : (
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>—</span>
                )}
              </td>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                <SignalBadge signal={signalLabel[signal] || signal} variant={variant} />
              </td>
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

function BollingerTable({ results }: { results: ScanResult[] }) {
  return (
    <table className="w-full text-[13px] min-w-[900px]">
      <thead>
        <tr style={{ backgroundColor: "var(--bg-card)" }}>
          <TH>#</TH>
          <TH>Ticker</TH>
          <TH align="right">Score</TH>
          <TH align="right">Current</TH>
          <TH align="right">Upper</TH>
          <TH align="right">SMA(20)</TH>
          <TH align="right">Lower</TH>
          <TH align="right">%B</TH>
          <TH align="center">Squeeze</TH>
          <TH align="center">Signal</TH>
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
              <TD mono color="var(--text-muted)">{i + 1}</TD>
              <TickerCell ticker={r.ticker} />
              <ScoreCell score={r.score} />
              <TD mono align="right">{fmtPrice(m.current)}</TD>
              <TD mono align="right">{fmtPrice(m.upper)}</TD>
              <TD mono align="right">{fmtPrice(m.sma)}</TD>
              <TD mono align="right">{fmtPrice(m.lower)}</TD>
              <td
                className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap"
                style={{ color: pctB !== null && pctB < 0.2 ? "var(--color-profit)" : pctB !== null && pctB > 0.8 ? "var(--color-loss)" : "var(--text-primary)" }}
              >
                {fmt(m.pct_b, 3)}
              </td>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                {m.squeeze ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--warning-10)", color: "var(--color-warning)" }}>SQUEEZE</span>
                ) : (
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>—</span>
                )}
              </td>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                <SignalBadge signal={signalLabel[signal] || signal} variant={variant} />
              </td>
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

function High52WTable({ results }: { results: ScanResult[] }) {
  return (
    <table className="w-full text-[13px] min-w-[900px]">
      <thead>
        <tr style={{ backgroundColor: "var(--bg-card)" }}>
          <TH>#</TH>
          <TH>Ticker</TH>
          <TH align="right">Score</TH>
          <TH align="right">Current</TH>
          <TH align="right">52W High</TH>
          <TH align="right">52W Low</TH>
          <TH align="right">From High</TH>
          <TH align="right">Range %</TH>
          <TH align="center">Signal</TH>
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
              <TD mono color="var(--text-muted)">{i + 1}</TD>
              <TickerCell ticker={r.ticker} />
              <ScoreCell score={r.score} />
              <TD mono align="right">{fmtPrice(m.current)}</TD>
              <TD mono align="right">{fmtPrice(m.high_52w)}</TD>
              <TD mono align="right">{fmtPrice(m.low_52w)}</TD>
              <td
                className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap"
                style={{ color: pctFromHigh !== null && pctFromHigh >= -5 ? "var(--color-profit)" : pctFromHigh !== null && pctFromHigh <= -20 ? "var(--color-loss)" : "var(--text-primary)" }}
              >
                {fmtPct(m.pct_from_high, 1, true)}
              </td>
              <td className="px-5 py-2.5 text-right whitespace-nowrap">
                <div className="flex items-center gap-2 justify-end">
                  <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, rangePosVal * 100)}%`,
                        backgroundColor: rangePosVal > 0.7 ? "var(--color-profit)" : rangePosVal < 0.3 ? "var(--color-loss)" : "var(--text-muted)",
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {fmt(rangePos !== null ? rangePos * 100 : null, 0)}%
                  </span>
                </div>
              </td>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                <SignalBadge signal={signalLabel[signal] || signal} variant={variant} />
              </td>
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

function Low52WTable({ results }: { results: ScanResult[] }) {
  return (
    <table className="w-full text-[13px] min-w-[900px]">
      <thead>
        <tr style={{ backgroundColor: "var(--bg-card)" }}>
          <TH>#</TH>
          <TH>Ticker</TH>
          <TH align="right">Score</TH>
          <TH align="right">Current</TH>
          <TH align="right">52W Low</TH>
          <TH align="right">52W High</TH>
          <TH align="right">From Low</TH>
          <TH align="right">Range %</TH>
          <TH align="center">Signal</TH>
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
              <TD mono color="var(--text-muted)">{i + 1}</TD>
              <TickerCell ticker={r.ticker} />
              <ScoreCell score={r.score} />
              <TD mono align="right">{fmtPrice(m.current)}</TD>
              <TD mono align="right">{fmtPrice(m.low_52w)}</TD>
              <TD mono align="right">{fmtPrice(m.high_52w)}</TD>
              <td
                className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap"
                style={{ color: pctFromLow !== null && pctFromLow <= 5 ? "var(--color-loss)" : pctFromLow !== null && pctFromLow >= 20 ? "var(--color-profit)" : "var(--text-primary)" }}
              >
                {fmtPct(m.pct_from_low, 1, true)}
              </td>
              <td className="px-5 py-2.5 text-right whitespace-nowrap">
                <div className="flex items-center gap-2 justify-end">
                  <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, rangePosVal * 100)}%`,
                        backgroundColor: rangePosVal < 0.3 ? "var(--color-loss)" : rangePosVal > 0.7 ? "var(--color-profit)" : "var(--text-muted)",
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {fmt(rangePos !== null ? rangePos * 100 : null, 0)}%
                  </span>
                </div>
              </td>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                <SignalBadge signal={signalLabel[signal] || signal} variant={variant} />
              </td>
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

function FibTable({ results }: { results: ScanResult[] }) {
  return (
    <table className="w-full text-[13px] min-w-[780px]">
      <thead>
        <tr style={{ backgroundColor: "var(--bg-card)" }}>
          <TH>#</TH>
          <TH>Ticker</TH>
          <TH align="right">Score</TH>
          <TH align="right">Current</TH>
          <TH align="right">52W High</TH>
          <TH align="right">52W Low</TH>
          <TH align="right">Fib 0.618</TH>
          <TH align="center">Signal</TH>
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
              <TD mono color="var(--text-muted)">{i + 1}</TD>
              <TickerCell ticker={r.ticker} />
              <ScoreCell score={r.score} />
              <TD mono align="right">{fmtPrice(m.current)}</TD>
              <TD mono align="right">{fmtPrice(m.high_6m)}</TD>
              <TD mono align="right">{fmtPrice(m.low_6m)}</TD>
              <TD mono align="right">{fmtPrice(m.fib_618)}</TD>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                {m.near_618 ? (
                  <SignalBadge signal="Near 0.618" variant="warning" />
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>—</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function PivotTable({ results }: { results: ScanResult[] }) {
  return (
    <table className="w-full text-[13px] min-w-[850px]">
      <thead>
        <tr style={{ backgroundColor: "var(--bg-card)" }}>
          <TH>#</TH>
          <TH>Ticker</TH>
          <TH align="right">Score</TH>
          <TH align="right">Current</TH>
          <TH align="right">Pivot</TH>
          <TH align="right">S1</TH>
          <TH align="right">S2</TH>
          <TH align="right">R1</TH>
          <TH align="right">R2</TH>
          <TH align="center">Signal</TH>
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
              <TD mono color="var(--text-muted)">{i + 1}</TD>
              <TickerCell ticker={r.ticker} />
              <ScoreCell score={r.score} />
              <TD mono align="right">{fmtPrice(m.current)}</TD>
              <TD mono align="right">{fmtPrice(m.pivot)}</TD>
              <TD mono align="right">{fmtPrice(m.s1)}</TD>
              <TD mono align="right">{fmtPrice(m.s2)}</TD>
              <TD mono align="right">{fmtPrice(m.r1)}</TD>
              <TD mono align="right">{fmtPrice(m.r2)}</TD>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                <SignalBadge signal={label} variant={variant} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function MACDTable({ results }: { results: ScanResult[] }) {
  return (
    <table className="w-full text-[13px] min-w-[780px]">
      <thead>
        <tr style={{ backgroundColor: "var(--bg-card)" }}>
          <TH>#</TH>
          <TH>Ticker</TH>
          <TH align="right">Score</TH>
          <TH align="right">Current</TH>
          <TH align="right">MACD</TH>
          <TH align="right">Signal</TH>
          <TH align="right">Histogram</TH>
          <TH align="center">Trend</TH>
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
              <TD mono color="var(--text-muted)">{i + 1}</TD>
              <TickerCell ticker={r.ticker} />
              <ScoreCell score={r.score} />
              <TD mono align="right">{fmtPrice(m.current)}</TD>
              <TD mono align="right">{fmt(m.macd, 2)}</TD>
              <TD mono align="right">{fmt(m.signal_line, 2)}</TD>
              <td className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: histColor }}>
                {histVal > 0 ? "+" : ""}{fmt(m.histogram, 2)}
              </td>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                <SignalBadge signal={label} variant={variant} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function RSITable({ results }: { results: ScanResult[] }) {
  return (
    <table className="w-full text-[13px] min-w-[680px]">
      <thead>
        <tr style={{ backgroundColor: "var(--bg-card)" }}>
          <TH>#</TH>
          <TH>Ticker</TH>
          <TH align="right">Score</TH>
          <TH align="right">Current</TH>
          <TH align="right">RSI</TH>
          <TH align="center">Trend</TH>
          <TH align="center">Signal</TH>
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
              <TD mono color="var(--text-muted)">{i + 1}</TD>
              <TickerCell ticker={r.ticker} />
              <ScoreCell score={r.score} />
              <TD mono align="right">{fmtPrice(m.current)}</TD>
              <td className="px-5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: rsiColor }}>
                {fmt(m.rsi, 1)}
              </td>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                {m.rsi_rising ? (
                  <span className="text-[11px] font-medium" style={{ color: "var(--color-profit)" }}>▲</span>
                ) : (
                  <span className="text-[11px] font-medium" style={{ color: "var(--color-loss)" }}>▼</span>
                )}
              </td>
              <td className="px-5 py-2.5 text-center whitespace-nowrap">
                <SignalBadge signal={label} variant={variant} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
