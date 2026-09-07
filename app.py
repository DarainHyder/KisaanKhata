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

# HF Spaces provides persistent storage at /data — use it for SQLite.
os.environ.setdefault("DATABASE_URL", "sqlite:///data/kisaankhata.db")
os.environ.setdefault("APP_ENV", "production")
os.environ.setdefault("WHISPER_MODEL_SIZE", "small")
os.environ.setdefault("WHISPER_LANGUAGE", "ur")

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
