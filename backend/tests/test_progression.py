from sqlalchemy import select

from app.models import Remediation, User, UserConceptMastery, UserExerciseProgress
from app.services import progression
from .conftest import register_and_login


def get_user(db_session, client):
    token, user_data = register_and_login(client)
    return db_session.get(User, user_data["id"]), token


def test_passing_two_level_exercises_unlocks_next_level(client, db_session, exercises):
    user, _ = get_user(db_session, client)
    level1_a, level1_b, _ = exercises

    update = progression.record_attempt_outcome(db_session, user, level1_a, accuracy=0.9, passed=True)
    db_session.commit()
    assert update.leveled_up is False
    assert user.unlocked_level == 1

    update = progression.record_attempt_outcome(db_session, user, level1_b, accuracy=0.95, passed=True)
    db_session.commit()
    assert update.leveled_up is True
    assert user.unlocked_level == 2


def test_consecutive_failures_start_remediation(client, db_session, exercises):
    user, _ = get_user(db_session, client)
    _, _, level2 = exercises

    for i in range(3):
        update = progression.record_attempt_outcome(db_session, user, level2, accuracy=0.4, passed=False)
        db_session.commit()
    assert update.remediation_started is True
    remediation = db_session.execute(select(Remediation)).scalar_one()
    assert remediation.source_exercise_id == level2.id
    assert remediation.status == "active"


def test_next_exercise_prefers_remediation_then_returns_to_source(client, db_session, exercises):
    user, _ = get_user(db_session, client)
    level1_a, level1_b, level2 = exercises

    for _ in range(3):
        progression.record_attempt_outcome(db_session, user, level2, accuracy=0.3, passed=False)
    db_session.commit()

    suggestion = progression.next_exercise_for(db_session, user)
    assert suggestion.reason == "remediation"
    assert suggestion.exercise.id in {level1_a.id, level1_b.id}
    assert suggestion.source_exercise.id == level2.id

    # Pass two similar exercises -> remediation resolves and we're steered back to the source.
    progression.record_attempt_outcome(db_session, user, level1_a, accuracy=0.9, passed=True)
    update = progression.record_attempt_outcome(db_session, user, level1_b, accuracy=0.9, passed=True)
    db_session.commit()
    assert update.remediation_resolved is True

    after = progression.next_exercise_for(db_session, user)
    assert after.exercise.id == level2.id
    assert after.reason in ("progression", "retry-original")


def test_passing_source_resolves_remediation(client, db_session, exercises):
    user, _ = get_user(db_session, client)
    _, _, level2 = exercises

    for _ in range(3):
        progression.record_attempt_outcome(db_session, user, level2, accuracy=0.3, passed=False)
    db_session.commit()
    update = progression.record_attempt_outcome(db_session, user, level2, accuracy=0.95, passed=True)
    db_session.commit()
    assert update.remediation_resolved is True
    remediation = db_session.execute(select(Remediation)).scalar_one()
    assert remediation.status == "resolved"


def test_concept_mastery_updates_with_ewma(client, db_session, exercises):
    user, _ = get_user(db_session, client)
    level1_a, _, _ = exercises

    progression.record_attempt_outcome(db_session, user, level1_a, accuracy=1.0, passed=True)
    db_session.commit()
    mastery = db_session.execute(
        select(UserConceptMastery).where(UserConceptMastery.concept == "quarter-notes")
    ).scalar_one()
    assert mastery.mastery == 0.3  # 0.7 * 0 + 0.3 * 1.0

    progression.record_attempt_outcome(db_session, user, level1_a, accuracy=1.0, passed=True)
    db_session.commit()
    db_session.refresh(mastery)
    assert mastery.mastery == 0.51  # 0.7 * 0.3 + 0.3 * 1.0


def test_progress_rows_track_consecutive_fails_and_reset(client, db_session, exercises):
    user, _ = get_user(db_session, client)
    level1_a, _, _ = exercises

    progression.record_attempt_outcome(db_session, user, level1_a, accuracy=0.5, passed=False)
    progression.record_attempt_outcome(db_session, user, level1_a, accuracy=0.6, passed=False)
    db_session.commit()
    progress = db_session.execute(select(UserExerciseProgress)).scalar_one()
    assert progress.consecutive_fails == 2
    assert progress.best_accuracy == 0.6

    progression.record_attempt_outcome(db_session, user, level1_a, accuracy=0.9, passed=True)
    db_session.commit()
    db_session.refresh(progress)
    assert progress.consecutive_fails == 0
    assert progress.passed is True
    assert progress.best_accuracy == 0.9


def test_next_exercise_progression_and_practice(client, db_session, exercises):
    user, _ = get_user(db_session, client)
    level1_a, level1_b, level2 = exercises

    first = progression.next_exercise_for(db_session, user)
    assert first.reason == "progression"
    assert first.exercise.id == level1_a.id

    # Pass everything; should fall back to practice (lowest accuracy first) or completed.
    progression.record_attempt_outcome(db_session, user, level1_a, accuracy=0.85, passed=True)
    progression.record_attempt_outcome(db_session, user, level1_b, accuracy=0.95, passed=True)
    progression.record_attempt_outcome(db_session, user, level2, accuracy=0.99, passed=True)
    db_session.commit()

    final = progression.next_exercise_for(db_session, user)
    assert final.reason in ("practice", "completed")
    if final.reason == "practice":
        assert final.exercise.id == level1_a.id
