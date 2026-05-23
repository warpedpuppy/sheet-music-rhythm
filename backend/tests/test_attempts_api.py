from app.services import rhythm
from .conftest import auth_headers


def perfect_taps(exercise, beat_ms=650.0):
    """Taps with the correct relative rhythm at an arbitrary tempo (the user's own pace)."""
    return [1000.0 + position * beat_ms for position in rhythm.onset_beats(exercise.pattern)]


def test_submit_perfect_attempt(client, user_token, exercises):
    exercise = exercises[0]
    taps = perfect_taps(exercise)
    response = client.post(
        "/api/attempts",
        json={"exercise_id": exercise.id, "taps_ms": taps, "gave_up": False},
        headers=auth_headers(user_token),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["passed"] is True
    assert data["accuracy"] == 1.0
    assert len(data["results"]) == len(taps)
    assert all(r["status"] == "hit" for r in data["results"])
    assert data["progression"]["unlocked_level"] == 1
    assert data["detected_tempo_bpm"] == round(60000 / 650)
    assert len(data["played_pattern"]["events"]) == len(taps)


def test_submit_failed_attempt_returns_per_note_results(client, user_token, exercises):
    exercise = exercises[0]
    response = client.post(
        "/api/attempts",
        json={"exercise_id": exercise.id, "taps_ms": [], "gave_up": False},
        headers=auth_headers(user_token),
    )
    data = response.json()
    assert data["passed"] is False
    assert data["accuracy"] == 0.0
    assert all(r["status"] == "missed" for r in data["results"])
    assert data["played_pattern"] is None


def test_level_up_after_passing_two_exercises(client, user_token, exercises):
    level1_a, level1_b, _ = exercises
    client.post(
        "/api/attempts",
        json={"exercise_id": level1_a.id, "taps_ms": perfect_taps(level1_a), "gave_up": False},
        headers=auth_headers(user_token),
    )
    response = client.post(
        "/api/attempts",
        json={"exercise_id": level1_b.id, "taps_ms": perfect_taps(level1_b), "gave_up": False},
        headers=auth_headers(user_token),
    )
    data = response.json()
    assert data["progression"]["leveled_up"] is True
    assert data["progression"]["unlocked_level"] == 2


def test_gave_up_attempt_recorded_without_score(client, user_token, exercises):
    exercise = exercises[0]
    response = client.post(
        "/api/attempts",
        json={"exercise_id": exercise.id, "taps_ms": [], "gave_up": True},
        headers=auth_headers(user_token),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["gave_up"] is True
    assert data["accuracy"] is None
    assert data["passed"] is False

    history = client.get("/api/attempts", headers=auth_headers(user_token)).json()
    assert len(history) == 1
    assert history[0]["gave_up"] is True


def test_repeated_failures_trigger_remediation_via_api(client, user_token, exercises):
    _, _, level2 = exercises
    for _ in range(3):
        response = client.post(
            "/api/attempts",
            json={"exercise_id": level2.id, "taps_ms": [], "gave_up": False},
            headers=auth_headers(user_token),
        )
    assert response.json()["progression"]["remediation_started"] is True

    next_response = client.get("/api/next-exercise", headers=auth_headers(user_token))
    data = next_response.json()
    assert data["reason"] == "remediation"
    assert data["source_exercise_id"] == level2.id
    assert data["exercise"]["difficulty"] <= level2.difficulty

    progress = client.get("/api/progress", headers=auth_headers(user_token)).json()
    assert progress["active_remediation"]["source_exercise_id"] == level2.id


def test_attempt_history_filter_by_exercise(client, user_token, exercises):
    level1_a, level1_b, _ = exercises
    client.post(
        "/api/attempts",
        json={"exercise_id": level1_a.id, "taps_ms": [], "gave_up": False},
        headers=auth_headers(user_token),
    )
    client.post(
        "/api/attempts",
        json={"exercise_id": level1_b.id, "taps_ms": [], "gave_up": False},
        headers=auth_headers(user_token),
    )
    history = client.get(
        f"/api/attempts?exercise_id={level1_a.id}", headers=auth_headers(user_token)
    ).json()
    assert len(history) == 1
    assert history[0]["exercise_id"] == level1_a.id


def test_attempt_on_missing_exercise_404(client, user_token):
    response = client.post(
        "/api/attempts",
        json={"exercise_id": 999, "taps_ms": [], "gave_up": False},
        headers=auth_headers(user_token),
    )
    assert response.status_code == 404


def test_progress_endpoint_shape(client, user_token, exercises):
    exercise = exercises[0]
    client.post(
        "/api/attempts",
        json={"exercise_id": exercise.id, "taps_ms": perfect_taps(exercise), "gave_up": False},
        headers=auth_headers(user_token),
    )
    progress = client.get("/api/progress", headers=auth_headers(user_token)).json()
    assert progress["unlocked_level"] == 1
    level1 = next(l for l in progress["per_level"] if l["difficulty"] == 1)
    assert level1["passed_count"] == 1
    assert level1["total"] == 2
    assert any(c["concept"] == "quarter-notes" for c in progress["concepts"])
