---
plan: 02-02
phase: 02-email-otp-authentication
status: complete
---

# Plan 02-02: OTP Primitives + Unit Tests — Summary

## What Was Built

Created `backend/auth_otp.py` — the security-sensitive OTP module isolating code generation, SHA-256 hashed storage, constant-time verification, and Resend email delivery behind a clean public API. Created the test infrastructure (`backend/tests/__init__.py`, `backend/tests/conftest.py`) and a comprehensive unit test suite (`backend/tests/test_auth_otp.py`).

## Public API (backend/auth_otp.py)

| Symbol | Type | Description |
|--------|------|-------------|
| `OTP_TTL_SEC` | `int` | 600 (10 min, env-overridable via `OTP_TTL_SEC`) |
| `is_valid_email(email)` | `-> bool` | Structural email check (not RFC 5322) |
| `generate_and_store_otp(email, *, db_getter)` | `-> str` | 6-digit CSPRNG code, SHA-256 hashed in otp_codes |
| `verify_and_consume_otp(email, code, *, db_getter)` | `-> bool` | Constant-time verify + single-use delete + lazy sweep |
| `send_otp_email(to_email, code)` | `-> None` | Resend SDK call; raises on API failure |

## Test Suite (backend/tests/test_auth_otp.py)

**23 tests passed** via `cd backend && pytest tests/test_auth_otp.py -x`.

| Test | Covers |
|------|--------|
| `test_is_valid_email_accepts_valid` (×3) | Valid email formats |
| `test_is_valid_email_rejects_invalid` (×7) | Invalid email formats |
| `test_hash_code_is_sha256_hex` | 64-char hex output |
| `test_hash_code_is_deterministic` | Same input = same hash |
| `test_hash_code_differs_by_input` | Different inputs differ |
| `test_otp_roundtrip` | Generate → verify succeeds |
| `test_otp_single_use` | Second verify of same code fails (AUTH-04) |
| `test_otp_wrong_code_does_not_consume` | Wrong code leaves row intact |
| `test_otp_expiry` | Expired code rejected (AUTH-04) |
| `test_otp_unknown_email_returns_false` | No row = False, no raise |
| `test_otp_reissue_invalidates_previous` | D-01 INSERT OR REPLACE |
| `test_lazy_sweep_removes_expired` | D-02 sweep on no-match path |
| `test_send_otp_email_calls_resend` | AUTH-02 Resend params shape |
| `test_send_otp_email_includes_from_sender` | RESEND_FROM_EMAIL used |
| `test_otp_ttl_sec_default_is_600_seconds` | AUTH-04 TTL constant |

## Deviations from RESEARCH.md Pattern 4

None. Implementation follows specified schema, API signatures, and security requirements exactly.

## Import Safety

Module imports cleanly without `RESEND_API_KEY` set (guarded by `if RESEND_API_KEY:` at module level).

## Key Security Properties

- CSPRNG: `secrets.randbelow(1_000_000)` — no `random.randint`
- Hashing: SHA-256 via `hashlib.sha256` — no plaintext storage
- Comparison: `hmac.compare_digest` — no `==` for OTP comparison
- Single-use: row deleted on successful verify
- Lazy sweep: expired rows deleted at verify time (D-02)
- Import-safe: no crash if `RESEND_API_KEY` unset
