"""
KisaanKhata — SMS / WhatsApp Service
=======================================
Handles all SMS-layer logic:

  send_sms(to, message)          — Send a message via Twilio (or dry-run log)
  parse_sms_command(body)        — Parse "SALE WHEAT 2000 MULTAN" → structured dict
  build_price_reply(...)         — Format the comparison result into a short reply
  HELP_TEXT                      — Standard help message (< 160 chars)

Design philosophy
-----------------
Target audience: rural Pakistani farmers with basic phones (not smartphones),
low literacy, and limited data access. Reply messages must be:

  1. SHORT     — under 160 characters for a single SMS segment
  2. PLAIN     — Roman Urdu, no technical terms, no jargon
  3. ACTIONABLE — tell the farmer specifically what they got vs. what they
                  should have, in simple PKR numbers
  4. HONEST    — include data source so the farmer knows if it's today's live
                 price or a historical reference

Roman Urdu is deliberately used (not Urdu script) because:
  - Basic GSM phones often can't render Urdu script in SMS
  - Roman Urdu is widely readable by literate rural Pakistanis
  - WhatsApp renders Urdu script correctly, but Roman Urdu works everywhere

Dry-run mode (TWILIO_DRY_RUN=true):
  SMS send is skipped; the message is printed to logs instead.
  Useful for local development without Twilio credentials.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Twilio credentials — read from environment, never hardcoded
# ---------------------------------------------------------------------------
_ACCOUNT_SID   = os.getenv("TWILIO_ACCOUNT_SID", "")
_AUTH_TOKEN    = os.getenv("TWILIO_AUTH_TOKEN", "")
_FROM_NUMBER   = os.getenv("TWILIO_PHONE_NUMBER", "")
_DRY_RUN       = os.getenv("TWILIO_DRY_RUN", "false").lower() == "true"

# ---------------------------------------------------------------------------
# Help message (< 160 chars)
# Command format: SALE <crop> <price> <city>
# ---------------------------------------------------------------------------
HELP_TEXT = (
    "Format: SALE gandum 2000 Multan\n"
    "Yani: SALE [fasl] [price Rs] [shahar]\n"
    "Misal: SALE chawal 4500 Lahore\n"
    "KisaanKhata helpline: kisaankhata.pk"
)

# ---------------------------------------------------------------------------
# Crop name normalisation
# Maps common Roman Urdu / English spellings → canonical crop keys
# used in LivePriceEntry and price_matcher datasets
# ---------------------------------------------------------------------------
CROP_ALIASES: dict[str, str] = {
    # Wheat
    "gandum": "wheat", "wheat": "wheat", "gendum": "wheat", "gandaum": "wheat",
    # Rice
    "chawal": "rice_basmati", "rice": "rice_basmati", "basmati": "rice_basmati",
    "irri": "rice_irri", "chaawal": "rice_basmati",
    # Maize / Corn
    "makka": "maize", "makkai": "maize", "maize": "maize", "corn": "maize",
    # Potato
    "aloo": "potato", "potato": "potato", "alu": "potato",
    # Onion
    "pyaz": "onion", "onion": "onion", "piaz": "onion",
    # Tomato
    "tamatar": "tomato", "tomato": "tomato",
    # Cotton
    "kapas": "cotton", "cotton": "cotton", "phutti": "cotton",
    # Sugarcane
    "ganna": "sugarcane", "sugarcane": "sugarcane", "cane": "sugarcane",
    # Sugar
    "cheeni": "sugar", "sugar": "sugar", "chini": "sugar",
    # Garlic
    "lehsan": "garlic", "garlic": "garlic",
    # Canola
    "sarson": "canola", "canola": "canola", "rapeseed": "canola",
    # Chickpea
    "chana": "chickpea_white", "gram": "chickpea_white", "chola": "chickpea_white",
    # Mango
    "aam": "mango", "mango": "mango",
    # Guava
    "amrood": "guava", "guava": "guava",
    # Carrot
    "gajar": "carrot", "carrot": "carrot",
    # Groundnut
    "moongphali": "groundnut", "groundnut": "groundnut", "peanut": "groundnut",
}

# Display name for each canonical crop (Roman Urdu + English)
CROP_DISPLAY: dict[str, str] = {
    "wheat":         "gandum (wheat)",
    "rice_basmati":  "basmati chawal",
    "rice_irri":     "IRRI chawal",
    "maize":         "makka",
    "potato":        "aloo (potato)",
    "onion":         "pyaz (onion)",
    "tomato":        "tamatar (tomato)",
    "cotton":        "kapas (cotton)",
    "sugarcane":     "ganna (sugarcane)",
    "sugar":         "cheeni (sugar)",
    "garlic":        "lehsan (garlic)",
    "canola":        "sarson (canola)",
    "chickpea_white":"chana",
    "mango":         "aam (mango)",
    "guava":         "amrood (guava)",
    "carrot":        "gajar (carrot)",
    "groundnut":     "moongphali",
}


# ---------------------------------------------------------------------------
# 1. SMS sending
# ---------------------------------------------------------------------------

def send_sms(to_number: str, message: str) -> bool:
    """
    Send a plain SMS via Twilio.

    Args:
        to_number : Recipient number in E.164 format (+923001234567).
        message   : Text to send (keep under 160 chars for single SMS segment).

    Returns:
        True if sent (or dry-run), False on error.

    Environment:
        TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER must be set.
        Set TWILIO_DRY_RUN=true to skip actual sending (logs the message instead).
    """
    if _DRY_RUN:
        logger.info("[SMS DRY-RUN] To=%s | %s", to_number, message)
        return True

    if not all([_ACCOUNT_SID, _AUTH_TOKEN, _FROM_NUMBER]):
        logger.error("[SMS] Twilio credentials not configured. Set TWILIO_* env vars.")
        return False

    try:
        from twilio.rest import Client
        client = Client(_ACCOUNT_SID, _AUTH_TOKEN)
        client.messages.create(body=message, from_=_FROM_NUMBER, to=to_number)
        logger.info("[SMS] Sent to %s (%d chars)", to_number, len(message))
        return True
    except Exception as exc:
        logger.error("[SMS] Twilio send failed to %s: %s", to_number, exc)
        return False


def send_whatsapp(to_number: str, message: str) -> bool:
    """
    Send a WhatsApp message via Twilio's WhatsApp sandbox.

    from_ must use the "whatsapp:+<number>" prefix format Twilio requires.
    """
    if _DRY_RUN:
        logger.info("[WA DRY-RUN] To=%s | %s", to_number, message)
        return True

    if not all([_ACCOUNT_SID, _AUTH_TOKEN, _FROM_NUMBER]):
        logger.error("[WhatsApp] Twilio credentials not configured.")
        return False

    try:
        from twilio.rest import Client
        client = Client(_ACCOUNT_SID, _AUTH_TOKEN)
        client.messages.create(
            body=message,
            from_=f"whatsapp:{_FROM_NUMBER}",
            to=f"whatsapp:{to_number}",
        )
        logger.info("[WhatsApp] Sent to %s", to_number)
        return True
    except Exception as exc:
        logger.error("[WhatsApp] Twilio send failed to %s: %s", to_number, exc)
        return False


# ---------------------------------------------------------------------------
# 2. Command parser
# ---------------------------------------------------------------------------

def parse_sms_command(body: str) -> Optional[dict]:
    """
    Parse a farmer's SMS command into a structured dict.

    Strategy: token-based (not pure regex), so crop matching is unambiguous.
    1. Split body into tokens.
    2. First token must be a recognised command keyword.
    3. Scan remaining tokens for a known crop alias (try 2-word then 1-word).
    4. The token immediately after the crop that looks like a number → price.
    5. Remaining tokens → city name.

    Accepted command keywords:
        SALE / becha / bikri / farokht
        PRICE / dam / bhav / rate

    Examples:
        "SALE gandum 2000 Multan"     → {cmd:"sale", crop:"wheat", price:2000, city:"Multan"}
        "SALE aloo 800"               → {cmd:"sale", crop:"potato", price:800,  city:None}
        "PRICE pyaz Lahore"           → {cmd:"price", crop:"onion", price:None, city:"Lahore"}
        "sale chawal 4,500 rahim yar khan" → crop:"rice_basmati", city:"Rahim Yar Khan"

    Returns:
        dict with keys: cmd, crop (canonical), crop_raw, price, city
        or None if the message doesn't match any known format.
    """
    # Normalise:
    # 1. Remove commas inside numbers first (2,000 → 2000) before general cleanup
    text = re.sub(r"(\d),(\d)", r"\1\2", body.strip())
    # 2. Lowercase, collapse whitespace
    text = re.sub(r"[^\w\s]", " ", text.lower())
    tokens = text.split()


    if not tokens:
        return None

    # ---- Identify command keyword ----
    SALE_KEYWORDS  = {"sale", "becha", "bikri", "farokht", "farosh"}
    PRICE_KEYWORDS = {"price", "dam", "bhav", "rate", "bhao", "keemat"}

    cmd_token = tokens[0]
    if cmd_token in SALE_KEYWORDS:
        cmd = "sale"
    elif cmd_token in PRICE_KEYWORDS:
        cmd = "price"
    else:
        return None  # unrecognised command

    rest = tokens[1:]  # everything after the command keyword
    if not rest:
        return None

    # ---- Find crop: try 2-word match first, then 1-word ----
    crop_key  = None
    crop_raw  = None
    crop_end  = 0   # index in `rest` after the crop tokens

    if len(rest) >= 2:
        two_word = rest[0] + " " + rest[1]
        if two_word in CROP_ALIASES:
            crop_key = CROP_ALIASES[two_word]
            crop_raw = two_word
            crop_end = 2

    if crop_key is None:
        one_word = rest[0]
        if one_word in CROP_ALIASES:
            crop_key = CROP_ALIASES[one_word]
            crop_raw = one_word
            crop_end = 1

    if crop_key is None:
        return None  # crop not recognised

    after_crop = rest[crop_end:]  # tokens after the crop name

    # ---- Extract price (first numeric token after crop) ----
    price     = None
    price_idx = None

    for i, tok in enumerate(after_crop):
        numeric = tok.replace(",", "")
        if re.fullmatch(r"\d+(\.\d+)?", numeric):
            try:
                price = float(numeric)
                price_idx = i
            except ValueError:
                pass
            break

    # ---- City: everything after the price token (or after crop if no price) ----
    city_tokens = []
    if price_idx is not None:
        city_tokens = after_crop[price_idx + 1:]
    else:
        city_tokens = after_crop  # no price found → remaining tokens = city

    city = " ".join(city_tokens).title() if city_tokens else None

    # For SALE, price is required
    if cmd == "sale" and price is None:
        return None

    return {
        "cmd":      cmd,
        "crop":     crop_key,
        "crop_raw": crop_raw,
        "price":    price,
        "city":     city if city else None,
    }



# ---------------------------------------------------------------------------
# 3. Reply builder
# ---------------------------------------------------------------------------

def build_price_reply(
    parsed: dict,
    compare_result: Optional[dict],
) -> str:
    """
    Build a short, farmer-friendly Roman Urdu reply (< 160 chars target).

    Args:
        parsed         : Output of parse_sms_command().
        compare_result : Output of compare_price(), or None if no data.

    Returns:
        Plain-text reply string.
    """
    crop_display = CROP_DISPLAY.get(parsed["crop"], parsed["crop_raw"])

    # ---- No reference data available ----
    if compare_result is None or compare_result.get("status") == "no_data":
        return (
            f"{crop_display} ka price data abhi maujood nahi. "
            f"Baad mein dobara try karein."
        )[:160]

    ref_price    = compare_result.get("reference_price")
    source       = compare_result.get("source", "")
    freshness    = compare_result.get("data_freshness", "")
    city_part    = f" ({parsed['city']})" if parsed.get("city") else ""

    # Source label — keep it human readable, not technical
    if "amis_live" in source:
        source_label = f"aaj ka{city_part} mandi price"
    elif "kaggle" in source:
        source_label = "pichle records ka average"
    else:
        source_label = "national average price"

    # ---- PRICE query (no comparison, just inform) ----
    if parsed["cmd"] == "price":
        return (
            f"{crop_display}: {source_label} "
            f"Rs {ref_price:,.0f}/40kg ({freshness}). "
            f"KisaanKhata"
        )[:160]

    # ---- SALE comparison ----
    reported     = parsed["price"]
    status       = compare_result.get("status", "no_data")
    diff_amount  = compare_result.get("difference_amount")
    diff_percent = compare_result.get("difference_percent")

    if status == "fair":
        verdict = "Theek dam mila. Shukriya!"
    elif status == "underpaid":
        shortage = abs(diff_amount) if diff_amount else 0
        pct      = abs(diff_percent) if diff_percent else 0
        verdict  = f"Aapko Rs {shortage:,.0f} ({pct:.0f}%) kam mila."
    else:  # overpaid
        verdict = "Aapko mandi se zyada dam mila!"

    return (
        f"{crop_display}: Aapko Rs {reported:,.0f} mila. "
        f"{source_label} Rs {ref_price:,.0f}. "
        f"{verdict}"
    )[:160]
