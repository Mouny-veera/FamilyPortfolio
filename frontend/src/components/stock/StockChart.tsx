import { useEffect, useRef, useCallback, useState } from "react"
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  ColorType,
  CrosshairMode,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
} from "lightweight-charts"
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react"
import type { StockCandle } from "@/lib/api"
import {
  type IndicatorId,
  type IndicatorPoint,
  INDICATORS,
  computeEMA,
  computeRSI,
  computeMACD,
  computeBollinger,
  computeVWAP,
} from "./indicators"

interface StockChartProps {
  candles: StockCandle[]
  resolution: string
  activeIndicators: Set<IndicatorId>
  selectedRange?: string | null
  onUserZoom?: () => void
}

interface OHLCVData {
  open: number
  high: number
  low: number
  close: number
  volume: number
  change: number
  changePct: number
}

function isDark() {
  const html = document.documentElement
  if (html.classList.contains("dark")) return true
  if (html.classList.contains("light")) return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function getChartColors(dark: boolean) {
  const profit = cssVar("--color-profit")
  const loss = cssVar("--color-loss")
  const muted = cssVar("--text-muted")
  const border = cssVar("--border-color")
  const elevated = cssVar("--bg-elevated")
  return {
    bg: "transparent",
    text: muted,
    grid: cssVar("--chart-grid") || (dark ? "rgba(148, 163, 184, 0.06)" : "rgba(0, 0, 0, 0.04)"),
    border,
    crosshair: cssVar("--chart-crosshair") || (dark ? "rgba(148, 163, 184, 0.3)" : "rgba(0, 0, 0, 0.2)"),
    labelBg: cssVar("--chart-label-bg") || elevated,
    upColor: profit,
    downColor: loss,
    upWick: profit,
    downWick: loss,
    volUp: cssVar("--chart-vol-up") || (dark ? "rgba(16, 185, 129, 0.2)" : "rgba(5, 150, 105, 0.15)"),
    volDown: cssVar("--chart-vol-down") || (dark ? "rgba(244, 63, 94, 0.2)" : "rgba(225, 29, 72, 0.15)"),
  }
}

function toLineData(points: IndicatorPoint[]): LineData<Time>[] {
  return points.map(p => ({ time: p.time as Time, value: p.value }))
}

function getIndicatorColor(id: IndicatorId): string {
  return INDICATORS.find(i => i.id === id)?.color ?? "#94A3B8"
}

function formatLegendNum(v: number): string {
  return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatLegendVol(v: number): string {
  if (v >= 10_000_000) return `${(v / 10_000_000).toFixed(2)} Cr`
  if (v >= 100_000) return `${(v / 100_000).toFixed(2)} L`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)} K`
  return v.toLocaleString("en-IN")
}

const RANGE_SECONDS: Record<string, number> = {
  "1D": 86400,
  "5D": 5 * 86400,
  "1M": 30 * 86400,
  "3M": 90 * 86400,
  "6M": 180 * 86400,
  "1Y": 365 * 86400,
  "5Y": 1825 * 86400,
}

// Index of the first candle inside `range`, or null when the range covers all data.
function rangeStartIndex(candles: StockCandle[], range: string | null | undefined): number | null {
  if (!range || range === "ALL" || !RANGE_SECONDS[range] || candles.length < 2) return null
  const targetStart = candles[candles.length - 1].time - RANGE_SECONDS[range]
  const idx = candles.findIndex(c => c.time >= targetStart)
  if (idx <= 0 || idx >= candles.length - 1) return null
  return idx
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function StockChart({ candles, resolution, activeIndicators, selectedRange, onUserZoom }: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [ohlcv, setOhlcv] = useState<OHLCVData | null>(null)

  // Latest-value refs so zooming never changes buildChart's identity — otherwise
  // the first zoom would tear the chart down and rebuild it mid-gesture.
  const selectedRangeRef = useRef(selectedRange)
  const onUserZoomRef = useRef(onUserZoom)
  const candlesRef = useRef(candles)
  selectedRangeRef.current = selectedRange
  onUserZoomRef.current = onUserZoom
  candlesRef.current = candles

  // Guards for the visible-range subscription: suppress while we drive the range
  // ourselves, and notify the parent only once per gesture. Time-based because
  // the library dispatches range changes asynchronously.
  // Notify the parent at most once per gesture; re-armed whenever we apply a range.
  const notified = useRef(false)
  const gestureCleanup = useRef<(() => void) | null>(null)

  const isIntraday = ["1", "5", "15", "30", "60", "120"].includes(resolution)

  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null
  const displayData = ohlcv || (lastCandle ? {
    open: lastCandle.open,
    high: lastCandle.high,
    low: lastCandle.low,
    close: lastCandle.close,
    volume: lastCandle.volume,
    change: lastCandle.close - lastCandle.open,
    changePct: lastCandle.open !== 0 ? ((lastCandle.close - lastCandle.open) / lastCandle.open) * 100 : 0,
  } : null)

  // Apply a range without tearing the chart down. Suppressed so it doesn't
  // register as a user zoom.
  const applyRange = useCallback((chart: IChartApi, data: StockCandle[], range: string | null | undefined) => {
    const ts = chart.timeScale()
    notified.current = false
    const idx = rangeStartIndex(data, range)
    if (idx === null) {
      ts.fitContent()
    } else {
      ts.setVisibleLogicalRange({ from: idx, to: data.length - 1 })
    }
  }, [])

  // A range button is "active" until the user actually manipulates the chart.
  // Driven off real input events rather than visible-range changes — the library
  // emits those while it settles (autoscale, rightOffset, resize), which is
  // indistinguishable from a gesture after the fact.
  const notifyUserGesture = useCallback(() => {
    if (notified.current) return
    notified.current = true
    onUserZoomRef.current?.()
  }, [])

  // Geometric zoom animation. TradingView's zoom is multiplicative — measured at
  // R²=0.996 for a constant ratio per frame — so interpolate the factor in log
  // space rather than linearly.
  const animateZoom = useCallback((factor: number) => {
    const ts = chartRef.current?.timeScale()
    if (!ts) return
    const range = ts.getVisibleLogicalRange()
    if (!range) return
    const center = (range.from + range.to) / 2
    const startHalf = (range.to - range.from) / 2

    if (prefersReducedMotion()) {
      const half = startHalf * factor
      ts.setVisibleLogicalRange({ from: center - half, to: center + half })
      return
    }

    const t0 = performance.now()
    const DURATION = 180
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / DURATION)
      const eased = 1 - Math.pow(1 - p, 3)
      const half = startHalf * Math.pow(factor, eased)
      ts.setVisibleLogicalRange({ from: center - half, to: center + half })
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [])

  const handleZoomIn = useCallback(() => {
    notifyUserGesture()
    animateZoom(0.7)
  }, [animateZoom, notifyUserGesture])

  const handleZoomOut = useCallback(() => {
    notifyUserGesture()
    animateZoom(1.4)
  }, [animateZoom, notifyUserGesture])

  const handleReset = useCallback(() => {
    if (!chartRef.current) return
    applyRange(chartRef.current, candlesRef.current, selectedRangeRef.current)
  }, [applyRange])

  const buildChart = useCallback(() => {
    if (!containerRef.current || candles.length === 0) return

    gestureCleanup.current?.()
    gestureCleanup.current = null
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const dark = isDark()
    const colors = getChartColors(dark)

    const hasRSI = activeIndicators.has("rsi")
    const hasMACD = activeIndicators.has("macd")

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.bg },
        textColor: colors.text,
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: colors.crosshair, width: 1, style: 3, labelBackgroundColor: colors.labelBg },
        horzLine: { color: colors.crosshair, width: 1, style: 3, labelBackgroundColor: colors.labelBg },
      },
      rightPriceScale: {
        borderColor: colors.border,
        autoScale: true,
        scaleMargins: {
          top: 0.05,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: isIntraday,
        secondsVisible: false,
        fixLeftEdge: false,
        // Let the view run past the last candle the way TradingView does — a
        // pinned right edge makes zoom and pan feel like they hit a wall.
        fixRightEdge: false,
        rightOffset: 12,
        minBarSpacing: 0.5,
      },
      // deltaY (vertical scroll / pinch) zooms, deltaX (two-finger horizontal
      // swipe) pans. handleScroll.mouseWheel was false, so trackpad panning was
      // dead and every gesture came through as a zoom.
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
        axisDoubleClickReset: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
    })

    // --- Main pane: Candlesticks ---
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: colors.upColor,
      downColor: colors.downColor,
      borderVisible: false,
      wickUpColor: colors.upWick,
      wickDownColor: colors.downWick,
    })
    candleSeries.setData(
      candles.map(c => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      } as CandlestickData<Time>))
    )

    // --- Volume (always visible) ---
    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    })
    volSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })
    volSeries.setData(
      candles.map(c => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open ? colors.volUp : colors.volDown,
      } as HistogramData<Time>))
    )

    // --- OHLCV crosshair legend ---
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        setOhlcv(null)
        return
      }
      const candleData = param.seriesData.get(candleSeries) as CandlestickData<Time> | undefined
      if (candleData && "open" in candleData) {
        setOhlcv({
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: (param.seriesData.get(volSeries) as HistogramData<Time> | undefined)?.value ?? 0,
          change: candleData.close - candleData.open,
          changePct: candleData.open !== 0 ? ((candleData.close - candleData.open) / candleData.open) * 100 : 0,
        })
      }
    })

    // --- Overlay indicators on main pane ---
    if (activeIndicators.has("ema20") && candles.length >= 20) {
      const s = chart.addSeries(LineSeries, { color: getIndicatorColor("ema20"), lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false })
      s.setData(toLineData(computeEMA(candles, 20)))
    }
    if (activeIndicators.has("ema50") && candles.length >= 50) {
      const s = chart.addSeries(LineSeries, { color: getIndicatorColor("ema50"), lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false })
      s.setData(toLineData(computeEMA(candles, 50)))
    }
    if (activeIndicators.has("ema100") && candles.length >= 100) {
      const s = chart.addSeries(LineSeries, { color: getIndicatorColor("ema100"), lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false })
      s.setData(toLineData(computeEMA(candles, 100)))
    }
    if (activeIndicators.has("ema200") && candles.length >= 200) {
      const s = chart.addSeries(LineSeries, { color: getIndicatorColor("ema200"), lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false })
      s.setData(toLineData(computeEMA(candles, 200)))
    }
    if (activeIndicators.has("vwap") && candles.length > 0) {
      const s = chart.addSeries(LineSeries, { color: getIndicatorColor("vwap"), lineWidth: 1, lineStyle: 2, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false })
      s.setData(toLineData(computeVWAP(candles)))
    }

    // --- Bollinger Bands ---
    if (activeIndicators.has("bollinger") && candles.length >= 20) {
      const bb = computeBollinger(candles)
      const bbColor = getIndicatorColor("bollinger")
      const mid = chart.addSeries(LineSeries, { color: bbColor, lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false })
      mid.setData(toLineData(bb.middle))

      const upper = chart.addSeries(LineSeries, { color: bbColor, lineWidth: 1, lineStyle: 2, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false })
      upper.setData(toLineData(bb.upper))

      const lower = chart.addSeries(LineSeries, { color: bbColor, lineWidth: 1, lineStyle: 2, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false })
      lower.setData(toLineData(bb.lower))
    }

    // --- RSI in separate pane ---
    if (hasRSI && candles.length >= 15) {
      const rsiPane = chart.addPane()
      const rsiData = computeRSI(candles)
      const rsiSeries = rsiPane.addSeries(LineSeries, {
        color: getIndicatorColor("rsi"),
        lineWidth: 2,
        lastValueVisible: true,
        priceLineVisible: false,
        priceFormat: { type: "custom", formatter: (v: number) => v.toFixed(1) },
      })
      rsiSeries.setData(toLineData(rsiData))

      const overbought = rsiData.map(p => ({ time: p.time as Time, value: 70 }))
      const oversold = rsiData.map(p => ({ time: p.time as Time, value: 30 }))
      const ob = rsiPane.addSeries(LineSeries, { color: colors.downColor, lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false })
      ob.setData(overbought)
      const os = rsiPane.addSeries(LineSeries, { color: colors.upColor, lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false })
      os.setData(oversold)
    }

    // --- MACD in separate pane ---
    if (hasMACD && candles.length >= 26) {
      const macdPane = chart.addPane()
      const macdData = computeMACD(candles, 12, 26, 9, dark)

      const macdHist = macdPane.addSeries(HistogramSeries, {
        lastValueVisible: false,
        priceLineVisible: false,
        priceFormat: { type: "custom", formatter: (v: number) => v.toFixed(2) },
      })
      macdHist.setData(macdData.histogram.map(h => ({ time: h.time as Time, value: h.value, color: h.color })))

      const macdLine = macdPane.addSeries(LineSeries, {
        color: cssVar("--color-info") || "#3B82F6",
        lineWidth: 2,
        lastValueVisible: true,
        priceLineVisible: false,
        priceFormat: { type: "custom", formatter: (v: number) => v.toFixed(2) },
      })
      macdLine.setData(toLineData(macdData.macd))

      const signalLine = macdPane.addSeries(LineSeries, {
        color: cssVar("--color-warning") || "#F59E0B",
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
      })
      signalLine.setData(toLineData(macdData.signal))
    }

    applyRange(chart, candles, selectedRangeRef.current)

    // Wheel = zoom or pan. Pointer counts only once it moves past a small
    // threshold, so a click or crosshair hover doesn't deselect the range.
    const el = containerRef.current
    let dragging = false
    let startX = 0
    let startY = 0
    const onWheel = () => notifyUserGesture()
    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      startX = e.clientX
      startY = e.clientY
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) {
        dragging = false
        notifyUserGesture()
      }
    }
    const endDrag = () => { dragging = false }
    el.addEventListener("wheel", onWheel, { passive: true })
    el.addEventListener("pointerdown", onPointerDown)
    el.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", endDrag)

    gestureCleanup.current = () => {
      el.removeEventListener("wheel", onWheel)
      el.removeEventListener("pointerdown", onPointerDown)
      el.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", endDrag)
    }

    chartRef.current = chart
  }, [candles, resolution, isIntraday, activeIndicators, applyRange, notifyUserGesture])

  // Re-apply the range when the user picks one, without rebuilding the chart.
  useEffect(() => {
    if (!chartRef.current || !selectedRange) return
    applyRange(chartRef.current, candlesRef.current, selectedRange)
  }, [selectedRange, applyRange])

  useEffect(() => {
    buildChart()

    const ro = new ResizeObserver(() => {
      if (!chartRef.current || !containerRef.current) return
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      })
      // A width change keeps bar spacing and so reveals more bars — re-pin the
      // selected range, and keep it from registering as a user zoom. If the user
      // has already zoomed (no selected range) their view is left alone.
      if (selectedRangeRef.current) {
        applyRange(chartRef.current, candlesRef.current, selectedRangeRef.current)
      }
    })
    if (containerRef.current) ro.observe(containerRef.current)

    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const themeChange = () => buildChart()
    mq.addEventListener("change", themeChange)

    const mo = new MutationObserver(() => buildChart())
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

    return () => {
      mq.removeEventListener("change", themeChange)
      mo.disconnect()
      ro.disconnect()
      gestureCleanup.current?.()
      gestureCleanup.current = null
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [buildChart])

  const isUp = displayData ? displayData.close >= displayData.open : true

  return (
    <div className="relative w-full" style={{ height: "100%", minHeight: 300 }}>
      {/* OHLCV Legend */}
      {displayData && (
        <div
          className="absolute top-2 left-2 z-10 flex items-center gap-3 px-2.5 py-1.5 rounded-lg font-mono tabular-nums text-[11px]"
          style={{
            backgroundColor: "rgba(var(--bg-card-rgb, 0,0,0), 0.75)",
            backdropFilter: "blur(8px)",
            color: "var(--text-secondary)",
            pointerEvents: "none",
          }}
        >
          <span>
            O <span style={{ color: isUp ? "var(--color-profit)" : "var(--color-loss)" }}>{formatLegendNum(displayData.open)}</span>
          </span>
          <span>
            H <span style={{ color: isUp ? "var(--color-profit)" : "var(--color-loss)" }}>{formatLegendNum(displayData.high)}</span>
          </span>
          <span>
            L <span style={{ color: isUp ? "var(--color-profit)" : "var(--color-loss)" }}>{formatLegendNum(displayData.low)}</span>
          </span>
          <span>
            C <span style={{ color: isUp ? "var(--color-profit)" : "var(--color-loss)" }}>{formatLegendNum(displayData.close)}</span>
          </span>
          <span style={{ color: isUp ? "var(--color-profit)" : "var(--color-loss)" }}>
            {displayData.change >= 0 ? "+" : ""}{formatLegendNum(displayData.change)} ({displayData.changePct >= 0 ? "+" : ""}{displayData.changePct.toFixed(2)}%)
          </span>
          <span style={{ color: "var(--text-muted)" }}>
            Vol {formatLegendVol(displayData.volume)}
          </span>
        </div>
      )}

      {/* Zoom Controls */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-1.5 py-1 rounded-lg"
        style={{
          backgroundColor: "rgba(var(--bg-card-rgb, 0,0,0), 0.75)",
          backdropFilter: "blur(8px)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded-md transition-colors cursor-pointer"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
          aria-label="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded-md transition-colors cursor-pointer"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
          aria-label="Zoom in"
        >
          <ZoomIn size={14} />
        </button>
        <div style={{ width: 1, height: 16, backgroundColor: "var(--border-subtle)" }} />
        <button
          onClick={handleReset}
          className="p-1.5 rounded-md transition-colors cursor-pointer"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
          aria-label="Reset zoom"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Chart */}
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: "100%", minHeight: 300 }}
      />
    </div>
  )
}
