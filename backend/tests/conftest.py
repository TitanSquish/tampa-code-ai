"""Shared pytest fixtures for Phase 2 auth tests.

Exposes:
- db_getter: a tmp-path-backed SQLite `db_getter` callable with the otp_codes
             table pre-created. Each test gets a fresh DB.
- mock_resend_send: monkeypatches `resend.Emails.send` with a MagicMock that
                    records calls and returns {"id": "mock-email-id"}.
"""
from __future__ import annotations

import sqlite3
from unittest.mock import MagicMock

import pytest


@pytest.fixture
def db_getter(tmp_path):
    """Return a callable that opens a fresh SQLite connection per call,
    pointed at a tmp-path DB file that already has the otp_codes table."""
    db_path = str(tmp_path / "test_permitiq.db")

    # Pre-create schema ONCE per test (matches what _init_db does in code_website.py)
    with sqlite3.connect(db_path) as init_conn:
        init_conn.execute(
            "CREATE TABLE IF NOT EXISTS otp_codes ("
            "email TEXT PRIMARY KEY, "
            "code_hash TEXT NOT NULL, "
            "expires_at REAL NOT NULL, "
            "created_at REAL NOT NULL)"
        )
        init_conn.commit()

    def _get():
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn

    return _get


@pytest.fixture
def mock_resend_send(monkeypatch):
    """Replace resend.Emails.send with a MagicMock so tests never hit the network.
    Returns the mock itself so tests can inspect call args."""
    import resend

    mock = MagicMock(return_value={"id": "mock-email-id"})
    monkeypatch.setattr(resend.Emails, "send", mock)
    return mock
