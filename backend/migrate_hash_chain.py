"""
KisaanKhata — one-time migration for tamper-evident hash chain.

The LedgerEntry model gained entry_hash / previous_hash columns after the
initial SQLite database was created. Running this script:

  1. Adds the two columns if they are missing.
  2. Recomputes and back-fills the per-farmer SHA-256 hash chain for every
     existing LedgerEntry so the integrity verification endpoint works.

Safe to run multiple times — it is idempotent.
"""

from collections import defaultdict

from database import engine, SessionLocal
from models import LedgerEntry
from services.integrity import GENESIS, compute_entry_hash


def _columns_exist():
    """Return True if both hash columns already exist in ledger_entries."""
    from sqlalchemy import inspect
    return (
        inspect(engine).has_table("ledger_entries")
        and "entry_hash" in inspect(engine).get_columns("ledger_entries")
        and "previous_hash" in inspect(engine).get_columns("ledger_entries")
    )


def _add_columns():
    """Use raw SQLite DDL to add the two nullable hash columns."""
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE ledger_entries ADD COLUMN entry_hash VARCHAR(64)"))
        conn.execute(text("ALTER TABLE ledger_entries ADD COLUMN previous_hash VARCHAR(64)"))
        conn.commit()


def main():
    if not _columns_exist():
        print("[migrate] Adding missing hash columns to ledger_entries...")
        _add_columns()
        print("[migrate] Columns added.")
    else:
        print("[migrate] Hash columns already present.")

    db = SessionLocal()
    try:
        entries = (
            db.query(LedgerEntry)
            .order_by(LedgerEntry.farmer_id.asc(),
                      LedgerEntry.created_at.asc(),
                      LedgerEntry.id.asc())
            .all()
        )

        if not entries:
            print("[migrate] No ledger entries to backfill.")
            return

        running_hash_by_farmer: dict[int, str] = defaultdict(lambda: GENESIS)
        updated = 0

        for entry in entries:
            prev_hash = running_hash_by_farmer[entry.farmer_id]
            entry.previous_hash = prev_hash
            entry.entry_hash = compute_entry_hash(entry, prev_hash)
            running_hash_by_farmer[entry.farmer_id] = entry.entry_hash
            updated += 1

        db.commit()
        print(f"[migrate] Backfilled hash chain for {updated} entries "
              f"across {len(running_hash_by_farmer)} farmer(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
