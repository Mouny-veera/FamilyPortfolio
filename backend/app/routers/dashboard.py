from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Member, Lot, PriceCache, RealizedPnL
from ..schemas import (
    DashboardOut, DashboardMemberSnapshot, MemberOut,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

PROFIT_ALERT_THRESHOLD = 10.0


@router.get("", response_model=DashboardOut)
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    members_result = await db.execute(select(Member).order_by(Member.id))
    members = members_result.scalars().all()

    prices_result = await db.execute(select(PriceCache))
    price_map = {p.ticker: p for p in prices_result.scalars().all()}

    last_refresh = None
    if price_map:
        last_refresh = max(p.updated_at for p in price_map.values())

    all_lots_result = await db.execute(select(Lot))
    all_lots = all_lots_result.scalars().all()
    lots_by_member: dict[int, list] = {}
    for lot in all_lots:
        lots_by_member.setdefault(lot.member_id, []).append(lot)

    total_invested = 0.0
    total_current = 0.0
    total_alerts = 0
    has_prices = bool(price_map)
    snapshots: list[DashboardMemberSnapshot] = []

    for member in members:
        lots = lots_by_member.get(member.id, [])

        member_invested = sum(l.buy_value for l in lots)
        member_current = 0.0
        member_alerts = 0

        ticker_groups: dict[str, list] = {}
        for lot in lots:
            ticker_groups.setdefault(lot.ticker, []).append(lot)

        for ticker, ticker_lots in ticker_groups.items():
            price = price_map.get(ticker)
            if not price:
                continue
            group_qty = sum(l.buy_qty for l in ticker_lots)
            group_buy_value = sum(l.buy_value for l in ticker_lots)
            group_current = group_qty * price.last_price
            member_current += group_current
            pnl_pct = ((group_current - group_buy_value) / group_buy_value * 100) if group_buy_value > 0 else 0
            if pnl_pct >= PROFIT_ALERT_THRESHOLD:
                member_alerts += 1

        total_invested += member_invested
        total_current += member_current
        total_alerts += member_alerts

        member_pnl = member_current - member_invested if has_prices else None
        member_pnl_pct = (
            round((member_pnl / member_invested) * 100, 2)
            if member_pnl is not None and member_invested
            else None
        )

        snapshots.append(DashboardMemberSnapshot(
            member=MemberOut.model_validate(member),
            invested=round(member_invested, 2),
            current_value=round(member_current, 2) if has_prices else None,
            pnl=round(member_pnl, 2) if member_pnl is not None else None,
            pnl_pct=member_pnl_pct,
            alert_count=member_alerts,
        ))

    total_pnl = total_current - total_invested if has_prices else None
    total_pnl_pct = (
        round((total_pnl / total_invested) * 100, 2)
        if total_pnl is not None and total_invested
        else None
    )

    return DashboardOut(
        total_invested=round(total_invested, 2),
        total_current_value=round(total_current, 2) if has_prices else None,
        total_pnl=round(total_pnl, 2) if total_pnl is not None else None,
        total_pnl_pct=total_pnl_pct,
        active_alerts=total_alerts,
        last_refresh=last_refresh,
        members=snapshots,
    )


@router.get("/profit-trend")
async def get_profit_trend(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            RealizedPnL.financial_year,
            func.sum(RealizedPnL.profit_loss).label("total_pnl"),
            func.sum(RealizedPnL.buy_value).label("total_invested"),
            func.sum(RealizedPnL.sell_value).label("total_sell_value"),
            func.count(RealizedPnL.id).label("trade_count"),
        )
        .group_by(RealizedPnL.financial_year)
        .order_by(RealizedPnL.financial_year)
    )
    rows = result.all()
    return [
        {
            "financial_year": row.financial_year,
            "total_pnl": round(row.total_pnl, 2),
            "total_invested": round(row.total_invested, 2),
            "total_sell_value": round(row.total_sell_value, 2),
            "trade_count": row.trade_count,
            "pnl_pct": round((row.total_pnl / row.total_invested) * 100, 2) if row.total_invested and row.total_invested > 0 else 0,
        }
        for row in rows
    ]
