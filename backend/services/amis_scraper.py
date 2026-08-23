"""
KisaanKhata — AMIS Punjab Live Price Scraper
=============================================
Fetches current wholesale prices from http://www.amis.pk — Pakistan's
official Agricultural Market Information Service for Punjab.

Data scraped
------------
- Source  : amis.pk ViewPrices.aspx (daily city-level prices)
- Columns : City, Min price, Max price, FQP (Fair Quoted Price)
- Unit    : 40 Kg (AMIS standard unit for most commodities)
- Coverage: 20 major crops covering Punjab's key agricultural markets

Confirmed HTML structure (from inspect_amis_page.py):
  - Price table has header row: [Date, Graph, Min, Max, FQP, Quantity]
  - City rows: ['1Lahore', 'Graph', '11500', '12000', '11750', '-']
  - City name has a leading digit (rank) prefix — stripped during parse
  - '-' values mean no price reported for that city today — skipped

Ethics / rate limiting
----------------------
- User-Agent identifies this as an educational/open-data project
- 2-second delay between each commodity request
- Each scrape function wrapped in try/except — one failure doesn't stop batch
- AMIS data is public government data intended for citizen access
"""

from __future__ import annotations

import re
import time
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = "http://www.amis.pk"
REQUEST_DELAY_SECONDS = 2   # polite delay between requests

