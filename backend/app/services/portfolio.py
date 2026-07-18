from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Lot, PriceCache

PROFIT_ALERT_THRESHOLD = 10.0


@dataclass
class TickerPnL:
    ticker: str
    total_qty: float
    total_buy_value: float
    current_price: float
    current_value: float
    profit: float
    profit_pct: float
    lot_count: int


async def load_price_map(db: AsyncSession) -> dict[str, PriceCache]:
    result = await db.execute(select(PriceCache))
    return {p.ticker: p for p in result.scalars().all()}


def compute_ticker_pnl(
    ticker: str,
    lots: list[Lot],
    price: PriceCache | None,
) -> TickerPnL | None:
    if not price:
        return None
    total_qty = sum(l.buy_qty for l in lots)
    total_buy_value = sum(l.buy_value for l in lots)
    current_value = round(total_qty * price.last_price, 2)
    profit = round(current_value - total_buy_value, 2)
    profit_pct = round((profit / total_buy_value) * 100, 2) if total_buy_value > 0 else 0.0
    return TickerPnL(
        ticker=ticker,
        total_qty=total_qty,
        total_buy_value=round(total_buy_value, 2),
        current_price=price.last_price,
        current_value=current_value,
        profit=profit,
        profit_pct=profit_pct,
        lot_count=len(lots),
    )


def group_lots_by_ticker(lots: list[Lot]) -> dict[str, list[Lot]]:
    grouped: dict[str, list[Lot]] = {}
    for lot in lots:
        grouped.setdefault(lot.ticker, []).append(lot)
    return grouped


def is_alert(pnl: TickerPnL) -> bool:
    return pnl.profit_pct >= PROFIT_ALERT_THRESHOLD
