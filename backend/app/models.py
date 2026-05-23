from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    unlocked_level: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    attempts: Mapped[list["Attempt"]] = relationship(back_populates="user")
    progress: Mapped[list["UserExerciseProgress"]] = relationship(back_populates="user")


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    difficulty: Mapped[int] = mapped_column(Integer, index=True)
    time_signature: Mapped[str] = mapped_column(String(10), default="4/4")
    tempo_bpm: Mapped[int] = mapped_column(Integer, default=80)
    num_measures: Mapped[int] = mapped_column(Integer, default=2)
    pattern: Mapped[dict] = mapped_column(JSON)
    concept_tags: Mapped[list] = mapped_column(JSON, default=list)
    learn_section_slug: Mapped[str | None] = mapped_column(String(60), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    attempts: Mapped[list["Attempt"]] = relationship(back_populates="exercise")

    __table_args__ = (Index("ix_exercises_difficulty_id", "difficulty", "id"),)


class Attempt(Base):
    __tablename__ = "attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"), index=True)
    taps: Mapped[list] = mapped_column(JSON, default=list)
    results: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    gave_up: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped["User"] = relationship(back_populates="attempts")
    exercise: Mapped["Exercise"] = relationship(back_populates="attempts")

    __table_args__ = (Index("ix_attempts_user_exercise_created", "user_id", "exercise_id", "created_at"),)


class UserExerciseProgress(Base):
    __tablename__ = "user_exercise_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"), index=True)
    attempts_count: Mapped[int] = mapped_column(Integer, default=0)
    pass_count: Mapped[int] = mapped_column(Integer, default=0)
    consecutive_fails: Mapped[int] = mapped_column(Integer, default=0)
    best_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    last_attempt_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped["User"] = relationship(back_populates="progress")
    exercise: Mapped["Exercise"] = relationship()

    __table_args__ = (UniqueConstraint("user_id", "exercise_id", name="uq_user_exercise"),)


class UserConceptMastery(Base):
    __tablename__ = "user_concept_mastery"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    concept: Mapped[str] = mapped_column(String(60))
    attempts_count: Mapped[int] = mapped_column(Integer, default=0)
    pass_count: Mapped[int] = mapped_column(Integer, default=0)
    mastery: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    __table_args__ = (UniqueConstraint("user_id", "concept", name="uq_user_concept"),)


class Remediation(Base):
    __tablename__ = "remediations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    source_exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"))
    status: Mapped[str] = mapped_column(String(20), default="active")
    passes_required: Mapped[int] = mapped_column(Integer, default=2)
    passes_done: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    source_exercise: Mapped["Exercise"] = relationship()
