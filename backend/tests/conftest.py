import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import hash_password
from app.database import Base, get_db
from app.main import app
from app.models import Exercise, User

# A single shared in-memory SQLite connection for the whole test, so the app and
# the test see the same data.
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Data helpers
# ---------------------------------------------------------------------------


def make_user(db, username="student", password="password1", is_admin=False) -> User:
    user = User(username=username, password_hash=hash_password(password), is_admin=is_admin)
    db.add(user)
    db.commit()
    return user


def make_exercise(
    db,
    title="Test exercise",
    level=1,
    concept="note-values",
    events=None,
    time_sig=(4, 4),
    num_measures=1,
    tempo_bpm=80,
    is_active=True,
) -> Exercise:
    if events is None:
        events = [
            {"type": "note", "duration": "q"},
            {"type": "note", "duration": "q"},
            {"type": "note", "duration": "q"},
            {"type": "note", "duration": "q"},
        ]
    exercise = Exercise(
        title=title,
        description="",
        level=level,
        concept=concept,
        learn_section=concept,
        time_sig_top=time_sig[0],
        time_sig_bottom=time_sig[1],
        num_measures=num_measures,
        tempo_bpm=tempo_bpm,
        pattern_json=json.dumps({"events": events}),
        is_active=is_active,
    )
    db.add(exercise)
    db.commit()
    return exercise


@pytest.fixture()
def student(db):
    return make_user(db, "student", "password1")


@pytest.fixture()
def admin(db):
    return make_user(db, "boss", "adminpass1", is_admin=True)


def auth_headers(client, username, password) -> dict[str, str]:
    response = client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture()
def student_headers(client, student):
    return auth_headers(client, "student", "password1")


@pytest.fixture()
def admin_headers(client, admin):
    return auth_headers(client, "boss", "adminpass1")


def perfect_taps(expected_beats: list[float], ms_per_beat: float = 600.0) -> list[float]:
    return [beat * ms_per_beat for beat in expected_beats]
