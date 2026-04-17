"""Unit tests for backend/auth_otp.py.

Covers: AUTH-02 (Resend call shape), AUTH-04 (10-min expiry + single-use),
plus hash + email validation + lazy sweep.
"""
from __future__ import annotations

import time

import pytest

from auth_otp import (
    OTP_TTL_SEC,
    _hash_code,
    generate_and_store_otp,
    is_valid_email,
    send_otp_email,
    verify_and_consume_otp,
)


# ── is_valid_email ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("email", [
    "a@b.co",
    "user.name+tag@example.com",
    "victor@tampacodeai.com",
])
def test_is_valid_email_accepts_valid(email):
    assert is_valid_email(email) is True

@pytest.mark.parametrize("email", [
    "",
    "no-at-sign",
    "@no-local.com",
    "no-domain@",
    "no-dot@localhost",
    "has space@x.co",
    "a" * 250 + "@b.co",  # > 254 chars
])
def test_is_valid_email_rejects_invalid(email):
    assert is_valid_email(email) is False


# ── _hash_code ───────────────────────────────────────────────────────────────

def test_hash_code_is_sha256_hex():
    result = _hash_code("123456")
    assert len(result) == 64
    assert all(c in "0123456789abcdef" for c in result)

def test_hash_code_is_deterministic():
    assert _hash_code("000000") == _hash_code("000000")

def test_hash_code_differs_by_input():
    assert _hash_code("123456") != _hash_code("123457")


# ── generate_and_store_otp + verify_and_consume_otp ─────────────────────────

def test_otp_roundtrip(db_getter):
    """Generate then verify: first attempt succeeds."""
    code = generate_and_store_otp("a@b.com", db_getter=db_getter)
    assert len(code) == 6
    assert code.isdigit()
    assert verify_and_consume_otp("a@b.com", code, db_getter=db_getter) is True

def test_otp_single_use(db_getter):
    """AUTH-04: second verify of the same code fails."""
    code = generate_and_store_otp("a@b.com", db_getter=db_getter)
    assert verify_and_consume_otp("a@b.com", code, db_getter=db_getter) is True
    assert verify_and_consume_otp("a@b.com", code, db_getter=db_getter) is False

def test_otp_wrong_code_does_not_consume(db_getter):
    """Submitting a wrong code must return False AND leave the row intact
    so the user can retry with the correct code."""
    code = generate_and_store_otp("a@b.com", db_getter=db_getter)
    wrong = "000000" if code != "000000" else "111111"
    assert verify_and_consume_otp("a@b.com", wrong, db_getter=db_getter) is False
    # Correct code still works
    assert verify_and_consume_otp("a@b.com", code, db_getter=db_getter) is True

def test_otp_expiry(db_getter):
    """AUTH-04: code rejected after expires_at passes."""
    code = generate_and_store_otp("a@b.com", db_getter=db_getter)
    # Manually fast-forward expires_at to 1 sec ago
    with db_getter() as conn:
        conn.execute(
            "UPDATE otp_codes SET expires_at = ? WHERE email = ?",
            (time.time() - 1, "a@b.com"),
        )
        conn.commit()
    assert verify_and_consume_otp("a@b.com", code, db_getter=db_getter) is False

def test_otp_unknown_email_returns_false(db_getter):
    """Verifying for an email with no stored code returns False (no raise)."""
    assert verify_and_consume_otp("never@existed.com", "123456", db_getter=db_getter) is False

def test_otp_reissue_invalidates_previous(db_getter):
    """Per D-01 INSERT OR REPLACE: new request invalidates the old code."""
    first = generate_and_store_otp("a@b.com", db_getter=db_getter)
    second = generate_and_store_otp("a@b.com", db_getter=db_getter)
    if first != second:
        assert verify_and_consume_otp("a@b.com", first, db_getter=db_getter) is False
    assert verify_and_consume_otp("a@b.com", second, db_getter=db_getter) is True

def test_lazy_sweep_removes_expired(db_getter):
    """D-02: verify_and_consume_otp sweeps expired rows even on no-match path."""
    generate_and_store_otp("a@b.com", db_getter=db_getter)
    with db_getter() as conn:
        conn.execute(
            "UPDATE otp_codes SET expires_at = ? WHERE email = ?",
            (time.time() - 1, "a@b.com"),
        )
        conn.commit()
    verify_and_consume_otp("other@b.com", "123456", db_getter=db_getter)
    with db_getter() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM otp_codes WHERE email = ?", ("a@b.com",)
        ).fetchone()
    assert row["n"] == 0


# ── send_otp_email (mocked) ─────────────────────────────────────────────────

def test_send_otp_email_calls_resend(mock_resend_send):
    """AUTH-02: Resend SDK is called with expected params shape."""
    send_otp_email("user@example.com", "123456")
    assert mock_resend_send.call_count == 1
    (params,) = mock_resend_send.call_args.args
    assert params["to"] == ["user@example.com"]
    assert "123456" in params["subject"]
    assert "123456" in params["html"]
    assert params["from"]  # non-empty

def test_send_otp_email_includes_from_sender(mock_resend_send):
    """Sender must be non-empty (from RESEND_FROM_EMAIL constant)."""
    send_otp_email("user@example.com", "654321")
    (params,) = mock_resend_send.call_args.args
    assert "onboarding@resend.dev" in params["from"] or "<" in params["from"]


# ── OTP_TTL_SEC constant ────────────────────────────────────────────────────

def test_otp_ttl_sec_default_is_600_seconds():
    """AUTH-04: 10-minute default TTL."""
    assert OTP_TTL_SEC == 600
