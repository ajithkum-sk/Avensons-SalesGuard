"""Avensons SalesGuard API."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import close_pool, fetch_one, open_pool
from .routers.api import router
from .routers.auth import router as auth_router
from .routers.salesperson import router as salesperson_router
from .routers.admin import router as admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    open_pool()
    yield
    close_pool()


app = FastAPI(title="Avensons SalesGuard", version="1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.include_router(auth_router)
app.include_router(salesperson_router)
app.include_router(admin_router)


@app.get("/health")
def health():
    row = fetch_one("SELECT count(*) AS snapshots FROM snapshot")
    return {"status": "ok", "snapshots": row["snapshots"]}
