import type { StockCandle } from "@/lib/api"

export interface IndicatorPoint {
  time: number
  value: number
}

export interface MACDResult {
  macd: IndicatorPoint[]
  signal: IndicatorPoint[]
  histogram: { time: number; value: number; color: string }[]
}

export interface BollingerResult {
  upper: IndicatorPoint[]
  middle: IndicatorPoint[]
  lower: IndicatorPoint[]
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000
}

export function computeSMA(candles: StockCandle[], period: number): IndicatorPoint[] {
  if (candles.length < period) return []
  const result: IndicatorPoint[] = []
  let sum = 0
  for (let i = 0; i < period; i++) sum += candles[i].close
  result.push({ time: candles[period - 1].time, value: round2(sum / period) })
  for (let i = period; i < candles.length; i++) {
    sum += candles[i].close - candles[i - period].close
    result.push({ time: candles[i].time, value: round2(sum / period) })
  }
  return result
}

export function computeEMA(candles: StockCandle[], period: number): IndicatorPoint[] {
  if (candles.length < period) return []
  const k = 2 / (period + 1)
  let sum = 0
  for (let i = 0; i < period; i++) sum += candles[i].close
  let ema = sum / period
  const result: IndicatorPoint[] = [{ time: candles[period - 1].time, value: round2(ema) }]
  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k)
    result.push({ time: candles[i].time, value: round2(ema) })
  }
  return result
}

function emaFromValues(values: number[], period: number): number[] {
  if (values.length < period) return []
  const k = 2 / (period + 1)
  let sum = 0
  for (let i = 0; i < period; i++) sum += values[i]
  let ema = sum / period
  const result = new Array(period - 1).fill(NaN)
  result.push(ema)
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k)
    result.push(ema)
  }
  return result
}

export function computeRSI(candles: StockCandle[], period: number = 14): IndicatorPoint[] {
  if (candles.length < period + 1) return []

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close
    if (change > 0) avgGain += change
    else avgLoss -= change
  }
  avgGain /= period
  avgLoss /= period

  const result: IndicatorPoint[] = []
  const rsi0 = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  result.push({ time: candles[period].time, value: round2(rsi0) })

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
    result.push({ time: candles[i].time, value: round2(rsi) })
  }
  return result
}

export function computeMACD(
  candles: StockCandle[],
  fast: number = 12,
  slow: number = 26,
  signalPeriod: number = 9,
  isDark: boolean = true,
): MACDResult {
  if (candles.length < slow) return { macd: [], signal: [], histogram: [] }

  const closes = candles.map(c => c.close)
  const emaFast = emaFromValues(closes, fast)
  const emaSlow = emaFromValues(closes, slow)

  const macdValues: number[] = new Array(candles.length).fill(NaN)
  const startIdx = slow - 1
  for (let i = startIdx; i < candles.length; i++) {
    macdValues[i] = emaFast[i] - emaSlow[i]
  }

  const validMacdValues: number[] = []
  const validMacdIndices: number[] = []
  for (let i = 0; i < candles.length; i++) {
    if (!isNaN(macdValues[i])) {
      validMacdValues.push(macdValues[i])
      validMacdIndices.push(i)
    }
  }

  const signalEma = emaFromValues(validMacdValues, signalPeriod)

  const macd: IndicatorPoint[] = []
  const signal: IndicatorPoint[] = []
  const histogram: { time: number; value: number; color: string }[] = []

  const colorUp = isDark ? "rgba(16, 185, 129, 0.6)" : "rgba(5, 150, 105, 0.6)"
  const colorDown = isDark ? "rgba(244, 63, 94, 0.6)" : "rgba(225, 29, 72, 0.6)"

  for (let vi = 0; vi < validMacdValues.length; vi++) {
    const ci = validMacdIndices[vi]
    const m = validMacdValues[vi]
    macd.push({ time: candles[ci].time, value: round4(m) })

    if (vi < signalEma.length && !isNaN(signalEma[vi])) {
      const s = signalEma[vi]
      signal.push({ time: candles[ci].time, value: round4(s) })
      const h = m - s
      histogram.push({
        time: candles[ci].time,
        value: round4(h),
        color: h >= 0 ? colorUp : colorDown,
      })
    }
  }

  return { macd, signal, histogram }
}

