import sys; sys.path.insert(0,'.')
import main
from routers import prices
from services.price_matcher import (
    get_reference_price, compare_price,
    AMIS_LIVE_MAX_AGE_HOURS, _SOURCE_CONTEXT, _lookup_amis_live
)
print('All imports OK')
print(f'AMIS live max age: {AMIS_LIVE_MAX_AGE_HOURS}h')
print(f'Source labels: {list(_SOURCE_CONTEXT.keys())}')

# Test: no-db call falls through to kaggle/faostat (backward compat)
r = get_reference_price('wheat', db=None)
if r:
    src = r['source']
    tier = r.get('source_tier')
    price = r['price']
    print(f'Tier fallback (no db): source={src} tier={tier} price={price}')
else:
    print('No data (expected if no kaggle/faostat csv loaded)')

# Test compare_price no-db path
cr = compare_price(11000, 'wheat', db=None)
print(f'compare_price: status={cr["status"]} source={cr["source"]} tier={cr["source_tier"]}')
print('DONE')
