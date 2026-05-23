import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Attempt, Exercise, User
from ..schemas import ExerciseListItem, ExerciseOut, Pattern
from ..services.progression import get_or_create_progress, passed_exercise_ids
from ..services.rhythm import tap_count

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


def exercise_to_out(exercise: Exercise) -> ExerciseOut:
    pattern = Pattern.model_validate(json.loads(exercise.pattern_json))
    return ExerciseOut(
        id=exercise.id,
        title=exercise.title,
        description=exercise.description,
        level=exercise.level,
        concept=exercise.concept,
        learn_section=exercise.learn_section,
        time_sig_top=exercise.time_sig_top,
        time_sig_bottom=exercise.time_sig_bottom,
        num_measures=exercise.num_measures,
        tempo_bpm=exercise.tempo_bpm,
        pattern=pattern,
        is_active=exercise.is_active,
        tap_count=tap_count(pattern),
    )


@router.get("", response_model=list[ExerciseListItem])
def list_exercises(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ExerciseListItem]:
    progress = get_or_create_progress(db, user)
    db.commit()
    passed = passed_exercise_ids(db, user.id)
    counts = dict(
        db.execute(
            select(Attempt.exercise_id, func.count(Attempt.id))
            .where(Attempt.user_id == user.id)
            .group_by(Attempt.exercise_id)
        ).all()
    )
    exercises = db.execute(
        select(Exercise)
        .where(Exercise.is_active.is_(True))
        .order_by(Exercise.level.asc(), Exercise.id.asc())
    ).scalars().all()
    return [
        ExerciseListItem(
            id=e.id,
            title=e.title,
            description=e.description,
            level=e.level,
            concept=e.concept,
            learn_section=e.learn_section,
            time_sig_top=e.time_sig_top,
            time_sig_bottom=e.time_sig_bottom,
            num_measures=e.num_measures,
            locked=e.level > progress.unlocked_level and not user.is_admin,
            passed=e.id in passed,
            attempt_count=counts.get(e.id, 0),
        )
        for e in exercises
    ]


@router.get("/{exercise_id}", response_model=ExerciseOut)
def get_exercise(
    exercise_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExerciseOut:
    exercise = db.get(Exercise, exercise_id)
    if exercise is None or not exercise.is_active:
        raise HTTPException(status_code=404, detail="Exercise not found.")
    progress = get_or_create_progress(db, user)
    db.commit()
    if exercise.level > progress.unlocked_level and not user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="This exercise is locked. Pass more exercises at your current level to unlock it.",
        )
    return exercise_to_out(exercise)
