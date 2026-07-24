import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, TrendingUp, TrendingDown, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"
import { api, type StockQuote, type StockCandle, type ChartRange } from "@/lib/api"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { StockChart } from "./StockChart"
import {
  type IndicatorId,
  INDICATORS,
  computeSMA,
  loadSavedIndicators,
  saveIndicators,
} from "./indicators"

const RANGES: { key: ChartRange; label: string }[] = [
  { key: "1D", label: "1D" },
  { key: "1W", label: "1W" },
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "1Y", label: "1Y" },
  { key: "5Y", label: "5Y" },
]

const SMA_OPTIONS = [
  { key: "sma20", label: "SMA 20", period: 20 },
  { key: "sma50", label: "SMA 50", period: 50 },
  { key: "sma200", label: "SMA 200", period: 200 },
]

function formatVolume(v: number | null | undefined): string {
  if (v == null) return "—"
  if (v >= 10_000_000) return `${(v / 10_000_000).toFixed(2)} Cr`
  if (v >= 100_000) return `${(v / 100_000).toFixed(2)} L`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)} K`
  return v.toLocaleString("en-IN")
}

function StatItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <span className="text-[11px] uppercase font-semibold tracking-[0.06em]" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="font-mono tabular-nums text-[13px] font-medium" style={{ color: color || "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  )
}

function RangeBar({ high, low, current, label }: { high: number; low: number; current: number; label: string }) {
  const pct = high === low ? 50 : ((current - low) / (high - low)) * 100
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <div className="flex justify-between mb-1.5">
        <span className="text-[11px] uppercase font-semibold tracking-[0.06em]" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono tabular-nums text-[12px]" style={{ color: "var(--color-loss)" }}>
          {formatNumber(low)}
        </span>
        <div className="flex-1 h-1.5 rounded-full relative" style={{ backgroundColor: "var(--bg-elevated)" }}>
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
            style={{
              left: `calc(${clamped}% - 5px)`,
              background: "var(--gradient-accent)",
              boxShadow: "var(--shadow-accent)",
            }}
          />
        </div>
        <span className="font-mono tabular-nums text-[12px]" style={{ color: "var(--color-profit)" }}>
          {formatNumber(high)}
        </span>
      </div>
    </div>
  )
}

function IndicatorPanel({
  active,
  onToggle,
}: {
  active: Set<IndicatorId>
  onToggle: (id: IndicatorId) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const overlays = INDICATORS.filter(i => i.group === "overlay")
  const oscillators = INDICATORS.filter(i => i.group === "oscillator")
  const volumes = INDICATORS.filter(i => i.group === "volume")

  return (
    <div className="mb-3">
      {/* Active indicator chips + toggle button */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold tracking-wide transition-all cursor-pointer min-h-[36px]"
          style={{
            color: expanded ? "white" : "var(--text-secondary)",
            background: expanded ? "var(--gradient-accent)" : "var(--bg-elevated)",
            boxShadow: expanded ? "var(--shadow-accent)" : "none",
          }}
          aria-expanded={expanded}
          aria-controls="indicator-panel"
        >
          Indicators
          {active.size > 0 && (
            <span
              className="font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: expanded ? "rgba(255,255,255,0.2)" : "var(--accent-10)",
                color: expanded ? "#fff" : "var(--color-accent)",
              }}
            >
              {active.size}
            </span>
          )}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Active indicator chips (when collapsed) */}
        {!expanded && active.size > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {[...active].map(id => {
              const ind = INDICATORS.find(i => i.id === id)
              if (!ind) return null
              return (
                <button
                  key={id}
                  onClick={() => onToggle(id)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer min-h-[28px]"
                  style={{
                    backgroundColor: "var(--bg-elevated)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-color)",
                  }}
                  title={`Remove ${ind.label}`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: ind.color }}
                  />
                  {ind.shortLabel}
                  <span style={{ color: "var(--text-muted)", fontSize: 10 }}>×</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Expanded indicator grid */}
      {expanded && (
        <div
          id="indicator-panel"
          className="mt-2 rounded-xl p-3 animate-page-enter"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <IndicatorGroup label="Overlays" items={overlays} active={active} onToggle={onToggle} />
          <IndicatorGroup label="Volume" items={volumes} active={active} onToggle={onToggle} />
          <IndicatorGroup label="Oscillators" items={oscillators} active={active} onToggle={onToggle} />
        </div>
      )}
    </div>
  )
}

function IndicatorGroup({
  label,
  items,
  active,
  onToggle,
}: {
  label: string
  items: typeof INDICATORS
  active: Set<IndicatorId>
  onToggle: (id: IndicatorId) => void
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[10px] uppercase font-semibold tracking-[0.08em] mb-1.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(ind => {
          const isActive = active.has(ind.id)
          return (
            <button
              key={ind.id}
              onClick={() => onToggle(ind.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer min-h-[32px]"
              style={{
                backgroundColor: isActive ? `${ind.color}18` : "var(--bg-elevated)",
                color: isActive ? ind.color : "var(--text-secondary)",
                border: `1px solid ${isActive ? `${ind.color}40` : "transparent"}`,
              }}
              title={ind.description}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: ind.color, opacity: isActive ? 1 : 0.4 }}
              />
              {ind.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function StockDetailPage() {
  const { ticker } = useParams<{ ticker: string }>()
  const navigate = useNavigate()

  const [quote, setQuote] = useState<StockQuote | null>(null)
  const [candles, setCandles] = useState<StockCandle[]>([])
  const [resolution, setResolution] = useState("")
  const [range, setRange] = useState<ChartRange>("6M")
  const [chartLoading, setChartLoading] = useState(true)
  const [quoteLoading, setQuoteLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorId>>(loadSavedIndicators)

  const toggleIndicator = useCallback((id: IndicatorId) => {
    setActiveIndicators(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveIndicators(next)
      return next
    })
  }, [])

  const fetchChart = useCallback(async (r: ChartRange) => {
    if (!ticker) return
    setChartLoading(true)
    setError(null)
    try {
      const data = await api.getStockChart(ticker, r)
      setCandles(data.candles)
      setResolution(data.resolution)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load chart")
    } finally {
      setChartLoading(false)
    }
  }, [ticker])

  const fetchQuote = useCallback(async () => {
    if (!ticker) return
    setQuoteLoading(true)
    try {
      const q = await api.getStockQuote(ticker)
      setQuote(q)
    } catch {
      // quote error is non-critical
    } finally {
      setQuoteLoading(false)
    }
  }, [ticker])

  useEffect(() => {
    fetchChart(range)
    fetchQuote()
  }, [fetchChart, fetchQuote, range])

  useEffect(() => {
    const handler = () => fetchQuote()
    window.addEventListener("prices-refreshed", handler)
    return () => window.removeEventListener("prices-refreshed", handler)
  }, [fetchQuote])

  const handleRangeChange = (r: ChartRange) => {
    setRange(r)
    fetchChart(r)
  }

  const isPositive = quote && quote.change_pct != null ? quote.change_pct >= 0 : true
  const changeColor = isPositive ? "var(--color-profit)" : "var(--color-loss)"

  const hasOscillators = activeIndicators.has("rsi") || activeIndicators.has("macd")
  const chartHeight = hasOscillators
    ? "clamp(450px, 65vh, 750px)"
    : "clamp(350px, 50vh, 550px)"

  return (
    <div className="animate-page-enter">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 flex items-center justify-center"
          style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-elevated)" }}
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold tracking-tight truncate" style={{ color: "var(--text-primary)" }}>
            {ticker}
          </h1>
          {quote && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono tabular-nums text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {formatCurrency(quote.last_price)}
              </span>
              {quote.change_pct != null && (
                <span
                  className="flex items-center gap-0.5 font-mono tabular-nums text-[13px] font-medium px-1.5 py-0.5 rounded-md"
                  style={{ color: changeColor, backgroundColor: isPositive ? "var(--accent-10)" : "var(--loss-10)" }}
                >
                  {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {quote.change != null && `${quote.change >= 0 ? "+" : ""}${formatNumber(quote.change)}`}
                  {" "}({quote.change_pct >= 0 ? "+" : ""}{quote.change_pct.toFixed(2)}%)
                </span>
              )}
            </div>
          )}
          {quoteLoading && !quote && (
            <div className="h-5 w-40 rounded mt-1" style={{ backgroundColor: "var(--bg-elevated)" }} />
          )}
        </div>
        <button
          onClick={() => { fetchQuote(); fetchChart(range) }}
          className="p-2 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 flex items-center justify-center"
          style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-elevated)" }}
          aria-label="Refresh data"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Chart area */}
        <div className="flex-1 min-w-0">
          {/* Controls row: Range picker + Indicators */}
          <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
            {/* Range picker */}
            <div
              className="flex items-center gap-1 p-1 rounded-lg w-fit"
              style={{ backgroundColor: "var(--bg-elevated)" }}
              role="tablist"
              aria-label="Chart time range"
            >
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  role="tab"
                  aria-selected={range === r.key}
                  onClick={() => handleRangeChange(r.key)}
                  className="px-3 py-1.5 rounded-md text-[12px] font-semibold tracking-wide transition-all cursor-pointer min-h-[36px] lg:min-h-0"
                  style={{
                    color: range === r.key ? "white" : "var(--text-muted)",
                    background: range === r.key ? "var(--gradient-accent)" : "transparent",
                    boxShadow: range === r.key ? "var(--shadow-accent)" : "none",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Indicator panel */}
          <IndicatorPanel active={activeIndicators} onToggle={toggleIndicator} />

          {/* Chart container */}
          <div
            className="rounded-xl overflow-hidden transition-all duration-300"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              boxShadow: "var(--shadow-card)",
              height: chartHeight,
            }}
          >
            {chartLoading ? (
              <div className="flex items-center justify-center h-full gap-2" style={{ color: "var(--text-muted)" }}>
                <Loader2 size={20} className="animate-spin" style={{ color: "var(--color-accent)" }} />
                <span className="text-[13px]">Loading chart...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <span className="text-[13px]" style={{ color: "var(--color-loss)" }}>{error}</span>
                <button
                  onClick={() => fetchChart(range)}
                  className="text-[12px] font-medium px-3 py-1.5 rounded-md cursor-pointer"
                  style={{ color: "var(--color-accent)", backgroundColor: "var(--accent-10)" }}
                >
                  Retry
                </button>
              </div>
            ) : candles.length > 0 ? (
              <StockChart candles={candles} resolution={resolution} activeIndicators={activeIndicators} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>No data available</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats sidebar */}
        <div
          className="lg:w-72 rounded-xl p-4"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <h2 className="text-[11px] uppercase font-semibold tracking-[0.08em] mb-3" style={{ color: "var(--text-muted)" }}>
            Key Statistics
          </h2>

          {quoteLoading && !quote ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex justify-between py-2">
                  <div className="h-3 w-16 rounded" style={{ backgroundColor: "var(--bg-elevated)" }} />
                  <div className="h-3 w-20 rounded" style={{ backgroundColor: "var(--bg-elevated)" }} />
                </div>
              ))}
            </div>
          ) : quote ? (
            <>
              <StatItem label="Open" value={formatNumber(quote.open)} />
              <StatItem label="High" value={formatNumber(quote.high)} />
              <StatItem label="Low" value={formatNumber(quote.low)} />
              <StatItem label="Prev Close" value={formatNumber(quote.prev_close)} />
              <StatItem label="Volume" value={formatVolume(quote.volume)} />

              {quote.high != null && quote.low != null && quote.last_price != null && (
                <RangeBar
                  high={quote.high}
                  low={quote.low}
                  current={quote.last_price}
                  label="Day Range"
                />
              )}

              {quote.high_52w != null && quote.low_52w != null && quote.last_price != null && (
                <RangeBar
                  high={quote.high_52w}
                  low={quote.low_52w}
                  current={quote.last_price}
                  label="52W Range"
                />
              )}

              <StatItem
                label="Change"
                value={
                  quote.change != null
                    ? `${quote.change >= 0 ? "+" : ""}${formatNumber(quote.change)}`
                    : "—"
                }
                color={changeColor}
              />
              <StatItem
                label="Change %"
                value={
                  quote.change_pct != null
                    ? `${quote.change_pct >= 0 ? "+" : ""}${quote.change_pct.toFixed(2)}%`
                    : "—"
                }
                color={changeColor}
              />
            </>
          ) : (
            <div className="text-[13px] py-4 text-center" style={{ color: "var(--text-muted)" }}>
              Quote unavailable
            </div>
          )}

          {/* SMA values from chart data */}
          {candles.length >= 20 && (
            <>
              <h2 className="text-[11px] uppercase font-semibold tracking-[0.08em] mt-5 mb-3" style={{ color: "var(--text-muted)" }}>
                Moving Averages
              </h2>
              {SMA_OPTIONS.map((sma) => {
                if (candles.length < sma.period) return null
                const values = computeSMA(candles, sma.period)
                const latest = values[values.length - 1]
                if (!latest) return null
                const current = candles[candles.length - 1].close
                const above = current >= latest.value
                return (
                  <StatItem
                    key={sma.key}
                    label={sma.label}
                    value={formatNumber(latest.value)}
                    color={above ? "var(--color-profit)" : "var(--color-loss)"}
                  />
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
