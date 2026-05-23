from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..config import VALID_LEARN_SLUGS
from ..database import get_db
from ..models import Attempt, Exercise, User, UserExerciseProgress
from ..schemas import (
    AdminUserOut,
    AdminUserProgressOut,
    AttemptSummary,
    ExerciseIn,
    ExerciseOut,
    TestRunRequest,
    TestRunStatus,
    UserOut,
)
from ..services import rhythm, test_runner
from .exercises import exercise_to_out
from .progress import build_progress

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# ---------- Users ----------

@router.get("/users", response_model=list[AdminUserOut])
def list_users(db: Session = Depends(get_db)):
    users = db.execute(select(User).order_by(User.id)).scalars().all()
    attempt_counts = dict(
        db.execute(select(Attempt.user_id, func.count(Attempt.id)).group_by(Attempt.user_id)).all()
    )
    passed_counts = dict(
        db.execute(
            select(UserExerciseProgress.user_id, func.count(UserExerciseProgress.id))
            .where(UserExerciseProgress.passed == True)  # noqa: E712
            .group_by(UserExerciseProgress.user_id)
        ).all()
    )
    last_active = dict(
        db.execute(select(Attempt.user_id, func.max(Attempt.created_at)).group_by(Attempt.user_id)).all()
    )
    return [
        AdminUserOut(
            id=u.id,
            username=u.username,
            is_admin=u.is_admin,
            unlocked_level=u.unlocked_level,
            total_attempts=attempt_counts.get(u.id, 0),
            exercises_passed=passed_counts.get(u.id, 0),
            last_active=last_active.get(u.id),
        )
        for u in users
    ]


@router.get("/users/{user_id}/progress", response_model=AdminUserProgressOut)
def user_progress(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    attempts = db.execute(
        select(Attempt).where(Attempt.user_id == user_id).order_by(Attempt.created_at.desc()).limit(20)
    ).scalars().all()
    return AdminUserProgressOut(
        user=UserOut.model_validate(user),
        progress=build_progress(db, user),
        recent_attempts=[AttemptSummary.model_validate(a) for a in attempts],
    )


# ---------- Exercise CRUD ----------

def _validate_exercise(payload: ExerciseIn) -> None:
    try:
        rhythm.validate_pattern(payload.pattern.model_dump(), payload.time_signature, payload.num_measures)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc))
    if payload.learn_section_slug and payload.learn_section_slug not in VALID_LEARN_SLUGS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Unknown learn section slug. Valid slugs: {', '.join(VALID_LEARN_SLUGS)}",
        )


@router.post("/exercises", response_model=ExerciseOut, status_code=status.HTTP_201_CREATED)
def create_exercise(payload: ExerciseIn, db: Session = Depends(get_db)):
    _validate_exercise(payload)
    exercise = Exercise(
        title=payload.title,
        difficulty=payload.difficulty,
        time_signature=payload.time_signature,
        tempo_bpm=payload.tempo_bpm,
        num_measures=payload.num_measures,
        pattern=payload.pattern.model_dump(),
        concept_tags=payload.concept_tags,
        learn_section_slug=payload.learn_section_slug,
    )
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise_to_out(exercise)


@router.put("/exercises/{exercise_id}", response_model=ExerciseOut)
def update_exercise(exercise_id: int, payload: ExerciseIn, db: Session = Depends(get_db)):
    exercise = db.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")
    _validate_exercise(payload)
    exercise.title = payload.title
    exercise.difficulty = payload.difficulty
    exercise.time_signature = payload.time_signature
    exercise.tempo_bpm = payload.tempo_bpm
    exercise.num_measures = payload.num_measures
    exercise.pattern = payload.pattern.model_dump()
    exercise.concept_tags = payload.concept_tags
    exercise.learn_section_slug = payload.learn_section_slug
    db.commit()
    db.refresh(exercise)
    return exercise_to_out(exercise)


@router.delete("/exercises/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exercise(exercise_id: int, db: Session = Depends(get_db)):
    exercise = db.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")
    exercise.is_active = False
    db.commit()


# ---------- Test runner ----------

@router.post("/test-run", response_model=TestRunStatus, status_code=status.HTTP_202_ACCEPTED)
def start_test_run(payload: TestRunRequest):
    state = test_runner.start_run(payload.suite)
    if state is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="A test run is already in progress"
        )
    return TestRunStatus(**state)


@router.get("/test-run/{run_id}", response_model=TestRunStatus)
def get_test_run(run_id: str):
    state = test_runner.get_run(run_id)
    if state is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test run not found")
    return TestRunStatus(**state)
