from .conftest import auth_headers, register_and_login


def test_register_returns_token_and_user(client):
    response = client.post("/api/auth/register", json={"username": "alice", "password": "secret123"})
    assert response.status_code == 201
    data = response.json()
    assert data["access_token"]
    assert data["user"]["username"] == "alice"
    assert data["user"]["is_admin"] is False
    assert data["user"]["unlocked_level"] == 1


def test_register_duplicate_username_conflicts(client):
    register_and_login(client, "bob", "secret123")
    response = client.post("/api/auth/register", json={"username": "bob", "password": "other123"})
    assert response.status_code == 409


def test_register_rejects_short_password(client):
    response = client.post("/api/auth/register", json={"username": "carol", "password": "abc"})
    assert response.status_code == 422


def test_login_success_and_wrong_password(client):
    register_and_login(client, "dave", "secret123")
    ok = client.post("/api/auth/login", json={"username": "dave", "password": "secret123"})
    assert ok.status_code == 200
    assert ok.json()["access_token"]

    bad = client.post("/api/auth/login", json={"username": "dave", "password": "wrong"})
    assert bad.status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401

    token, _ = register_and_login(client, "erin", "secret123")
    response = client.get("/api/auth/me", headers=auth_headers(token))
    assert response.status_code == 200
    assert response.json()["username"] == "erin"


def test_non_admin_cannot_access_admin_routes(client, user_token):
    response = client.get("/api/admin/users", headers=auth_headers(user_token))
    assert response.status_code == 403


def test_admin_can_access_admin_routes(client, admin_token):
    response = client.get("/api/admin/users", headers=auth_headers(admin_token))
    assert response.status_code == 200
