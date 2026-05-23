from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from .database import Base, engine
from .routers import admin, attempts, auth, exercises, progress

# Columns added after the initial release, applied to existing databases on startup
# (SQLAlchemy's create_all only creates missing tables, not missing columns).
SCHEMA_UPGRADES: list[tuple[str, str, str]] = [
    ("attempts", "mode", "ALTER TABLE attempts ADD COLUMN mode VARCHAR(16) NOT NULL DEFAULT 'free'"),
]


def apply_schema_upgrades(target: Engine) -> None:
    inspector = inspect(target)
    with target.begin() as connection:
        for table, column, ddl in SCHEMA_UPGRADES:
            if not inspector.has_table(table):
                continue
            existing = {col["name"] for col in inspector.get_columns(table)}
            if column not in existing:
                connection.execute(text(ddl))


def create_app() -> FastAPI:
    Base.metadata.create_all(bind=engine)
    apply_schema_upgrades(engine)
    app = FastAPI(title="Sheet Music Rhythm Trainer", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(auth.router)
    app.include_router(exercises.router)
    app.include_router(attempts.router)
    app.include_router(progress.router)
    app.include_router(admin.router)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
