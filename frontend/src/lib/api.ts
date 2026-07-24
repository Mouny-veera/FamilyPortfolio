import { loadStoredAuth } from "./auth"

const BASE = "/api"

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {}
  if (options?.body) headers["Content-Type"] = "application/json"
  const stored = loadStoredAuth()
  if (stored?.token) {
    headers["Authorization"] = `Bearer ${stored.token}`
  }
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  })
  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/google") {
      const { clearAuth } = await import("./auth")
      clearAuth()
      window.location.reload()
      throw new Error("Session expired")
    }
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || "Request failed")
  }
  return res.json()
}

export interface Member {
  id: number
  name: string
}

export interface Lot {
  id: number
  member_id: number
  ticker: string
  buy_date: string
  buy_qty: number
  buy_rate: number
  buy_value: number
  lot_label: string
  financial_year: string
  notes: string | null
  created_at: string
}

export interface NseSuggestion {
  symbol: string
  company_name: string
  score: number
}

export interface NseSearchResult {
  symbol: string
  company_name: string
  isin: string
}

export interface LotGroup {
  ticker: string
  total_qty: number
  total_invested: number
  lot_count: number
  lots: Lot[]
  current_price: number | null
  current_value: number | null
  unrealized_pnl: number | null
  unrealized_pnl_pct: number | null
  scanner_badge: string | null
  mapping_status: string | null
  nse_suggestions: NseSuggestion[] | null
}

export interface Alert {
  member: Member
  ticker: string
  total_qty: number
  total_buy_value: number
  current_price: number
  current_value: number
  profit: number
  profit_pct: number
  lot_count: number
}

export interface RealizedPnL {
  id: number
  member_id: number
  ticker: string
  buy_date: string
  buy_qty: number
  buy_rate: number
  buy_value: number
  sell_date: string
  sell_qty: number
  sell_rate: number
  sell_value: number
  profit_loss: number
  profit_loss_pct: number
  financial_year: string
  lot_label: string
  notes: string | null
}

export interface HoldingsSummary {
  invested: number
  current_value: number | null
  unrealized_pnl: number | null
  unrealized_pnl_pct: number | null
}

export interface MemberHoldings {
  member: Member
  summary: HoldingsSummary
  holdings: LotGroup[]
  realized_pnl: RealizedPnL[]
}

export interface DashboardMemberSnapshot {
  member: Member
  invested: number
  current_value: number | null
  pnl: number | null
  pnl_pct: number | null
  alert_count: number
}

export interface Dashboard {
  total_invested: number
  total_current_value: number | null
  total_pnl: number | null
  total_pnl_pct: number | null
  active_alerts: number
  last_refresh: string | null
  members: DashboardMemberSnapshot[]
}

export interface ScanResult {
  id: number
  ticker: string
  score: number
  strategy_name: string
  metrics: Record<string, unknown> | null
  scanned_at: string
}

export interface StockCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface StockChart {
  candles: StockCandle[]
  resolution: string
}

export interface StockQuote {
  ticker: string
  last_price: number | null
  change: number | null
  change_pct: number | null
  open: number | null
  high: number | null
  low: number | null
  prev_close: number | null
  volume: number | null
  high_52w: number | null
  low_52w: number | null
}

export type ChartRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y"

