import logging
import sqlite3
from datetime import datetime
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

logger = logging.getLogger(__name__)

DB_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "portfolio.db"
BACKUP_DIR = DB_DIR / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session


def backup_database(max_backups: int = 10):
    if not DB_PATH.exists():
        return
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = BACKUP_DIR / f"portfolio_{stamp}.db"
    src_conn = sqlite3.connect(str(DB_PATH))
    dst_conn = sqlite3.connect(str(dest))
    src_conn.backup(dst_conn)
    dst_conn.close()
    src_conn.close()
    logger.info("Database backup: %s", dest.name)

    backups = sorted(BACKUP_DIR.glob("portfolio_*.db"), key=lambda p: p.stat().st_mtime)
    while len(backups) > max_backups:
        backups.pop(0).unlink()


async def _migrate_add_columns(conn):
    migrations = [
        ("stock_fundamentals", "industry", "VARCHAR(100)"),
        ("stock_fundamentals", "pb_ratio", "FLOAT"),
        ("stock_fundamentals", "roe", "FLOAT"),
        ("stock_fundamentals", "npm", "FLOAT"),
        ("stock_fundamentals", "face_value", "FLOAT"),
        ("stock_fundamentals", "isin", "VARCHAR(20)"),
        ("stock_fundamentals", "data_source", "VARCHAR(20)"),
        ("stock_fundamentals", "bse_scrip_code", "VARCHAR(20)"),
    ]
    for table, column, col_type in migrations:
        try:
            await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
            logger.info("[Migration] Added %s.%s", table, column)
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                pass
            else:
                logger.error("[Migration] UNEXPECTED ERROR adding %s.%s: %s", table, column, e)
                raise


async def init_db():
    backup_database()
    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.execute(text("PRAGMA busy_timeout=5000"))
        await conn.run_sync(Base.metadata.create_all)
        await _migrate_add_columns(conn)