HEADERS = {
    "User-Agent": (
        "KisaanKhata/1.0 (Hackathon Project; public agricultural data access) "
        "Python-requests/2.31 — github.com/kisaankhata"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
}

# ---------------------------------------------------------------------------
# Commodity mapping — confirmed IDs from BrowsePrices.aspx?searchType=0
# Format: commodity_id -> canonical_crop_name
# 20 major crops covering grains, vegetables, fruits, cash crops
# ---------------------------------------------------------------------------

COMMODITY_MAP: dict[int, str] = {
    1:   "wheat",
    3:   "rice_basmati",
    4:   "rice_irri",
    5:   "paddy_basmati",
    6:   "paddy_irri",
    7:   "sugar",
    8:   "chickpea_white",
    9:   "chickpea_black",
    10:  "gram_pulse",
    17:  "maize",
    18:  "millet",
    19:  "sorghum",
    20:  "rapeseed",
    21:  "potato",
    22:  "potato_store",
    23:  "onion",
    24:  "garlic",
    26:  "tomato",
    27:  "spinach",
    28:  "brinjal",
    29:  "red_chilli",
    30:  "okra",
    34:  "cauliflower",
    38:  "carrot",
    42:  "banana",
    43:  "guava",
    45:  "kinnow",
    48:  "mango",
    49:  "cotton",
    63:  "groundnut",
    65:  "jaggery",
    117: "canola",
    127: "brown_sugar",
}


# ---------------------------------------------------------------------------
# HTML parsing helpers
# ---------------------------------------------------------------------------

def _parse_price(value: str) -> Optional[float]:
    """
    Parse a price string like '11500', '11,500', or '-' into a float.
    Returns None for '-', empty, or unparseable values.
    """
    v = value.strip()
    if not v or v == "-":
        return None
    try:
        return float(v.replace(",", ""))
    except ValueError:
        return None


def _strip_city_rank(raw: str) -> str:
    """
    AMIS prepends a rank digit to city names: '1Lahore' → 'Lahore'.
    Strips leading digits and whitespace.
    """
    return re.sub(r"^\d+\s*", "", raw.strip())


def _find_price_table(soup: BeautifulSoup):
    """
    Find the price data table on the ViewPrices page.
    Strategy: look for a <table> whose first row contains 'Min', 'Max', 'FQP'.
    This is more robust than relying on table index (which shifts across pages).
    """
    for tbl in soup.find_all("table"):
        rows = tbl.find_all("tr")
        if not rows:
            continue
        header_cells = [td.get_text(strip=True) for td in rows[0].find_all(["td", "th"])]
        if "Min" in header_cells and "Max" in header_cells and "FQP" in header_cells:
            return tbl, rows
    return None, []


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def scrape_commodity(commodity_id: int, crop_name: str) -> list[dict]:
    """
    Fetch the AMIS price page for a single commodity and parse all city rows.

    Args:
        commodity_id : AMIS integer ID (e.g. 1 for Wheat).
        crop_name    : Canonical name to store (e.g. "wheat").

    Returns:
        List of dicts with keys: crop_name, city, min_price, max_price, fqp, unit.
        Empty list if the page fails or has no data.
    """
    url = f"{BASE_URL}/ViewPrices.aspx?searchType=0&commodityId={commodity_id}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("AMIS fetch failed for %s (id=%d): %s", crop_name, commodity_id, exc)
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    tbl, rows = _find_price_table(soup)

    if tbl is None:
        logger.warning("No price table found for %s (id=%d)", crop_name, commodity_id)
        return []

    results = []
    # Skip header row (index 0)
    for row in rows[1:]:
        cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
        # Expected: [city_with_rank, 'Graph', min, max, fqp, quantity]
        if len(cells) < 5:
            continue

        city_raw = cells[0]
        # Skip rows that look like sub-headers or separators
        if "dated" in city_raw.lower() or "graph" in city_raw.lower():
            continue

        city = _strip_city_rank(city_raw)
        if not city:
            continue

        min_p = _parse_price(cells[2])
        max_p = _parse_price(cells[3])
        fqp   = _parse_price(cells[4])

        # Skip rows with no price data at all
        if min_p is None and max_p is None and fqp is None:
            continue

        results.append({
            "crop_name": crop_name,
            "city":      city,
            "min_price": min_p,
            "max_price": max_p,
            "fqp":       fqp,
            "unit":      "40 Kg",   # AMIS standard unit
        })

    logger.info("  ✓ %s (id=%d): %d city rows", crop_name, commodity_id, len(results))
    return results


def scrape_all_commodities(db: Session) -> dict:
    """
    Scrape all commodities in COMMODITY_MAP and persist to the LivePriceEntry table.

    Behaviour
    ---------
    - Loops through COMMODITY_MAP with a 2-second delay between each request.
    - Each commodity is wrapped in try/except — one failure doesn't stop the batch.
    - Inserts new rows for this scrape run (does NOT delete old rows — callers
      can query by scraped_at DESC to get the freshest data).
    - Returns a summary dict: {total, saved, failed, timestamp}.

    Args:
        db : SQLAlchemy Session (injected by FastAPI or the scheduler).
    """
    from models import LivePriceEntry

    now = datetime.utcnow()
    total_saved = 0
    failed_crops = []

    logger.info("AMIS scrape started at %s — %d commodities", now, len(COMMODITY_MAP))

    for commodity_id, crop_name in COMMODITY_MAP.items():
        try:
            rows = scrape_commodity(commodity_id, crop_name)
            for row in rows:
                entry = LivePriceEntry(
                    crop_name  = row["crop_name"],
                    city       = row["city"],
                    min_price  = row["min_price"],
                    max_price  = row["max_price"],
                    fqp        = row["fqp"],
                    unit       = row["unit"],
                    scraped_at = now,
                    source     = "amis",
                )
                db.add(entry)
            total_saved += len(rows)

        except Exception as exc:
            logger.error("Failed scraping %s (id=%d): %s", crop_name, commodity_id, exc)
            failed_crops.append(crop_name)
            continue  # don't let one crop stop the whole batch

        finally:
            time.sleep(REQUEST_DELAY_SECONDS)

    try:
        db.commit()
        logger.info(
            "AMIS scrape complete — saved %d rows, %d crops failed: %s",
            total_saved, len(failed_crops), failed_crops
        )
    except Exception as exc:
        db.rollback()
        logger.error("DB commit failed after AMIS scrape: %s", exc)

    return {
        "timestamp":    now.isoformat(),
        "total_saved":  total_saved,
        "failed_crops": failed_crops,
        "total_crops":  len(COMMODITY_MAP),
    }


def get_latest_amis_price(crop_name: str, db: Session) -> Optional[dict]:
    """
    Look up the most recent AMIS price for a crop (averaged across all cities).

    Args:
        crop_name : Canonical crop name (e.g. "wheat", "potato").
        db        : SQLAlchemy Session.

    Returns:
        Dict with keys: fqp, min_price, max_price, scraped_at, city_count
        or None if no data found.
    """
    from models import LivePriceEntry
    from sqlalchemy import func

    # Find the most recent scrape timestamp for this crop
    latest_ts = (
        db.query(func.max(LivePriceEntry.scraped_at))
        .filter(LivePriceEntry.crop_name == crop_name)
        .scalar()
    )
    if not latest_ts:
        return None

    rows = (
        db.query(LivePriceEntry)
        .filter(
            LivePriceEntry.crop_name == crop_name,
            LivePriceEntry.scraped_at == latest_ts,
        )
        .all()
    )
    if not rows:
        return None

    fqps = [r.fqp for r in rows if r.fqp is not None]
    mins = [r.min_price for r in rows if r.min_price is not None]
    maxs = [r.max_price for r in rows if r.max_price is not None]

    return {
        "crop_name":   crop_name,
        "fqp":         round(sum(fqps) / len(fqps), 2) if fqps else None,
        "min_price":   round(sum(mins) / len(mins), 2) if mins else None,
        "max_price":   round(sum(maxs) / len(maxs), 2) if maxs else None,
        "city_count":  len(rows),
        "scraped_at":  latest_ts.isoformat(),
        "source":      "amis",
    }
