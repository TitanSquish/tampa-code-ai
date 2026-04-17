"""CORS preflight smoke test (D-03, D-04)."""
from __future__ import annotations

import os
import sys

import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


@pytest.fixture
def client(tmp_path, monkeypatch, mock_resend_send):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "cors_test.db"))
    monkeypatch.setenv("FLASK_SECRET_KEY", "test-secret")
    monkeypatch.setenv("FRONTEND_ORIGIN", "http://localhost:5173")
    if "code_website" in sys.modules:
        del sys.modules["code_website"]
    import code_website

    code_website.app.config["TESTING"] = True
    return code_website.app.test_client()


def test_preflight_allows_vite_origin(client):
    resp = client.options(
        "/api/auth/verify-otp",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert resp.status_code in (200, 204)
    assert resp.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
    assert resp.headers.get("Access-Control-Allow-Credentials") == "true"


def test_preflight_rejects_unknown_origin(client):
    resp = client.options(
        "/api/auth/verify-otp",
        headers={
            "Origin": "http://evil.example.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    allow = resp.headers.get("Access-Control-Allow-Origin")
    assert allow != "http://evil.example.com"
