from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------- Pattern ----------

class PatternEvent(BaseModel):
    type: Literal["note", "rest"]
    duration: Literal["w", "h", "q", "8", "16"]
    dots: int = Field(default=0, ge=0, le=1)
    tieToNext: bool = False


class Pattern(BaseModel):
    events: list[PatternEvent]


# ---------- Auth / users ----------

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    is_admin: bool
    unlocked_level: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Exercises ----------

class ExerciseIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    difficulty: int = Field(ge=1, le=20)
    time_signature: str = "4/4"
    tempo_bpm: int = Field(ge=30, le=240)
    num_measures: int = Field(ge=1, le=16)
    pattern: Pattern
    concept_tags: list[str] = []
    learn_section_slug: str | None = None


class UserExerciseStatus(BaseModel):
    passed: bool = False
    best_accuracy: float | None = None
    attempts_count: int = 0
    locked: bool = False


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    difficulty: int
    time_signature: str
    tempo_bpm: int
    num_measures: int
    pattern: Pattern
    concept_tags: list[str]
    learn_section_slug: str | None
    count_in_beats: int = 4
    tolerance_ms: float = 0.0
    user_status: UserExerciseStatus | None = None


# ---------- Attempts / scoring ----------

class AttemptIn(BaseModel):
    exercise_id: int
    taps_ms: list[float] = []
    gave_up: bool = False


class NoteResult(BaseModel):
    index: int
    expected_ms: float
    status: Literal["hit", "early", "late", "missed"]
    tap_ms: float | None = None
    delta_ms: float | None = None


class ProgressionInfo(BaseModel):
    unlocked_level: int
    leveled_up: bool = False
    remediation_started: bool = False
    remediation_resolved: bool = False
    suggestion: str | None = None


class AttemptOut(BaseModel):
    attempt_id: int
    gave_up: bool = False
    results: list[NoteResult] = []
    extra_taps: list[float] = []
    accuracy: float | None = None
    passed: bool = False
    tolerance_ms: float = 0.0
    progression: ProgressionInfo


class AttemptSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exercise_id: int
    accuracy: float | None
    passed: bool
    gave_up: bool
    created_at: datetime


# ---------- Progress ----------

class LevelProgress(BaseModel):
    difficulty: int
    passed_count: int
    total: int


class ConceptMasteryOut(BaseModel):
    concept: str
    mastery: float
    attempts: int


class RemediationOut(BaseModel):
    source_exercise_id: int
    source_exercise_title: str
    passes_done: int
    passes_required: int


class ProgressOut(BaseModel):
    unlocked_level: int
    per_level: list[LevelProgress]
    concepts: list[ConceptMasteryOut]
    active_remediation: RemediationOut | None = None


class NextExerciseOut(BaseModel):
    exercise: ExerciseOut | None
    reason: Literal["progression", "remediation", "retry-original", "practice", "completed"]
    source_exercise_id: int | None = None
    source_exercise_title: str | None = None


# ---------- Admin ----------

class AdminUserOut(BaseModel):
    id: int
    username: str
    is_admin: bool
    unlocked_level: int
    total_attempts: int
    exercises_passed: int
    last_active: datetime | None = None


class AdminUserProgressOut(BaseModel):
    user: UserOut
    progress: ProgressOut
    recent_attempts: list[AttemptSummary]


class TestRunRequest(BaseModel):
    suite: Literal["backend", "frontend"] = "backend"


class TestCaseResult(BaseModel):
    nodeid: str
    outcome: str
    duration: float = 0.0
    message: str | None = None


class TestRunSummary(BaseModel):
    total: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    duration_s: float = 0.0


class TestRunStatus(BaseModel):
    run_id: str
    suite: str
    status: Literal["running", "passed", "failed", "error", "timeout"]
    summary: TestRunSummary | None = None
    tests: list[TestCaseResult] = []
    raw_output_tail: str | None = None
