"""
KisaanKhata — Ledger Integrity Service
========================================
Implements a lightweight tamper-evidence mechanism using per-farmer SHA-256
hash chaining. This is NOT a distributed blockchain — it is a single-database
integrity mechanism that provides:

  - Tamper evidence : any post-write alteration of a stored LedgerEntry
    (even via direct database access) changes that entry's hash and breaks
    the chain from that point forward.
  - Auditability    : the chain can be independently re-verified by any party
    given read access to the database rows.
  - Transparency    : the verify endpoint is publicly accessible so farmers,
    cooperatives, or institutional partners (banks, agriculture departments)
    can confirm no records have been changed since creation.

How the chain works
-------------------
Each LedgerEntry stores two hash fields:

  previous_hash : the entry_hash of the farmer's immediately preceding entry,
                  or the sentinel string "GENESIS" for the very first entry.

  entry_hash    : SHA-256 of a canonical string built from:
                    farmer_id | entry_type | amount | crop_name | unit |
                    date (ISO-8601) | reported_price_per_unit | created_at |
                    previous_hash

  Because entry_hash depends on previous_hash (which depends on all earlier
  entries), any change to a field in entry N changes entry_hash(N), which
  no longer matches previous_hash(N+1), which breaks entry_hash(N+1), etc.
  The break point is exactly detectable.

Limitations (honest engineering)
---------------------------------
  - An adversary with WRITE access to ALL rows can recompute the full chain
    after altering records. Mitigation: export chain checksums to an external
    immutable store (email, public ledger, farmer SMS) — outside scope for MVP.
  - Hash collisions are theoretically possible with SHA-256 but negligible
    for practical purposes.
  - The chain is per-farmer and ordered by (created_at, id) — inserting entries
    out of order is not supported; use created_at-ordered insertion.

Public API
----------
  compute_entry_hash(entry, previous_hash) -> str
  get_previous_hash(farmer_id, db)         -> str
  verify_farmer_chain(farmer_id, db)       -> dict
"""

from __future__ import annotations

import hashlib
import logging
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from models import LedgerEntry

logger = logging.getLogger(__name__)

# Sentinel value used as previous_hash for a farmer's very first entry.
GENESIS = "GENESIS"


# ---------------------------------------------------------------------------
# Hash computation
# ---------------------------------------------------------------------------

def _canonical_string(entry: "LedgerEntry", previous_hash: str) -> str:
    """
    Build a deterministic string representation of a LedgerEntry for hashing.

    Every field that makes a ledger entry meaningful is included. The format
    is pipe-separated to prevent field-boundary collisions (e.g. amount=10,
    crop=0  vs  amount=100, crop=<empty>). Date is serialised as ISO-8601 UTC
    to avoid timezone ambiguity.

    Args:
        entry         : The LedgerEntry ORM object (fields already set).
        previous_hash : Hash of the preceding entry, or "GENESIS".

    Returns:
        A deterministic UTF-8 string suitable for SHA-256 hashing.
    """
    # Normalise every field — None becomes the literal string "None" so that
    # a missing crop_name produces a different hash than crop_name="None".
    date_str = entry.date.isoformat() if entry.date else "None"
    created_str = entry.created_at.isoformat() if entry.created_at else "None"

    return "|".join([
        str(entry.farmer_id),
        str(entry.entry_type),
        str(entry.amount),
        str(entry.crop_name),
        str(entry.unit),
        date_str,
        str(entry.reported_price_per_unit),
        created_str,
        previous_hash,
    ])


def compute_entry_hash(entry: "LedgerEntry", previous_hash: str) -> str:
    """
    Compute the SHA-256 hash for a LedgerEntry given the previous chain hash.

    Args:
        entry         : LedgerEntry ORM object with all fields set.
        previous_hash : "GENESIS" for the first entry, or the entry_hash of
                        the immediately preceding entry for this farmer.

    Returns:
        64-character lowercase hex digest string.
    """
    canonical = _canonical_string(entry, previous_hash)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Chain helpers
# ---------------------------------------------------------------------------

