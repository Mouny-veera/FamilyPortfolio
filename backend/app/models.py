from datetime import date, datetime

from sqlalchemy import (
    Integer, String, Float, Date, DateTime, ForeignKey, Text, JSON, Index, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def derive_financial_year(d: date) -> str:
    if d.month >= 4:
        return f"{d.year}-{str(d.year + 1)[2:]}"
    return f"{d.year - 1}-{str(d.year)[2:]}"


class Member(Base):
    __tablename__ = "members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    lots: Mapped[list["Lot"]] = relationship(back_populates="member", cascade="all, delete-orphan")
    realized_pnl: Mapped[list["RealizedPnL"]] = relationship(back_populates="member", cascade="all, delete-orphan")


class Lot(Base):
    __tablename__ = "lots"
    __table_args__ = (
        Index("ix_lots_member_id", "member_id"),
        Index("ix_lots_ticker", "ticker"),
        Index("ix_lots_member_ticker", "member_id", "ticker"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), nullable=False)
    ticker: Mapped[str] = mapped_column(String(30), nullable=False)
    buy_date: Mapped[date] = mapped_column(Date, nullable=False)
    buy_qty: Mapped[float] = mapped_column(Float, nullable=False)
    buy_rate: Mapped[float] = mapped_column(Float, nullable=False)
    buy_value: Mapped[float] = mapped_column(Float, nullable=False)
    lot_label: Mapped[str] = mapped_column(String(10), nullable=False)
    financial_year: Mapped[str] = mapped_column(String(10), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    member: Mapped["Member"] = relationship(back_populates="lots")


class RealizedPnL(Base):
    __tablename__ = "realized_pnl"
    __table_args__ = (
        Index("ix_realized_pnl_member_id", "member_id"),
        Index("ix_realized_pnl_ticker", "ticker"),
        Index("ix_realized_pnl_member_ticker", "member_id", "ticker"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), nullable=False)
    ticker: Mapped[str] = mapped_column(String(30), nullable=False)
    buy_date: Mapped[date] = mapped_column(Date, nullable=False)
    buy_qty: Mapped[float] = mapped_column(Float, nullable=False)
    buy_rate: Mapped[float] = mapped_column(Float, nullable=False)
    buy_value: Mapped[float] = mapped_column(Float, nullable=False)
    sell_date: Mapped[date] = mapped_column(Date, nullable=False)
    sell_qty: Mapped[float] = mapped_column(Float, nullable=False)
    sell_rate: Mapped[float] = mapped_column(Float, nullable=False)
    sell_value: Mapped[float] = mapped_column(Float, nullable=False)
    profit_loss: Mapped[float] = mapped_column(Float, nullable=False)
    profit_loss_pct: Mapped[float] = mapped_column(Float, nullable=False)
    financial_year: Mapped[str] = mapped_column(String(10), nullable=False)
    lot_label: Mapped[str] = mapped_column(String(10), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    member: Mapped["Member"] = relationship(back_populates="realized_pnl")


class ScanResult(Base):
    __tablename__ = "scan_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(30), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    strategy_name: Mapped[str] = mapped_column(String(50), nullable=False)
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    scanned_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class PriceCache(Base):
    __tablename__ = "price_cache"

    ticker: Mapped[str] = mapped_column(String(30), primary_key=True)
    last_price: Mapped[float] = mapped_column(Float, nullable=False)
    change_pct: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class NseStock(Base):
    __tablename__ = "nse_stocks"

    symbol: Mapped[str] = mapped_column(String(30), primary_key=True)
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    series: Mapped[str] = mapped_column(String(10), nullable=False, default="EQ")
    isin: Mapped[str] = mapped_column(String(20), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
