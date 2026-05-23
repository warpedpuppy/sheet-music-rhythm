"""Adaptive progression: per-attempt bookkeeping and next-exercise selection."""

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import (
    Exercise,
    Remediation,
    User,
    UserConceptMastery,
    UserExerciseProgress,
)


@dataclass
class ProgressionUpdate:
    unlocked_level: int
    leveled_up: bool = False
    remediation_started: bool = False
    remediation_resolved: bool = False
    suggestion: str | None = None


def _get_or_create_progress(db: Session, user_id: int, exercise_id: int) -> UserExerciseProgress:
    progress = db.execute(
        select(UserExerciseProgress).where(
            UserExerciseProgress.user_id == user_id,
            UserExerciseProgress.exercise_id == exercise_id,
        )
    ).scalar_one_or_none()
    if progress is None:
        progress = UserExerciseProgress(
            user_id=user_id,
            exercise_id=exercise_id,
            attempts_count=0,
            pass_count=0,
            consecutive_fails=0,
            passed=False,
        )
        db.add(progress)
    return progress


def _update_concept_mastery(db: Session, user_id: int, exercise: Exercise, accuracy: float, passed: bool) -> None:
    for concept in exercise.concept_tags or []:
        mastery = db.execute(
            select(UserConceptMastery).where(
                UserConceptMastery.user_id == user_id,
                UserConceptMastery.concept == concept,
            )
        ).scalar_one_or_none()
        if mastery is None:
            mastery = UserConceptMastery(
                user_id=user_id, concept=concept, mastery=0.0, attempts_count=0, pass_count=0
            )
            db.add(mastery)
        mastery.attempts_count += 1
        if passed:
            mastery.pass_count += 1
        mastery.mastery = round(0.7 * mastery.mastery + 0.3 * accuracy, 4)
        mastery.updated_at = datetime.now(timezone.utc)


def _active_remediation(db: Session, user_id: int) -> Remediation | None:
    return db.execute(
        select(Remediation).where(
            Remediation.user_id == user_id, Remediation.status == "active"
        )
    ).scalar_one_or_none()


def _remediation_candidates(db: Session, user_id: int, source: Exercise) -> list[Exercise]:
    """Active exercises sharing a concept tag with the source, at same or lower difficulty."""
    exercises = db.execute(
        select(Exercise).where(
            Exercise.is_active == True,  # noqa: E712
            Exercise.difficulty <= source.difficulty,
            Exercise.id != source.id,
        ).order_by(Exercise.difficulty, Exercise.id)
    ).scalars().all()
    source_tags = set(source.concept_tags or [])
    return [e for e in exercises if source_tags & set(e.concept_tags or [])]


def _passed_exercise_ids(db: Session, user_id: int) -> set[int]:
    rows = db.execute(
        select(UserExerciseProgress.exercise_id).where(
            UserExerciseProgress.user_id == user_id,
            UserExerciseProgress.passed == True,  # noqa: E712
        )
    ).scalars().all()
    return set(rows)


