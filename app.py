"""
Hugging Face Spaces Entrypoint — Gradio SDK (no Docker)
========================================================
Mounts the KisaanKhata FastAPI backend behind a minimal Gradio UI
so the free Hugging Face Spaces Gradio runtime can serve it.

The FastAPI routes (/api/*, /admin/*, /sms/*, /analytics/*, /prices/*,
/docs, /redoc, etc.) remain fully functional alongside the Gradio page.
"""

import os
import sys
from pathlib import Path

# Prefer the HF Spaces persistent-storage directory (/data) when available.
# SQLite needs the parent directory to exist, so create it if necessary.
_DEFAULT_DB_URL = "sqlite:///data/kisaankhata.db"
os.environ.setdefault("DATABASE_URL", _DEFAULT_DB_URL)
os.environ.setdefault("APP_ENV", "production")
os.environ.setdefault("WHISPER_MODEL_SIZE", "small")
os.environ.setdefault("WHISPER_LANGUAGE", "ur")

_db_url = os.environ["DATABASE_URL"]
if _db_url.startswith("sqlite:///"):
    # Use SQLAlchemy's URL parser so the path we test matches exactly what
    # SQLAlchemy will hand to the sqlite driver (this differs by OS: on Linux
    # ``sqlite:///data/...`` is absolute ``/data/...``, while on Windows it is
    # relative ``data/...``).
    from sqlalchemy import make_url  # noqa: E402

    db_path = Path(make_url(_db_url).database)
    try:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        # Verify the directory is actually writable; /data exists only when a
        # persistent-storage volume is attached to the Space.
        test_file = db_path.parent / ".write_test"
        test_file.touch()
        test_file.unlink()
    except OSError:
        # Fall back to the repo root so the Space starts without persistence.
        # The ``./`` prefix keeps the path explicitly relative on every OS.
        os.environ["DATABASE_URL"] = "sqlite:///./kisaankhata.db"

# Make the backend package importable from the repo root.
_BACKEND_DIR = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(_BACKEND_DIR))

import gradio as gr  # noqa: E402
from main import app as fastapi_app  # noqa: E402

# Minimal Gradio page so HF Spaces has a UI to render at the Space root.
with gr.Blocks(title="KisaanKhata API") as demo:
    gr.Markdown("# KisaanKhata API")
    gr.Markdown("The backend is running.")
    gr.Markdown("Visit `/docs` for the interactive Swagger UI.")

# Mount Gradio at `/`. FastAPI keeps all of its own routes.
app = gr.mount_gradio_app(fastapi_app, demo, path="/")

# The HF Spaces Gradio SDK imports app.py but does not automatically start a
# server for a FastAPI object. When running inside a Space, SPACE_ID is set and
# we start uvicorn explicitly so the backend stays alive and serves traffic.
if os.getenv("SPACE_ID"):
    import uvicorn  # noqa: E402

    uvicorn.run(app, host="0.0.0.0", port=7860)
