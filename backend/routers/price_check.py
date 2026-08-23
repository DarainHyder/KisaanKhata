"""
KisaanKhata — Price Check Router
==================================
Compares a farmer's reported sale price against 3-tier reference data:
  Tier 1: AMIS Punjab live (amis.pk, scraped every 6 hours)
  Tier 2: Kaggle historical mandi prices (per-city, daily)
  Tier 3: FAOSTAT national annual producer prices

Routes
------
  GET  /api/price-check/{entry_id}
      — Check a single LedgerEntry sale against reference price.

  GET  /api/price-check/farmer/{farmer_id}
      — Run checks on all sale entries for a farmer.
"""

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import LedgerEntry, Farmer
from schemas import PriceCheckResult
from services.price_matcher import compare_price

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _entry_to_price_check(entry: LedgerEntry, farmer_location: str,
                           db: Session) -> dict:
    """Run compare_price for a single sale LedgerEntry and return a result dict."""
    result = compare_price(
        reported_price=entry.reported_price_per_unit,
        crop_name=entry.crop_name,
        date=entry.date.strftime("%Y-%m-%d") if entry.date else None,
        db=db,
    )
    result["ledger_entry_id"] = entry.id
    result["crop_name"]       = entry.crop_name
    return result


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/{entry_id}", response_model=PriceCheckResult)
def check_price_for_entry(entry_id: int, db: Session = Depends(get_db)):
    """
    Compare the reported sale price in a single LedgerEntry against mandi data.

    - Returns HTTP 404 if the entry doesn't exist.
    - Returns HTTP 400 if the entry is a loan (not a sale).
    - Returns PriceCheckResult with source, data_freshness, and fairness verdict.
    """
    entry = db.query(LedgerEntry).filter(LedgerEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail=f"LedgerEntry id={entry_id} not found.")
    if entry.entry_type != "sale":
        raise HTTPException(status_code=400, detail="Price check is only valid for 'sale' entries.")
    if not entry.reported_price_per_unit:
        raise HTTPException(status_code=400, detail="This entry has no reported_price_per_unit.")

    farmer = db.query(Farmer).filter(Farmer.id == entry.farmer_id).first()
    return _entry_to_price_check(entry, farmer.location if farmer else "", db)


@router.get("/farmer/{farmer_id}", response_model=list[PriceCheckResult])
def check_all_prices_for_farmer(farmer_id: int, db: Session = Depends(get_db)):
    """
    Run price-fairness checks on every sale entry for a farmer.

    - Returns HTTP 404 if the farmer doesn't exist.
    - Returns an empty list if the farmer has no sale entries.
    """
    farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail=f"Farmer id={farmer_id} not found.")

    sale_entries = (
        db.query(LedgerEntry)
        .filter(
            LedgerEntry.farmer_id == farmer_id,
            LedgerEntry.entry_type == "sale",
            LedgerEntry.reported_price_per_unit.isnot(None),
        )
        .order_by(LedgerEntry.date.desc())
        .all()
    )
    return [_entry_to_price_check(e, farmer.location, db) for e in sale_entries]


