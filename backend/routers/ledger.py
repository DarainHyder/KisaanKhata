"""
KisaanKhata — Ledger Router
=============================
Handles all CRUD operations for Farmers and LedgerEntries.

Routes defined here
-------------------
  POST   /api/ledger/farmers                  — Register a new farmer
  GET    /api/ledger/farmers/{id}             — Get a single farmer by ID
  POST   /api/ledger/entry                   — Log a new loan or sale entry
  GET    /api/ledger/{farmer_id}              — List all entries for a farmer (date desc)
  GET    /api/ledger/{farmer_id}/summary      — Loan/sale totals + net balance
  GET    /api/ledger/{farmer_id}/verify       — Verify the farmer's tamper-evident hash chain
  POST   /api/ledger/voice-entry             — Upload audio → transcript + parsed guess
  POST   /api/ledger/voice-entry/confirm     — Save confirmed/corrected entry to DB
"""

import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from database import get_db
from models import Farmer, LedgerEntry
from schemas import (
    FarmerCreate, FarmerRead,
    LedgerEntryCreate, LedgerEntryRead,
    FarmerSummary,
    VoiceEntryResponse, VoiceParsedGuess, VoiceEntryConfirm,
)
from services.price_matcher import calculate_farmer_summary
from services.stt_service import transcribe_audio, save_upload_to_tempfile, parse_transcription_to_entry
from services.integrity import compute_entry_hash, get_previous_hash, verify_farmer_chain

router = APIRouter()


# ===========================================================================
# Helper — reusable farmer lookup
# ===========================================================================

def _get_farmer_or_404(farmer_id: int, db: Session) -> Farmer:
    """
    Return the Farmer ORM object for the given ID, or raise HTTP 404.
    Centralised so all routes share the same error message format.
    """
    farmer = db.query(Farmer).filter(Farmer.id == farmer_id).first()
    if not farmer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Farmer with id={farmer_id} was not found.",
        )
    return farmer


# ===========================================================================
# Farmer routes
# ===========================================================================

@router.post("/farmers", response_model=FarmerRead, status_code=status.HTTP_201_CREATED)
def create_farmer(payload: FarmerCreate, db: Session = Depends(get_db)):
    """
    Register a new farmer in the database.

    - Checks for a duplicate phone_number and raises HTTP 409 if one exists.
    - Persists the new Farmer row and returns it with its generated ID.
    """
    existing = db.query(Farmer).filter(Farmer.phone_number == payload.phone_number).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A farmer with phone_number '{payload.phone_number}' is already registered.",
        )

    farmer = Farmer(
        name=payload.name,
        phone_number=payload.phone_number,
        location=payload.location,
    )
    db.add(farmer)
    db.commit()
    db.refresh(farmer)
    return farmer


@router.get("/farmers/{farmer_id}", response_model=FarmerRead)
def get_farmer(farmer_id: int, db: Session = Depends(get_db)):
    """
    Fetch a single farmer by their primary-key ID.
    Returns HTTP 404 if the farmer does not exist.
    """
    return _get_farmer_or_404(farmer_id, db)


# ===========================================================================
# LedgerEntry routes
# ===========================================================================

@router.post("/entry", response_model=LedgerEntryRead, status_code=status.HTTP_201_CREATED)
def create_ledger_entry(payload: LedgerEntryCreate, db: Session = Depends(get_db)):
    """
    Log a new loan or harvest sale for a farmer.

    - Verifies the referenced farmer exists (HTTP 404 if not).
    - Pydantic schema already enforces that reported_price_per_unit and
      crop_name are present for 'sale' entries (HTTP 422 if violated).
    - Persists the entry and returns it with its generated ID.
    """
    # Verify farmer exists
    _get_farmer_or_404(payload.farmer_id, db)

    entry = LedgerEntry(
        farmer_id=payload.farmer_id,
        entry_type=payload.entry_type,
        crop_name=payload.crop_name,
        amount=payload.amount,
        reported_price_per_unit=payload.reported_price_per_unit,
        unit=payload.unit,
        date=payload.date,
    )
    # Stamp tamper-evident hash chain before persisting
    prev_hash       = get_previous_hash(payload.farmer_id, db)
    entry.previous_hash = prev_hash
    entry.entry_hash    = compute_entry_hash(entry, prev_hash)

    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/{farmer_id}", response_model=list[LedgerEntryRead])
def list_entries_for_farmer(farmer_id: int, db: Session = Depends(get_db)):
    """
    Return all ledger entries for a specific farmer, ordered by date descending
    (most recent transaction first).

    Returns HTTP 404 if the farmer does not exist.
    """
    _get_farmer_or_404(farmer_id, db)

    entries = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.farmer_id == farmer_id)
        .order_by(LedgerEntry.date.desc())
        .all()
    )
    return entries


@router.get("/{farmer_id}/summary", response_model=FarmerSummary)
def get_farmer_summary(farmer_id: int, db: Session = Depends(get_db)):
    """
    Return financial summary for a farmer:
      - total_loans    : sum of all 'loan' entry amounts
      - total_sales    : sum of all 'sale' entry amounts
      - net_balance    : total_sales − total_loans
                         (positive = farmer is ahead; negative = still in debt)

    Calculation is delegated to services.price_matcher.calculate_farmer_summary()
    so it can be unit-tested and reused independently of the HTTP layer.

    Returns HTTP 404 if the farmer does not exist.
    """
    _get_farmer_or_404(farmer_id, db)
    return calculate_farmer_summary(farmer_id, db)


