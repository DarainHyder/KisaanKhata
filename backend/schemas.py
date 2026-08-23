"""
KisaanKhata — Pydantic Schemas
================================
Defines request (Create*) and response (Read*) schemas for the two
core domain objects: Farmer and LedgerEntry.

Pydantic handles input validation and JSON serialisation so FastAPI
route functions can simply declare the schema as a parameter type.
"""

from datetime import datetime
from typing import Literal, Optional, List

from pydantic import BaseModel, Field, field_validator


# ===========================================================================
# Farmer schemas
# ===========================================================================

class FarmerCreate(BaseModel):
    """
    Payload required when registering a new farmer.
    The `id` and `created_at` fields are assigned by the database.
    """

    name: str = Field(
        ...,
        min_length=2,
        max_length=120,
        examples=["Muhammad Aslam"],
        description="Full name of the farmer.",
    )
    phone_number: str = Field(
        ...,
        pattern=r"^(\+92|0)?[0-9]{10}$",
        examples=["03001234567"],
        description="Pakistani mobile number (10 digits, optionally prefixed with +92 or 0).",
    )
    location: str = Field(
        ...,
        max_length=100,
        examples=["Multan"],
        description="District or city where the farmer is based.",
    )


class FarmerRead(FarmerCreate):
    """
    Full farmer record returned by the API — includes server-generated fields.
    """

    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ===========================================================================
# LedgerEntry schemas
# ===========================================================================

class LedgerEntryCreate(BaseModel):
    """
    Payload required when logging a new ledger entry (loan or sale).

    Rules enforced at the schema level:
      - `crop_name` and `reported_price_per_unit` are required when
        `entry_type == "sale"`.
      - For `entry_type == "loan"`, those fields are optional / ignored.
    """

    farmer_id: int = Field(..., description="ID of the farmer this entry belongs to.")
    entry_type: Literal["loan", "sale"] = Field(
        ..., description="Whether this entry is a loan received or a harvest sale."
    )
    crop_name: Optional[str] = Field(
        None,
        max_length=80,
        examples=["wheat"],
        description="Name of the crop sold. Required for sale entries.",
    )
    amount: float = Field(
        ..., gt=0, description="Total monetary value of the transaction in PKR."
    )
    reported_price_per_unit: Optional[float] = Field(
        None,
        gt=0,
        description=(
            "Price per unit the farmer was told they received. "
            "Required for sale entries; used for mandi price comparison."
        ),
    )
    unit: str = Field(
        ...,
        max_length=30,
        examples=["40kg", "maund"],
        description="Weight or volume unit used in this transaction.",
    )
    date: datetime = Field(
        ..., description="Actual date of the loan or sale event (ISO-8601)."
    )

    @field_validator("crop_name")
    @classmethod
    def crop_name_required_for_sales(cls, v, info):
        """Ensure crop_name is provided when entry_type is 'sale'."""
        if info.data.get("entry_type") == "sale" and not v:
            raise ValueError("crop_name is required for sale entries.")
        return v

    @field_validator("reported_price_per_unit")
    @classmethod
    def price_required_for_sales(cls, v, info):
        """Ensure reported_price_per_unit is provided when entry_type is 'sale'."""
        if info.data.get("entry_type") == "sale" and v is None:
            raise ValueError("reported_price_per_unit is required for sale entries.")
        return v


class LedgerEntryRead(LedgerEntryCreate):
    """
    Full ledger entry returned by the API — includes server-generated fields.

    entry_hash and previous_hash are included so that API consumers (frontend,
    institutional auditors) can independently verify the integrity chain without
    needing database access — just the HTTP responses are enough to re-verify.
    """

    id:            int
    created_at:    datetime
    entry_hash:    Optional[str] = Field(None, description="SHA-256 hash of this entry's fields + chain linkage.")
    previous_hash: Optional[str] = Field(None, description="entry_hash of the preceding entry, or 'GENESIS'.")

    model_config = {"from_attributes": True}



# ===========================================================================
# Voice entry schemas
# ===========================================================================

