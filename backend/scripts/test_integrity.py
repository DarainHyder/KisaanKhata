"""
End-to-end test of the hash chain integrity system.
Tests: hash computation, chain building, verification (pass and fail cases).
Run: python scripts/test_integrity.py
"""
import sys
sys.path.insert(0, ".")

# ---- test imports ----
from services.integrity import (
    GENESIS, compute_entry_hash, verify_farmer_chain
)
print("Imports OK")

# ---- test hash computation is deterministic ----
from datetime import datetime
from models import LedgerEntry

def make_entry(**kwargs):
    e = LedgerEntry()
    e.farmer_id               = kwargs.get("farmer_id", 1)
    e.entry_type              = kwargs.get("entry_type", "loan")
    e.amount                  = kwargs.get("amount", 50000.0)
    e.crop_name               = kwargs.get("crop_name", None)
    e.unit                    = kwargs.get("unit", "40kg")
    e.reported_price_per_unit = kwargs.get("rpu", None)
    e.date                    = kwargs.get("date", datetime(2026, 8, 20))
    e.created_at              = kwargs.get("created_at", datetime(2026, 8, 20, 10, 0, 0))
    return e

e1 = make_entry()
h1a = compute_entry_hash(e1, GENESIS)
h1b = compute_entry_hash(e1, GENESIS)
assert h1a == h1b, "Hash should be deterministic"
assert len(h1a) == 64, "SHA-256 hex should be 64 chars"
print(f"✓ Hash is deterministic and 64 chars: {h1a[:16]}…")

# ---- changing a field changes the hash ----
e1_tampered = make_entry(amount=99999.0)
h_tampered = compute_entry_hash(e1_tampered, GENESIS)
assert h1a != h_tampered, "Altered amount should produce different hash"
print(f"✓ Tampered amount produces different hash: {h_tampered[:16]}…")

# ---- chain linkage ----
e2 = make_entry(entry_type="sale", crop_name="wheat", amount=120000.0,
                created_at=datetime(2026, 8, 21, 10, 0, 0))
h2 = compute_entry_hash(e2, h1a)  # depends on e1's hash
assert h2 != h1a, "Entry 2 hash should differ from entry 1"
print(f"✓ Chain linkage works: h2={h2[:16]}…")

# ---- test verify_farmer_chain with an in-memory DB ----
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
Base.metadata.create_all(bind=engine)
Session = sessionmaker(bind=engine)
db = Session()

# Create a farmer
from models import Farmer
farmer = Farmer(name="Test Farmer", phone_number="03001111111", location="Multan")
db.add(farmer)
db.commit()
db.refresh(farmer)

# Import helpers
from services.integrity import get_previous_hash

# Entry 1 — GENESIS
prev = get_previous_hash(farmer.id, db)
assert prev == GENESIS, f"Expected GENESIS, got {prev!r}"
entry1 = make_entry(farmer_id=farmer.id)
entry1.previous_hash = prev
entry1.entry_hash    = compute_entry_hash(entry1, prev)
db.add(entry1)
db.commit()
db.refresh(entry1)
print(f"✓ Entry 1 inserted: hash={entry1.entry_hash[:16]}…")

# Entry 2 — chains off entry 1
prev2 = get_previous_hash(farmer.id, db)
assert prev2 == entry1.entry_hash, "get_previous_hash should return entry1's hash"
entry2 = make_entry(farmer_id=farmer.id, entry_type="sale", crop_name="wheat",
                    amount=150000.0, created_at=datetime(2026, 8, 22, 10, 0, 0))
entry2.previous_hash = prev2
entry2.entry_hash    = compute_entry_hash(entry2, prev2)
db.add(entry2)
db.commit()
db.refresh(entry2)
print(f"✓ Entry 2 inserted: hash={entry2.entry_hash[:16]}…")

# ---- verify intact chain ----
result = verify_farmer_chain(farmer.id, db)
assert result["verified"] is True, f"Chain should verify: {result}"
assert result["total_entries"] == 2
print(f"✓ Chain verified intact: {result['detail']}")

# ---- simulate tampering: change entry1's amount directly ----
db.execute(
    __import__("sqlalchemy").text("UPDATE ledger_entries SET amount=1.0 WHERE id=:id"),
    {"id": entry1.id}
)
db.commit()
db.expire_all()  # force re-read from DB

result_bad = verify_farmer_chain(farmer.id, db)
assert result_bad["verified"] is False, "Tampered chain should fail verification"
assert result_bad["broken_at_entry"] == entry1.id, "Break should be at entry 1"
print(f"✓ Tamper detected correctly: {result_bad['detail']}")

db.close()
print("\n✅ ALL INTEGRITY TESTS PASSED")
