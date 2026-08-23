"""
KisaanKhata — Database Connection Setup
========================================
Creates a file-based SQLite database (kisaankhata.db) in the backend
directory so the whole project is self-contained with zero external
dependencies — ideal for a hackathon environment.

Uses SQLAlchemy's declarative base so all models can inherit from `Base`
and participate in `Base.metadata.create_all()` at startup.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Database URL
# ---------------------------------------------------------------------------
# Falls back to a local SQLite file if DATABASE_URL is not set in .env
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./kisaankhata.db")

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
# check_same_thread=False is required for SQLite when used with FastAPI's
# async request handling (multiple threads may share a single connection).
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ---------------------------------------------------------------------------
# Declarative base — imported by models.py
# ---------------------------------------------------------------------------
Base = declarative_base()


# ---------------------------------------------------------------------------
# Dependency — used in FastAPI route functions via `Depends(get_db)`
# ---------------------------------------------------------------------------

def get_db():
    """
    Yields a database session for the duration of a single request,
    then closes it automatically (even on errors) via the finally block.

    Usage in a route:
        @router.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
