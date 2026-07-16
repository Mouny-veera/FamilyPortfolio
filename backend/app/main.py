from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import init_db, async_session
from .models import Member
from .routers import members, holdings, dashboard, scanner, settings, nse, alerts
from .services.price_service import start_polling, stop_polling
from .services.nse_master import refresh_nse_master_list
from .services.fyers_auth import ensure_valid_token

FAMILY_MEMBERS = ["Veerakumar", "Sneeha", "Mouny", "Mani", "Devi"]


async def seed_members():
    from sqlalchemy import select
    async with async_session() as db:
        result = await db.execute(select(Member))
        if result.scalars().first() is None:
            for name in FAMILY_MEMBERS:
                db.add(Member(name=name))
            await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_members()
    await ensure_valid_token()
    start_polling()
    import asyncio
    nse_task = asyncio.create_task(refresh_nse_master_list())
    nse_task.add_done_callback(lambda t: t.exception() if not t.cancelled() and t.exception() else None)
    yield
    stop_polling()


app = FastAPI(title="Family Portfolio Scanner", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(members.router)
app.include_router(holdings.router)
app.include_router(dashboard.router)
app.include_router(scanner.router)
app.include_router(settings.router)
app.include_router(nse.router)
app.include_router(alerts.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
