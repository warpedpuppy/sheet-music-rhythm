from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import admin, attempts, auth, exercises, progress


def create_app() -> FastAPI:
    Base.metadata.create_all(bind=engine)

    app = FastAPI(title="Sheet Music Rhythm Trainer API")
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
    def health():
        return {"status": "ok"}

    return app


app = create_app()
