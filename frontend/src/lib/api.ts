const BASE = "/api"

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {}
  if (options?.body) headers["Content-Type"] = "application/json"
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  })
  if (!res.ok) {
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

export interface ProfitTrend {
  financial_year: string
  total_pnl: number
  total_invested: number
  total_sell_value: number
  trade_count: number
  pnl_pct: number
}

export const api = {
  getMembers: () => request<Member[]>("/members"),
  getMember: (id: number) => request<Member>(`/members/${id}`),
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
  deleteLot: (lotId: number) => request<{ status: string }>(`/holdings/lot/${lotId}`, { method: "DELETE" }),
  getDashboard: () => request<Dashboard>("/dashboard"),
  getProfitTrend: () => request<ProfitTrend[]>("/dashboard/profit-trend"),
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
  removeFyers: () => request<{ status: string; message: string }>("/settings/fyers", { method: "DELETE" }),
}
