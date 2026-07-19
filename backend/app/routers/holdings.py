from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Member, Lot, RealizedPnL, PriceCache, ScanResult, derive_financial_year
from ..schemas import (
    BuyRequest, EditLotRequest, SellRequest, SellGroupRequest, LotOut, LotGroupOut,
    RealizedPnLOut, MemberHoldingsOut, HoldingsSummary, MemberOut, NseSuggestion,
)
from ..services.nse_master import fuzzy_match_ticker, get_nse_symbol_set

router = APIRouter(prefix="/api/holdings", tags=["holdings"])


async def _next_lot_label(db: AsyncSession, member_id: int, ticker: str) -> str:
    result = await db.execute(
        select(Lot.lot_label)
        .where(Lot.member_id == member_id, Lot.ticker == ticker)
        .order_by(Lot.lot_label)
    )
    existing = [r[0] for r in result.all()]

    pnl_result = await db.execute(
        select(RealizedPnL.lot_label)
        .where(RealizedPnL.member_id == member_id, RealizedPnL.ticker == ticker)
        .order_by(RealizedPnL.lot_label)
    )
    existing.extend(r[0] for r in pnl_result.all())

    if not existing:
        result = await db.execute(
            select(func.count(func.distinct(Lot.ticker)))
            .where(Lot.member_id == member_id)
        )
        ticker_count = result.scalar() or 0

        pnl_ticker_result = await db.execute(
            select(func.count(func.distinct(RealizedPnL.ticker)))
            .where(
                RealizedPnL.member_id == member_id,
                ~RealizedPnL.ticker.in_(
                    select(Lot.ticker).where(Lot.member_id == member_id)
                ),
            )
        )
        pnl_only_count = pnl_ticker_result.scalar() or 0
        next_num = ticker_count + pnl_only_count + 1
        return str(next_num)

    base_num = existing[0].rstrip("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    suffix_letters = [
        lbl[len(base_num):] for lbl in existing if lbl != base_num and lbl.startswith(base_num)
    ]
    if not suffix_letters:
        return f"{base_num}A"
    last_suffix = sorted(suffix_letters)[-1]
    last_char = last_suffix[-1]
    if last_char == "Z":
        return f"{base_num}{last_suffix}A"
    return f"{base_num}{last_suffix[:-1]}{chr(ord(last_char) + 1)}"


