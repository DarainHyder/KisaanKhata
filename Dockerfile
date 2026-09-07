# Hugging Face Space — FastAPI backend container
# ================================================
# Builds the KisaanKhata API for deployment on Hugging Face Spaces.
# HF Spaces exposes the service on port 7860 by default.

FROM python:3.12-slim

# Install system dependencies required by faster-whisper (ffmpeg) and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (better Docker layer caching)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend source code
COPY backend/ .

# Hugging Face Spaces routes traffic to port 7860
ENV PORT=7860
ENV DATABASE_URL=sqlite:///data/kisaankhata.db
ENV APP_ENV=production
ENV WHISPER_MODEL_SIZE=small
ENV WHISPER_LANGUAGE=ur

EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
