"""Create the database, the admin + demo accounts, and the seed curriculum.

Run from ``backend/`` with the venv active:  ``python seed.py``
Safe to re-run: existing users are kept and exercises are only inserted once
(matched by title).
"""

import json

from sqlalchemy import select

from app.auth import hash_password
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import Exercise, User, UserProgress
from app.schemas import Pattern
from app.services.rhythm import validate_pattern


def n(duration: str, dots: int = 0, tie: bool = False) -> dict:
    event: dict = {"type": "note", "duration": duration}
    if dots:
        event["dots"] = dots
    if tie:
        event["tieToNext"] = True
    return event


def r(duration: str, dots: int = 0) -> dict:
    event: dict = {"type": "rest", "duration": duration}
    if dots:
        event["dots"] = dots
    return event


# (title, description, level, concept, learn_section, time_sig, num_measures, tempo, events)
EXERCISES = [
    # Level 1 — quarter & half notes -------------------------------------------------
    (
        "Four steady quarters",
        "Four quarter notes — one tap on every beat, all evenly spaced.",
        1, "note-values", "note-values", (4, 4), 1, 80,
        [n("q"), n("q"), n("q"), n("q")],
    ),
    (
        "Half then quarters",
        "A half note lasts two beats: tap it, hold the silence, then tap the two quarters.",
        1, "note-values", "note-values", (4, 4), 1, 80,
        [n("h"), n("q"), n("q")],
    ),
    (
        "Quarters and a half",
        "Two quick quarters, then let the half note ring for two full beats.",
        1, "note-values", "note-values", (4, 4), 1, 80,
        [n("q"), n("q"), n("h")],
    ),
    # Level 2 — whole notes & time signatures ---------------------------------------
    (
        "The whole note",
        "A whole note fills the entire measure — one tap, then wait four beats before the quarters.",
        2, "time-signatures", "time-signatures", (4, 4), 2, 80,
        [n("w"), n("q"), n("q"), n("q"), n("q")],
    ),
    (
        "Waltz time",
        "Three beats per measure in 3/4 time. Feel the ONE-two-three.",
        2, "time-signatures", "time-signatures", (3, 4), 2, 90,
        [n("q"), n("q"), n("q"), n("h"), n("q")],
    ),
    (
        "Mixed long notes",
        "Halves and quarters across two measures of 4/4.",
        2, "time-signatures", "time-signatures", (4, 4), 2, 80,
        [n("h"), n("q"), n("q"), n("q"), n("q"), n("h")],
    ),
    # Level 3 — rests ----------------------------------------------------------------
    (
        "Mind the gap",
        "A quarter rest is one beat of silence. Don't tap during it!",
        3, "rests", "rests", (4, 4), 1, 80,
        [n("q"), r("q"), n("q"), n("q")],
    ),
    (
        "Rest in the middle",
        "A two-beat rest separates the phrases. Keep counting through the silence.",
        3, "rests", "rests", (4, 4), 2, 80,
        [n("q"), n("q"), r("h"), n("h"), n("q"), n("q")],
    ),
    (
        "Starting with silence",
        "Each measure begins with a rest — your first tap lands on beat two.",
        3, "rests", "rests", (4, 4), 2, 80,
        [r("q"), n("q"), n("q"), n("q"), r("q"), n("q"), n("h")],
    ),
    # Level 4 — eighth notes ---------------------------------------------------------
    (
        "Walking and running",
        "Eighth notes move twice as fast as quarters. Walk, walk, run-run, walk.",
        4, "eighth-notes", "eighth-notes", (4, 4), 1, 76,
        [n("q"), n("q"), n("8"), n("8"), n("q")],
    ),
    (
        "Eighth-note pairs",
        "Two pairs of eighths, then two quarters. Keep the eighths perfectly even.",
        4, "eighth-notes", "eighth-notes", (4, 4), 1, 76,
        [n("8"), n("8"), n("8"), n("8"), n("q"), n("q")],
    ),
    (
        "Eighths around a rest",
        "An eighth rest is half a beat of silence tucked between notes.",
        4, "eighth-notes", "eighth-notes", (4, 4), 1, 72,
        [n("8"), n("8"), n("q"), r("8"), n("8"), n("q")],
    ),
    # Level 5 — dotted notes ---------------------------------------------------------
    (
        "The dotted half",
        "A dot adds half the note's value: a dotted half lasts three full beats.",
        5, "dotted-notes", "dotted-notes", (3, 4), 2, 84,
        [n("h", dots=1), n("q"), n("q"), n("q")],
    ),
    (
        "Dotted quarter plus eighth",
        "The classic long-short pair: a dotted quarter (1½ beats) followed by an eighth.",
        5, "dotted-notes", "dotted-notes", (4, 4), 1, 76,
        [n("q", dots=1), n("8"), n("q"), n("q")],
    ),
    (
        "Long-short, long-short",
        "Two dotted-quarter-plus-eighth pairs in a row, then even quarters to finish.",
        5, "dotted-notes", "dotted-notes", (4, 4), 2, 76,
        [n("q", dots=1), n("8"), n("q", dots=1), n("8"), n("q"), n("q"), n("h")],
    ),
    # Level 6 — ties -----------------------------------------------------------------
    (
        "Across the barline",
        "The tie joins the last note of measure one to the first note of measure two — tap once, hold through both.",
        6, "ties", "ties", (4, 4), 2, 80,
        [n("q"), n("q"), n("q"), n("q", tie=True), n("q"), n("q"), n("q"), n("q")],
    ),
    (
        "Tied eighths",
        "Two eighths tied together sound like a single quarter note — only the first one is tapped.",
        6, "ties", "ties", (4, 4), 1, 76,
        [n("q"), n("8"), n("8", tie=True), n("8"), n("8"), n("q")],
    ),
    (
        "Holding on",
        "A half note tied to another half rings for four full beats.",
        6, "ties", "ties", (4, 4), 2, 80,
        [n("q"), n("q"), n("h", tie=True), n("h"), n("q"), n("q")],
    ),
    # Level 7 — sixteenths & syncopation --------------------------------------------
    (
        "Sixteenth runs",
        "Four sixteenths fit inside one beat. Keep them light and even.",
        7, "sixteenths", "sixteenths", (4, 4), 1, 69,
        [n("16"), n("16"), n("16"), n("16"), n("q"), n("8"), n("8"), n("q")],
    ),
    (
        "Sixteenth combinations",
        "Eighth-and-two-sixteenths, then two-sixteenths-and-an-eighth. Say it: 'rhy-thm-of the-mu-sic'.",
        7, "sixteenths", "sixteenths", (4, 4), 1, 69,
        [n("8"), n("16"), n("16"), n("q"), n("16"), n("16"), n("8"), n("q")],
    ),
    (
        "Off the beat",
        "Syncopation puts the long notes between the beats. Lean into the off-beats.",
        7, "syncopation", "syncopation", (4, 4), 1, 76,
        [n("8"), n("q"), n("q"), n("q"), n("8")],
    ),
    (
        "The Charleston",
        "The most famous syncopated figure: a dotted quarter, then a note tied over the third beat.",
        7, "syncopation", "syncopation", (4, 4), 2, 80,
        [n("q", dots=1), n("8", tie=True), n("h"), n("q", dots=1), n("8"), n("q"), r("q")],
    ),
]


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        created_users = 0
        for username, password, is_admin in [
            ("admin", settings.admin_password, True),
            ("demo", "demo123", False),
        ]:
            existing = db.execute(
                select(User).where(User.username == username)
            ).scalar_one_or_none()
            if existing is None:
                user = User(
                    username=username,
                    password_hash=hash_password(password),
                    is_admin=is_admin,
                )
                db.add(user)
                db.flush()
                db.add(UserProgress(user_id=user.id, unlocked_level=1))
                created_users += 1

        created_exercises = 0
        for title, description, level, concept, learn, sig, measures, tempo, events in EXERCISES:
            existing = db.execute(
                select(Exercise).where(Exercise.title == title)
            ).scalar_one_or_none()
            if existing is not None:
                continue
            pattern = Pattern.model_validate({"events": events})
            validate_pattern(pattern, sig[0], sig[1], measures)
            db.add(
                Exercise(
                    title=title,
                    description=description,
                    level=level,
                    concept=concept,
                    learn_section=learn,
                    time_sig_top=sig[0],
                    time_sig_bottom=sig[1],
                    num_measures=measures,
                    tempo_bpm=tempo,
                    pattern_json=json.dumps({"events": events}),
                    is_active=True,
                )
            )
            created_exercises += 1

        db.commit()
        print(f"Created {created_users} user(s) and {created_exercises} exercise(s).")
        print("Accounts: admin /", settings.admin_password, " and demo / demo123")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
