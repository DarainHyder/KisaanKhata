# KisaanKhata 🌾

**A digital ledger for smallholder farmers in Pakistan.**  
KisaanKhata gives farmers an independent record of their loans and harvest sales, and automatically checks whether they were paid a fair price compared to real **mandi** (wholesale market) rates — fighting exploitation by middlemen (*arhtiya*).

---

## Project Structure

```
kisaankhata/
├── backend/
│   ├── main.py                  FastAPI app entrypoint & CORS config
│   ├── database.py              SQLite connection (SQLAlchemy)
│   ├── models.py                ORM models: Farmer, LedgerEntry
│   ├── schemas.py               Pydantic request/response schemas
│   ├── routers/
│   │   ├── ledger.py            CRUD routes for farmers & entries
│   │   └── price_check.py       Price-fairness check routes (+ voice)
│   ├── services/
│   │   ├── price_matcher.py     Mandi price comparison logic
│   │   └── stt_service.py       Whisper speech-to-text wrapper
│   ├── data/
│   │   └── mandi_prices_pk.csv  Mandi price dataset (placeholder)
│   ├── requirements.txt
│   └── .env.example
├── frontend/                    React app (scaffolded in a later prompt)
└── README.md
```

---

## Running the Backend Locally

### 1 — Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.10 + |
| ffmpeg | Any recent version — required by Whisper |

Install **ffmpeg**:
- **Windows**: `winget install ffmpeg` or download from https://ffmpeg.org/download.html
- **macOS**: `brew install ffmpeg`
- **Ubuntu/Debian**: `sudo apt install ffmpeg`

---

### 2 — Create & activate a virtual environment

```bash
# From the project root
cd kisaankhata/backend

python -m venv .venv

# Windows PowerShell
.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate
```

---

### 3 — Install Python dependencies

```bash
pip install -r requirements.txt
```

> ⚠️ `openai-whisper` will download the **"base" model weights (~150 MB)** on first use.
> This requires an internet connection the first time only.

> **ffmpeg is required by Whisper and must be installed separately.**  
> Whisper uses ffmpeg to decode audio files. Without it, transcription will fail silently.
> - **Windows**: `winget install ffmpeg` or download from https://ffmpeg.org/download.html  
> - **macOS**: `brew install ffmpeg`  
> - **Ubuntu/Debian**: `sudo apt install ffmpeg`  
> 
> Verify installation: `ffmpeg -version`

---

### 4 — Configure environment variables

```bash
cp .env.example .env
# Edit .env if you want to change the Whisper model size or database path
```

---

### 5 — Run the development server

```bash
# Make sure you are inside kisaankhata/backend/ with the venv active
uvicorn main:app --reload
```

The API will be available at **http://127.0.0.1:8000**

| URL | Description |
|---|---|
| `http://127.0.0.1:8000/` | Health check |
| `http://127.0.0.1:8000/docs` | Swagger UI (interactive API docs) |
| `http://127.0.0.1:8000/redoc` | ReDoc API docs |

---

## Deployment

### Why not both on Vercel?

Vercel is **serverless-first** and excellent for the React frontend, but the FastAPI backend has three parts that do not fit Vercel's model well:

1. **SQLite persistence** — Vercel functions have an ephemeral filesystem; the database would reset on every deploy/cold start.
2. **Background scheduler** — `APScheduler` needs a continuously running process; Vercel functions are request-scoped.
3. **Local Whisper** — the `faster-whisper` model and its dependencies are far larger than Vercel's function size limit.

The practical, low-cost setup is:

- **Frontend → Vercel** (fast CDN, automatic deploys from GitHub)
- **Backend → Render** (free tier, persistent disk, continuous process)

---

### 1 — Backend on Render

The `backend/render.yaml` blueprint is already included. You only need to create the service and add secrets.

1. Go to [render.com](https://render.com) and sign up/log in with GitHub.
2. Click **New + → Blueprint**.
3. Connect your `DarainHyder/KisaanKhata` repo.
4. Render will read `backend/render.yaml` and propose a free web service called `kisaankhata-api`.
5. In the Render dashboard, add these environment variables under **Environment**:
   - `TWILIO_ACCOUNT_SID` — from your Twilio console
   - `TWILIO_AUTH_TOKEN` — from your Twilio console
   - `TWILIO_PHONE_NUMBER` — e.g. `+1234567890`
6. Click **Create Blueprint**. Render builds and deploys the backend.
7. Once live, copy the backend URL (e.g. `https://kisaankhata-api.onrender.com`).

> The SQLite file is stored on a 1 GB persistent disk at `./data/kisaankhata.db`, so data survives redeploys.
> `ffmpeg` is installed automatically via the `packages:` section in `render.yaml`.

---

### 2 — Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and sign up/log in with GitHub.
2. Click **Add New… → Project**.
3. Import `DarainHyder/KisaanKhata`.
4. In the project settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add an environment variable:
   - `VITE_API_BASE_URL` = your Render backend URL + `/api`, e.g. `https://kisaankhata-api.onrender.com/api`
6. Click **Deploy**.

Vercel will rebuild and redeploy automatically on every push to `main`.

---

### 3 — Connect frontend to backend locally

For local development the Vite dev proxy still forwards `/api` to `http://localhost:8000`, so no change is needed.

---

## API Overview

### Ledger (`/api/ledger`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/ledger/farmers` | Register a new farmer |
| `GET` | `/api/ledger/farmers/{id}` | Get a single farmer |
| `POST` | `/api/ledger/entry` | Log a loan or sale entry |
| `GET` | `/api/ledger/{farmer_id}` | All entries for a farmer (date desc) |
| `GET` | `/api/ledger/{farmer_id}/summary` | Loan/sale totals + net balance |
| `POST` | `/api/ledger/voice-entry` | Upload audio → raw Whisper transcript |

### Price Check (`/api/price-check`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/price-check/{entry_id}` | Check fairness of a single sale entry |
| `GET` | `/api/price-check/farmer/{farmer_id}` | Check all sales for a farmer |
| `POST` | `/api/price-check/voice` | Voice-first price check (audio upload) |

---

## Development Roadmap

- [x] **Stage 1** — Project scaffold (models, schemas, routers, service stubs)
- [x] **Stage 2** — Implement CRUD routes + farmer financial summary
- [x] **Stage 3** — Dual-source price comparison (Kaggle mandi + FAOSTAT)
- [x] **Stage 4** — Whisper STT integration (voice-entry endpoint, Urdu default)
- [ ] **Stage 5** — Transcript parsing → structured ledger entry (NLP)
- [ ] **Stage 6** — React frontend (farmer dashboard, voice UI)
- [ ] **Stage 7** — Deploy (Railway / Render + Vercel)

---

## Technology Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI |
| Database | SQLite (via SQLAlchemy ORM) |
| Data validation | Pydantic v2 |
| Speech-to-text | OpenAI Whisper (local) |
| Data processing | pandas |
| Frontend *(future)* | React + Vite |

---

## License

MIT — build freely, share knowledge, empower farmers. 🌾
