"""Save all AMIS commodity IDs to a text file."""
import re
import sys
import requests
from bs4 import BeautifulSoup

r = requests.get(
    'http://www.amis.pk/BrowsePrices.aspx?searchType=0',
    headers={'User-Agent': 'KisaanKhata/1.0 educational-access'},
    timeout=20
)
soup = BeautifulSoup(r.text, 'lxml')
links = [a for a in soup.find_all('a', href=True) if 'commodityId' in a['href']]

with open('scripts/amis_commodities.txt', 'w', encoding='utf-8') as f:
    for a in links:
        cid = re.search(r'commodityId=(\d+)', a['href'])
        if cid:
            line = f"{cid.group(1):>4}  {a.get_text(strip=True)}\n"
            f.write(line)
            sys.stdout.buffer.write(line.encode('utf-8', errors='replace'))

print(f"\nTotal: {len(links)} commodities")
