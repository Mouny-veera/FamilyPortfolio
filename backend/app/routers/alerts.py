from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Member, Lot, PriceCache
from ..schemas import MemberOut

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

PROFIT_ALERT_THRESHOLD = 10.0


@router.get("")
async def get_alerts(db: AsyncSession = Depends(get_db)):
    members_result = await db.execute(select(Member).order_by(Member.id))
    members = members_result.scalars().all()

    prices_result = await db.execute(select(PriceCache))
    price_map = {p.ticker: p for p in prices_result.scalars().all()}

    alerts = []

    for member in members:
        lots_result = await db.execute(
            select(Lot)
            .where(Lot.member_id == member.id)
            .order_by(Lot.ticker, Lot.buy_date)
        )
        lots = lots_result.scalars().all()

        grouped: dict[str, list] = {}
        for lot in lots:
            grouped.setdefault(lot.ticker, []).append(lot)

        for ticker, ticker_lots in grouped.items():
            price = price_map.get(ticker)
            if not price:
                continue

            total_qty = sum(l.buy_qty for l in ticker_lots)
            total_buy_value = sum(l.buy_value for l in ticker_lots)
            current_value = round(total_qty * price.last_price, 2)
            profit = round(current_value - total_buy_value, 2)
            profit_pct = round((profit / total_buy_value) * 100, 2) if total_buy_value else 0

            if profit_pct >= PROFIT_ALERT_THRESHOLD:
                alerts.append({
                    "member": MemberOut.model_validate(member).model_dump(),
                    "ticker": ticker,
                    "total_qty": total_qty,
                    "total_buy_value": round(total_buy_value, 2),
                    "current_price": price.last_price,
                    "current_value": current_value,
                    "profit": profit,
                    "profit_pct": profit_pct,
                    "lot_count": len(ticker_lots),
                })

    alerts.sort(key=lambda a: -a["profit_pct"])
    return alerts
