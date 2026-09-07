"""
KisaanKhata — Speech-to-Text Service (faster-whisper wrapper)
===============================================================
Uses the `faster-whisper` package (CTranslate2 backend — no PyTorch needed)
to transcribe farmer audio recordings locally with no API key.

faster-whisper is ~2x faster than openai-whisper and requires ~4x less disk
space. API is slightly different: transcribe() returns a generator of segments.

Key design
----------
- Model loaded lazily on the first transcription request (cached in _model).
- Default model size: "base" — good balance for hackathon demo without GPU.
- Default language: "ur" (Urdu).
- Supported formats: WAV, MP3, M4A, OGG, FLAC, WEBM (via ffmpeg).
- Graceful error handling: load failure stored in _model_load_error,
  surfaced as HTTP 503 by the route rather than crashing the server.

Environment variables
---------------------
  WHISPER_MODEL_SIZE  — default "base"
  WHISPER_LANGUAGE    — default "ur"
"""

from __future__ import annotations

import os
import tempfile
import shutil
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

WHISPER_MODEL_SIZE: str = os.getenv("WHISPER_MODEL_SIZE", "base")
WHISPER_LANGUAGE:   str = os.getenv("WHISPER_LANGUAGE", "ur")

SUPPORTED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".webm", ".mp4"}

# ---------------------------------------------------------------------------
# Module-level model cache
# ---------------------------------------------------------------------------

_model = None
_model_load_error: Optional[str] = None


def _load_model_once() -> None:
    """
    Load the faster-whisper model exactly once at module import time.
    Uses CPU with int8 quantisation for maximum compatibility without a GPU.
    Any error is captured so routes can return HTTP 503 instead of crashing.
    """
    global _model, _model_load_error
    try:
        from faster_whisper import WhisperModel
        print(f"[STT] Loading faster-whisper '{WHISPER_MODEL_SIZE}' model (CPU/int8) … ",
              end="", flush=True)
        # device="cpu", compute_type="int8" → fast and works on any machine
        _model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
        print("done.")
    except ImportError:
        _model_load_error = (
            "faster-whisper is not installed. "
            "Run: pip install faster-whisper"
        )
        print(f"[STT] WARNING — {_model_load_error}")
    except Exception as exc:
        _model_load_error = f"Failed to load Whisper model '{WHISPER_MODEL_SIZE}': {exc}"
        print(f"[STT] WARNING — {_model_load_error}")


# ===========================================================================
# Public API
# ===========================================================================

def transcribe_audio(audio_file_path: str, language: str = WHISPER_LANGUAGE) -> str:
    """
    Transcribe an audio file to text using the locally-running faster-whisper model.

    The model is loaded lazily on the first transcription request so that the
    server starts quickly on platforms like Hugging Face Spaces (the model is
    downloaded once and then cached in memory).

    Args:
        audio_file_path : Path to the audio file (WAV, MP3, M4A, OGG, FLAC, WEBM).
        language        : BCP-47 language code. Default "ur" (Urdu).
                          Pass "en" for English during development/testing.

    Returns:
        Transcribed text as a single plain string.

    Raises:
        RuntimeError      : If the model failed to load.
        FileNotFoundError : If the audio file does not exist.
        ValueError        : If the file extension is not supported.
        RuntimeError      : If transcription fails for any other reason.
    """
    global _model, _model_load_error
    if _model is None and _model_load_error is None:
        _load_model_once()

    if _model is None:
        raise RuntimeError(
            _model_load_error or "Whisper model is not loaded. Check server logs."
        )

    path = Path(audio_file_path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_file_path}")

    if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported audio format '{path.suffix}'. "
            f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )

    try:
        # faster-whisper returns a generator of Segment objects + TranscriptionInfo
        segments, _info = _model.transcribe(str(path), language=language)
        # Join all segment texts into one string
        text = " ".join(seg.text.strip() for seg in segments).strip()
        return text
    except Exception as exc:
        raise RuntimeError(f"Whisper transcription failed: {exc}") from exc


