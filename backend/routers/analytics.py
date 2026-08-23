"""
KisaanKhata — Analytics Router
================================
Aggregated, fully anonymised analytics for agriculture-department / policy-level users.

PRIVACY CONTRACT — enforced throughout this module
---------------------------------------------------
  - NO farmer names, phone numbers, or individual identifiers are ever returned.
  - All responses are aggregate counts, percentages, and averages only.
  - Districts with fewer than MIN_GROUP_SIZE underpaid entries are EXCLUDED
    from district-level reports to prevent de-anonymisation of small communities.
  - This is documented in every route's docstring so it is auditable.

Routes
------
  GET /analytics/underpayment-by-district
        Aggregated underpayment counts and average % per district.

  GET /analytics/price-trend-national/{crop_name}
        National live price trend (all-city average per day).

  GET /analytics/summary-report
        Single-page system-wide statistics for pitch to agriculture departments.

  GET /analytics/export-report
        Same summary as CSV download for offline/institutional reporting.
"""

from __future__ import annotations

import csv
import io
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from database import get_db
from models import Farmer, LedgerEntry, LivePriceEntry
from services.price_matcher import compare_price

logger = logging.getLogger(__name__)
router = APIRouter()

# Minimum entries required in a district before it is included in district reports.
# Prevents de-anonymisation of very small groups (e.g. a single-farmer village).
MIN_GROUP_SIZE = 5


# ===========================================================================
# Internal helpers
# ===========================================================================

def _run_price_checks_for_sales(
    db: Session,
) -> list[dict]:
    """
    Run compare_price against every sale entry that has a reported_price_per_unit,
    and return a flat list of result dicts, each enriched with the farmer's district.

    Each dict contains:
      district      : Farmer.location (city/district string)
      status        : "fair" | "underpaid" | "overpaid" | "no_data"
      difference_percent : float | None
      crop_name     : str
      date          : date string

    Privacy: farmer_id, name, phone_number are deliberately NOT included.
    """
    # Single query: join sale entries to farmers, pull only non-identifying fields
    rows = (
        db.query(
            LedgerEntry.id,
            LedgerEntry.crop_name,
            LedgerEntry.reported_price_per_unit,
            LedgerEntry.date,
            Farmer.location,
        )
        .join(Farmer, Farmer.id == LedgerEntry.farmer_id)
        .filter(
            LedgerEntry.entry_type == "sale",
            LedgerEntry.reported_price_per_unit.isnot(None),
            LedgerEntry.crop_name.isnot(None),
        )
        .all()
    )

    results = []
    for entry_id, crop, price, date, district in rows:
        try:
            result = compare_price(
                reported_price=price,
                crop_name=crop,
                date=date.strftime("%Y-%m-%d") if date else None,
                db=db,
            )
            results.append({
                "district":          district or "Unknown",
                "status":            result["status"],
                "difference_percent": result.get("difference_percent"),
                "crop_name":         crop,
            })
        except Exception as exc:
            logger.debug("Price check failed for entry %s: %s", entry_id, exc)
            continue

    return results


# ===========================================================================
# 1. GET /analytics/underpayment-by-district
# ===========================================================================

@router.get("/underpayment-by-district")
def underpayment_by_district(db: Session = Depends(get_db)):
    """
    Return aggregated underpayment statistics grouped by farmer district.

    Only districts with >= MIN_GROUP_SIZE underpaid entries are included,
    to protect anonymity of small farming communities.

    Returns:
        List of district objects:
          district              (str)   — city/district name
          underpaid_count       (int)   — number of underpaid sale entries
          avg_underpayment_pct  (float) — mean underpayment % (negative = below reference)
          total_sales_checked   (int)   — total entries checked in that district
          underpayment_rate_pct (float) — what fraction of that district's sales were underpaid

    Privacy: no farmer names, IDs, or phone numbers are present in this response.
    Districts below MIN_GROUP_SIZE ({min_size}) are excluded.
    """.format(min_size=MIN_GROUP_SIZE)

    all_results = _run_price_checks_for_sales(db)

    # Group by district
    by_district: dict[str, dict] = defaultdict(lambda: {
        "underpaid_diffs": [],
        "total_checked":   0,
    })

    for r in all_results:
        d = r["district"]
        by_district[d]["total_checked"] += 1
        if r["status"] == "underpaid" and r["difference_percent"] is not None:
            by_district[d]["underpaid_diffs"].append(r["difference_percent"])

    output = []
    for district, stats in sorted(by_district.items()):
        underpaid = stats["underpaid_diffs"]
        count     = len(underpaid)

        # Enforce minimum group size for privacy
        if count < MIN_GROUP_SIZE:
            continue

        avg_pct = round(sum(underpaid) / count, 2) if underpaid else 0.0
        total   = stats["total_checked"]

        output.append({
            "district":              district,
            "underpaid_count":       count,
            "avg_underpayment_pct":  avg_pct,
            "total_sales_checked":   total,
            "underpayment_rate_pct": round((count / total) * 100, 1) if total else 0.0,
        })

    # Sort by worst underpayment rate first
    output.sort(key=lambda x: x["underpayment_rate_pct"], reverse=True)

    return {
        "generated_at":   datetime.utcnow().isoformat(),
        "min_group_size": MIN_GROUP_SIZE,
        "districts":      output,
        "privacy_note": (
            f"Districts with fewer than {MIN_GROUP_SIZE} underpaid entries are excluded "
            "to prevent de-anonymisation of small communities. "
            "No individual farmer data is included in this response."
        ),
    }


