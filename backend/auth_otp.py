"""
Email OTP auth helpers.

Responsibilities:
- Generate cryptographically secure 6-digit codes via secrets.randbelow
- Store SHA-256 hashed codes in permitiq.db otp_codes with a 10-min TTL
- Constant-time verify + single-use consumption via hmac.compare_digest
- Lazy sweep of expired rows at verify time (D-02)
- Send codes via the Resend Python SDK

Config via env vars (see backend/.env.example):
- RESEND_API_KEY     (required at email-send time; missing key raises at send)
- RESEND_FROM_EMAIL  (default: 'Tampa Code AI <onboarding@resend.dev>')
- OTP_TTL_SEC        (default: 600 — 10 minutes per AUTH-04)

Public API:
- OTP_TTL_SEC                     module-level int constant
- is_valid_email(email) -> bool
- generate_and_store_otp(email, *, db_getter) -> str (plaintext code)
- verify_and_consume_otp(email, code, *, db_getter) -> bool
- send_otp_email(to_email, code) -> None
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets
import time
from typing import Callable

import resend

logger = logging.getLogger(__name__)

# ── Config (override with env) ───────────────────────────────────────────────
OTP_TTL_SEC = int(os.getenv("OTP_TTL_SEC", "600"))  # 10 minutes per AUTH-04
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv(
    "RESEND_FROM_EMAIL",
    "Tampa Code AI <onboarding@resend.dev>",
)

# Defensive: configure the SDK only if key is present.
# Do NOT crash at import — ingest.py and tests must be able to import this module
# without RESEND_API_KEY being set.
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


# ── Email format validation ──────────────────────────────────────────────────
def is_valid_email(email: str) -> bool:
    """Simple structural check — not RFC 5322. Resend is the real validator.

    Rules: non-empty, no whitespace, length <= 254, contains '@', and the
    substring after the last '@' contains a '.'.
    """
    if not email or not isinstance(email, str):
        return False
    if len(email) > 254:
        return False
    if any(c.isspace() for c in email):
        return False
    if "@" not in email:
        return False
    local, _, domain = email.rpartition("@")
    if not local or not domain:
        return False
    if "." not in domain:
        return False
    return True


# ── OTP generation + storage ─────────────────────────────────────────────────
def _hash_code(code: str) -> str:
    """SHA-256 hex digest. Stored server-side; plaintext is emailed once."""
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def generate_and_store_otp(email: str, *, db_getter: Callable) -> str:
    """Generate a 6-digit code, store its SHA-256 hash with 10-min expiry.

    Returns the plaintext code (caller sends it via send_otp_email).
    Uses INSERT OR REPLACE so a new request invalidates any previous code
    for the same email (per D-01 PRIMARY KEY on email).
    """
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = time.time()
    with db_getter() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO otp_codes "
            "(email, code_hash, expires_at, created_at) "
            "VALUES (?, ?, ?, ?)",
            (email, _hash_code(code), now + OTP_TTL_SEC, now),
        )
        conn.commit()
    return code


def verify_and_consume_otp(
    email: str, code: str, *, db_getter: Callable
) -> bool:
    """Verify (email, code) against an unexpired row. Consumes row on success.

    Per D-02, performs lazy sweep of all expired rows in the same transaction
    (no background scheduler needed). Returns True iff a matching unexpired
    row existed; False otherwise. Uses hmac.compare_digest for timing-safe
    comparison. Never raises.
    """
    now = time.time()
    with db_getter() as conn:
        # D-02: lazy sweep of expired rows in same transaction
        conn.execute(
            "DELETE FROM otp_codes WHERE expires_at < ?", (now,)
        )
        row = conn.execute(
            "SELECT code_hash FROM otp_codes WHERE email = ?", (email,)
        ).fetchone()
        if not row:
            conn.commit()
            return False
        # Constant-time comparison — defends against timing side-channels
        if not hmac.compare_digest(row["code_hash"], _hash_code(code)):
            conn.commit()
            return False
        # Single-use per AUTH-04 — delete on success
        conn.execute(
            "DELETE FROM otp_codes WHERE email = ?", (email,)
        )
        conn.commit()
    return True


# ── Resend email delivery ────────────────────────────────────────────────────
def send_otp_email(to_email: str, code: str) -> None:
    """Send a 6-digit OTP via Resend.

    Raises resend.exceptions.ResendError subclasses on failure
    (MissingApiKeyError, InvalidApiKeyError, ValidationError,
    RateLimitError, ApplicationError). Caller is expected to log
    via app.logger.exception and map to HTTP 502.
    """
    params = {
        "from": RESEND_FROM_EMAIL,
        "to": [to_email],
        "subject": f"Your Tampa Code AI login code: {code}",
        "html": (
            f"<p>Your one-time login code is:</p>"
            f"<p style='font-size:24px;font-weight:bold;letter-spacing:4px'>{code}</p>"
            f"<p>This code expires in 10 minutes.</p>"
        ),
    }
    resend.Emails.send(params)