export function computeBollinger(candles: StockCandle[], period: number = 20, multiplier: number = 2): BollingerResult {
  if (candles.length < period) return { upper: [], middle: [], lower: [] }

  const upper: IndicatorPoint[] = []
  const middle: IndicatorPoint[] = []
  const lower: IndicatorPoint[] = []

  let sum = 0
  for (let i = 0; i < period; i++) sum += candles[i].close

  for (let i = period - 1; i < candles.length; i++) {
    if (i >= period) {
      sum += candles[i].close - candles[i - period].close
    }
    const sma = sum / period

    let sqSum = 0
    for (let j = i - period + 1; j <= i; j++) {
      const d = candles[j].close - sma
      sqSum += d * d
    }
    const stdDev = Math.sqrt(sqSum / period)

    middle.push({ time: candles[i].time, value: round2(sma) })
    upper.push({ time: candles[i].time, value: round2(sma + multiplier * stdDev) })
    lower.push({ time: candles[i].time, value: round2(sma - multiplier * stdDev) })
  }

  return { upper, middle, lower }
}

export function computeVWAP(candles: StockCandle[]): IndicatorPoint[] {
  if (candles.length === 0) return []
  const result: IndicatorPoint[] = []

  let cumVolPrice = 0
  let cumVol = 0
  let lastDate = -1

  for (const c of candles) {
    const dayStart = Math.floor(c.time / 86400) * 86400
    if (dayStart !== lastDate) {
      cumVolPrice = 0
      cumVol = 0
      lastDate = dayStart
    }
    const typicalPrice = (c.high + c.low + c.close) / 3
    cumVolPrice += typicalPrice * c.volume
    cumVol += c.volume
    if (cumVol > 0) {
      result.push({ time: c.time, value: round2(cumVolPrice / cumVol) })
    }
  }
  return result
}

export type IndicatorId = "sma20" | "sma50" | "sma200" | "ema20" | "ema50" | "bollinger" | "vwap" | "rsi" | "macd" | "volume"

export interface IndicatorConfig {
  id: IndicatorId
  label: string
  shortLabel: string
  group: "overlay" | "oscillator" | "volume"
  color: string
  description: string
}

export const INDICATORS: IndicatorConfig[] = [
  { id: "sma20", label: "SMA 20", shortLabel: "SMA20", group: "overlay", color: "#F59E0B", description: "20-day simple moving average" },
  { id: "sma50", label: "SMA 50", shortLabel: "SMA50", group: "overlay", color: "#3B82F6", description: "50-day simple moving average" },
  { id: "sma200", label: "SMA 200", shortLabel: "SMA200", group: "overlay", color: "#8B5CF6", description: "200-day simple moving average" },
  { id: "ema20", label: "EMA 20", shortLabel: "EMA20", group: "overlay", color: "#EC4899", description: "20-day exponential moving average" },
  { id: "ema50", label: "EMA 50", shortLabel: "EMA50", group: "overlay", color: "#14B8A6", description: "50-day exponential moving average" },
  { id: "bollinger", label: "Bollinger Bands", shortLabel: "BB", group: "overlay", color: "#6366F1", description: "20-period bands with 2x std deviation" },
  { id: "vwap", label: "VWAP", shortLabel: "VWAP", group: "overlay", color: "#F97316", description: "Volume weighted average price" },
  { id: "volume", label: "Volume", shortLabel: "Vol", group: "volume", color: "#64748B", description: "Trading volume bars" },
  { id: "rsi", label: "RSI (14)", shortLabel: "RSI", group: "oscillator", color: "#A855F7", description: "Relative strength index, 14-period" },
  { id: "macd", label: "MACD (12,26,9)", shortLabel: "MACD", group: "oscillator", color: "#10B981", description: "Moving avg convergence divergence" },
]

const STORAGE_KEY = "fp-chart-indicators"

export function loadSavedIndicators(): Set<IndicatorId> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return new Set(JSON.parse(saved))
  } catch { /* ignore */ }
  return new Set(["volume"])
}

export function saveIndicators(active: Set<IndicatorId>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...active]))
}
