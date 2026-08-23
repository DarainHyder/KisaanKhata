"""
Inspect the AMIS Punjab price page HTML structure.
Run: python scripts/inspect_amis_page.py

This prints table tags, classes, ids found on both:
  - BrowsePrices page (to find commodity IDs from links)
  - ViewPrices page for Wheat (commodity_id=1) to confirm table structure
"""

import sys
import time
import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (KisaanKhata Hackathon Project; educational/public-data access) "
        "Python-requests/2.31"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}
BASE = "http://www.amis.pk"

# -----------------------------------------------------------------------
# 1. BrowsePrices — extract commodity links and IDs
# -----------------------------------------------------------------------
print("=" * 60)
print("STEP 1: BrowsePrices page — commodity links")
print("=" * 60)

try:
    r = requests.get(
        f"{BASE}/BrowsePrices.aspx?searchType=0",
        headers=HEADERS, timeout=20
    )
    print(f"Status: {r.status_code}  |  Content-Type: {r.headers.get('content-type','?')}")
    soup = BeautifulSoup(r.text, "html.parser")

    # Find all links that look like commodity links
    links = soup.find_all("a", href=True)
    commodity_links = [
        a for a in links
        if "commodityId" in a.get("href", "")
    ]
    print(f"\nFound {len(commodity_links)} commodity links:\n")
    for a in commodity_links:
        href = a["href"]
        text = a.get_text(strip=True)
        print(f"  {text!r:40s}  ->  {href}")

    print("\n--- All tables on BrowsePrices ---")
    for tbl in soup.find_all("table"):
        print(f"  <table id={tbl.get('id','')!r} class={tbl.get('class','')!r}>")

except Exception as e:
    print(f"[ERROR fetching BrowsePrices] {e}")

time.sleep(3)   # polite delay

# -----------------------------------------------------------------------
# 2. ViewPrices for Wheat (commodityId=1) — inspect table structure
# -----------------------------------------------------------------------
print("\n" + "=" * 60)
print("STEP 2: ViewPrices?searchType=0&commodityId=1 (Wheat)")
print("=" * 60)

try:
    r = requests.get(
        f"{BASE}/ViewPrices.aspx?searchType=0&commodityId=1",
        headers=HEADERS, timeout=20
    )
    print(f"Status: {r.status_code}  |  Length: {len(r.text)} chars")
    soup = BeautifulSoup(r.text, "html.parser")

    # All tables
    print("\n--- Tables found ---")
    tables = soup.find_all("table")
    print(f"Total tables: {len(tables)}")
    for i, tbl in enumerate(tables):
        print(f"\n  Table #{i}: id={tbl.get('id','')!r}  class={tbl.get('class','')!r}")
        rows = tbl.find_all("tr")
        print(f"    Rows: {len(rows)}")
        for j, row in enumerate(rows[:4]):   # first 4 rows
            cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
            print(f"    row[{j}]: {cells}")

    # GridView specifically
    print("\n--- Looking for GridView / DataGrid ---")
    for tag in soup.find_all(id=lambda x: x and ("grid" in x.lower() or "Grid" in x)):
        print(f"  Found: id={tag.get('id')!r}  tag={tag.name}")

    # Any element with 'price' in class or id
    print("\n--- Elements with 'price' in id/class ---")
    for tag in soup.find_all(True):
        id_ = tag.get("id", "")
        cls = " ".join(tag.get("class", []))
        if "price" in id_.lower() or "price" in cls.lower():
            print(f"  <{tag.name} id={id_!r} class={cls!r}>")

    # Print first 3000 chars of raw HTML for manual inspection
    print("\n--- First 3000 chars of page HTML ---")
    print(r.text[:3000])

except Exception as e:
    print(f"[ERROR fetching ViewPrices] {e}")
