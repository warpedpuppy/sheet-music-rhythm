import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import hash_password
from app.database import Base, get_db
from app.main import app
from app.models import Exercise, User


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def make_pattern(*events):
    return {"events": list(events)}


def note(duration, dots=0, tie=False):
    event = {"type": "note", "duration": duration}
    if dots:
        event["dots"] = dots
    if tie:
        event["tieToNext"] = True
    return event


def rest(duration):
    return {"type": "rest", "duration": duration}


@pytest.fixture()
def exercises(db_session):
    """A small library: two level-1, one level-2, all sharing useful tags."""
    quarters = make_pattern(*[note("q")] * 8)
    items = [
        Exercise(
            title="Level 1 A", difficulty=1, time_signature="4/4", tempo_bpm=60, num_measures=2,
            pattern=quarters, concept_tags=["quarter-notes"], learn_section_slug="note-values",
        ),
        Exercise(
            title="Level 1 B", difficulty=1, time_signature="4/4", tempo_bpm=60, num_measures=2,
            pattern=quarters, concept_tags=["quarter-notes"], learn_section_slug="note-values",
        ),
        Exercise(
            title="Level 2 A", difficulty=2, time_signature="4/4", tempo_bpm=60, num_measures=2,
            pattern=make_pattern(note("h"), note("h"), note("h"), note("h")),
            concept_tags=["half-notes", "quarter-notes"], learn_section_slug="note-values",
        ),
    ]
    db_session.add_all(items)
    db_session.commit()
    for item in items:
        db_session.refresh(item)
    return items


def register_and_login(client, username="student", password="password1"):
    response = client.post("/api/auth/register", json={"username": username, "password": password})
    assert response.status_code == 201, response.text
    data = response.json()
    return data["access_token"], data["user"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def user_token(client):
    token, _ = register_and_login(client)
    return token


@pytest.fixture()
def admin_token(client, db_session):
    db_session.add(
        User(username="admin", password_hash=hash_password("adminpass"), is_admin=True)
    )
    db_session.commit()
    response = client.post("/api/auth/login", json={"username": "admin", "password": "adminpass"})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]
