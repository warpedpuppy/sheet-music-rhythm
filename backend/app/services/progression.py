"""Adaptive progression: level unlocks, concept mastery, and remediation.

Rules:
- Passing ``PASSES_TO_UNLOCK`` distinct exercises at the highest unlocked level
  unlocks the next level.
- Failing (or giving up on) the same exercise ``CONSECUTIVE_FAILS_FOR_REMEDIATION``
  times in a row opens a remediation: the trainer suggests other exercises that share
  the concept at the same or lower level until ``REMEDIATION_PASSES_REQUIRED`` of them
  are passed, then steers the student back to the exercise they were stuck on.
- A concept is considered mastered after ``MASTERY_PASSES`` passed exercises.
"""

from dataclasses import dataclass, field

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Attempt, ConceptMastery, Exercise, Remediation, User, UserProgress

PASSES_TO_UNLOCK = 2
CONSECUTIVE_FAILS_FOR_REMEDIATION = 3
REMEDIATION_PASSES_REQUIRED = 2
MASTERY_PASSES = 2


@dataclass
class OutcomeSummary:
    newly_unlocked_level: int | None = None
    remediation_started: bool = False
    remediation_active: bool = False
    remediation_completed: bool = False
    messages: list[str] = field(default_factory=list)

    @property
    def message(self) -> str:
        return " ".join(self.messages)


def get_or_create_progress(db: Session, user: User) -> UserProgress:
    progress = db.get(UserProgress, user.id)
    if progress is None:
        progress = UserProgress(user_id=user.id, unlocked_level=1)
        db.add(progress)
        db.flush()
    return progress


def get_or_create_mastery(db: Session, user_id: int, concept: str) -> ConceptMastery:
    mastery = db.execute(
        select(ConceptMastery).where(
            ConceptMastery.user_id == user_id, ConceptMastery.concept == concept
        )
    ).scalar_one_or_none()
    if mastery is None:
        mastery = ConceptMastery(user_id=user_id, concept=concept, passes=0, fails=0)
        db.add(mastery)
        db.flush()
    return mastery


def max_level(db: Session) -> int:
    result = db.execute(
        select(func.max(Exercise.level)).where(Exercise.is_active.is_(True))
    ).scalar()
    return result or 1


def passed_exercise_ids(db: Session, user_id: int) -> set[int]:
    rows = db.execute(
        select(Attempt.exercise_id)
        .where(Attempt.user_id == user_id, Attempt.passed.is_(True))
        .distinct()
    ).all()
    return {row[0] for row in rows}


def consecutive_failures(db: Session, user_id: int, exercise_id: int) -> int:
    attempts = db.execute(
        select(Attempt.passed)
        .where(Attempt.user_id == user_id, Attempt.exercise_id == exercise_id)
        .order_by(Attempt.id.desc())
    ).all()
    count = 0
    for (passed,) in attempts:
        if passed:
            break
        count += 1
    return count


def active_remediation(db: Session, user_id: int) -> Remediation | None:
    return db.execute(
        select(Remediation)
        .where(Remediation.user_id == user_id, Remediation.active.is_(True))
        .order_by(Remediation.id.desc())
    ).scalars().first()


def latest_completed_remediation(db: Session, user_id: int) -> Remediation | None:
    return db.execute(
        select(Remediation)
        .where(
            Remediation.user_id == user_id,
            Remediation.active.is_(False),
            Remediation.completed_passes >= REMEDIATION_PASSES_REQUIRED,
        )
        .order_by(Remediation.id.desc())
    ).scalars().first()