@router.get("/{farmer_id}/verify")
def verify_ledger_integrity(farmer_id: int, db: Session = Depends(get_db)):
    """
    Re-verify the tamper-evident SHA-256 hash chain for a farmer's ledger.

    Walks every LedgerEntry for this farmer in chronological order, recomputes
    each entry's expected hash from its raw fields, and compares it against the
    stored entry_hash and previous_hash values.

    Returns:
      - verified=True  if the full history is cryptographically intact.
      - verified=False with broken_at_entry and detail if any entry has been
        altered or the chain linkage is inconsistent.

    This endpoint is intentionally public so that farmers, cooperatives, or
    institutional partners can independently audit the record without needing
    any special credentials. Transparency IS the trust feature.

    Returns HTTP 404 if the farmer does not exist.
    """
    _get_farmer_or_404(farmer_id, db)
    return verify_farmer_chain(farmer_id, db)


# ===========================================================================
# Voice entry — transcribe + parse (no auto-save)
# ===========================================================================

@router.post("/voice-entry", response_model=VoiceEntryResponse)
async def voice_entry(
    audio: UploadFile = File(..., description="Audio file (WAV, MP3, M4A, OGG, FLAC, WEBM)."),
    language: str = Query(default="ur", description="BCP-47 language code. 'ur'=Urdu, 'en'=English."),
):
    """
    Step 1 of the voice flow:
      1. Transcribe the uploaded audio with Whisper (local, no API key).
      2. Run the rule-based parser to extract a structured 'best guess'.
      3. Return BOTH the raw transcript and the parsed guess.

    The parsed fields are NOT saved to the database automatically.
    The frontend should show them in an editable confirmation form.
    The farmer confirms / corrects the fields, then calls /voice-entry/confirm.

    Error codes
    -----------
    400  Unsupported audio format.
    503  Whisper model not loaded (check server startup logs).
    422  Transcription failed.
    """
    tmp_path: Path | None = None
    try:
        tmp_path = save_upload_to_tempfile(audio)
        transcript = transcribe_audio(str(tmp_path), language=language)

        # Run rule-based parser — always returns a dict, never raises
        parsed_dict = parse_transcription_to_entry(transcript)
        parsed = VoiceParsedGuess(**parsed_dict)

        return VoiceEntryResponse(
            transcript=transcript,
            language=language,
            original_file=audio.filename,
            parsed=parsed,
            note=(
                "Review the parsed fields below and correct any errors, "
                "then submit to POST /api/ledger/voice-entry/confirm to save."
            ),
        )

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        msg = str(exc)
        if "not loaded" in msg or "not installed" in msg:
            raise HTTPException(status_code=503, detail=f"STT service unavailable: {msg}")
        raise HTTPException(status_code=422, detail=f"Transcription failed: {msg}")
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if tmp_path and tmp_path.exists():
            try:
                os.remove(tmp_path)
            except OSError:
                pass


@router.post("/voice-entry/confirm", response_model=LedgerEntryRead,
             status_code=status.HTTP_201_CREATED)
def voice_entry_confirm(
    payload: VoiceEntryConfirm,
    db: Session = Depends(get_db),
):
    """
    Step 2 of the voice flow — save the confirmed/corrected entry.

    The frontend sends back the fields that the farmer reviewed and approved
    (originally parsed by /voice-entry, corrected if needed).
    This route validates and persists them exactly like POST /entry.

    - Verifies that farmer_id exists (HTTP 404 if not).
    - Validates that sale entries include crop_name and reported_price_per_unit
      (HTTP 400 if missing).
    - Saves and returns the created LedgerEntry with its generated ID.
    """
    _get_farmer_or_404(payload.farmer_id, db)

    # Extra validation for sale entries (Pydantic doesn't enforce cross-field
    # rules on VoiceEntryConfirm, so we do it explicitly here)
    if payload.entry_type == "sale":
        if not payload.crop_name:
            raise HTTPException(
                status_code=400,
                detail="crop_name is required for sale entries.",
            )
        if payload.reported_price_per_unit is None:
            raise HTTPException(
                status_code=400,
                detail="reported_price_per_unit is required for sale entries.",
            )
    if payload.entry_type not in ("loan", "sale"):
        raise HTTPException(
            status_code=400,
            detail="entry_type must be 'loan' or 'sale'.",
        )

    entry = LedgerEntry(
        farmer_id=payload.farmer_id,
        entry_type=payload.entry_type,
        crop_name=payload.crop_name,
        amount=payload.amount,
        reported_price_per_unit=payload.reported_price_per_unit,
        unit=payload.unit,
        date=payload.date,
    )
    # Stamp tamper-evident hash chain before persisting
    prev_hash           = get_previous_hash(payload.farmer_id, db)
    entry.previous_hash = prev_hash
    entry.entry_hash    = compute_entry_hash(entry, prev_hash)

    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