export const api = {
  getMembers: () => request<Member[]>("/members"),
  getMember: (id: number) => request<Member>(`/members/${id}`),
  createMember: (name: string) => request<Member>("/members", { method: "POST", body: JSON.stringify({ name }) }),
  updateMember: (id: number, name: string) => request<Member>(`/members/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  deleteMember: (id: number) => request<{ status: string }>(`/members/${id}`, { method: "DELETE" }),
  getHoldings: (memberId: number) => request<MemberHoldings>(`/holdings/${memberId}`),
  addBuy: (data: {
    member_id: number
    ticker: string
    buy_date: string
    buy_qty: number
    buy_rate: number
    notes?: string
  }) => request<Lot>("/holdings/buy", { method: "POST", body: JSON.stringify(data) }),
  sellLot: (data: {
    lot_id: number
    sell_date: string
    sell_qty: number
    sell_rate: number
  }) => request<RealizedPnL>("/holdings/sell", { method: "POST", body: JSON.stringify(data) }),
  sellGroup: (data: {
    member_id: number
    ticker: string
    sell_date: string
    sell_rate: number
  }) => request<RealizedPnL[]>("/holdings/sell-group", { method: "POST", body: JSON.stringify(data) }),
  editLot: (lotId: number, data: {
    buy_date: string
    buy_qty: number
    buy_rate: number
    notes?: string | null
  }) => request<Lot>(`/holdings/lot/${lotId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteLot: (lotId: number) => request<{ status: string }>(`/holdings/lot/${lotId}`, { method: "DELETE" }),
  getDashboard: () => request<Dashboard>("/dashboard"),
  getScanResults: () => request<ScanResult[]>("/scanner/results"),
  runScanner: () => request<{ status: string; results_count: number }>("/scanner/run", { method: "POST" }),
  refreshPrices: () => request<{ updated: number }>("/settings/refresh-prices", { method: "POST" }),
  searchNse: (q: string) => request<NseSearchResult[]>(`/nse/search?q=${encodeURIComponent(q)}`),
  refreshNseMaster: () => request<{ status: string; count?: number }>("/nse/refresh-master", { method: "POST" }),
  getMappingStatus: () => request<Array<{ ticker: string; status: string; suggestions: NseSuggestion[] }>>("/nse/mapping-status"),
  remapTicker: (oldTicker: string, newTicker: string) =>
    request<{ old_ticker: string; new_ticker: string; lots_updated: number }>(
      `/nse/remap?old_ticker=${encodeURIComponent(oldTicker)}&new_ticker=${encodeURIComponent(newTicker)}`,
      { method: "POST" },
    ),
  getAlerts: () => request<Alert[]>("/alerts"),
  getDataProvider: () => request<{ active: string; fyers_configured: boolean; fyers_client_id: string; fyers_fy_id: string; auto_login: boolean }>("/settings/data-provider"),
  setupFyersAutoLogin: (data: { fy_id: string; pin: string; totp_secret: string }) =>
    request<{ status: string; message: string }>("/settings/fyers/setup", { method: "POST", body: JSON.stringify(data) }),
  refreshFyersToken: () => request<{ status: string; message: string }>("/settings/fyers/refresh-token", { method: "POST" }),
  getFyersStatus: () => request<{ connected: boolean; token_valid: boolean; fy_id?: string; message: string }>("/settings/fyers/status"),
  exchangeFyersAuthCode: (auth_code: string) => request<{ status: string; message: string }>("/settings/fyers/manual-token", { method: "POST", body: JSON.stringify({ auth_code }) }),
  removeFyers: () => request<{ status: string; message: string }>("/settings/fyers", { method: "DELETE" }),
  getNifty200Status: () => request<{ count: number; updated_at: string | null; source: string }>("/settings/nifty200-status"),
  refreshNifty200: () => request<{ status: string; count: number }>("/settings/refresh-nifty200", { method: "POST" }),
  getAutoScan: () => request<{ enabled: boolean; scan_time: string; last_auto_scan: string | null; next_scan: string | null }>("/settings/auto-scan"),
  setAutoScan: (enabled: boolean) => request<{ enabled: boolean; scan_time: string; last_auto_scan: string | null; next_scan: string | null }>("/settings/auto-scan", { method: "POST", body: JSON.stringify({ enabled }) }),
  getStockChart: (ticker: string, range: ChartRange = "6M") =>
    request<StockChart>(`/stocks/${encodeURIComponent(ticker)}/chart?range=${range}`),
  getStockQuote: (ticker: string) =>
    request<StockQuote>(`/stocks/${encodeURIComponent(ticker)}/quote`),
  googleLogin: (credential: string) =>
    request<{ token: string; email: string; name: string; picture: string | null }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),
}
