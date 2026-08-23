"""
KisaanKhata — Prices Router
=============================
Live price analytics routes powered by the AMIS Punjab scrape pipeline.

Routes
------
  GET /api/prices/trend/{crop_name}
      — Time series of live prices grouped by scrape date.
        Returns min/max/avg FQP per day across all cities.
        Used for price trend charts on the frontend.

  GET /api/prices/compare-cities/{crop_name}
      — Side-by-side city comparison from the most recent scrape.
        Sorted by FQP descending so the highest-paying mandi is on top.
        Actionable: farmer can see "Multan is paying more than Vehari today."
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import LivePriceEntry

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _require_live_data(crop_name: str, db: Session) -> datetime:
    """
    Return the most recent scraped_at timestamp for a crop.
    Raises HTTP 404 if no data found — guides the user to run /admin/scrape-now.
    """
    latest_ts = (
        db.query(func.max(LivePriceEntry.scraped_at))
        .filter(LivePriceEntry.crop_name == crop_name)
        .scalar()
    )
    if not latest_ts:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No live price data found for '{crop_name}'. "
                "Run POST /admin/scrape-now to fetch fresh data from AMIS Punjab."
            ),
        )
    return latest_ts


# ---------------------------------------------------------------------------
# GET /prices/trend/{crop_name}
# ---------------------------------------------------------------------------

@router.get("/trend/{crop_name}")
def price_trend(
    crop_name: str,
    days: int = 30,
    db: Session = Depends(get_db),
):
    """
    Return a daily price time series for a crop over stored AMIS scrape history.

    Aggregates all city-level FQP values scraped on each day into:
      - min  : lowest city price that day
      - max  : highest city price that day
      - avg  : average across all cities (PKR/40kg)
      - cities_reported: number of cities with price data that day

    Args:
        crop_name : Canonical crop name (e.g. 'wheat', 'potato', 'onion').
        days      : How many past days to include (default 30, max 365).
                    Use ?days=90 to see three months.

    Returns:
        {
          "crop_name": "wheat",
          "unit": "40 Kg",
          "data_points": [
            { "date": "2026-08-20", "min": 11500, "max": 12000, "avg": 11750,
              "cities_reported": 42 },
            ...
          ]
        }
    """
    days = min(days, 365)
    cutoff = datetime.utcnow() - timedelta(days=days)

    # Pull all qualifying rows in date range
    rows = (
        db.query(LivePriceEntry)
        .filter(
            LivePriceEntry.crop_name == crop_name,
            LivePriceEntry.scraped_at >= cutoff,
            LivePriceEntry.fqp.isnot(None),
        )
        .order_by(LivePriceEntry.scraped_at)
        .all()
    )

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No live price data for '{crop_name}' in the last {days} days. "
                "Run POST /admin/scrape-now to fetch fresh data."
            ),
        )

    # Group by date (YYYY-MM-DD) — each scrape run shares the same scraped_at
    # so grouping by date naturally groups by scrape run.
    from collections import defaultdict
    by_date: dict[str, list[float]] = defaultdict(list)

    for row in rows:
        day_key = row.scraped_at.strftime("%Y-%m-%d")
        by_date[day_key].append(row.fqp)

    data_points = []
    for day in sorted(by_date.keys()):
        prices = by_date[day]
        data_points.append({
            "date":             day,
            "min":              round(min(prices), 2),
            "max":              round(max(prices), 2),
            "avg":              round(sum(prices) / len(prices), 2),
            "cities_reported":  len(prices),
        })

    return {
        "crop_name":   crop_name,
        "unit":        "40 Kg",
        "days_range":  days,
        "data_points": data_points,
    }


# ---------------------------------------------------------------------------
# GET /prices/compare-cities/{crop_name}
# ---------------------------------------------------------------------------

@router.get("/compare-cities/{crop_name}")
def compare_cities(
    crop_name: str,
    db: Session = Depends(get_db),
):
    """
    Return the latest AMIS price for a crop across ALL scraped cities,
    sorted by FQP descending so the highest-paying mandi is shown first.

    This gives farmers actionable intelligence:
      "Multan mandi is paying PKR 12,000/40kg for wheat today,
       while Vehari mandi is paying only PKR 11,200 — a difference of PKR 800."

    Returns:
        {
          "crop_name": "wheat",
          "scraped_at": "2026-08-20T07:00:00",
          "data_age_hours": 4.2,
          "top_city": { "city": "Multan", "fqp": 12000, ... },
          "cities": [
            { "rank": 1, "city": "Multan", "min_price": 11500,
              "max_price": 12000, "fqp": 11750, "unit": "40 Kg" },
            ...
          ]
        }
    """
    latest_ts = _require_live_data(crop_name, db)

    rows = (
        db.query(LivePriceEntry)
        .filter(
            LivePriceEntry.crop_name == crop_name,
            LivePriceEntry.scraped_at == latest_ts,
        )
        .order_by(LivePriceEntry.fqp.desc().nullslast())
        .all()
    )

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No city data found for '{crop_name}' at latest scrape.",
        )

    age_hours = (datetime.utcnow() - latest_ts).total_seconds() / 3600

    cities_list = []
    for rank, row in enumerate(rows, start=1):
        cities_list.append({
            "rank":      rank,
            "city":      row.city,
            "min_price": row.min_price,
            "max_price": row.max_price,
            "fqp":       row.fqp,
            "unit":      row.unit,
        })

    # Summary stats
    fqps_valid = [r.fqp for r in rows if r.fqp is not None]
    top_city   = cities_list[0] if cities_list else None
    bottom_city = next((c for c in reversed(cities_list) if c["fqp"] is not None), None)

    return {
        "crop_name":      crop_name,
        "scraped_at":     latest_ts.isoformat(),
        "data_age_hours": round(age_hours, 1),
        "city_count":     len(rows),
        "top_city":       top_city,
        "bottom_city":    bottom_city,
        "spread_pkr": (
            round(top_city["fqp"] - bottom_city["fqp"], 2)
            if top_city and bottom_city and top_city["fqp"] and bottom_city["fqp"]
            else None
        ),
        "insight": (
            f"{top_city['city']} mandi is paying the most for {crop_name} today "
            f"(PKR {top_city['fqp']:,.0f}/40kg). "
            f"Compare with {bottom_city['city']} at PKR {bottom_city['fqp']:,.0f}/40kg."
            if top_city and bottom_city and top_city["fqp"] and bottom_city["fqp"]
            else f"Price data available for {len(rows)} cities."
        ),
        "cities": cities_list,
    }
