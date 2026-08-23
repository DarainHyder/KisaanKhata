"""
Smoke-test for SMS service — tests parser, reply builder, and dry-run send.
Run: python scripts/test_sms.py
"""
import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.path.insert(0, '.')

# Force dry-run so no Twilio API calls are made
os.environ['TWILIO_DRY_RUN'] = 'true'

from services.sms_service import parse_sms_command, build_price_reply, send_sms, HELP_TEXT

print('--- parse_sms_command tests ---')

# Valid SALE command
r = parse_sms_command('SALE gandum 2000 Multan')
assert r is not None, 'Should parse SALE gandum 2000 Multan'
assert r['cmd'] == 'sale'
assert r['crop'] == 'wheat'
assert r['price'] == 2000.0
assert r['city'] == 'Multan'
print('[PASS] SALE gandum 2000 Multan ->', r)

# Case insensitive
r2 = parse_sms_command('sale ALOO 800')
assert r2 is not None
assert r2['crop'] == 'potato'
assert r2['price'] == 800.0
assert r2['city'] is None
print('[PASS] sale ALOO 800 ->', r2)

# PRICE query
r3 = parse_sms_command('PRICE pyaz Lahore')
assert r3 is not None
assert r3['cmd'] == 'price'
assert r3['crop'] == 'onion'
assert r3['city'] == 'Lahore'
print('[PASS] PRICE pyaz Lahore ->', r3)

# Unknown crop returns None
r4 = parse_sms_command('SALE xyzplant 500')
assert r4 is None
print('[PASS] Unknown crop returns None')

# Completely wrong format returns None
r5 = parse_sms_command('hello how are you')
assert r5 is None
print('[PASS] Random text returns None')

# Comma in price
r6 = parse_sms_command('SALE gandum 2,000 Faisalabad')
assert r6 is not None and r6['price'] == 2000.0
print('[PASS] Comma in price handled:', r6['price'])

print('')
print('--- build_price_reply tests ---')

parsed_sale = {'cmd': 'sale', 'crop': 'wheat', 'crop_raw': 'gandum', 'price': 2000.0, 'city': 'Multan'}

# Underpaid scenario
compare_underpaid = {
    'status': 'underpaid',
    'reference_price': 2200.0,
    'source': 'amis_live',
    'data_freshness': '2026-08-23',
    'difference_amount': -200.0,
    'difference_percent': -9.09,
}
reply = build_price_reply(parsed_sale, compare_underpaid)
assert len(reply) <= 160, f'Reply too long: {len(reply)} chars'
assert 'gandum' in reply.lower() or 'wheat' in reply.lower()
assert '2,000' in reply or '2000' in reply
print('[PASS] Underpaid reply (' + str(len(reply)) + ' chars):')
print('  ' + reply)

# Fair scenario
compare_fair = {
    'status': 'fair',
    'reference_price': 2200.0,
    'source': 'kaggle_historical',
    'data_freshness': '2023-04-01',
    'difference_amount': 0,
    'difference_percent': 0,
}
reply2 = build_price_reply(parsed_sale, compare_fair)
assert len(reply2) <= 160
print('[PASS] Fair reply (' + str(len(reply2)) + ' chars):')
print('  ' + reply2)

# No data scenario
reply3 = build_price_reply(parsed_sale, None)
assert len(reply3) <= 160
print('[PASS] No-data reply (' + str(len(reply3)) + ' chars):')
print('  ' + reply3)

print('')
print('--- HELP_TEXT ---')
print('  ' + HELP_TEXT)
print('  Chars: ' + str(len(HELP_TEXT)))

print('')
print('--- send_sms dry-run test ---')
ok = send_sms('+923001234567', 'Test message')
assert ok is True
print('[PASS] Dry-run send returned True')

print('')
print('ALL SMS TESTS PASSED')
