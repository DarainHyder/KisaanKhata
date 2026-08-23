"""Integrity system test — run: python scripts/test_integrity2.py"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.path.insert(0,'.')

from datetime import datetime
from services.integrity import GENESIS, compute_entry_hash, get_previous_hash, verify_farmer_chain
from models import LedgerEntry, Farmer
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from database import Base

print('Imports OK')

def make_entry(**kw):
    e = LedgerEntry()
    e.farmer_id               = kw.get('farmer_id', 1)
    e.entry_type              = kw.get('entry_type', 'loan')
    e.amount                  = kw.get('amount', 50000.0)
    e.crop_name               = kw.get('crop_name', None)
    e.unit                    = kw.get('unit', '40kg')
    e.reported_price_per_unit = kw.get('rpu', None)
    e.date                    = kw.get('date', datetime(2026, 8, 20))
    e.created_at              = kw.get('created_at', datetime(2026, 8, 20, 10, 0, 0))
    return e

e1 = make_entry()
h1a = compute_entry_hash(e1, GENESIS)
h1b = compute_entry_hash(e1, GENESIS)
assert h1a == h1b and len(h1a) == 64
print('[PASS] Hash deterministic, 64 chars:', h1a[:16] + '...')

e1t = make_entry(amount=99999.0)
ht = compute_entry_hash(e1t, GENESIS)
assert h1a != ht
print('[PASS] Tampered amount changes hash')

# in-memory DB test
engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False})
Base.metadata.create_all(bind=engine)
Session = sessionmaker(bind=engine)
db = Session()

farmer = Farmer(name='Test', phone_number='03001234567', location='Multan')
db.add(farmer); db.commit(); db.refresh(farmer)

prev = get_previous_hash(farmer.id, db)
assert prev == GENESIS
entry1 = make_entry(farmer_id=farmer.id)
entry1.previous_hash = prev
entry1.entry_hash    = compute_entry_hash(entry1, prev)
db.add(entry1); db.commit(); db.refresh(entry1)
print('[PASS] Entry 1 hash:', entry1.entry_hash[:16] + '...')

prev2 = get_previous_hash(farmer.id, db)
assert prev2 == entry1.entry_hash
entry2 = make_entry(farmer_id=farmer.id, entry_type='sale', crop_name='wheat',
                    amount=150000.0, created_at=datetime(2026, 8, 22, 10, 0, 0))
entry2.previous_hash = prev2
entry2.entry_hash    = compute_entry_hash(entry2, prev2)
db.add(entry2); db.commit(); db.refresh(entry2)

r = verify_farmer_chain(farmer.id, db)
assert r['verified'] is True and r['total_entries'] == 2
print('[PASS] Chain verified intact, 2 entries')

# tamper test
db.execute(text('UPDATE ledger_entries SET amount=1.0 WHERE id=:id'), {'id': entry1.id})
db.commit(); db.expire_all()
rb = verify_farmer_chain(farmer.id, db)
assert rb['verified'] is False
broken = rb['broken_at_entry']
assert broken == entry1.id
print('[PASS] Tamper detected at entry id=' + str(broken))
print('[PASS] Detail:', rb['detail'])

db.close()
print('')
print('ALL INTEGRITY TESTS PASSED')
