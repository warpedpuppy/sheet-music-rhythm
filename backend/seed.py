"""Idempotent seed script: creates the admin user, a demo user, and the exercise library.

Run with:  python seed.py
"""

from sqlalchemy import select

from app.auth import hash_password
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import Exercise, User
from app.services.rhythm import validate_pattern


def n(duration: str, dots: int = 0, tie: bool = False) -> dict:
    event = {"type": "note", "duration": duration}
    if dots:
        event["dots"] = dots
    if tie:
        event["tieToNext"] = True
    return event


def r(duration: str) -> dict:
    return {"type": "rest", "duration": duration}


EXERCISES = [
    # Level 1 — quarter notes
    dict(title="Steady Quarters", difficulty=1, time_signature="4/4", tempo_bpm=80, num_measures=2,
         concept_tags=["quarter-notes"], learn_section_slug="note-values",
         events=[n("q")] * 8),
    dict(title="Quarters in Three", difficulty=1, time_signature="3/4", tempo_bpm=80, num_measures=2,
         concept_tags=["quarter-notes"], learn_section_slug="time-signatures",
         events=[n("q")] * 6),
    dict(title="March Time", difficulty=1, time_signature="2/4", tempo_bpm=84, num_measures=4,
         concept_tags=["quarter-notes"], learn_section_slug="counting",
         events=[n("q")] * 8),
    # Level 2 — half and whole notes
    dict(title="Half Notes", difficulty=2, time_signature="4/4", tempo_bpm=80, num_measures=2,
         concept_tags=["half-notes"], learn_section_slug="note-values",
         events=[n("h"), n("h"), n("h"), n("h")]),
    dict(title="Whole and Halves", difficulty=2, time_signature="4/4", tempo_bpm=76, num_measures=2,
         concept_tags=["whole-notes", "half-notes"], learn_section_slug="note-values",
         events=[n("w"), n("h"), n("h")]),
    dict(title="Long and Short", difficulty=2, time_signature="3/4", tempo_bpm=80, num_measures=2,
         concept_tags=["half-notes", "quarter-notes"], learn_section_slug="note-values",
         events=[n("h"), n("q"), n("q"), n("h")]),
    # Level 3 — eighth notes
    dict(title="Eighth Note Pairs", difficulty=3, time_signature="4/4", tempo_bpm=80, num_measures=2,
         concept_tags=["eighth-notes"], learn_section_slug="eighth-notes",
         events=[n("8"), n("8"), n("q"), n("8"), n("8"), n("q"),
                 n("8"), n("8"), n("q"), n("8"), n("8"), n("q")]),
    dict(title="Quarters and Eighths", difficulty=3, time_signature="4/4", tempo_bpm=80, num_measures=2,
         concept_tags=["eighth-notes", "quarter-notes"], learn_section_slug="eighth-notes",
         events=[n("q"), n("8"), n("8"), n("q"), n("q"),
                 n("8"), n("8"), n("q"), n("q"), n("q")]),
    dict(title="Running Eighths", difficulty=3, time_signature="4/4", tempo_bpm=84, num_measures=2,
         concept_tags=["eighth-notes"], learn_section_slug="eighth-notes",
         events=[n("8")] * 16),
    # Level 4 — rests
    dict(title="Quarter Rests", difficulty=4, time_signature="4/4", tempo_bpm=80, num_measures=2,
         concept_tags=["rests", "quarter-notes"], learn_section_slug="rests",
         events=[n("q"), r("q"), n("q"), n("q"), n("q"), n("q"), r("q"), n("q")]),
    dict(title="Rest on Beat Two", difficulty=4, time_signature="4/4", tempo_bpm=80, num_measures=2,
         concept_tags=["rests", "eighth-notes"], learn_section_slug="rests",
         events=[n("q"), r("q"), n("8"), n("8"), n("q"),
                 n("q"), r("q"), n("q"), n("q")]),
    dict(title="Off-Beat Entries", difficulty=4, time_signature="4/4", tempo_bpm=76, num_measures=2,
         concept_tags=["rests", "eighth-notes"], learn_section_slug="rests",
         events=[r("8"), n("8"), r("8"), n("8"), n("q"), n("q"),
                 r("8"), n("8"), n("q"), r("8"), n("8"), n("q")]),
    # Level 5 — dotted notes
    dict(title="Dotted Quarter, Eighth", difficulty=5, time_signature="4/4", tempo_bpm=76, num_measures=2,
         concept_tags=["dotted-notes", "eighth-notes"], learn_section_slug="dotted-notes",
         events=[n("q", dots=1), n("8"), n("q"), n("q"),
                 n("q", dots=1), n("8"), n("h")]),
    dict(title="Dotted Half in Three", difficulty=5, time_signature="3/4", tempo_bpm=80, num_measures=2,
         concept_tags=["dotted-notes", "half-notes"], learn_section_slug="dotted-notes",
         events=[n("h", dots=1), n("q"), n("q"), n("q")]),
    dict(title="Dotted Rhythm Workout", difficulty=5, time_signature="4/4", tempo_bpm=76, num_measures=2,
         concept_tags=["dotted-notes", "eighth-notes"], learn_section_slug="dotted-notes",
         events=[n("q", dots=1), n("8"), n("q", dots=1), n("8"),
                 n("8"), n("8"), n("q", dots=1), n("8"), n("q")]),
    # Level 6 — sixteenth notes
    dict(title="Sixteenth Groups", difficulty=6, time_signature="4/4", tempo_bpm=70, num_measures=2,
         concept_tags=["sixteenth-notes"], learn_section_slug="sixteenth-notes",
         events=[n("16"), n("16"), n("16"), n("16"), n("q"), n("16"), n("16"), n("16"), n("16"), n("q"),
                 n("16"), n("16"), n("16"), n("16"), n("q"), n("16"), n("16"), n("16"), n("16"), n("q")]),
    dict(title="Eighth and Two Sixteenths", difficulty=6, time_signature="4/4", tempo_bpm=70, num_measures=2,
         concept_tags=["sixteenth-notes", "eighth-notes"], learn_section_slug="sixteenth-notes",
         events=[n("8"), n("16"), n("16"), n("q"), n("8"), n("16"), n("16"), n("q"),
                 n("8"), n("16"), n("16"), n("q"), n("8"), n("16"), n("16"), n("q")]),
    dict(title="Sixteenth Mix", difficulty=6, time_signature="4/4", tempo_bpm=70, num_measures=2,
         concept_tags=["sixteenth-notes", "eighth-notes"], learn_section_slug="sixteenth-notes",
         events=[n("16"), n("16"), n("8"), n("q"), n("8"), n("8"), n("q"),
                 n("q"), n("16"), n("16"), n("16"), n("16"), n("q"), n("q")]),
    # Level 7 — ties and syncopation
    dict(title="Tie Over the Barline", difficulty=7, time_signature="4/4", tempo_bpm=80, num_measures=2,
         concept_tags=["ties"], learn_section_slug="ties",
         events=[n("q"), n("q"), n("h", tie=True), n("q"), n("q"), n("q"), n("q")]),
    dict(title="Syncopated Push", difficulty=7, time_signature="4/4", tempo_bpm=76, num_measures=2,
         concept_tags=["syncopation", "ties", "eighth-notes"], learn_section_slug="syncopation",
         events=[n("8"), n("q"), n("q"), n("q"), n("8", tie=True),
                 n("q"), n("q"), n("q"), n("8"), n("8")]),
    dict(title="Charleston Groove", difficulty=7, time_signature="4/4", tempo_bpm=76, num_measures=2,
         concept_tags=["syncopation", "dotted-notes", "ties"], learn_section_slug="syncopation",
         events=[n("q", dots=1), n("8", tie=True), n("h"),
                 n("q", dots=1), n("8"), r("q"), n("q")]),
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.execute(select(User).where(User.username == "admin")).scalar_one_or_none() is None:
            db.add(User(username="admin", password_hash=hash_password(settings.admin_password), is_admin=True))
            if settings.admin_password == "admin123":
                print("WARNING: admin user created with the default password 'admin123'. "
                      "Set ADMIN_PASSWORD in .env for anything beyond local development.")
            else:
                print("Created admin user.")
        if db.execute(select(User).where(User.username == "demo")).scalar_one_or_none() is None:
            db.add(User(username="demo", password_hash=hash_password("demo123")))
            print("Created demo user (demo / demo123).")

        created = 0
        for spec in EXERCISES:
            pattern = {"events": spec["events"]}
            validate_pattern(pattern, spec["time_signature"], spec["num_measures"])
            existing = db.execute(
                select(Exercise).where(Exercise.title == spec["title"])
            ).scalar_one_or_none()
            if existing is not None:
                continue
            db.add(
                Exercise(
                    title=spec["title"],
                    difficulty=spec["difficulty"],
                    time_signature=spec["time_signature"],
                    tempo_bpm=spec["tempo_bpm"],
                    num_measures=spec["num_measures"],
                    pattern=pattern,
                    concept_tags=spec["concept_tags"],
                    learn_section_slug=spec["learn_section_slug"],
                )
            )
            created += 1
        db.commit()
        print(f"Seeded {created} new exercises ({len(EXERCISES)} total in library).")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
