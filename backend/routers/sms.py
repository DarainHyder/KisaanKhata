"""
KisaanKhata — SMS / WhatsApp Webhook Router
=============================================
Handles Twilio webhook callbacks for inbound SMS and WhatsApp messages.

Routes
------
  POST  /sms/incoming         — Twilio SMS webhook
  POST  /sms/incoming-wa      — Twilio WhatsApp webhook (same logic, different channel)
  GET   /sms/stats            — Usage metrics (unique users, query count, etc.)
  GET   /sms/logs             — Recent SMS log entries (for demo/pitch)

Twilio webhook setup
--------------------
In the Twilio Console → Phone Numbers → Manage → Active Numbers:
  SMS webhook URL : https://your-server.com/sms/incoming
  Method          : HTTP POST

For WhatsApp sandbox:
  https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
  Sandbox webhook : https://your-server.com/sms/incoming-wa

Security note
-------------
For a production deployment, add Twilio request signature validation:
  from twilio.request_validator import RequestValidator
  validator.validate(url, post_vars, x_twilio_signature)
For the hackathon demo this is omitted to keep setup minimal.
"""

import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Form, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import SmsLog
from services.sms_service import (
    parse_sms_command, build_price_reply, send_sms, send_whatsapp, HELP_TEXT
)
from services.price_matcher import compare_price

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Shared webhook logic
# ---------------------------------------------------------------------------

def _handle_incoming(
    from_number: str,
    body: str,
    channel: str,
    db: Session,
) -> str:
    """
    Core logic shared by SMS and WhatsApp webhooks:
    1. Parse the incoming command.
    2. Look up price reference.
    3. Build reply.
    4. Log to SmsLog.
    5. Return reply text (caller sends it via Twilio TwiML or direct API).
    """
    body_clean = (body or "").strip()
    logger.info("[SMS] Incoming %s from %s: %r", channel, from_number, body_clean)

    # ---- Parse command ----
    parsed = parse_sms_command(body_clean)

    if parsed is None:
        # Unrecognised format — send help
        reply  = HELP_TEXT
        status = "parse_error"
        _log(db, from_number, channel, body_clean, reply,
             crop=None, price=None, city=None, status=status)
        return reply

    # ---- Look up price ----
    compare_result = None
    status = "ok"

    if parsed["cmd"] == "sale" and parsed["price"] is not None:
        try:
            compare_result = compare_price(
                reported_price=parsed["price"],
                crop_name=parsed["crop"],
                db=db,
            )
            if compare_result.get("status") == "no_data":
                status = "no_data"
        except Exception as exc:
            logger.error("[SMS] compare_price failed: %s", exc)
            status = "no_data"

    elif parsed["cmd"] == "price":
        # Just price inquiry — no comparison
        from services.price_matcher import get_reference_price
        ref = get_reference_price(parsed["crop"], db=db)
        if ref:
            compare_result = {
                "status":          "info",
                "reference_price": ref["price"],
                "source":          ref["source"],
                "data_freshness":  ref["data_freshness"],
                "difference_amount":  None,
                "difference_percent": None,
            }
        else:
            status = "no_data"

    # ---- Build reply ----
    reply = build_price_reply(parsed, compare_result)

    # ---- Log interaction ----
    _log(
        db, from_number, channel, body_clean, reply,
        crop=parsed.get("crop"),
        price=parsed.get("price"),
        city=parsed.get("city"),
        status=status,
    )

    return reply


def _log(
    db: Session,
    phone: str,
    channel: str,
    msg_in: str,
    msg_out: str,
    crop, price, city, status: str,
):
    """Persist the SMS interaction to SmsLog."""
    try:
        row = SmsLog(
            phone_number=phone,
            channel=channel,
            message_in=msg_in[:1600],
            message_out=msg_out[:1600],
            parsed_crop=crop,
            parsed_price=price,
            parsed_city=city,
            status=status,
        )
        db.add(row)
        db.commit()
    except Exception as exc:
        logger.error("[SMS] Failed to write SmsLog: %s", exc)
        db.rollback()


def _twiml_response(message: str) -> Response:
    """
    Return a TwiML MessagingResponse so Twilio sends the reply automatically.
    This avoids a second Twilio API call and uses Twilio's reply mechanism.
    """
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        f"<Message>{message}</Message>"
        "</Response>"
    )
    return Response(content=xml, media_type="application/xml")


# ---------------------------------------------------------------------------
# POST /sms/incoming — Twilio SMS webhook
# ---------------------------------------------------------------------------