def record_attempt_outcome(
    db: Session, user: User, exercise: Exercise, accuracy: float | None, passed: bool
) -> ProgressionUpdate:
    """Update progress, mastery, level unlocks, and remediation state after an attempt.

    Caller is responsible for committing the session.
    """
    update = ProgressionUpdate(unlocked_level=user.unlocked_level)

    progress = _get_or_create_progress(db, user.id, exercise.id)
    progress.attempts_count += 1
    progress.last_attempt_at = datetime.now(timezone.utc)
    if passed:
        progress.pass_count += 1
        progress.consecutive_fails = 0
        progress.passed = True
    else:
        progress.consecutive_fails += 1
    if accuracy is not None and (progress.best_accuracy is None or accuracy > progress.best_accuracy):
        progress.best_accuracy = accuracy

    _update_concept_mastery(db, user.id, exercise, accuracy or 0.0, passed)

    # Make pending progress/mastery rows visible to the queries below.
    db.flush()

    remediation = _active_remediation(db, user.id)

    if passed:
        # Resolve remediation if the source itself was passed, or count a similar pass.
        if remediation is not None:
            source = db.get(Exercise, remediation.source_exercise_id)
            if exercise.id == remediation.source_exercise_id:
                remediation.status = "resolved"
                remediation.resolved_at = datetime.now(timezone.utc)
                update.remediation_resolved = True
            elif source is not None and set(source.concept_tags or []) & set(exercise.concept_tags or []) \
                    and exercise.difficulty <= source.difficulty:
                remediation.passes_done += 1
                if remediation.passes_done >= remediation.passes_required:
                    remediation.status = "resolved"
                    remediation.resolved_at = datetime.now(timezone.utc)
                    update.remediation_resolved = True
                    source_progress = _get_or_create_progress(db, user.id, remediation.source_exercise_id)
                    source_progress.consecutive_fails = 0
                    update.suggestion = (
                        f"Great work! You're ready to retry \"{source.title}\"."
                    )

        # Level unlock: pass enough exercises at the current unlocked level.
        if exercise.difficulty == user.unlocked_level:
            level_exercise_ids = db.execute(
                select(Exercise.id).where(
                    Exercise.is_active == True,  # noqa: E712
                    Exercise.difficulty == user.unlocked_level,
                )
            ).scalars().all()
            passed_ids = _passed_exercise_ids(db, user.id)
            passed_at_level = len([eid for eid in level_exercise_ids if eid in passed_ids])
            needed = min(settings.level_passes_to_unlock, len(level_exercise_ids))
            max_level = db.execute(
                select(Exercise.difficulty).where(Exercise.is_active == True)  # noqa: E712
                .order_by(Exercise.difficulty.desc()).limit(1)
            ).scalar_one_or_none() or user.unlocked_level
            if passed_at_level >= needed and user.unlocked_level < max_level + 1:
                user.unlocked_level += 1
                update.leveled_up = True
    else:
        if (
            progress.consecutive_fails >= settings.consecutive_fails_for_remediation
            and remediation is None
        ):
            candidates = _remediation_candidates(db, user.id, exercise)
            if candidates:
                db.add(
                    Remediation(
                        user_id=user.id,
                        source_exercise_id=exercise.id,
                        status="active",
                        passes_required=settings.remediation_passes_required,
                        passes_done=0,
                    )
                )
                update.remediation_started = True
                update.suggestion = (
                    "This one is tricky. Let's practice some similar exercises first."
                )

    update.unlocked_level = user.unlocked_level
    return update


@dataclass
class NextExercise:
    exercise: Exercise | None
    reason: str
    source_exercise: Exercise | None = None


def next_exercise_for(db: Session, user: User) -> NextExercise:
    passed_ids = _passed_exercise_ids(db, user.id)

    remediation = _active_remediation(db, user.id)
    if remediation is not None:
        source = db.get(Exercise, remediation.source_exercise_id)
        if source is not None:
            candidates = [
                e for e in _remediation_candidates(db, user.id, source) if e.id not in passed_ids
            ]
            if candidates:
                return NextExercise(exercise=candidates[0], reason="remediation", source_exercise=source)
            return NextExercise(exercise=source, reason="retry-original", source_exercise=source)

    unpassed = db.execute(
        select(Exercise).where(
            Exercise.is_active == True,  # noqa: E712
            Exercise.difficulty <= user.unlocked_level,
        ).order_by(Exercise.difficulty, Exercise.id)
    ).scalars().all()
    unpassed = [e for e in unpassed if e.id not in passed_ids]
    if unpassed:
        return NextExercise(exercise=unpassed[0], reason="progression")

    max_level = db.execute(
        select(Exercise.difficulty).where(Exercise.is_active == True)  # noqa: E712
        .order_by(Exercise.difficulty.desc()).limit(1)
    ).scalar_one_or_none()
    if max_level is not None and user.unlocked_level > max_level:
        return NextExercise(exercise=None, reason="completed")
    if max_level is not None and not unpassed and user.unlocked_level >= max_level:
        # Everything unlocked is passed and there is nothing above: practice weakest.
        pass

    practice_rows = db.execute(
        select(UserExerciseProgress).where(
            UserExerciseProgress.user_id == user.id,
            UserExerciseProgress.passed == True,  # noqa: E712
        ).order_by(UserExerciseProgress.best_accuracy)
    ).scalars().all()
    for row in practice_rows:
        exercise = db.get(Exercise, row.exercise_id)
        if exercise is not None and exercise.is_active:
            return NextExercise(exercise=exercise, reason="practice")

    return NextExercise(exercise=None, reason="completed")
