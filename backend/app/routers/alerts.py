from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Member, Lot
from ..schemas import MemberOut
from ..services.portfolio import load_price_map, group_lots_by_ticker, compute_ticker_pnl, is_alert

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
async def get_alerts(db: AsyncSession = Depends(get_db)):
    members_result = await db.execute(select(Member).order_by(Member.id))
    members = members_result.scalars().all()

    price_map = await load_price_map(db)

    alerts = []

    for member in members:
        lots_result = await db.execute(
            select(Lot)
            .where(Lot.member_id == member.id)
            .order_by(Lot.ticker, Lot.buy_date)
        )
        lots = lots_result.scalars().all()

        for ticker, ticker_lots in group_lots_by_ticker(lots).items():
            pnl = compute_ticker_pnl(ticker, ticker_lots, price_map.get(ticker))
            if pnl and is_alert(pnl):
                alerts.append({
                    "member": MemberOut.model_validate(member).model_dump(),
                    "ticker": ticker,
                    "total_qty": pnl.total_qty,
                    "total_buy_value": pnl.total_buy_value,
                    "current_price": pnl.current_price,
                    "current_value": pnl.current_value,
                    "profit": pnl.profit,
                    "profit_pct": pnl.profit_pct,
                    "lot_count": pnl.lot_count,
                })

    alerts.sort(key=lambda a: -a["profit_pct"])
    return alerts