class VoiceParsedGuess(BaseModel):
    """
    The structured guess produced by the rule-based transcript parser.
    All fields are Optional — the parser only sets what it could detect.
    The farmer must confirm/correct these on the frontend before saving.
    """
    entry_type:              Optional[str]   = Field(None, description="'loan' or 'sale', or null if not detected.")
    amount:                  Optional[float] = Field(None, description="Total amount in PKR, or null.")
    crop_name:               Optional[str]   = Field(None, description="Detected crop name, or null.")
    unit:                    Optional[str]   = Field(None, description="Unit string (e.g. 'kg', 'maund'), or null.")
    reported_price_per_unit: Optional[float] = Field(None, description="Price per unit for sale entries, or null.")
    confidence_note:         str             = Field("", description="Human-readable explanation of what was detected.")


class VoiceEntryResponse(BaseModel):
    """
    Response returned by POST /api/ledger/voice-entry.
    Contains the raw transcript AND the parsed structured guess so the
    frontend can display both and let the farmer confirm before saving.
    """
    transcript:    str            = Field(..., description="Raw Whisper transcription.")
    language:      str            = Field(..., description="Language code used for transcription.")
    original_file: Optional[str] = Field(None, description="Original uploaded filename.")
    parsed:        VoiceParsedGuess = Field(..., description="Rule-based parse result (may have null fields).")
    note:          str            = Field(..., description="Instruction for the frontend.")


class VoiceEntryConfirm(BaseModel):
    """
    Payload for POST /api/ledger/voice-entry/confirm.
    The farmer (via the frontend) corrects/confirms the parsed fields,
    then submits this to actually save the ledger entry.
    This is just LedgerEntryCreate — typed separately for clarity.
    """
    farmer_id:               int            = Field(..., description="ID of the farmer.")
    entry_type:              str            = Field(..., description="'loan' or 'sale'.")
    amount:                  float          = Field(..., gt=0)
    unit:                    str            = Field(..., max_length=30)
    date:                    datetime       = Field(..., description="Date of the transaction (ISO-8601).")
    crop_name:               Optional[str]  = Field(None, max_length=80)
    reported_price_per_unit: Optional[float]= Field(None, gt=0)


# ===========================================================================
# Farmer summary schema  (debt-clarity feature)
# ===========================================================================

class FarmerSummary(BaseModel):
    """
    Aggregated financial summary for a single farmer.
    Returned by GET /api/ledger/{farmer_id}/summary.
    """

    farmer_id: int
    farmer_name: str
    total_loans: float = Field(
        ...,
        description="Sum of all 'loan' entry amounts in PKR.",
    )
    total_sales: float = Field(
        ...,
        description="Sum of all 'sale' entry amounts in PKR.",
    )
    net_balance: float = Field(
        ...,
        description=(
            "total_sales − total_loans. "
            "Positive means the farmer has received more from sales than borrowed. "
            "Negative means outstanding debt remains."
        ),
    )
    entry_count: int = Field(..., description="Total number of ledger entries recorded.")
    message: str = Field(
        ...,
        description="Plain-language summary suitable for display to the farmer.",
    )

    model_config = {"from_attributes": True}


# ===========================================================================
# Price-check response schema
# ===========================================================================

class PriceCheckResult(BaseModel):
    """
    Result of comparing the farmer's reported sale price against the
    mandi/FAOSTAT reference price.

    The `source` and `data_freshness` fields are included so the app is
    transparent about which dataset was used and how current it is.
    """

    ledger_entry_id: int = Field(..., description="The ledger entry being evaluated.")
    crop_name: str = Field(..., description="Crop that was sold.")

    reported_price: float = Field(..., description="Price the farmer was paid (PKR/40kg).")
    reference_price: Optional[float] = Field(
        None, description="Reference mandi/FAOSTAT price (PKR/40kg)."
    )
    difference_amount: Optional[float] = Field(
        None,
        description="reported_price − reference_price. Negative = underpaid.",
    )
    difference_percent: Optional[float] = Field(
        None, description="Percentage difference (reported vs reference)."
    )
    status: str = Field(
        ...,
        description="'fair' | 'underpaid' | 'overpaid' | 'no_data'",
    )
    source: str = Field(
        ...,
        description="Dataset used: 'kaggle', 'faostat', or 'none'.",
    )
    data_freshness: str = Field(
        ...,
        description="Most recent date or year available in the reference data.",
    )
    message: str = Field(..., description="Human-readable verdict for the farmer.")

    model_config = {"from_attributes": True}