@router.post("/incoming")
async def sms_incoming(
    From: str = Form(...),
    Body: str = Form(...),
    db:   Session = Depends(get_db),
):
    """
    Twilio calls this URL when a farmer sends an SMS to the Twilio number.

    Twilio POST body fields (Form):
      From  : Sender's phone number (+923001234567)
      Body  : Message text

    Returns a TwiML XML response — Twilio reads this and sends the reply SMS
    without needing a second outbound API call.

    Command format expected:
      SALE <crop> <price> [city]     — price check + comparison
      PRICE <crop> [city]            — look up today's price only

    Example SMS:
      "SALE gandum 2000 Multan"
    Example reply:
      "gandum (wheat): Aapko Rs 2,000 mila. aaj ka (Multan) mandi price Rs 2,200.
       Aapko Rs 200 (9%) kam mila."
    """
    reply = _handle_incoming(From, Body, "sms", db)
    return _twiml_response(reply)


# ---------------------------------------------------------------------------
# POST /sms/incoming-wa — Twilio WhatsApp webhook
# ---------------------------------------------------------------------------

@router.post("/incoming-wa")
async def whatsapp_incoming(
    From: str = Form(...),
    Body: str = Form(...),
    db:   Session = Depends(get_db),
):
    """
    Twilio calls this URL when a farmer messages via WhatsApp.

    Identical to /sms/incoming in logic; differs only in the channel label
    stored in SmsLog and the TwiML from_ prefix Twilio uses internally.

    Farmer sends WhatsApp to the Twilio sandbox number, using the same
    SALE / PRICE command format as SMS.
    """
    # WhatsApp From numbers have prefix "whatsapp:" — strip it for storage
    clean_from = From.replace("whatsapp:", "")
    reply = _handle_incoming(clean_from, Body, "whatsapp", db)
    return _twiml_response(reply)


# ---------------------------------------------------------------------------
# GET /sms/stats — usage metrics for pitch deck
# ---------------------------------------------------------------------------

@router.get("/stats")
def sms_stats(db: Session = Depends(get_db)):
    """
    Return aggregate SMS/WhatsApp usage metrics.

    Useful for impact measurement in the pitch deck:
      - "X unique farmers queried prices via SMS this week"
      - "Y total price checks performed"
    """
    total_queries   = db.query(func.count(SmsLog.id)).scalar()
    unique_users    = db.query(func.count(SmsLog.phone_number.distinct())).scalar()
    successful      = db.query(func.count(SmsLog.id)).filter(SmsLog.status == "ok").scalar()
    parse_errors    = db.query(func.count(SmsLog.id)).filter(SmsLog.status == "parse_error").scalar()
    no_data_count   = db.query(func.count(SmsLog.id)).filter(SmsLog.status == "no_data").scalar()
    sms_count       = db.query(func.count(SmsLog.id)).filter(SmsLog.channel == "sms").scalar()
    wa_count        = db.query(func.count(SmsLog.id)).filter(SmsLog.channel == "whatsapp").scalar()

    # Last 7 days
    week_ago = datetime.utcnow() - timedelta(days=7)
    last_7d  = db.query(func.count(SmsLog.id)).filter(SmsLog.timestamp >= week_ago).scalar()
    unique_7d = (
        db.query(func.count(SmsLog.phone_number.distinct()))
        .filter(SmsLog.timestamp >= week_ago)
        .scalar()
    )

    # Most queried crops
    top_crops = (
        db.query(SmsLog.parsed_crop, func.count(SmsLog.id).label("cnt"))
        .filter(SmsLog.parsed_crop.isnot(None))
        .group_by(SmsLog.parsed_crop)
        .order_by(func.count(SmsLog.id).desc())
        .limit(5)
        .all()
    )

    return {
        "total_queries":    total_queries,
        "unique_farmers":   unique_users,
        "successful":       successful,
        "parse_errors":     parse_errors,
        "no_data":          no_data_count,
        "sms_count":        sms_count,
        "whatsapp_count":   wa_count,
        "last_7_days":      {"queries": last_7d, "unique_farmers": unique_7d},
        "top_crops":        [{"crop": r[0], "queries": r[1]} for r in top_crops],
    }


# ---------------------------------------------------------------------------
# GET /sms/logs — recent interactions for demo/audit
# ---------------------------------------------------------------------------

@router.get("/logs")
def sms_logs(limit: int = 20, db: Session = Depends(get_db)):
    """
    Return the most recent SMS/WhatsApp interactions, newest first.
    Useful for live demo — show the judge that real messages are flowing.
    """
    rows = (
        db.query(SmsLog)
        .order_by(SmsLog.timestamp.desc())
        .limit(min(limit, 100))
        .all()
    )
    return [
        {
            "id":           r.id,
            "channel":      r.channel,
            "phone":        r.phone_number[-4:].rjust(len(r.phone_number), "*"),  # mask all but last 4
            "message_in":   r.message_in,
            "message_out":  r.message_out,
            "crop":         r.parsed_crop,
            "price":        r.parsed_price,
            "city":         r.parsed_city,
            "status":       r.status,
            "timestamp":    r.timestamp.isoformat(),
        }
        for r in rows
    ]
