import { useEffect, useRef, useCallback } from "react"
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  ColorType,
  CrosshairMode,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
} from "lightweight-charts"
import type { StockCandle } from "@/lib/api"
import {
  type IndicatorId,
  type IndicatorPoint,
  INDICATORS,
  computeSMA,
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
}

function isDark() {
  const html = document.documentElement
  if (html.classList.contains("dark")) return true
  if (html.classList.contains("light")) return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function getChartColors(dark: boolean) {
  return dark
    ? {
        bg: "transparent",
        text: "#94A3B8",
        grid: "rgba(148, 163, 184, 0.06)",
        border: "rgba(148, 163, 184, 0.08)",
        crosshair: "rgba(148, 163, 184, 0.3)",
        labelBg: "#1E293B",
        upColor: "#10B981",
        downColor: "#F43F5E",
        upWick: "#10B981",
        downWick: "#F43F5E",
        volUp: "rgba(16, 185, 129, 0.2)",
        volDown: "rgba(244, 63, 94, 0.2)",
        bbFill: "rgba(99, 102, 241, 0.06)",
        rsiOverbought: "rgba(244, 63, 94, 0.15)",
        rsiOversold: "rgba(16, 185, 129, 0.15)",
      }
    : {
        bg: "transparent",
        text: "#78716C",
        grid: "rgba(0, 0, 0, 0.04)",
        border: "rgba(0, 0, 0, 0.06)",
        crosshair: "rgba(0, 0, 0, 0.2)",
        labelBg: "#57534E",
        upColor: "#059669",
        downColor: "#E11D48",
        upWick: "#059669",
        downWick: "#E11D48",
        volUp: "rgba(5, 150, 105, 0.15)",
        volDown: "rgba(225, 29, 72, 0.15)",
        bbFill: "rgba(99, 102, 241, 0.04)",
        rsiOverbought: "rgba(225, 29, 72, 0.08)",
        rsiOversold: "rgba(5, 150, 105, 0.08)",
      }
}

function toLineData(points: IndicatorPoint[]): LineData<Time>[] {
  return points.map(p => ({ time: p.time as Time, value: p.value }))
}

function getIndicatorColor(id: IndicatorId): string {
  return INDICATORS.find(i => i.id === id)?.color ?? "#94A3B8"
}

export function StockChart({ candles, resolution, activeIndicators }: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRefs = useRef<ISeriesApi<string>[]>([])

  const isIntraday = ["1", "5", "15", "60"].includes(resolution)

  const buildChart = useCallback(() => {
    if (!containerRef.current || candles.length === 0) return

    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      seriesRefs.current = []
    }

    const dark = isDark()
    const colors = getChartColors(dark)

    const hasRSI = activeIndicators.has("rsi")
    const hasMACD = activeIndicators.has("macd")
    const hasVolume = activeIndicators.has("volume")

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
        scaleMargins: {
          top: 0.05,
          bottom: hasVolume ? 0.2 : 0.05,
        },
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: isIntraday,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
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
    seriesRefs.current.push(candleSeries as ISeriesApi<string>)

    // --- Volume on main pane ---
    if (hasVolume) {
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
      seriesRefs.current.push(volSeries as ISeriesApi<string>)
    }

    // --- Overlay indicators on main pane ---
    if (activeIndicators.has("sma20") && candles.length >= 20) {
      const s = chart.addSeries(LineSeries, { color: getIndicatorColor("sma20"), lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false })
      s.setData(toLineData(computeSMA(candles, 20)))
      seriesRefs.current.push(s as ISeriesApi<string>)
    }
    if (activeIndicators.has("sma50") && candles.length >= 50) {
      const s = chart.addSeries(LineSeries, { color: getIndicatorColor("sma50"), lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false })
      s.setData(toLineData(computeSMA(candles, 50)))
      seriesRefs.current.push(s as ISeriesApi<string>)
    }
    if (activeIndicators.has("sma200") && candles.length >= 200) {
      const s = chart.addSeries(LineSeries, { color: getIndicatorColor("sma200"), lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false })
      s.setData(toLineData(computeSMA(candles, 200)))
      seriesRefs.current.push(s as ISeriesApi<string>)
    }
    if (activeIndicators.has("ema20") && candles.length >= 20) {
      const s = chart.addSeries(LineSeries, { color: getIndicatorColor("ema20"), lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false })
      s.setData(toLineData(computeEMA(candles, 20)))
      seriesRefs.current.push(s as ISeriesApi<string>)
    }
    if (activeIndicators.has("ema50") && candles.length >= 50) {
      const s = chart.addSeries(LineSeries, { color: getIndicatorColor("ema50"), lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false })
      s.setData(toLineData(computeEMA(candles, 50)))
      seriesRefs.current.push(s as ISeriesApi<string>)
    }
    if (activeIndicators.has("vwap") && candles.length > 0) {
      const s = chart.addSeries(LineSeries, { color: getIndicatorColor("vwap"), lineWidth: 1, lineStyle: 2, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false })
      s.setData(toLineData(computeVWAP(candles)))
      seriesRefs.current.push(s as ISeriesApi<string>)
    }

    // --- Bollinger Bands ---
    if (activeIndicators.has("bollinger") && candles.length >= 20) {
      const bb = computeBollinger(candles)
      const bbColor = getIndicatorColor("bollinger")
      const mid = chart.addSeries(LineSeries, { color: bbColor, lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false })
      mid.setData(toLineData(bb.middle))
      seriesRefs.current.push(mid as ISeriesApi<string>)

      const upper = chart.addSeries(LineSeries, { color: bbColor, lineWidth: 1, lineStyle: 2, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false })
      upper.setData(toLineData(bb.upper))
      seriesRefs.current.push(upper as ISeriesApi<string>)

      const lower = chart.addSeries(LineSeries, { color: bbColor, lineWidth: 1, lineStyle: 2, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false })
      lower.setData(toLineData(bb.lower))
      seriesRefs.current.push(lower as ISeriesApi<string>)
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
      seriesRefs.current.push(rsiSeries as ISeriesApi<string>)

      // 70/30 reference lines
      const overbought = rsiData.map(p => ({ time: p.time as Time, value: 70 }))
      const oversold = rsiData.map(p => ({ time: p.time as Time, value: 30 }))
      const ob = rsiPane.addSeries(LineSeries, { color: colors.downColor, lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false })
      ob.setData(overbought)
      seriesRefs.current.push(ob as ISeriesApi<string>)
      const os = rsiPane.addSeries(LineSeries, { color: colors.upColor, lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false })
      os.setData(oversold)
      seriesRefs.current.push(os as ISeriesApi<string>)
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
      seriesRefs.current.push(macdHist as ISeriesApi<string>)

      const macdLine = macdPane.addSeries(LineSeries, {
        color: "#3B82F6",
        lineWidth: 2,
        lastValueVisible: true,
        priceLineVisible: false,
        priceFormat: { type: "custom", formatter: (v: number) => v.toFixed(2) },
      })
      macdLine.setData(toLineData(macdData.macd))
      seriesRefs.current.push(macdLine as ISeriesApi<string>)

      const signalLine = macdPane.addSeries(LineSeries, {
        color: "#F59E0B",
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
      })
      signalLine.setData(toLineData(macdData.signal))
      seriesRefs.current.push(signalLine as ISeriesApi<string>)
    }

    chart.timeScale().fitContent()
    chartRef.current = chart
  }, [candles, resolution, isIntraday, activeIndicators])

  useEffect(() => {
    buildChart()

    const ro = new ResizeObserver(() => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
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
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        seriesRefs.current = []
      }
    }
  }, [buildChart])

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ height: "100%", minHeight: 300 }}
    />
  )
}
