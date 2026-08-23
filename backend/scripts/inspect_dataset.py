"""
KisaanKhata — Dataset Inspector
=================================
Run this script BEFORE writing any parsing logic to confirm the actual
column names, dtypes, and sample data in both dataset sources.

Usage (from kisaankhata/backend/):
    python scripts/inspect_dataset.py
"""

import os
import sys
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Paths (relative to kisaankhata/backend/)
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent  # kisaankhata/backend/
FAOSTAT_CSV = BASE_DIR / "data" / "producer_prices_pak.csv"
KAGGLE_DIR  = BASE_DIR / "data" / "kaggle_crop_prices"

SEP = "=" * 70


# ===========================================================================
# 1. FAOSTAT — producer_prices_pak.csv
# ===========================================================================
print(f"\n{SEP}")
print("FAOSTAT: producer_prices_pak.csv")
print(SEP)

if not FAOSTAT_CSV.exists():
    print(f"  [ERROR] File not found: {FAOSTAT_CSV}")
else:
    fao = pd.read_csv(FAOSTAT_CSV)
    print(f"\nShape: {fao.shape[0]:,} rows × {fao.shape[1]} columns")
    print(f"\nColumn names:\n  {list(fao.columns)}")
    print(f"\nDtypes:\n{fao.dtypes.to_string()}")
    print(f"\nFirst 5 rows:")
    pd.set_option("display.max_columns", None)
    pd.set_option("display.width", 200)
    print(fao.head(5).to_string(index=False))
    # Unique values in key candidate columns
    for col in fao.columns:
        n_unique = fao[col].nunique()
        if n_unique < 30:
            print(f"\n  Unique values in '{col}' ({n_unique}): {sorted(fao[col].dropna().unique().tolist())}")


# ===========================================================================
# 2. Kaggle crop prices — per-crop CSV files
# ===========================================================================
print(f"\n{SEP}")
print(f"KAGGLE: {KAGGLE_DIR}")
print(SEP)

if not KAGGLE_DIR.exists():
    print(f"  [ERROR] Directory not found: {KAGGLE_DIR}")
    sys.exit(1)

all_files = sorted(KAGGLE_DIR.glob("*.csv"))
print(f"\nTotal CSV files found: {len(all_files)}")
print("\nAll filenames:")
for f in all_files:
    print(f"  {f.name}  ({f.stat().st_size / 1024:.1f} KB)")

# Sample 5 spread across the list (first, ~25%, ~50%, ~75%, last)
indices  = [0, len(all_files)//4, len(all_files)//2, 3*len(all_files)//4, -1]
samples  = [all_files[i] for i in indices]
# Deduplicate while preserving order
deduped = []
seen_paths = set()
for x in samples:
    if x not in seen_paths:
        deduped.append(x)
        seen_paths.add(x)
samples = deduped

print(f"\n{'-'*70}")
print("Inspecting sample files:")
print(f"{'-'*70}")

for csv_path in samples:
    print(f"\n>>> {csv_path.name}")
    try:
        df = pd.read_csv(csv_path, nrows=200)   # only read first 200 rows for speed
        print(f"  Shape (sample): {df.shape[0]} rows × {df.shape[1]} cols")
        print(f"  Columns: {list(df.columns)}")
        print(f"  Dtypes:\n{df.dtypes.to_string()}")
        print(f"  First 5 rows:")
        print(df.head(5).to_string(index=False))
    except Exception as e:
        print(f"  [ERROR] Could not load: {e}")
