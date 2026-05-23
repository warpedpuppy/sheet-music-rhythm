from .conftest import auth_headers


def valid_exercise_payload(**overrides):
    payload = {
        "title": "New Exercise",
        "difficulty": 1,
        "time_signature": "4/4",
        "tempo_bpm": 80,
        "num_measures": 1,
        "pattern": {"events": [{"type": "note", "duration": "q"}] * 4},
        "concept_tags": ["quarter-notes"],
        "learn_section_slug": "note-values",
    }
    payload.update(overrides)
    return payload


def test_list_exercises_includes_user_status_and_locked_flag(client, user_token, exercises):
    response = client.get("/api/exercises", headers=auth_headers(user_token))
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    level1 = data[0]
    level2 = next(e for e in data if e["difficulty"] == 2)
    assert level1["user_status"]["locked"] is False
    assert level1["user_status"]["passed"] is False
    assert level2["user_status"]["locked"] is True
    assert len(level1["pattern"]["events"]) == 8


def test_get_exercise_detail(client, user_token, exercises):
    exercise_id = exercises[0].id
    response = client.get(f"/api/exercises/{exercise_id}", headers=auth_headers(user_token))
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Level 1 A"
    assert len(data["pattern"]["events"]) == 8


def test_get_missing_exercise_404(client, user_token):
    assert client.get("/api/exercises/999", headers=auth_headers(user_token)).status_code == 404


def test_exercises_require_auth(client, exercises):
    assert client.get("/api/exercises").status_code == 401


def test_admin_create_exercise(client, admin_token):
    response = client.post(
        "/api/admin/exercises", json=valid_exercise_payload(), headers=auth_headers(admin_token)
    )
    assert response.status_code == 201
    assert response.json()["title"] == "New Exercise"


def test_admin_create_rejects_invalid_pattern_total(client, admin_token):
    payload = valid_exercise_payload(
        pattern={"events": [{"type": "note", "duration": "q"}] * 3}
    )
    response = client.post("/api/admin/exercises", json=payload, headers=auth_headers(admin_token))
    assert response.status_code == 422


def test_admin_create_rejects_unknown_learn_slug(client, admin_token):
    payload = valid_exercise_payload(learn_section_slug="not-a-real-slug")
    response = client.post("/api/admin/exercises", json=payload, headers=auth_headers(admin_token))
    assert response.status_code == 422


def test_admin_update_exercise(client, admin_token, exercises):
    exercise_id = exercises[0].id
    payload = valid_exercise_payload(title="Renamed", num_measures=2,
                                     pattern={"events": [{"type": "note", "duration": "q"}] * 8})
    response = client.put(
        f"/api/admin/exercises/{exercise_id}", json=payload, headers=auth_headers(admin_token)
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Renamed"


def test_admin_soft_delete_hides_from_list(client, admin_token, user_token, exercises):
    exercise_id = exercises[0].id
    response = client.delete(f"/api/admin/exercises/{exercise_id}", headers=auth_headers(admin_token))
    assert response.status_code == 204

    listing = client.get("/api/exercises", headers=auth_headers(user_token)).json()
    assert all(e["id"] != exercise_id for e in listing)
