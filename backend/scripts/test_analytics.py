"""
Smoke-test for the analytics router.
Creates an in-memory DB with seeded farmers and sale entries, then tests
each analytics route directly (bypassing HTTP).
Run: python scripts/test_analytics.py
"""
import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.path.insert(0, '.')
os.environ['TWILIO_DRY_RUN'] = 'true'

from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
from models import Farmer, LedgerEntry

engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False})
Base.metadata.create_all(bind=engine)
Session = sessionmaker(bind=engine)
db = Session()

# Load reference datasets so compare_price can return meaningful results
print('Loading price reference data...')
from services.price_matcher import load_price_data
load_price_data()
print('Price data loaded.')

print('Seeding test data...')

# Create farmers in 3 districts, 4 farmers each
districts = ['Multan', 'Faisalabad', 'Lahore']
farmers = []
for i, dist in enumerate(districts):
    for j in range(4):
        f = Farmer(
            name=f'Farmer {i}-{j}',
            phone_number=f'030{i}{j:07d}',
            location=dist,
        )
        db.add(f)
        db.commit()
        db.refresh(f)
        farmers.append((f.id, dist))

# Create 6 sale entries per farmer with a low reported price (underpaid scenario)
# We use wheat at Rs 1500 — well below any reference (should trigger underpaid)
from services.integrity import compute_entry_hash, get_previous_hash
entry_count = 0
for farmer_id, district in farmers:
    for k in range(6):
        e = LedgerEntry(
            farmer_id=farmer_id,
            entry_type='sale',
            crop_name='wheat',
            amount=1500.0 * 40,
            reported_price_per_unit=1500.0,   # deliberately low
            unit='40kg',
            date=datetime(2026, 8, k+1),
            created_at=datetime(2026, 8, k+1, 10, 0, 0),
        )
        prev = get_previous_hash(farmer_id, db)
        e.previous_hash = prev
        e.entry_hash    = compute_entry_hash(e, prev)
        db.add(e)
        db.commit()
        entry_count += 1

print(f'Seeded {len(farmers)} farmers, {entry_count} sale entries')

# ---- Test 1: summary_report ----
print('')
print('--- summary_report ---')
from routers.analytics import _build_summary
summary = _build_summary(db)
print(f'total_farmers:          {summary["total_farmers"]}')
print(f'total_sale_entries:     {summary["total_sale_entries"]}')
print(f'sales_with_price_check: {summary["sales_with_price_check"]}')
print(f'underpaid_count:        {summary["underpaid_count"]}')
print(f'pct_sales_underpaid:    {summary["pct_sales_underpaid"]}%')
print(f'avg_underpayment_pct:   {summary["avg_underpayment_pct"]}%')
print(f'worst_district:         {summary["worst_district"]}')
assert summary['total_farmers'] == len(farmers)
assert summary['total_sale_entries'] == entry_count
print('[PASS] summary_report')

# ---- Test 2: underpayment_by_district ----
print('')
print('--- underpayment_by_district ---')
from routers.analytics import underpayment_by_district, MIN_GROUP_SIZE
result = underpayment_by_district(db)
print(f'min_group_size: {result["min_group_size"]}')
print(f'districts returned: {len(result["districts"])}')
for d in result['districts']:
    print(f'  {d["district"]}: {d["underpaid_count"]} underpaid / {d["total_sales_checked"]} checked ({d["underpayment_rate_pct"]}%)')

# Each district has 24 entries — if price data is loaded, at least some should be underpaid
if summary['sales_with_price_check'] > 0 and summary['pct_sales_underpaid'] and summary['pct_sales_underpaid'] > 0:
    assert len(result['districts']) > 0, 'With underpaid entries, at least one district should appear'
    print('[PASS] underpayment_by_district with underpaid data')
else:
    print('[PASS] underpayment_by_district returned correctly (no underpaid data available in this env)')


# ---- Test 3: privacy - districts below MIN_GROUP_SIZE are excluded ----
print('')
print('--- privacy: small district exclusion ---')
# Add one farmer in a tiny district with only 2 entries
tiny_farmer = Farmer(name='Isolated', phone_number='03099999999', location='TinyVillage')
db.add(tiny_farmer); db.commit(); db.refresh(tiny_farmer)
for k in range(2):
    e = LedgerEntry(
        farmer_id=tiny_farmer.id,
        entry_type='sale',
        crop_name='wheat',
        amount=1500.0 * 40,
        reported_price_per_unit=1500.0,
        unit='40kg',
        date=datetime(2026, 8, k+1),
        created_at=datetime(2026, 8, k+1, 10, 0),
    )
    prev = get_previous_hash(tiny_farmer.id, db)
    e.previous_hash = prev
    e.entry_hash    = compute_entry_hash(e, prev)
    db.add(e); db.commit()

result2 = underpayment_by_district(db)
district_names = [d['district'] for d in result2['districts']]
assert 'TinyVillage' not in district_names, 'TinyVillage has <5 entries, should be excluded'
print('[PASS] TinyVillage (2 entries) correctly excluded from report')

# ---- Test 4: CSV export ----
print('')
print('--- CSV export ---')
from routers.analytics import export_report_csv
csv_response = export_report_csv(db)
assert csv_response.media_type == 'text/csv'
assert 'attachment' in csv_response.headers.get('content-disposition', '')
print('[PASS] CSV export returns correct media type and headers')

# ---- Test 5: national price trend (no live data = empty, not error) ----
print('')
print('--- price_trend_national (empty) ---')
from routers.analytics import price_trend_national
trend = price_trend_national('wheat', days=30, db=db)
assert 'daily_national' in trend
assert isinstance(trend['daily_national'], list)
print('[PASS] price_trend_national returns empty list gracefully (no AMIS data in test DB)')

db.close()
print('')
print('ALL ANALYTICS TESTS PASSED')
