from unittest.mock import patch

from app.services import rhythm, test_runner
from .conftest import auth_headers, register_and_login


def test_admin_user_list_includes_progress_summary(client, admin_token, exercises, db_session):
    token, user_data = register_and_login(client, "student1", "password1")
    exercise = exercises[0]
    taps = rhythm.expected_onsets(exercise.pattern, exercise.time_signature, exercise.tempo_bpm)
    client.post(
        "/api/attempts",
        json={"exercise_id": exercise.id, "taps_ms": taps, "gave_up": False},
        headers=auth_headers(token),
    )

    response = client.get("/api/admin/users", headers=auth_headers(admin_token))
    assert response.status_code == 200
    users = {u["username"]: u for u in response.json()}
    assert users["student1"]["total_attempts"] == 1
    assert users["student1"]["exercises_passed"] == 1
    assert users["student1"]["last_active"] is not None


def test_admin_user_progress_detail(client, admin_token, exercises):
    token, user_data = register_and_login(client, "student2", "password1")
    exercise = exercises[0]
    client.post(
        "/api/attempts",
        json={"exercise_id": exercise.id, "taps_ms": [], "gave_up": False},
        headers=auth_headers(token),
    )
    response = client.get(
        f"/api/admin/users/{user_data['id']}/progress", headers=auth_headers(admin_token)
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["username"] == "student2"
    assert len(data["recent_attempts"]) == 1


def test_admin_missing_user_404(client, admin_token):
    response = client.get("/api/admin/users/999/progress", headers=auth_headers(admin_token))
    assert response.status_code == 404


def fake_start_run(suite):
    return {
        "run_id": "abc123",
        "suite": suite,
        "status": "running",
        "summary": None,
        "tests": [],
        "raw_output_tail": None,
    }


def test_test_run_endpoint_starts_and_polls(client, admin_token):
    completed = {
        "run_id": "abc123",
        "suite": "backend",
        "status": "passed",
        "summary": {"total": 2, "passed": 2, "failed": 0, "skipped": 0, "duration_s": 1.5},
        "tests": [
            {"nodeid": "tests/test_x.py::test_a", "outcome": "passed", "duration": 0.1, "message": None},
            {"nodeid": "tests/test_x.py::test_b", "outcome": "passed", "duration": 0.2, "message": None},
        ],
        "raw_output_tail": "2 passed",
    }
    with patch.object(test_runner, "start_run", side_effect=fake_start_run), \
         patch.object(test_runner, "get_run", return_value=completed):
        start = client.post(
            "/api/admin/test-run", json={"suite": "backend"}, headers=auth_headers(admin_token)
        )
        assert start.status_code == 202
        assert start.json()["status"] == "running"
        run_id = start.json()["run_id"]

        poll = client.get(f"/api/admin/test-run/{run_id}", headers=auth_headers(admin_token))
        assert poll.status_code == 200
        data = poll.json()
        assert data["status"] == "passed"
        assert data["summary"]["passed"] == 2
        assert len(data["tests"]) == 2


def test_test_run_conflict_when_already_running(client, admin_token):
    with patch.object(test_runner, "start_run", return_value=None):
        response = client.post(
            "/api/admin/test-run", json={"suite": "backend"}, headers=auth_headers(admin_token)
        )
    assert response.status_code == 409


def test_test_run_unknown_id_404(client, admin_token):
    response = client.get("/api/admin/test-run/doesnotexist", headers=auth_headers(admin_token))
    assert response.status_code == 404


def test_pytest_report_parsing(tmp_path):
    """_run_pytest parses a canned pytest-json-report file via a mocked subprocess."""
    import json

    report = {
        "duration": 2.34,
        "summary": {"total": 2, "passed": 1, "failed": 1},
        "tests": [
            {"nodeid": "tests/test_a.py::test_ok", "outcome": "passed", "call": {"duration": 0.01}},
            {
                "nodeid": "tests/test_a.py::test_bad",
                "outcome": "failed",
                "call": {"duration": 0.02, "longrepr": "assert 1 == 2"},
            },
        ],
    }

    class FakeProc:
        returncode = 1
        stdout = "1 failed, 1 passed"
        stderr = ""

    def fake_run(cmd, **kwargs):
        report_arg = next(a for a in cmd if str(a).startswith("--json-report-file="))
        report_file = str(report_arg).split("=", 1)[1]
        with open(report_file, "w") as f:
            json.dump(report, f)
        return FakeProc()

    state = {"status": "running", "summary": None, "tests": [], "raw_output_tail": None}
    with patch.object(test_runner.subprocess, "run", side_effect=fake_run):
        test_runner._run_pytest(state)

    assert state["status"] == "failed"
    assert state["summary"]["total"] == 2
    assert state["summary"]["failed"] == 1
    assert state["tests"][1]["message"] == "assert 1 == 2"
