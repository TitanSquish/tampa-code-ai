"""Integration tests for POST /api/auth/* routes (AUTH-01..AUTH-08) and
protected-route 401 behavior."""
from __future__ import annotations

import os
import sys

import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


@pytest.fixture
def app_with_tmp_db(tmp_path, monkeypatch, mock_resend_send):
    """Import Flask app against a tmp SQLite DB with resend mocked."""
    db_path = str(tmp_path / "test_permitiq.db")
    monkeypatch.setenv("DB_PATH", db_path)
    monkeypatch.setenv("FLASK_SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("FRONTEND_ORIGIN", "http://localhost:5173")
    monkeypatch.setenv("SERVE_FRONTEND", "false")

    if "code_website" in sys.modules:
        del sys.modules["code_website"]
    import code_website  # noqa: E402

    code_website.app.config["TESTING"] = True
    yield code_website.app


@pytest.fixture
def client(app_with_tmp_db):
    return app_with_tmp_db.test_client()


def _capture_otp(monkeypatch):
    """Patch OTP generation so tests can inspect plaintext code."""
    import auth_otp

    bucket = {"last_code": None}
    orig = auth_otp.generate_and_store_otp

    def _spy(email, *, db_getter):
        code = orig(email, db_getter=db_getter)
        bucket["last_code"] = code
        return code

    monkeypatch.setattr("auth_otp.generate_and_store_otp", _spy)
    monkeypatch.setattr("code_website.generate_and_store_otp", _spy)
    return bucket


def test_request_otp_ok(client, mock_resend_send, monkeypatch):
    bucket = _capture_otp(monkeypatch)
    resp = client.post("/api/auth/request-otp", json={"email": "user@example.com"})
    assert resp.status_code == 200
    assert resp.get_json() == {"ok": True}
    assert mock_resend_send.call_count == 1
    assert bucket["last_code"] is not None
    assert len(bucket["last_code"]) == 6


def test_request_otp_invalid_email(client, mock_resend_send):
    resp = client.post("/api/auth/request-otp", json={"email": "not-an-email"})
    assert resp.status_code == 400
    assert "error" in resp.get_json()
    assert mock_resend_send.call_count == 0


def test_request_otp_missing_email(client, mock_resend_send):
    resp = client.post("/api/auth/request-otp", json={})
    assert resp.status_code == 400
    assert mock_resend_send.call_count == 0


def test_verify_otp_success(client, monkeypatch):
    bucket = _capture_otp(monkeypatch)
    client.post("/api/auth/request-otp", json={"email": "user@example.com"})
    code = bucket["last_code"]
    resp = client.post("/api/auth/verify-otp", json={"email": "user@example.com", "code": code})
    assert resp.status_code == 200
    assert resp.get_json() == {"ok": True}


def test_verify_otp_wrong_code(client, monkeypatch):
    bucket = _capture_otp(monkeypatch)
    client.post("/api/auth/request-otp", json={"email": "user@example.com"})
    wrong = "000000" if bucket["last_code"] != "000000" else "111111"
    resp = client.post("/api/auth/verify-otp", json={"email": "user@example.com", "code": wrong})
    assert resp.status_code == 401
    assert "error" in resp.get_json()


def test_verify_otp_missing_fields(client):
    resp = client.post("/api/auth/verify-otp", json={"email": "x@y.com"})
    assert resp.status_code == 400
    resp2 = client.post("/api/auth/verify-otp", json={"code": "123456"})
    assert resp2.status_code == 400


def test_verify_otp_sets_httponly_cookie(client, monkeypatch):
    bucket = _capture_otp(monkeypatch)
    client.post("/api/auth/request-otp", json={"email": "user@example.com"})
    resp = client.post(
        "/api/auth/verify-otp",
        json={"email": "user@example.com", "code": bucket["last_code"]},
    )
    set_cookie = resp.headers.get("Set-Cookie", "")
    assert "HttpOnly" in set_cookie
    assert "SameSite=Lax" in set_cookie


def test_logout_clears_session(client, monkeypatch):
    bucket = _capture_otp(monkeypatch)
    client.post("/api/auth/request-otp", json={"email": "user@example.com"})
    client.post("/api/auth/verify-otp", json={"email": "user@example.com", "code": bucket["last_code"]})
    authed = client.post("/api/feedback", json={})
    assert authed.status_code != 401
    out = client.post("/api/auth/logout")
    assert out.status_code == 200
    assert out.get_json() == {"ok": True}
    after = client.post("/api/feedback", json={})
    assert after.status_code == 401


@pytest.mark.parametrize(
    "method,path,kwargs",
    [
        ("POST", "/ask", {"json": {"question": "x"}}),
        ("POST", "/address-review", {"json": {"address": "1 Main", "permit_type": "A", "description": "x"}}),
        ("POST", "/api/property-context", {"json": {"address": "1 Main"}}),
        ("POST", "/api/feedback", {"json": {}}),
        ("GET", "/api/address-suggest", {"query_string": {"q": "main"}}),
        ("GET", "/pdf", {}),
    ],
)
def test_protected_routes_return_401_without_session(client, method, path, kwargs):
    resp = client.open(path, method=method, **kwargs)
    assert resp.status_code == 401, f"{method} {path} should be 401 without session, got {resp.status_code}"


def test_pdf_unauthenticated_returns_json_not_redirect(client):
    resp = client.get("/pdf")
    assert resp.status_code == 401
    assert resp.status_code != 302
    body = resp.get_json()
    assert body == {"error": "Unauthorized"}


def test_legacy_login_route_absent(client):
    resp = client.get("/login")
    assert resp.status_code == 404


def test_legacy_home_route_absent(client):
    resp = client.get("/")
    assert resp.status_code == 404


def test_legacy_logout_get_route_absent(client):
    resp = client.get("/logout")
    assert resp.status_code == 404
