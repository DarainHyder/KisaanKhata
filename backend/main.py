"""
KisaanKhata — FastAPI Application Entrypoint
=============================================
Initializes the FastAPI app, registers all routers, configures
CORS middleware, sets up APScheduler for periodic AMIS scraping,
and loads static price datasets at startup.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from database import engine, Base, SessionLocal
from routers import ledger, price_check, admin, prices, sms, analytics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App initialisation
# ---------------------------------------------------------------------------

app = FastAPI(
    title="KisaanKhata API",
    description=(
        "A digital ledger for smallholder farmers in Pakistan. "
        "Records loans and harvest sales, and checks whether farmers "
        "received a fair price compared to real mandi (market) rates."
    ),
    version="0.2.0",
)

# ---------------------------------------------------------------------------
# CORS — allow all origins so the React dev server (usually :5173) can reach us
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# APScheduler — background AMIS scrape every 6 hours
# ---------------------------------------------------------------------------

_scheduler = BackgroundScheduler()


def _scheduled_amis_scrape():
    """Called by APScheduler every 6 hours — opens its own DB session."""
    from services.amis_scraper import scrape_all_commodities
    db = SessionLocal()
    try:
        logger.info("[Scheduler] Starting scheduled AMIS scrape…")
        result = scrape_all_commodities(db)
        logger.info("[Scheduler] AMIS scrape done: %s", result)
    except Exception as exc:
        logger.error("[Scheduler] AMIS scrape error: %s", exc)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Startup / shutdown events
# ---------------------------------------------------------------------------

@app.on_event("startup")
def on_startup() -> None:
    """
    At startup:
    1. Create all SQLAlchemy-managed tables (idempotent).
    2. Load static price datasets (FAOSTAT + Kaggle) into memory.
    3. Start APScheduler for periodic AMIS scraping (every 6 hours).
    """
    Base.metadata.create_all(bind=engine)

    from services.price_matcher import load_price_data
    load_price_data()

    # Start scheduler — run AMIS scrape every 6 hours
    _scheduler.add_job(
        _scheduled_amis_scrape,
        trigger="interval",
        hours=6,
        id="amis_scrape",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("[Startup] APScheduler started — AMIS scrape every 6 hours.")


@app.on_event("shutdown")
def on_shutdown() -> None:
    """Gracefully shut down the background scheduler."""
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[Shutdown] APScheduler stopped.")


# ---------------------------------------------------------------------------
# Router registration
# ---------------------------------------------------------------------------

app.include_router(ledger.router,      prefix="/api/ledger",       tags=["Ledger"])
app.include_router(price_check.router, prefix="/api/price-check",  tags=["Price Check"])
app.include_router(prices.router,      prefix="/api/prices",       tags=["Prices"])
app.include_router(admin.router,       prefix="/admin",             tags=["Admin"])
app.include_router(sms.router,         prefix="/sms",               tags=["SMS / WhatsApp"])
app.include_router(analytics.router,   prefix="/analytics",         tags=["Analytics"])


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/", tags=["Health"])
def root():
    """Simple health-check endpoint."""
    return {"status": "ok", "app": "KisaanKhata API", "version": "0.2.0"}
