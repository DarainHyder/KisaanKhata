"""
KisaanKhata — Price Matcher Service
======================================
Implements price reference lookup from THREE sources in priority order:

  Tier 1 — AMIS Punjab live (LivePriceEntry DB table):
    Source : amis.pk scraped every 6 hours by the background scheduler
    Unit   : PKR/40kg (AMIS standard)
    Grain  : Daily, per-city — freshest possible data
    Used if: data is less than 24 hours old
    Source label: "amis_live"

  Tier 2 — Kaggle historical mandi prices (kaggle_df in-memory):
    Folder : backend/data/kaggle_crop_prices/*.csv
    Columns: City, Date (YYYY-MM-DD), Crop, Price (PKR/40kg)
    Grain  : Daily, per-city — historical (up to ~2023)
    Source label: "kaggle_historical"

  Tier 3 — FAOSTAT national producer prices (faostat_df in-memory):
    File   : backend/data/producer_prices_pak.csv
    Columns: Item (crop), Year, Value (PKR/tonne)
    Grain  : Annual national average — broadest fallback
    Source label: "faostat_national"

Public API
----------
  load_price_data()                                      → call once at startup
  get_reference_price(crop_name, date, db) → dict|None  → 3-tier lookup
  compare_price(reported, crop_name, date, db) → dict   → fairness verdict
  calculate_farmer_summary(farmer_id, db_session) → dict
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_BASE = Path(__file__).resolve().parent.parent          # kisaankhata/backend/
FAOSTAT_CSV  = _BASE / "data" / "producer_prices_pak.csv"
KAGGLE_DIR   = _BASE / "data" / "kaggle_crop_prices"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
FAIRNESS_THRESHOLD_PERCENT: float = 0.10   # 10 % tolerance
DATE_TOLERANCE_DAYS: int = 7               # days either side for date matching
AMIS_LIVE_MAX_AGE_HOURS: int = 24          # use live data only if < 24 h old

# ---------------------------------------------------------------------------
# Module-level cache (populated once at startup)
# ---------------------------------------------------------------------------
_faostat_df = None   # pandas DataFrame
_kaggle_df  = None   # pandas DataFrame


# ===========================================================================
# 1. Data Loading
# ===========================================================================

def load_price_data() -> None:
    """
    Load and cache both dataset sources into module-level DataFrames.
    Called once from main.py @app.on_event("startup").

    FAOSTAT normalisation
    ---------------------
    - Keep only: crop (from 'Item'), year (from 'Year'), price_per_tonne (from 'Value')
    - Normalise crop names to lowercase stripped strings.

    Kaggle normalisation
    --------------------
    - Every CSV has columns: City, Date, Crop, Price
    - Date is YYYY-MM-DD string → parse to datetime
    - Price is int (PKR per 40 kg mandi unit)
    - One file (Brown Sugar.csv) has encoding issues → fallback to latin-1
    - Wrap each file in try/except; skip failures, print summary.
    """
    global _faostat_df, _kaggle_df

    import pandas as pd

    # ---- FAOSTAT --------------------------------------------------------
    try:
        fao_raw = pd.read_csv(FAOSTAT_CSV)
        _faostat_df = pd.DataFrame({
            "crop":           fao_raw["Item"].str.strip().str.lower(),
            "year":           fao_raw["Year"].astype(int),
            "price_per_tonne": fao_raw["Value"].astype(float),
        }).dropna(subset=["price_per_tonne"])
        print(f"[PriceMatcher] FAOSTAT loaded: {len(_faostat_df):,} rows, "
              f"{_faostat_df['crop'].nunique()} crops.")
    except Exception as exc:
        print(f"[PriceMatcher] FAILED to load FAOSTAT CSV: {exc}")
        _faostat_df = pd.DataFrame(columns=["crop", "year", "price_per_tonne"])

    # ---- Kaggle ----------------------------------------------------------
    kaggle_frames = []
    ok = 0
    failed = 0

    for csv_path in sorted(KAGGLE_DIR.glob("*.csv")):
        # Derive crop name from filename as a fallback label
        filename_crop = csv_path.stem.replace("_", " ").strip()

        for encoding in ("utf-8", "utf-8-sig", "latin-1"):
            try:
                df = pd.read_csv(csv_path, encoding=encoding,
                                 parse_dates=["Date"], dayfirst=False)

                # All confirmed files have exactly: City, Date, Crop, Price
                required = {"City", "Date", "Crop", "Price"}
                if not required.issubset(df.columns):
                    raise ValueError(f"Missing columns: {required - set(df.columns)}")

                df = df.rename(columns={"Crop": "crop", "Date": "date",
                                        "Price": "price", "City": "city"})
                df["crop"] = df["crop"].fillna(filename_crop).str.strip().str.lower()
                df = df[["city", "date", "crop", "price"]].dropna(subset=["price"])
                df = df[df["price"] > 0]           # drop zero-price sentinel rows
                kaggle_frames.append(df)
                ok += 1
                break   # encoding worked — stop trying alternatives
            except UnicodeDecodeError:
                continue    # try next encoding
            except Exception as exc:
                print(f"[PriceMatcher] SKIP {csv_path.name}: {exc}")
                failed += 1
                break

    if kaggle_frames:
        _kaggle_df = pd.concat(kaggle_frames, ignore_index=True)
        print(f"[PriceMatcher] Kaggle loaded: {ok} files OK, {failed} failed. "
              f"{len(_kaggle_df):,} total rows, {_kaggle_df['crop'].nunique()} crops.")
    else:
        print("[PriceMatcher] No Kaggle files loaded.")
        _kaggle_df = pd.DataFrame(columns=["city", "date", "crop", "price"])


# ===========================================================================
# 2. Reference Price Lookup
# ===========================================================================

def get_reference_price(
    crop_name: str,
    date: str | None = None,
    db: Optional[Session] = None,
) -> dict | None:
    """
    3-tier price reference lookup.

    Priority order:
      1. AMIS live (DB) — if data < 24 h old  →  source = "amis_live"
      2. Kaggle historical CSV              →  source = "kaggle_historical"
      3. FAOSTAT annual national            →  source = "faostat_national"

    Args:
        crop_name : Crop name — matched case-insensitively and partially.
        date      : ISO-8601 date of the sale (YYYY-MM-DD). None = use latest.
        db        : SQLAlchemy Session — required for Tier-1 lookup.
                    If None, Tier 1 is skipped silently.

    Returns:
        dict with keys:
          price          (float)  — reference price in PKR per 40 kg
          source         (str)    — one of the three source labels above
          data_freshness (str)    — date/year string describing data age
          crop_matched   (str)    — actual name found in the dataset
          source_tier    (int)    — 1, 2, or 3 for UI rendering
        or None if no match found in any source.
    """
    query = crop_name.strip().lower()
    sale_date = _parse_date(date)

    # ---- Tier 1: AMIS live DB -------------------------------------------
    if db is not None:
        result = _lookup_amis_live(query, db)
        if result:
            return result

    # ---- Tier 2: Kaggle historical CSV ----------------------------------
    if _kaggle_df is not None and not _kaggle_df.empty:
        result = _lookup_kaggle(query, sale_date)
        if result:
            return result

    # ---- Tier 3: FAOSTAT national baseline ------------------------------
    if _faostat_df is not None and not _faostat_df.empty:
        result = _lookup_faostat(query, sale_date)
        if result:
            return result

    return None


def _parse_date(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y"):
        try:
            return datetime.strptime(date_str[:10], fmt[:len(date_str[:10])])
        except ValueError:
            continue
    return None


def _crop_mask(df, query: str):
    """Return a boolean mask for rows whose 'crop' column partially matches query."""
    return df["crop"].str.contains(query, case=False, na=False, regex=False)


def _lookup_amis_live(query: str, db: Session) -> dict | None:
    """
    Tier-1 lookup: find the most recent AMIS live price for this crop.
    Only returns data if the scrape timestamp is less than AMIS_LIVE_MAX_AGE_HOURS old.
    Uses the FQP (Fair Quoted Price) averaged across all cities scraped.
    """
    from models import LivePriceEntry

    cutoff = datetime.utcnow() - timedelta(hours=AMIS_LIVE_MAX_AGE_HOURS)

    # Find the most recent scrape for this crop (within freshness window)
    latest_ts = (
        db.query(func.max(LivePriceEntry.scraped_at))
        .filter(
            LivePriceEntry.crop_name.ilike(f"%{query}%"),
            LivePriceEntry.scraped_at >= cutoff,
        )
        .scalar()
    )
    if not latest_ts:
        return None

    rows = (
        db.query(LivePriceEntry)
        .filter(
            LivePriceEntry.crop_name.ilike(f"%{query}%"),
            LivePriceEntry.scraped_at == latest_ts,
        )
        .all()
    )
    if not rows:
        return None

    fqps = [r.fqp for r in rows if r.fqp is not None]
    if not fqps:
        return None

    avg_fqp      = round(sum(fqps) / len(fqps), 2)
    crop_matched = rows[0].crop_name
    city_count   = len(rows)

    return {
        "price":          avg_fqp,
        "source":         "amis_live",
        "source_tier":    1,
        "data_freshness": latest_ts.strftime("%Y-%m-%d %H:%M UTC"),
        "crop_matched":   crop_matched,
        "city_count":     city_count,
    }


def _lookup_kaggle(query: str, sale_date: datetime | None) -> dict | None:
    import pandas as pd

    mask = _crop_mask(_kaggle_df, query)
    subset = _kaggle_df[mask].copy()
    if subset.empty:
        return None

    # Filter to a date window if a date was given
    if sale_date is not None:
        window_start = pd.Timestamp(sale_date - timedelta(days=DATE_TOLERANCE_DAYS))
        window_end   = pd.Timestamp(sale_date + timedelta(days=DATE_TOLERANCE_DAYS))
        windowed = subset[(subset["date"] >= window_start) & (subset["date"] <= window_end)]
        if not windowed.empty:
            subset = windowed

    avg_price    = float(subset["price"].mean())
    freshest     = subset["date"].max()
    crop_matched = subset["crop"].mode().iloc[0]

    return {
        "price":          round(avg_price, 2),
        "source":         "kaggle_historical",
        "source_tier":    2,
        "data_freshness": freshest.strftime("%Y-%m-%d") if pd.notna(freshest) else "unknown",
        "crop_matched":   crop_matched,
    }


def _lookup_faostat(query: str, sale_date: datetime | None) -> dict | None:
    mask = _crop_mask(_faostat_df, query)
    subset = _faostat_df[mask].copy()
    if subset.empty:
        return None

    # Filter to nearest year if a date was given
    if sale_date is not None:
        target_year = sale_date.year
        if target_year in subset["year"].values:
            subset = subset[subset["year"] == target_year]
        else:
            closest_year = subset["year"].iloc[(subset["year"] - target_year).abs().argsort()].iloc[0]
            subset = subset[subset["year"] == closest_year]

    # FAOSTAT is PKR/tonne; convert to approx PKR/40kg  (÷ 25)
    avg_price_tonne = float(subset["price_per_tonne"].mean())
    avg_price_40kg  = round(avg_price_tonne / 25.0, 2)
    freshest_year   = int(subset["year"].max())
    crop_matched    = subset["crop"].mode().iloc[0]

    return {
        "price":          avg_price_40kg,
        "source":         "faostat_national",
        "source_tier":    3,
        "data_freshness": str(freshest_year),
        "crop_matched":   crop_matched,
    }


# ===========================================================================
# 3. Price Fairness Comparison
# ===========================================================================

# Source-tier human-readable labels for transparent messaging
_SOURCE_CONTEXT = {
    "amis_live":        "today's live Punjab mandi price",
    "kaggle_historical": "historical mandi price records",
    "faostat_national":  "national annual price average",
}


def compare_price(
    reported_price: float,
    crop_name: str,
    date: str | None = None,
    db: Optional[Session] = None,
) -> dict:
    """
    Compare a farmer's reported sale price against the 3-tier reference.

    Args:
        reported_price : Price per 40 kg the farmer was paid (PKR).
        crop_name      : Crop name (matched flexibly).
        date           : ISO date of the sale (YYYY-MM-DD).
        db             : SQLAlchemy Session — enables Tier-1 (AMIS live) lookup.

    Returns:
        dict with keys:
          reported_price      (float)
          reference_price     (float | None)
          difference_amount   (float | None)   — reported − reference
          difference_percent  (float | None)   — as a percentage
          status              (str)  — "fair" | "underpaid" | "overpaid" | "no_data"
          source              (str)  — source label (e.g. "amis_live")
          source_tier         (int)  — 1, 2, or 3
          data_freshness      (str)  — date/year of reference data
          message             (str)  — human-readable, source-transparent verdict
    """
    ref = get_reference_price(crop_name, date, db=db)

    if ref is None:
        return {
            "reported_price":     reported_price,
            "reference_price":    None,
            "difference_amount":  None,
            "difference_percent": None,
            "status":             "no_data",
            "source":             "none",
            "source_tier":        0,
            "data_freshness":     "N/A",
            "message": (
                f"No reference price found for '{crop_name}'. "
                "Cannot verify fairness — please check with your local mandi."
            ),
        }

    reference_price    = ref["price"]
    difference_amount  = round(reported_price - reference_price, 2)
    difference_percent = round((difference_amount / reference_price) * 100, 2) if reference_price else None

    threshold = reference_price * FAIRNESS_THRESHOLD_PERCENT
    if difference_amount >= -threshold:
        status = "fair" if difference_amount <= threshold else "overpaid"
    else:
        status = "underpaid"

    # Source-transparent context phrase
    source_ctx = _SOURCE_CONTEXT.get(ref["source"], ref["source"])
    freshness  = ref["data_freshness"]

    if status == "fair":
        message = (
            f"The price you received (PKR {reported_price:,.0f}/40kg) is fair — "
            f"compared against {source_ctx} of PKR {reference_price:,.0f}/40kg "
            f"(as of {freshness})."
        )
    elif status == "underpaid":
        message = (
            f"You may have been underpaid. You received PKR {reported_price:,.0f}/40kg, "
            f"but {source_ctx} shows PKR {reference_price:,.0f}/40kg — "
            f"PKR {abs(difference_amount):,.0f} ({abs(difference_percent):.1f}%) less than you should have received "
            f"(data as of {freshness})."
        )
    else:  # overpaid
        message = (
            f"You received a price above {source_ctx} — "
            f"PKR {reported_price:,.0f}/40kg vs reference PKR {reference_price:,.0f}/40kg "
            f"(data as of {freshness})."
        )

    return {
        "reported_price":     reported_price,
        "reference_price":    reference_price,
        "difference_amount":  difference_amount,
        "difference_percent": difference_percent,
        "status":             status,
        "source":             ref["source"],
        "source_tier":        ref.get("source_tier", 0),
        "data_freshness":     freshness,
        "message":            message,
    }


# ===========================================================================
# 4. Farmer Financial Summary  (debt-clarity feature)
# ===========================================================================

def calculate_farmer_summary(farmer_id: int, db_session: Session) -> dict:
    """
    Aggregate a farmer's ledger entries: total loans, total sales, net balance.
    """
    from models import Farmer, LedgerEntry

    farmer = db_session.query(Farmer).filter(Farmer.id == farmer_id).first()

    loan_total = float(
        db_session.query(func.coalesce(func.sum(LedgerEntry.amount), 0.0))
        .filter(LedgerEntry.farmer_id == farmer_id, LedgerEntry.entry_type == "loan")
        .scalar()
    )
    sale_total = float(
        db_session.query(func.coalesce(func.sum(LedgerEntry.amount), 0.0))
        .filter(LedgerEntry.farmer_id == farmer_id, LedgerEntry.entry_type == "sale")
        .scalar()
    )
    entry_count = int(
        db_session.query(func.count(LedgerEntry.id))
        .filter(LedgerEntry.farmer_id == farmer_id)
        .scalar()
    )

    net_balance = round(sale_total - loan_total, 2)

    if net_balance >= 0:
        message = (
            f"{farmer.name} has received PKR {sale_total:,.0f} from sales and "
            f"borrowed PKR {loan_total:,.0f}. Net balance is PKR {net_balance:,.0f} in their favour."
        )
    else:
        message = (
            f"{farmer.name} has received PKR {sale_total:,.0f} from sales but "
            f"borrowed PKR {loan_total:,.0f}. Outstanding debt: PKR {abs(net_balance):,.0f}."
        )

    return {
        "farmer_id":   farmer_id,
        "farmer_name": farmer.name,
        "total_loans": loan_total,
        "total_sales": sale_total,
        "net_balance": net_balance,
        "entry_count": entry_count,
        "message":     message,
    }