def get_previous_hash(farmer_id: int, db: Session) -> str:
    """
    Return the entry_hash of the farmer's most recently created LedgerEntry,
    or GENESIS if they have no entries yet.

    Ordering is by (created_at ASC, id ASC) — same order used by
    verify_farmer_chain — so the "latest" entry is the chain tail.

    Args:
        farmer_id : Primary key of the farmer.
        db        : Active SQLAlchemy Session.

    Returns:
        64-char hex hash string, or "GENESIS".
    """
    from models import LedgerEntry

    last_entry = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.farmer_id == farmer_id)
        .order_by(LedgerEntry.created_at.desc(), LedgerEntry.id.desc())
        .first()
    )
    if last_entry is None or last_entry.entry_hash is None:
        return GENESIS
    return last_entry.entry_hash


# ---------------------------------------------------------------------------
# Chain verification
# ---------------------------------------------------------------------------

def verify_farmer_chain(farmer_id: int, db: Session) -> dict:
    """
    Re-compute the hash chain from scratch and compare against stored hashes.

    Algorithm
    ---------
    1. Load ALL entries for this farmer ordered by (created_at ASC, id ASC).
    2. Walk the chain from the first entry (previous_hash = GENESIS) forward.
    3. At each step, recompute the expected hash and compare with stored hash.
    4. If any mismatch is found, record the broken entry and stop.

    Args:
        farmer_id : Primary key of the farmer.
        db        : Active SQLAlchemy Session.

    Returns:
        dict with keys:
          verified        (bool)   — True if the full chain is intact.
          farmer_id       (int)
          total_entries   (int)    — How many entries were checked.
          broken_at_entry (int|None) — entry.id where the chain breaks, or None.
          broken_at_seq   (int|None) — 1-based sequence position, or None.
          detail          (str)    — Human-readable summary.
    """
    from models import LedgerEntry

    entries = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.farmer_id == farmer_id)
        .order_by(LedgerEntry.created_at.asc(), LedgerEntry.id.asc())
        .all()
    )

    if not entries:
        return {
            "verified":        True,
            "farmer_id":       farmer_id,
            "total_entries":   0,
            "broken_at_entry": None,
            "broken_at_seq":   None,
            "detail":          "No entries found for this farmer — chain is vacuously valid.",
        }

    running_hash = GENESIS

    for seq, entry in enumerate(entries, start=1):
        expected_hash = compute_entry_hash(entry, running_hash)

        # Check stored previous_hash matches what we're tracking
        if entry.previous_hash != running_hash:
            msg = (
                f"Chain broken at entry id={entry.id} (seq {seq}/{len(entries)}): "
                f"stored previous_hash={entry.previous_hash!r} "
                f"but expected={running_hash!r}. "
                f"This entry or a preceding entry has been tampered with."
            )
            logger.warning("[Integrity] farmer_id=%d — %s", farmer_id, msg)
            return {
                "verified":        False,
                "farmer_id":       farmer_id,
                "total_entries":   len(entries),
                "broken_at_entry": entry.id,
                "broken_at_seq":   seq,
                "detail":          msg,
            }

        # Check stored entry_hash matches recomputed value
        if entry.entry_hash != expected_hash:
            msg = (
                f"Chain broken at entry id={entry.id} (seq {seq}/{len(entries)}): "
                f"stored hash={entry.entry_hash!r} "
                f"but recomputed={expected_hash!r}. "
                f"The fields of this entry have been altered after creation."
            )
            logger.warning("[Integrity] farmer_id=%d — %s", farmer_id, msg)
            return {
                "verified":        False,
                "farmer_id":       farmer_id,
                "total_entries":   len(entries),
                "broken_at_entry": entry.id,
                "broken_at_seq":   seq,
                "detail":          msg,
            }

        # Advance the chain
        running_hash = entry.entry_hash

    logger.info(
        "[Integrity] farmer_id=%d chain VERIFIED — %d entries all intact.",
        farmer_id, len(entries)
    )
    return {
        "verified":        True,
        "farmer_id":       farmer_id,
        "total_entries":   len(entries),
        "broken_at_entry": None,
        "broken_at_seq":   None,
        "detail": (
            f"All {len(entries)} ledger entr{'y' if len(entries)==1 else 'ies'} "
            f"for farmer {farmer_id} are cryptographically intact. "
            f"Chain tail hash: {running_hash[:16]}…"
        ),
    }
