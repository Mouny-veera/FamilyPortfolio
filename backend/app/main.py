import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .auth import require_auth

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)
from .database import init_db, async_session
from .models import Member
from .routers import members, holdings, dashboard, scanner, settings, nse, alerts, google_auth, stocks, fundamentals
from .services.price_service import start_polling, stop_polling
from .services.nse_master import refresh_nse_master_list
from .services.fyers_auth import ensure_valid_token
from .services.fyers_callback import start_callback_server, stop_callback_server
from .services.scan_scheduler import start_scan_scheduler, stop_scan_scheduler
from .services.fundamentals_scheduler import start_fundamentals_scheduler, stop_fundamentals_scheduler
from .services.backup_scheduler import start_backup_scheduler, stop_backup_scheduler
from .services.nifty_index import refresh_nifty200

async def seed_members():
    from sqlalchemy import select
    async with async_session() as db:
        result = await db.execute(select(Member))
        if result.scalars().first() is None:
            for name in ["Veerakumar", "Sneeha", "Mouny", "Manikandan", "Devi"]:
                db.add(Member(name=name))
            await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_members()
    await ensure_valid_token()
    start_polling()
    await start_callback_server()
    import asyncio
    nse_task = asyncio.create_task(refresh_nse_master_list())
    nse_task.add_done_callback(lambda t: t.exception() if not t.cancelled() and t.exception() else None)
    nifty_task = asyncio.create_task(refresh_nifty200())
    nifty_task.add_done_callback(lambda t: t.exception() if not t.cancelled() and t.exception() else None)
    start_scan_scheduler()
    start_fundamentals_scheduler()
    start_backup_scheduler()
    yield
    stop_backup_scheduler()
    stop_fundamentals_scheduler()
    stop_scan_scheduler()
    stop_polling()
    await stop_callback_server()


app = FastAPI(
    title="Family Portfolio Scanner",
    version="1.0.0",
    lifespan=lifespan,
    dependencies=[Depends(require_auth)],
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?|http://100\.\d+\.\d+\.\d+(:\d+)?",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "An internal error occurred"})


app.include_router(members.router)
app.include_router(holdings.router)
app.include_router(dashboard.router)
app.include_router(scanner.router)
app.include_router(settings.router)
app.include_router(nse.router)
app.include_router(alerts.router)
app.include_router(google_auth.router)
app.include_router(stocks.router)
app.include_router(fundamentals.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
