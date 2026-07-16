from datetime import date, datetime
from pydantic import BaseModel, Field, computed_field


class MemberOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class BuyRequest(BaseModel):
    member_id: int
    ticker: str
    buy_date: date
    buy_qty: float = Field(gt=0, description="Quantity must be positive")
    buy_rate: float = Field(gt=0, description="Rate must be positive")
    notes: str | None = None


class SellRequest(BaseModel):
    lot_id: int
    sell_date: date
    sell_qty: float = Field(gt=0, description="Sell quantity must be positive")
    sell_rate: float = Field(gt=0, description="Sell rate must be positive")


class SellGroupRequest(BaseModel):
    member_id: int
    ticker: str
    sell_date: date
    sell_rate: float = Field(gt=0, description="Sell rate must be positive")


class LotOut(BaseModel):
    id: int
    member_id: int
    ticker: str
    buy_date: date
    buy_qty: float
    buy_rate: float
    buy_value: float
    lot_label: str
    financial_year: str
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class NseSuggestion(BaseModel):
    symbol: str
    company_name: str
    score: float


class LotGroupOut(BaseModel):
    ticker: str
    total_qty: float
    total_invested: float
    lot_count: int
    lots: list[LotOut]
    current_price: float | None = None
    current_value: float | None = None
    unrealized_pnl: float | None = None
    unrealized_pnl_pct: float | None = None
    scanner_badge: str | None = None
    mapping_status: str | None = None
    nse_suggestions: list[NseSuggestion] | None = None


class RealizedPnLOut(BaseModel):
    id: int
    member_id: int
    ticker: str
    buy_date: date
    buy_qty: float
    buy_rate: float
    buy_value: float
    sell_date: date
    sell_qty: float
    sell_rate: float
    sell_value: float
    profit_loss: float
    profit_loss_pct: float
    financial_year: str
    lot_label: str
    notes: str | None = None

    model_config = {"from_attributes": True}


class HoldingsSummary(BaseModel):
    invested: float
    current_value: float | None = None
    unrealized_pnl: float | None = None
    unrealized_pnl_pct: float | None = None


class MemberHoldingsOut(BaseModel):
    member: MemberOut
    summary: HoldingsSummary
    holdings: list[LotGroupOut]
    realized_pnl: list[RealizedPnLOut]


class DashboardMemberSnapshot(BaseModel):
    member: MemberOut
    invested: float
    current_value: float | None = None
    pnl: float | None = None
    pnl_pct: float | None = None
    alert_count: int = 0


class DashboardOut(BaseModel):
    total_invested: float
    total_current_value: float | None = None
    total_pnl: float | None = None
    total_pnl_pct: float | None = None
    active_alerts: int
    last_refresh: datetime | None = None
    members: list[DashboardMemberSnapshot]


class PriceCacheOut(BaseModel):
    ticker: str
    last_price: float
    change_pct: float
    updated_at: datetime

    model_config = {"from_attributes": True}


class ScanResultOut(BaseModel):
    id: int
    ticker: str
    score: float
    strategy_name: str
    metrics: dict | None = None
    scanned_at: datetime

    model_config = {"from_attributes": True}