@router.post("/buy", response_model=LotOut)
async def add_buy(req: BuyRequest, db: AsyncSession = Depends(get_db)):
    member = await db.get(Member, req.member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    ticker = req.ticker.upper().strip()
    buy_value = round(req.buy_qty * req.buy_rate, 2)
    fy = derive_financial_year(req.buy_date)
    label = await _next_lot_label(db, req.member_id, ticker)

    lot = Lot(
        member_id=req.member_id,
        ticker=ticker,
        buy_date=req.buy_date,
        buy_qty=req.buy_qty,
        buy_rate=req.buy_rate,
        buy_value=buy_value,
        lot_label=label,
        financial_year=fy,
        notes=req.notes,
    )
    db.add(lot)
    await db.commit()
    await db.refresh(lot)
    return lot


@router.post("/sell", response_model=RealizedPnLOut)
async def sell_lot(req: SellRequest, db: AsyncSession = Depends(get_db)):
    async with db.begin():
        lot_result = await db.execute(
            select(Lot).where(Lot.id == req.lot_id).with_for_update()
        )
        lot = lot_result.scalar_one_or_none()
        if not lot:
            raise HTTPException(status_code=404, detail="Lot not found")

        if round(req.sell_qty, 4) > round(lot.buy_qty, 4):
            raise HTTPException(status_code=400, detail="Sell qty exceeds lot qty")

        sell_value = round(req.sell_qty * req.sell_rate, 2)
        proportional_buy_value = round((req.sell_qty / lot.buy_qty) * lot.buy_value, 2)
        profit_loss = round(sell_value - proportional_buy_value, 2)
        profit_loss_pct = round((profit_loss / proportional_buy_value) * 100, 4) if proportional_buy_value > 0 else 0

        pnl = RealizedPnL(
            member_id=lot.member_id,
            ticker=lot.ticker,
            buy_date=lot.buy_date,
            buy_qty=req.sell_qty,
            buy_rate=lot.buy_rate,
            buy_value=proportional_buy_value,
            sell_date=req.sell_date,
            sell_qty=req.sell_qty,
            sell_rate=req.sell_rate,
            sell_value=sell_value,
            profit_loss=profit_loss,
            profit_loss_pct=profit_loss_pct,
            financial_year=derive_financial_year(req.sell_date),
            lot_label=lot.lot_label,
            notes=lot.notes,
        )
        db.add(pnl)

        remaining_qty = round(lot.buy_qty - req.sell_qty, 4)
        if remaining_qty <= 0:
            await db.delete(lot)
        else:
            lot.buy_qty = remaining_qty
            lot.buy_value = round(lot.buy_value - proportional_buy_value, 2)

        await db.flush()
        await db.refresh(pnl)

    return pnl


@router.post("/sell-group", response_model=list[RealizedPnLOut])
async def sell_group(req: SellGroupRequest, db: AsyncSession = Depends(get_db)):
    async with db.begin():
        member = await db.get(Member, req.member_id)
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")

        ticker = req.ticker.upper().strip()
        lots_result = await db.execute(
            select(Lot)
            .where(Lot.member_id == req.member_id, Lot.ticker == ticker)
            .with_for_update()
            .order_by(Lot.buy_date)
        )
        lots = lots_result.scalars().all()
        if not lots:
            raise HTTPException(status_code=404, detail="No active lots for this ticker")

        results = []
        for lot in lots:
            sell_value = round(lot.buy_qty * req.sell_rate, 2)
            profit_loss = round(sell_value - lot.buy_value, 2)
            profit_loss_pct = round((profit_loss / lot.buy_value) * 100, 4) if lot.buy_value > 0 else 0

            pnl = RealizedPnL(
                member_id=lot.member_id,
                ticker=lot.ticker,
                buy_date=lot.buy_date,
                buy_qty=lot.buy_qty,
                buy_rate=lot.buy_rate,
                buy_value=lot.buy_value,
                sell_date=req.sell_date,
                sell_qty=lot.buy_qty,
                sell_rate=req.sell_rate,
                sell_value=sell_value,
                profit_loss=profit_loss,
                profit_loss_pct=profit_loss_pct,
                financial_year=derive_financial_year(req.sell_date),
                lot_label=lot.lot_label,
                notes=lot.notes,
            )
            db.add(pnl)
            await db.delete(lot)
            results.append(pnl)

        await db.flush()
        for pnl in results:
            await db.refresh(pnl)

    return results


@router.get("/{member_id}", response_model=MemberHoldingsOut)
async def get_member_holdings(member_id: int, db: AsyncSession = Depends(get_db)):
    member = await db.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    lots_result = await db.execute(
        select(Lot)
        .where(Lot.member_id == member_id)
        .order_by(Lot.ticker, Lot.buy_date)
    )
    lots = lots_result.scalars().all()

    member_tickers = list({lot.ticker for lot in lots})
    prices_result = await db.execute(
        select(PriceCache).where(PriceCache.ticker.in_(member_tickers))
    ) if member_tickers else None
    price_map = {p.ticker: p for p in prices_result.scalars().all()} if prices_result else {}

    nse_symbols = get_nse_symbol_set()

    scan_result = await db.execute(
        select(ScanResult.ticker, ScanResult.metrics)
        .where(ScanResult.strategy_name == "fibonacci_retracement")
    )
    scanner_map = {r[0]: r[1] for r in scan_result.all()}

    grouped: dict[str, list[Lot]] = {}
    for lot in lots:
        grouped.setdefault(lot.ticker, []).append(lot)

    holdings: list[LotGroupOut] = []
    total_invested = 0.0
    total_current = 0.0
    has_prices = False

    for ticker, ticker_lots in grouped.items():
        total_qty = sum(l.buy_qty for l in ticker_lots)
        total_inv = sum(l.buy_value for l in ticker_lots)
        total_invested += total_inv

        price = price_map.get(ticker)
        current_value = None
        unrealized = None
        unrealized_pct = None
        if price:
            has_prices = True
            current_value = round(total_qty * price.last_price, 2)
            total_current += current_value
            unrealized = round(current_value - total_inv, 2)
            unrealized_pct = round((unrealized / total_inv) * 100, 2) if total_inv > 0 else 0

        badge = None
        if ticker in scanner_map:
            metrics = scanner_map[ticker]
            if metrics and metrics.get("near_618"):
                badge = "Near 0.618"

        is_mapped = ticker in nse_symbols
        suggestions = None
        if not is_mapped and nse_symbols:
            raw = fuzzy_match_ticker(ticker)
            suggestions = [NseSuggestion(**s) for s in raw]

        holdings.append(LotGroupOut(
            ticker=ticker,
            total_qty=total_qty,
            total_invested=round(total_inv, 2),
            lot_count=len(ticker_lots),
            lots=[LotOut.model_validate(l) for l in ticker_lots],
            current_price=price.last_price if price else None,
            current_value=current_value,
            unrealized_pnl=unrealized,
            unrealized_pnl_pct=unrealized_pct,
            scanner_badge=badge,
            mapping_status="verified" if is_mapped else "unmatched",
            nse_suggestions=suggestions,
        ))

    pnl_result = await db.execute(
        select(RealizedPnL)
        .where(RealizedPnL.member_id == member_id)
        .order_by(RealizedPnL.sell_date.desc())
    )
    realized = [RealizedPnLOut.model_validate(r) for r in pnl_result.scalars().all()]

    summary = HoldingsSummary(
        invested=round(total_invested, 2),
        current_value=round(total_current, 2) if has_prices else None,
        unrealized_pnl=round(total_current - total_invested, 2) if has_prices else None,
        unrealized_pnl_pct=round(((total_current - total_invested) / total_invested) * 100, 2) if has_prices and total_invested > 0 else None,
    )

    return MemberHoldingsOut(
        member=MemberOut.model_validate(member),
        summary=summary,
        holdings=holdings,
        realized_pnl=realized,
    )


@router.put("/lot/{lot_id}", response_model=LotOut)
async def edit_lot(lot_id: int, req: EditLotRequest, db: AsyncSession = Depends(get_db)):
    lot = await db.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    lot.buy_date = req.buy_date
    lot.buy_qty = req.buy_qty
    lot.buy_rate = req.buy_rate
    lot.buy_value = round(req.buy_qty * req.buy_rate, 2)
    lot.financial_year = derive_financial_year(req.buy_date)
    lot.notes = req.notes

    await db.commit()
    await db.refresh(lot)
    return lot


@router.delete("/lot/{lot_id}")
async def delete_lot(lot_id: int, db: AsyncSession = Depends(get_db)):
    lot = await db.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    deleted_info = {
        "ticker": lot.ticker,
        "member_id": lot.member_id,
        "buy_qty": lot.buy_qty,
        "buy_rate": lot.buy_rate,
        "buy_value": lot.buy_value,
        "lot_label": lot.lot_label,
        "buy_date": str(lot.buy_date),
    }
    print(f"LOT DELETED: {deleted_info}")
    await db.delete(lot)
    await db.commit()
    return {"status": "deleted", "deleted_lot": deleted_info}
