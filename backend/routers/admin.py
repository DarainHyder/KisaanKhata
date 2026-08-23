"""
KisaanKhata — Admin Router
============================
Internal/demo routes for manual operations.

Routes
------
  POST  /admin/scrape-now          — Trigger AMIS scrape immediately (demo tool)
  GET   /admin/live-prices/{crop}  — View latest AMIS prices for a crop
  GET   /admin/scrape-status       — Show scheduler status
"""

import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# POST /admin/scrape-now  — manual trigger for demo
# ---------------------------------------------------------------------------

@router.post("/scrape-now")
def scrape_now(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Trigger an immediate AMIS price scrape in the background.

    Returns immediately with a 202 Accepted response.
    The scrape runs in the background — takes ~2-3 minutes for all 33 crops
    (due to polite 2-second delays between requests).

    Use GET /admin/live-prices/{crop} to verify data after it completes.
    """
    def _run_scrape(db: Session):
        from services.amis_scraper import scrape_all_commodities
        try:
            result = scrape_all_commodities(db)
            logger.info("[Admin] Manual scrape complete: %s", result)
        except Exception as exc:
            logger.error("[Admin] Manual scrape error: %s", exc)
        finally:
            db.close()

    # Pass a fresh session to the background task
    from database import SessionLocal
    bg_db = SessionLocal()
    background_tasks.add_task(_run_scrape, bg_db)

    return {
        "status": "accepted",
        "message": (
            "AMIS scrape started in the background. "
            f"Scraping 33 crops with 2s delay each — expect ~2-3 minutes. "
            "Check GET /admin/live-prices/{crop_name} to verify results."
        ),
    }


# ---------------------------------------------------------------------------
# GET /admin/live-prices/{crop}  — inspect latest scraped data
# ---------------------------------------------------------------------------

@router.get("/live-prices/{crop_name}")
def get_live_prices(crop_name: str, db: Session = Depends(get_db)):
    """
    Return all city-level AMIS price rows for a crop from the most recent scrape.

    Args:
        crop_name : Canonical crop name (e.g. 'wheat', 'potato', 'onion').
                    See services/amis_scraper.py COMMODITY_MAP for full list.
    """
    from models import LivePriceEntry
    from sqlalchemy import func

    latest_ts = (
        db.query(func.max(LivePriceEntry.scraped_at))
        .filter(LivePriceEntry.crop_name == crop_name)
        .scalar()
    )
    if not latest_ts:
        raise HTTPException(
            status_code=404,
            detail=f"No live price data found for '{crop_name}'. Run /admin/scrape-now first.",
        )

    rows = (
        db.query(LivePriceEntry)
        .filter(
            LivePriceEntry.crop_name == crop_name,
            LivePriceEntry.scraped_at == latest_ts,
        )
        .order_by(LivePriceEntry.fqp.desc())
        .all()
    )

    return {
        "crop_name":   crop_name,
        "scraped_at":  latest_ts.isoformat(),
        "city_count":  len(rows),
        "prices": [
            {
                "city":      r.city,
                "min_price": r.min_price,
                "max_price": r.max_price,
                "fqp":       r.fqp,
                "unit":      r.unit,
            }
            for r in rows
        ],
    }


# ---------------------------------------------------------------------------
# GET /admin/scrape-status  — scheduler and DB stats
# ---------------------------------------------------------------------------

@router.get("/scrape-status")
def scrape_status(db: Session = Depends(get_db)):
    """
    Return scheduler job info and count of live price rows in the DB.
    """
    from models import LivePriceEntry
    from sqlalchemy import func

    row_count = db.query(func.count(LivePriceEntry.id)).scalar()
    latest_ts = db.query(func.max(LivePriceEntry.scraped_at)).scalar()
    crop_count = db.query(func.count(LivePriceEntry.crop_name.distinct())).scalar()

    return {
        "live_price_rows":    row_count,
        "distinct_crops":     crop_count,
        "latest_scrape":      latest_ts.isoformat() if latest_ts else None,
        "scheduler_running":  True,   # always True if app is up
        "scrape_interval":    "every 6 hours",
    }