def save_upload_to_tempfile(upload_file_obj) -> Path:
    """
    Save a FastAPI UploadFile object to a named temporary file and return its path.

    The caller is responsible for deleting the file after use (use try/finally).

    Args:
        upload_file_obj : A FastAPI UploadFile instance.

    Returns:
        pathlib.Path pointing to the saved temporary file.

    Raises:
        ValueError : If the uploaded file has an unsupported extension.
    """
    original_name = upload_file_obj.filename or "upload.wav"
    suffix = Path(original_name).suffix.lower()

    if suffix not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Uploaded file '{original_name}' has unsupported format '{suffix}'. "
            f"Please upload one of: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        shutil.copyfileobj(upload_file_obj.file, tmp)
    finally:
        tmp.close()

    return Path(tmp.name)


# ===========================================================================
# Placeholder — parse_sale_from_transcript (next stage)
# ===========================================================================

def parse_transcription_to_entry(transcribed_text: str) -> dict:
    """
    Rule-based parser: extract ledger entry fields from a raw transcript.

    Handles rehearsed phrases in English and Urdu (romanised + native script).
    Returns a dict with whatever it could confidently extract; undetected fields
    are None so the frontend can show an editable confirmation form.

    Extracted fields
    ----------------
    entry_type             : "loan" | "sale" | None
    amount                 : float | None   (first large number found)
    crop_name              : str   | None
    unit                   : str   | None
    reported_price_per_unit: float | None   (second number, for sale entries)
    confidence_note        : str            (human-readable explanation)

    Design intent
    -------------
    This is intentionally NOT a ML model. Every rule is explicit and auditable,
    which makes it easy to explain during a hackathon demo. The frontend always
    shows the parsed result for farmer confirmation before saving.
    """
    import re

    text = transcribed_text.strip().lower()
    result: dict = {
        "entry_type":              None,
        "amount":                  None,
        "crop_name":               None,
        "unit":                    None,
        "reported_price_per_unit": None,
        "confidence_note":         "",
    }
    notes: list[str] = []

    # ------------------------------------------------------------------
    # 1. Entry type detection
    # ------------------------------------------------------------------
    LOAN_KEYWORDS = [
        # English
        "loan", "borrowed", "borrow", "qarz", "advance", "debt",
        # Urdu / Romanised Urdu
        "قرض", "ادھار", "ادهار", "udhaar", "udhar", "liya", "لیا",
    ]
    SALE_KEYWORDS = [
        # English
        "sold", "sale", "sell", "earned", "received", "income",
        # Urdu / Romanised Urdu
        "بیچا", "بیچی", "بیچے", "farokht", "فروخت",
        "becha", "bechi", "beche", "bikri", "بکری",
    ]

    if any(kw in text for kw in LOAN_KEYWORDS):
        result["entry_type"] = "loan"
        notes.append("entry_type=loan (keyword match)")
    elif any(kw in text for kw in SALE_KEYWORDS):
        result["entry_type"] = "sale"
        notes.append("entry_type=sale (keyword match)")

    # ------------------------------------------------------------------
    # 2. Number extraction
    #    Handles: 3000, 3,000, 3.5, and Urdu spoken numbers (ہزار/lakh etc.)
    # ------------------------------------------------------------------
    # First extract all numeric literals (with optional commas)
    raw_numbers = re.findall(r"\b\d[\d,]*(?:\.\d+)?\b", text)
    numeric_values = []
    for n in raw_numbers:
        try:
            numeric_values.append(float(n.replace(",", "")))
        except ValueError:
            pass

    # Urdu/Hindi word-number multipliers
    WORD_MULTIPLIERS = {
        # Urdu script
        "ہزار": 1_000, "لاکھ": 100_000, "کروڑ": 10_000_000,
        # Romanised
        "hazar": 1_000, "hazaar": 1_000,
        "lakh": 100_000, "lac": 100_000, "laakh": 100_000,
        "crore": 10_000_000, "karor": 10_000_000,
    }
    # Look for patterns like "teen hazar" (3000), "paanch lakh" (500000)
    URDU_DIGITS = {
        "ek": 1, "do": 2, "teen": 3, "char": 4, "paanch": 5,
        "chhe": 6, "chay": 6, "saat": 7, "aath": 8, "nau": 9, "das": 10,
        "bis": 20, "tees": 30, "chalis": 40, "pachaas": 50,
        "saath": 60, "sattar": 70, "assi": 80, "nabbe": 90,
        "sau": 100, "ek sau": 100,
    }
    for word, multiplier in WORD_MULTIPLIERS.items():
        if word in text:
            # Try to find a digit word or numeral before the multiplier
            pattern = rf"(\d+|{('|'.join(URDU_DIGITS.keys()))})\s*{re.escape(word)}"
            match = re.search(pattern, text)
            if match:
                token = match.group(1)
                base = URDU_DIGITS.get(token, None)
                if base is None:
                    try:
                        base = float(token)
                    except ValueError:
                        base = None
                if base:
                    numeric_values.append(base * multiplier)

    if numeric_values:
        # Largest number → total amount; second largest → price per unit (for sales)
        numeric_values_sorted = sorted(set(numeric_values), reverse=True)
        result["amount"] = numeric_values_sorted[0]
        notes.append(f"amount={result['amount']} (first/largest number)")
        if len(numeric_values_sorted) > 1 and result["entry_type"] == "sale":
            result["reported_price_per_unit"] = numeric_values_sorted[1]
            notes.append(f"reported_price_per_unit={result['reported_price_per_unit']} (second number)")

    # ------------------------------------------------------------------
    # 3. Crop name detection
    # ------------------------------------------------------------------
    CROP_KEYWORDS: dict[str, list[str]] = {
        "wheat":       ["wheat", "gandum", "گندم"],
        "rice":        ["rice", "chawal", "چاول", "dhan", "paddy"],
        "cotton":      ["cotton", "kapas", "کپاس", "rui"],
        "sugarcane":   ["sugarcane", "ganna", "گنا", "cane"],
        "maize":       ["maize", "corn", "makka", "مکئی", "makkai"],
        "mango":       ["mango", "aam", "آم"],
        "potato":      ["potato", "aloo", "آلو"],
        "onion":       ["onion", "pyaz", "پیاز"],
        "tomato":      ["tomato", "tamatar", "ٹماٹر"],
        "garlic":      ["garlic", "lehsan", "لہسن"],
        "carrot":      ["carrot", "gajar", "گاجر"],
        "canola":      ["canola", "sarson", "سرسوں"],
        "gram":        ["gram", "chana", "چنا"],
        "lentil":      ["lentil", "masoor", "مسور", "daal"],
        "guava":       ["guava", "amrood", "امرود"],
        "orange":      ["orange", "narangi", "نارنگی", "kinnow"],
        "banana":      ["banana", "kela", "کیلا"],
        "apple":       ["apple", "seb", "سیب"],
        "peach":       ["peach", "aaru", "آڑو"],
        "pomegranate": ["pomegranate", "anar", "انار"],
    }
    for crop, keywords in CROP_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            result["crop_name"] = crop
            notes.append(f"crop_name={crop} (keyword match)")
            break

    # ------------------------------------------------------------------
    # 4. Unit detection
    # ------------------------------------------------------------------
    UNIT_KEYWORDS: dict[str, list[str]] = {
        "maund":  ["maund", "maan", "من"],
        "40kg":   ["40kg", "40 kg", "chalis kilo", "چالیس کلو"],
        "kg":     ["kilo", "kilogram", "kg", "کلو", "کلوگرام"],
        "quintal":["quintal", "kintal", "کنٹل"],
        "tonne":  ["tonne", "ton", "ٹن"],
        "dozen":  ["dozen", "darjan", "درجن"],
    }
    for unit, keywords in UNIT_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            result["unit"] = unit
            notes.append(f"unit={unit} (keyword match)")
            break

    # ------------------------------------------------------------------
    # 5. Build confidence note
    # ------------------------------------------------------------------
    filled = sum(1 for v in [
        result["entry_type"], result["amount"],
        result["crop_name"], result["unit"]
    ] if v is not None)

    if filled == 4:
        result["confidence_note"] = "All key fields detected. Please verify before saving."
    elif filled >= 2:
        result["confidence_note"] = (
            f"{filled}/4 key fields detected ({', '.join(notes)}). "
            "Please fill in the missing fields before saving."
        )
    else:
        result["confidence_note"] = (
            "Could not reliably parse the transcript. "
            "Please fill in all fields manually."
        )

    return result


# ---------------------------------------------------------------------------
# Keep old name as alias for backward compatibility
# ---------------------------------------------------------------------------
def parse_sale_from_transcript(transcript: str) -> dict:
    """Alias for parse_transcription_to_entry (kept for backward compatibility)."""
    return parse_transcription_to_entry(transcript)