# ===========================================================================
# 2. GET /analytics/price-trend-national/{crop_name}
# ===========================================================================

@router.get("/price-trend-national/{crop_name}")
def price_trend_national(
    crop_name: str,
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """
    Return the national (all-Punjab) average daily price trend for a crop
    based on accumulated AMIS live scrape data.

    Aggregates across ALL cities for each scrape day, giving a single
    national-level view useful for spotting:
      - Seasonal price crashes (sharp drops over weeks)
      - Harvest glut effects (price fall when supply surges)
      - Potential manipulation patterns (unusual city-vs-national divergence)

    Args:
        crop_name : Canonical crop name (e.g. 'wheat', 'potato', 'onion').
        days      : Days of history to include (default 30, max 365).

    Returns:
        {
          "crop_name": "wheat",
          "unit": "40 Kg",
          "daily_national": [
            {
              "date": "2026-08-20",
              "national_avg_fqp": 11842.5,
              "national_min": 11000,
              "national_max": 12500,
              "cities_reporting": 38
            },
            ...
          ]
        }
    """
    cutoff = datetime.utcnow() - timedelta(days=days)

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
        return {
            "crop_name":      crop_name,
            "unit":           "40 Kg",
            "days_range":     days,
            "daily_national": [],
            "note": (
                f"No live price data found for '{crop_name}' in the last {days} days. "
                "Run POST /admin/scrape-now to populate data."
            ),
        }

    # Group by date
    by_date: dict[str, list[float]] = defaultdict(list)
    for row in rows:
        day_key = row.scraped_at.strftime("%Y-%m-%d")
        by_date[day_key].append(row.fqp)

    daily = []
    for day in sorted(by_date.keys()):
        fqps = by_date[day]
        daily.append({
            "date":               day,
            "national_avg_fqp":   round(sum(fqps) / len(fqps), 2),
            "national_min":       round(min(fqps), 2),
            "national_max":       round(max(fqps), 2),
            "cities_reporting":   len(fqps),
        })

    # Compute simple trend: % change from first day to last day
    trend_pct = None
    if len(daily) >= 2:
        first = daily[0]["national_avg_fqp"]
        last  = daily[-1]["national_avg_fqp"]
        trend_pct = round(((last - first) / first) * 100, 2) if first else None

    return {
        "crop_name":      crop_name,
        "unit":           "40 Kg",
        "days_range":     days,
        "trend_pct":      trend_pct,
        "trend_direction": (
            "rising" if trend_pct and trend_pct > 0 else
            "falling" if trend_pct and trend_pct < 0 else
            "stable"
        ),
        "daily_national": daily,
    }


# ===========================================================================
# 3. GET /analytics/summary-report
# ===========================================================================

def _build_summary(db: Session) -> dict:
    """
    Compute the full system-wide summary. Separated from the route so
    export-report can reuse it without duplication.
    """
    # ---- Farmer and entry counts (pure DB aggregation — no price_matcher) ----
    total_farmers = int(db.query(func.count(Farmer.id)).scalar() or 0)
    total_entries = int(db.query(func.count(LedgerEntry.id)).scalar() or 0)
    total_sales   = int(
        db.query(func.count(LedgerEntry.id))
        .filter(LedgerEntry.entry_type == "sale")
        .scalar() or 0
    )

    # ---- Price-check analysis (needs compare_price) ----
    all_checks = _run_price_checks_for_sales(db)

    checked_count   = len(all_checks)
    underpaid_checks = [r for r in all_checks if r["status"] == "underpaid"]
    underpaid_count  = len(underpaid_checks)

    pct_underpaid = round((underpaid_count / checked_count) * 100, 1) if checked_count else None

    # Average underpayment % (negative = below market)
    diffs = [r["difference_percent"] for r in underpaid_checks if r["difference_percent"] is not None]
    avg_underpayment_pct = round(sum(diffs) / len(diffs), 2) if diffs else None

    # ---- Worst district (minimum group size enforced) ----
    district_stats: dict[str, list[float]] = defaultdict(list)
    for r in underpaid_checks:
        if r["difference_percent"] is not None:
            district_stats[r["district"]].append(r["difference_percent"])

    worst_district = None
    worst_pct      = None
    for dist, diffs_d in district_stats.items():
        if len(diffs_d) >= MIN_GROUP_SIZE:
            avg = sum(diffs_d) / len(diffs_d)
            if worst_pct is None or avg < worst_pct:
                worst_pct      = round(avg, 2)
                worst_district = dist

    # ---- SMS usage (if table exists) ----
    sms_queries = 0
    sms_unique  = 0
    try:
        from models import SmsLog
        sms_queries = int(db.query(func.count(SmsLog.id)).scalar() or 0)
        sms_unique  = int(db.query(func.count(SmsLog.phone_number.distinct())).scalar() or 0)
    except Exception:
        pass

    return {
        "generated_at":             datetime.utcnow().isoformat(),
        "total_farmers":            total_farmers,
        "total_ledger_entries":     total_entries,
        "total_sale_entries":       total_sales,
        "sales_with_price_check":   checked_count,
        "underpaid_count":          underpaid_count,
        "pct_sales_underpaid":      pct_underpaid,
        "avg_underpayment_pct":     avg_underpayment_pct,
        "worst_district":           worst_district,
        "worst_district_avg_pct":   worst_pct,
        "sms_total_queries":        sms_queries,
        "sms_unique_farmers":       sms_unique,
        "privacy_note": (
            "This report contains no individual farmer data. "
            "All figures are system-wide aggregates. "
            f"District-level data requires a minimum of {MIN_GROUP_SIZE} entries."
        ),
    }


@router.get("/summary-report")
def summary_report(db: Session = Depends(get_db)):
    """
    Return a single JSON object with the most important system-wide statistics.

    Designed as the key evidence document for pitching to agriculture departments
    or institutional partners. Transforms individual farmer records into evidence
    of systemic underpayment patterns — without exposing any individual.

    Fields
    ------
    total_farmers             : Number of registered farmers using the system.
    total_ledger_entries      : All loans + sales logged.
    total_sale_entries        : Sales specifically.
    sales_with_price_check    : How many sales had enough data for a price check.
    underpaid_count           : Sales where farmer received below mandi reference.
    pct_sales_underpaid       : Percentage of checked sales that were underpaid.
    avg_underpayment_pct      : Average % below market price (negative number).
    worst_district            : District with the highest underpayment rate.
    worst_district_avg_pct    : Average underpayment % in that district.
    sms_total_queries         : Total SMS/WhatsApp price checks (reach metric).
    sms_unique_farmers        : Unique phone numbers (distinct users reached).

    Privacy: no individual farmer data, names, or identifiers are present.
    """
    return _build_summary(db)


# ===========================================================================
# 4. GET /analytics/export-report (CSV download)
# ===========================================================================

@router.get("/export-report")
def export_report_csv(db: Session = Depends(get_db)):
    """
    Download the summary report as a CSV file for offline / institutional use.

    Government officials and agriculture department staff often require
    spreadsheet-compatible formats for internal reporting. This endpoint
    returns the same data as /analytics/summary-report in CSV format.

    CSV format: two columns — Metric and Value.
    Content-Type: text/csv
    Filename: kisaankhata_report_{date}.csv

    Privacy: same anonymisation guarantees as /analytics/summary-report.
    """
    data = _build_summary(db)
    today = datetime.utcnow().strftime("%Y-%m-%d")

    # Build the CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["KisaanKhata — Impact Report", ""])
    writer.writerow(["Generated at (UTC)", data["generated_at"]])
    writer.writerow([])
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Total Registered Farmers",          data["total_farmers"]])
    writer.writerow(["Total Ledger Entries",              data["total_ledger_entries"]])
    writer.writerow(["Total Sale Entries",                data["total_sale_entries"]])
    writer.writerow(["Sales With Price Check Data",       data["sales_with_price_check"]])
    writer.writerow(["Underpaid Sales (count)",           data["underpaid_count"]])
    writer.writerow(["% Sales Flagged as Underpaid",      f"{data['pct_sales_underpaid']}%"
                     if data["pct_sales_underpaid"] is not None else "N/A"])
    writer.writerow(["Avg Underpayment % (all flagged)",  f"{data['avg_underpayment_pct']}%"
                     if data["avg_underpayment_pct"] is not None else "N/A"])
    writer.writerow(["District with Highest Underpayment", data["worst_district"] or "N/A"])
    writer.writerow(["Worst District Avg Underpayment %", f"{data['worst_district_avg_pct']}%"
                     if data["worst_district_avg_pct"] is not None else "N/A"])
    writer.writerow([])
    writer.writerow(["SMS / WhatsApp Reach", ""])
    writer.writerow(["Total SMS Price Queries",  data["sms_total_queries"]])
    writer.writerow(["Unique Farmers via SMS/WA", data["sms_unique_farmers"]])
    writer.writerow([])
    writer.writerow(["Privacy Statement",
                     data["privacy_note"]])

    output.seek(0)
    filename = f"kisaankhata_report_{today}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
