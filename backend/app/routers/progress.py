from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Exercise, Remediation, User, UserConceptMastery, UserExerciseProgress
from ..schemas import (
    ConceptMasteryOut,
    LevelProgress,
    NextExerciseOut,
    ProgressOut,
    RemediationOut,
)
from ..services import progression
from .exercises import exercise_to_out

router = APIRouter(prefix="/api", tags=["progress"])


def build_progress(db: Session, user: User) -> ProgressOut:
    exercises = db.execute(
        select(Exercise).where(Exercise.is_active == True)  # noqa: E712
    ).scalars().all()
    progress_rows = db.execute(
        select(UserExerciseProgress).where(UserExerciseProgress.user_id == user.id)
    ).scalars().all()
    passed_ids = {p.exercise_id for p in progress_rows if p.passed}

    by_level: dict[int, dict[str, int]] = {}
    for exercise in exercises:
        level = by_level.setdefault(exercise.difficulty, {"passed": 0, "total": 0})
        level["total"] += 1
        if exercise.id in passed_ids:
            level["passed"] += 1
    per_level = [
        LevelProgress(difficulty=d, passed_count=v["passed"], total=v["total"])
        for d, v in sorted(by_level.items())
    ]

    mastery_rows = db.execute(
        select(UserConceptMastery).where(UserConceptMastery.user_id == user.id)
    ).scalars().all()
    concepts = [
        ConceptMasteryOut(concept=m.concept, mastery=m.mastery, attempts=m.attempts_count)
        for m in sorted(mastery_rows, key=lambda m: m.concept)
    ]

    remediation = db.execute(
        select(Remediation).where(Remediation.user_id == user.id, Remediation.status == "active")
    ).scalar_one_or_none()
    remediation_out = None
    if remediation is not None:
        source = db.get(Exercise, remediation.source_exercise_id)
        remediation_out = RemediationOut(
            source_exercise_id=remediation.source_exercise_id,
            source_exercise_title=source.title if source else "",
            passes_done=remediation.passes_done,
            passes_required=remediation.passes_required,
        )

    return ProgressOut(
        unlocked_level=user.unlocked_level,
        per_level=per_level,
        concepts=concepts,
        active_remediation=remediation_out,
    )


@router.get("/progress", response_model=ProgressOut)
def get_progress(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return build_progress(db, user)


@router.get("/next-exercise", response_model=NextExerciseOut)
def get_next_exercise(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    result = progression.next_exercise_for(db, user)
    return NextExerciseOut(
        exercise=exercise_to_out(result.exercise) if result.exercise else None,
        reason=result.reason,
        source_exercise_id=result.source_exercise.id if result.source_exercise else None,
        source_exercise_title=result.source_exercise.title if result.source_exercise else None,
    )
