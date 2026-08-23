"""
KisaanKhata — SQLAlchemy ORM Models
=====================================
Defines four database tables:

  1. Farmer          — registered smallholder farmer.
  2. LedgerEntry     — loan received or harvest sale, with optional per-unit
                       price for mandi cross-checking. Tamper-evident via
                       SHA-256 hash chain (entry_hash / previous_hash).
  3. LivePriceEntry  — live price rows scraped from AMIS Punjab (amis.pk),
                       refreshed every 6 hours by the background scheduler.
  4. SmsLog          — record of every inbound SMS/WhatsApp price-check query
                       and the reply sent, for usage metrics and audit.
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    Enum as SAEnum,
)
from sqlalchemy.orm import relationship

from database import Base


# ---------------------------------------------------------------------------
# Farmer
# ---------------------------------------------------------------------------

class Farmer(Base):
    """
    Represents a registered smallholder farmer.

    Columns
    -------
    id           : Auto-incrementing primary key.
    name         : Full name of the farmer (e.g. "Muhammad Aslam").
    phone_number : Unique mobile number — used as a login/lookup identifier.
    location     : District or city string (e.g. "Multan", "Rahim Yar Khan").
    created_at   : UTC timestamp when the record was inserted.
    """

    __tablename__ = "farmers"

    id: int = Column(Integer, primary_key=True, index=True)
    name: str = Column(String(120), nullable=False)
    phone_number: str = Column(String(20), unique=True, index=True, nullable=False)
    location: str = Column(String(100), nullable=False)
    created_at: datetime = Column(DateTime, default=datetime.utcnow, nullable=False)

    # One-to-many: a farmer can have many ledger entries
    ledger_entries = relationship("LedgerEntry", back_populates="farmer")

    def __repr__(self) -> str:
        return f"<Farmer id={self.id} name={self.name!r} location={self.location!r}>"


# ---------------------------------------------------------------------------
# LedgerEntry
# ---------------------------------------------------------------------------

class LedgerEntry(Base):
    """
    Represents a single financial event for a farmer — either a loan
    received from a middleman/arhtiya, or a completed harvest sale.

    Columns
    -------
    id                     : Auto-incrementing primary key.
    farmer_id              : FK → farmers.id.
    entry_type             : "loan" or "sale".
    crop_name              : Name of the crop (e.g. "wheat", "cotton").
                             Nullable — only relevant for sale entries.
    amount                 : Total monetary value of the transaction (PKR).
    reported_price_per_unit: Price per unit the farmer was told they received.
                             Nullable — only relevant for sale entries.
                             Used in mandi price comparison logic.
    unit                   : Weight/volume unit used (e.g. "40kg", "maund").
    date                   : The actual date of the loan / sale event.
    created_at             : UTC timestamp when this record was inserted.
    """

    __tablename__ = "ledger_entries"

    id: int = Column(Integer, primary_key=True, index=True)
    farmer_id: int = Column(Integer, ForeignKey("farmers.id"), nullable=False, index=True)
    entry_type: str = Column(SAEnum("loan", "sale", name="entry_type_enum"), nullable=False)
    crop_name: str | None = Column(String(80), nullable=True)
    amount: float = Column(Float, nullable=False)
    reported_price_per_unit: float | None = Column(Float, nullable=True)
    unit: str = Column(String(30), nullable=False)
    date: datetime = Column(DateTime, nullable=False)
    created_at: datetime = Column(DateTime, default=datetime.utcnow, nullable=False)

    # -----------------------------------------------------------------------
    # Tamper-evidence: hash chain
    # -----------------------------------------------------------------------
    # entry_hash    : SHA-256 of this entry's own fields + previous_hash.
    #                 Changing any field changes this hash.
    # previous_hash : entry_hash of the immediately preceding entry for this
    #                 farmer, or "GENESIS" for the very first entry.
    #
    # Together these form a per-farmer hash chain: every entry cryptographically
    # commits to all entries before it, so silently altering any past record
    # breaks the chain from that point forward — detectable by verify_farmer_chain().
    #
    # NOTE: This is a lightweight integrity mechanism, NOT a distributed blockchain.
    # It runs entirely within a single SQLite database and does not provide
    # Byzantine fault tolerance or decentralised consensus. What it DOES provide:
    #   - Tamper evidence: any post-write alteration (even by a DBA with direct
    #     DB access) leaves a detectable signature mismatch.
    #   - Audit trail: the chain can be re-verified at any time by any party
    #     given read access to the database.
    #   - Demo-grade trustworthiness: sufficient to show institutional partners
    #     (banks, agriculture depts) that records are integrity-protected and
    #     this principle could scale to a distributed ledger if needed.
    # -----------------------------------------------------------------------
    entry_hash:    str | None = Column(String(64), nullable=True, index=True)
    previous_hash: str | None = Column(String(64), nullable=True)


    # Many-to-one: back reference to the owning farmer
    farmer = relationship("Farmer", back_populates="ledger_entries")

    def __repr__(self) -> str:
        return (
            f"<LedgerEntry id={self.id} farmer_id={self.farmer_id} "
            f"type={self.entry_type!r} crop={self.crop_name!r} amount={self.amount}>"
        )


# ---------------------------------------------------------------------------
# LivePriceEntry  — AMIS Punjab live scrape
# ---------------------------------------------------------------------------

class LivePriceEntry(Base):
    """
    A single city-level price row scraped from amis.pk.

    AMIS publishes daily wholesale prices (Min / Max / FQP) per city
    for 136 agricultural commodities across Punjab.

    Columns
    -------
    id          : Auto-incrementing primary key.
    crop_name   : Canonical English crop name (e.g. "wheat", "potato").
    city        : City / market name from AMIS (e.g. "Faisalabad", "Lahore").
    min_price   : Minimum wholesale price (PKR) — nullable if AMIS has no data.
    max_price   : Maximum wholesale price (PKR) — nullable.
    fqp         : Fair Quoted Price — the midpoint/official reference (PKR) — nullable.
    unit        : Unit string from AMIS (e.g. "40 Kg", "Mound"). Default "40 Kg".
    scraped_at  : UTC timestamp when this row was fetched.
    source      : Always "amis" — identifies which scraper produced this row.
    """

    __tablename__ = "live_price_entries"

    id:         int      = Column(Integer, primary_key=True, index=True)
    crop_name:  str      = Column(String(120), nullable=False, index=True)
    city:       str      = Column(String(100), nullable=False, index=True)
    min_price:  float | None = Column(Float, nullable=True)
    max_price:  float | None = Column(Float, nullable=True)
    fqp:        float | None = Column(Float, nullable=True)
    unit:       str      = Column(String(40), nullable=False, default="40 Kg")
    scraped_at: datetime = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    source:     str      = Column(String(20), nullable=False, default="amis")

    def __repr__(self) -> str:
        return (
            f"<LivePriceEntry crop={self.crop_name!r} city={self.city!r} "
            f"fqp={self.fqp} scraped_at={self.scraped_at}>"
        )


# ---------------------------------------------------------------------------
# SmsLog  — SMS / WhatsApp interaction audit trail
# ---------------------------------------------------------------------------

class SmsLog(Base):
    """
    Records every inbound farmer SMS/WhatsApp message and the reply sent.

    Purpose
    -------
    1. Impact metrics : count unique phone numbers and queries for the pitch deck
       ("X farmers used the price-check SMS in the past week").
    2. Audit trail   : paired message_in / message_out shows exactly what
       information was given to which farmer, when.
    3. Debugging     : identify common parsing failures (message_out contains
       the help text) to improve the command parser.

    Columns
    -------
    id            : Auto-incrementing primary key.
    phone_number  : Sender's number in E.164 format (+923001234567).
                    NOT linked to the Farmer table — SMS users may not be
                    registered farmers; the SMS channel is intentionally open.
    channel       : "sms" or "whatsapp" — distinguishes Twilio channels.
    message_in    : Raw text the farmer sent.
    message_out   : The reply message that was sent back.
    parsed_crop   : Crop name extracted from the command, if any.
    parsed_price  : Reported price extracted from the command, if any.
    parsed_city   : City extracted from the command, if any.
    status        : "ok" | "parse_error" | "no_data" | "send_error"
    timestamp     : UTC time the webhook was received.
    """

    __tablename__ = "sms_logs"

    id:           int            = Column(Integer, primary_key=True, index=True)
    phone_number: str            = Column(String(20),  nullable=False, index=True)
    channel:      str            = Column(String(12),  nullable=False, default="sms")
    message_in:   str            = Column(String(1600), nullable=False)
    message_out:  str            = Column(String(1600), nullable=False)
    parsed_crop:  str | None     = Column(String(80),  nullable=True)
    parsed_price: float | None   = Column(Float,        nullable=True)
    parsed_city:  str | None     = Column(String(100), nullable=True)
    status:       str            = Column(String(20),  nullable=False, default="ok")
    timestamp:    datetime       = Column(DateTime, default=datetime.utcnow,
                                          nullable=False, index=True)

    def __repr__(self) -> str:
        return (
            f"<SmsLog id={self.id} from={self.phone_number!r} "
            f"status={self.status!r} crop={self.parsed_crop!r}>"
        )
