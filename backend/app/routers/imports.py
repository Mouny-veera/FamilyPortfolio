"""Excel import: preview then commit.

Two phases on purpose. Parsing a hand-kept workbook involves guesses — which
column is which, what a typo'd date meant, which NSE symbol a company name
refers to. Writing those guesses straight into someone's financial records
would be wrong, so preview returns everything it inferred and commit only
accepts what the user confirmed.

Preview never touches the database. Commit refuses a member who already has
data, so an import can't silently overwrite a portfolio.
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Lot, Member, RealizedPnL
from ..services import excel_import
from ..services.nse_master import is_valid_nse_symbol

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/import", tags=["import"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_SUFFIXES = (".xlsx", ".xlsm")
# Every .xlsx is a zip; anything else can't be one, whatever it's named.
ZIP_MAGIC = b"PK"


class ImportRow(BaseModel):
    ticker: str = Field(min_length=1, max_length=30)
    buy_date: str
    qty: float = Field(gt=0)
    buy_rate: float = Field(ge=0)
    buy_value: float = Field(ge=0)
    sell_date: str | None = None
    sell_qty: float | None = None
    sell_rate: float | None = None
    sell_value: float | None = None


class CommitRequest(BaseModel):
    member_id: int
    holdings: list[ImportRow] = Field(default_factory=list)
    realized: list[ImportRow] = Field(default_factory=list)


def _guess_to_dict(guess: excel_import.ColumnGuess) -> dict:
    return {
        "field": guess.field, "index": guess.index, "header": guess.header,
        "confidence": round(guess.confidence, 2), "reason": guess.reason,
    }


def _row_to_dict(row: excel_import.ParsedRow) -> dict:
    return {
        "row_number": row.row_number,
        "raw_description": row.raw_description,
        "ticker": row.match.ticker,
        "match_status": row.match.status,
        "candidates": row.match.candidates,
        "buy_date": row.buy_date.isoformat() if row.buy_date else None,
        "qty": row.qty,
        "buy_rate": row.buy_rate,
        "buy_value": row.buy_value,
        "sell_date": row.sell_date.isoformat() if row.sell_date else None,
        "sell_qty": row.sell_qty,
        "sell_rate": row.sell_rate,
        "sell_value": row.sell_value,
        "profit_loss": row.profit_loss,
        "corporate_action": row.corporate_action,
        "repairs": [
            {"field": r.field, "original": r.original,
             "repaired": r.repaired.isoformat(), "note": r.note}
            for r in row.repairs
        ],
    }


@router.post("/preview")
async def preview_import(
    member_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Parse an uploaded workbook and report everything inferred. No writes."""
    member = await db.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    name = (file.filename or "").lower()
    if not name.endswith(ALLOWED_SUFFIXES):
        raise HTTPException(
            status_code=400,
            detail="Please upload an Excel workbook (.xlsx or .xlsm).",
        )

    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is {len(data) // (1024 * 1024)} MB; the limit is "
                   f"{MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )
    if not data.startswith(ZIP_MAGIC):
        raise HTTPException(
            status_code=400,
            detail="That file isn't a readable Excel workbook.",
        )

    try:
        previews = await asyncio.to_thread(excel_import.parse_workbook, data)
    except Exception as e:
        logger.warning("Excel parse failed for %s: %s", file.filename, e)
        raise HTTPException(
            status_code=400,
            detail="Could not read that workbook. It may be corrupt or password protected.",
        )

    previews = excel_import.select_import_sheets(previews)
    if not any(p.selected and p.rows for p in previews):
        raise HTTPException(
            status_code=422,
            detail="No holdings or trades were found in that workbook.",
        )

    existing_lots = await db.scalar(
        select(func.count()).select_from(Lot).where(Lot.member_id == member_id)
    )
    existing_pnl = await db.scalar(
        select(func.count()).select_from(RealizedPnL).where(RealizedPnL.member_id == member_id)
    )

    return {
        "member": {"id": member.id, "name": member.name},
        "member_has_data": bool(existing_lots or existing_pnl),
        "existing_lots": existing_lots or 0,
        "existing_realized": existing_pnl or 0,
        "sheets": [
            {
                "name": p.name.strip(),
                "kind": p.kind,
                "financial_year": p.financial_year,
                "selected": p.selected,
                "skip_reason": p.skip_reason,
                "header_row": p.header_row,
                "columns": {f: _guess_to_dict(g) for f, g in p.mapping.items()},
                "rows": [_row_to_dict(r) for r in p.rows],
                "skipped": [
                    {"row_number": s.row_number, "reason": s.reason, "preview": s.preview}
                    for s in p.skipped
                ],
                "annotations": [
                    {"row_number": a.row_number, "text": a.text} for a in p.annotations
                ],
            }
            for p in previews
        ],
    }


@router.post("/commit")
async def commit_import(req: CommitRequest, db: AsyncSession = Depends(get_db)):
    """Write confirmed rows. Refuses a member who already has data."""
    member = await db.get(Member, req.member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if not req.holdings and not req.realized:
        raise HTTPException(status_code=400, detail="Nothing to import.")

    existing_lots = await db.scalar(
        select(func.count()).select_from(Lot).where(Lot.member_id == req.member_id)
    )
    existing_pnl = await db.scalar(
        select(func.count()).select_from(RealizedPnL).where(RealizedPnL.member_id == req.member_id)
    )
    if existing_lots or existing_pnl:
        raise HTTPException(
            status_code=409,
            detail=(
                f"{member.name} already has {existing_lots} lots and {existing_pnl} "
                f"realized trades. Import only runs on a member with no data, so "
                f"nothing is overwritten."
            ),
        )

    def parse_day(value: str, label: str):
        parsed = excel_import.parse_date(value)
        if parsed is None:
            raise HTTPException(status_code=400, detail=f"Unreadable {label}: {value!r}")
        return parsed

    # Reject unknown symbols here too — the client picks them, but a bad ticker
    # would silently break live pricing for that lot.
    for row in [*req.holdings, *req.realized]:
        if not is_valid_nse_symbol(row.ticker):
            raise HTTPException(
                status_code=400,
                detail=f"{row.ticker!r} is not a known NSE symbol.",
            )

    holding_labels = excel_import.assign_lot_labels([r.ticker for r in req.holdings])
    realized_labels = excel_import.assign_lot_labels([r.ticker for r in req.realized])

    try:
        for row, label in zip(req.holdings, holding_labels):
            buy_date = parse_day(row.buy_date, "buy date")
            db.add(Lot(
                member_id=req.member_id,
                ticker=row.ticker,
                buy_date=buy_date,
                buy_qty=row.qty,
                buy_rate=row.buy_rate,
                buy_value=row.buy_value,
                lot_label=label,
                financial_year=excel_import.derive_financial_year(buy_date),
            ))

        for row, label in zip(req.realized, realized_labels):
            if row.sell_date is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"{row.ticker}: a realized trade needs a sell date.",
                )
            buy_date = parse_day(row.buy_date, "buy date")
            sell_date = parse_day(row.sell_date, "sell date")
            sell_value = row.sell_value or 0.0
            profit = round(sell_value - row.buy_value, 2)
            pct = round((profit / row.buy_value) * 100, 2) if row.buy_value else 0.0
            db.add(RealizedPnL(
                member_id=req.member_id,
                ticker=row.ticker,
                buy_date=buy_date,
                buy_qty=row.qty,
                buy_rate=row.buy_rate,
                buy_value=row.buy_value,
                sell_date=sell_date,
                sell_qty=row.sell_qty or row.qty,
                sell_rate=row.sell_rate or 0.0,
                sell_value=sell_value,
                profit_loss=profit,
                profit_loss_pct=pct,
                # Sell date decides the P&L financial year.
                financial_year=excel_import.derive_financial_year(sell_date),
                lot_label=label,
            ))

        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error("Import commit failed for member %s: %s", req.member_id, e)
        raise HTTPException(status_code=500, detail="Import failed; nothing was saved.")

    return {
        "member": member.name,
        "lots_imported": len(req.holdings),
        "realized_imported": len(req.realized),
    }