def record_attempt_outcome(
    db: Session, user: User, exercise: Exercise, passed: bool
) -> OutcomeSummary:
    """Update mastery, remediation, and level unlocks after an attempt is stored."""
    summary = OutcomeSummary()
    progress = get_or_create_progress(db, user)
    mastery = get_or_create_mastery(db, user.id, exercise.concept)
    remediation = active_remediation(db, user.id)

    if passed:
        mastery.passes += 1
        if remediation is not None and remediation.concept == exercise.concept and (
            remediation.source_exercise_id != exercise.id
        ):
            remediation.completed_passes += 1
            if remediation.completed_passes >= REMEDIATION_PASSES_REQUIRED:
                remediation.active = False
                summary.remediation_completed = True
                summary.messages.append(
                    "Great work — you've practiced this concept enough. "
                    "Time to go back to the exercise you were stuck on."
                )
        if remediation is not None and remediation.source_exercise_id == exercise.id:
            remediation.active = False
            summary.remediation_completed = True
            summary.messages.append("You beat the exercise you were stuck on!")

        newly_unlocked = _check_level_unlock(db, user, progress, exercise)
        if newly_unlocked is not None:
            summary.newly_unlocked_level = newly_unlocked
            summary.messages.append(f"Level {newly_unlocked} unlocked!")
    else:
        mastery.fails += 1
        fails = consecutive_failures(db, user.id, exercise.id)
        if fails >= CONSECUTIVE_FAILS_FOR_REMEDIATION and remediation is None:
            candidates = remediation_candidates(db, user.id, exercise)
            if candidates:
                db.add(
                    Remediation(
                        user_id=user.id,
                        source_exercise_id=exercise.id,
                        concept=exercise.concept,
                        completed_passes=0,
                        active=True,
                    )
                )
                db.flush()
                summary.remediation_started = True
                summary.messages.append(
                    "This one is giving you trouble — let's practice some similar "
                    "rhythms first and come back to it."
                )

    summary.remediation_active = active_remediation(db, user.id) is not None
    return summary


def _check_level_unlock(
    db: Session, user: User, progress: UserProgress, exercise: Exercise
) -> int | None:
    if exercise.level != progress.unlocked_level:
        return None
    highest = max_level(db)
    if progress.unlocked_level >= highest:
        return None
    passed_at_level = db.execute(
        select(func.count(func.distinct(Attempt.exercise_id)))
        .select_from(Attempt)
        .join(Exercise, Exercise.id == Attempt.exercise_id)
        .where(
            Attempt.user_id == user.id,
            Attempt.passed.is_(True),
            Exercise.level == progress.unlocked_level,
        )
    ).scalar()
    if (passed_at_level or 0) >= PASSES_TO_UNLOCK:
        progress.unlocked_level += 1
        return progress.unlocked_level
    return None


def remediation_candidates(
    db: Session, user_id: int, source: Exercise
) -> list[Exercise]:
    """Unpassed, active exercises sharing the source's concept at the same or lower level."""
    passed = passed_exercise_ids(db, user_id)
    rows = db.execute(
        select(Exercise)
        .where(
            Exercise.is_active.is_(True),
            Exercise.concept == source.concept,
            Exercise.level <= source.level,
            Exercise.id != source.id,
        )
        .order_by(Exercise.level.desc(), Exercise.id.asc())
    ).scalars().all()
    return [e for e in rows if e.id not in passed]


def next_exercise(db: Session, user: User) -> tuple[Exercise | None, str, str]:
    """Return ``(exercise, reason, message)`` for the student's recommended next step."""
    progress = get_or_create_progress(db, user)
    passed = passed_exercise_ids(db, user.id)

    remediation = active_remediation(db, user.id)
    if remediation is not None:
        source = db.get(Exercise, remediation.source_exercise_id)
        if source is not None:
            candidates = remediation_candidates(db, user.id, source)
            if candidates:
                remaining = REMEDIATION_PASSES_REQUIRED - remediation.completed_passes
                return (
                    candidates[0],
                    "remediation",
                    f"Let's practice a similar rhythm. Pass {remaining} more like this "
                    f"and we'll go back to “{source.title}”.",
                )
        # Nothing left to practice with — close the remediation and fall through.
        remediation.active = False
        db.flush()

    completed = latest_completed_remediation(db, user.id)
    if completed is not None:
        source = db.get(Exercise, completed.source_exercise_id)
        if source is not None and source.is_active and source.id not in passed:
            return (
                source,
                "progression",
                "You've warmed up — time to retry the exercise you were stuck on.",
            )

    candidates = db.execute(
        select(Exercise)
        .where(Exercise.is_active.is_(True), Exercise.level <= progress.unlocked_level)
        .order_by(Exercise.level.asc(), Exercise.id.asc())
    ).scalars().all()
    for exercise in candidates:
        if exercise.id not in passed:
            return exercise, "progression", "Here's your next exercise."

    return None, "complete", "You've passed every unlocked exercise. Nice work!"
