---
plan: 02-03
phase: 02-email-otp-authentication
status: complete
---

# Plan 02-03: Flask Auth Route Integration + CORS + Session Hardening Summary

## What Was Built

Completed the Phase 2 integration layer in `backend/code_website.py` by wiring email OTP auth routes to `auth_otp.py`, enabling credentialed CORS for the frontend origin, hardening session cookie settings, adding `otp_codes` schema creation in `_init_db()`, and converting `/pdf` unauthenticated behavior to JSON `401`.

## New Auth Routes

- `POST /api/auth/request-otp` — rate limit `5 per minute; 20 per hour`
- `POST /api/auth/verify-otp` — rate limit `10 per minute; 40 per hour`
- `POST /api/auth/logout` — idempotent session clear

## Session Cookie Configuration Applied

Added Flask session config:

- `SESSION_COOKIE_HTTPONLY=True`
- `SESSION_COOKIE_SAMESITE="Lax"`
- `SESSION_COOKIE_SECURE=(FLASK_ENV == "production")`
- `PERMANENT_SESSION_LIFETIME=timedelta(days=7)`

## CORS Configuration Applied

Added `flask-cors` initialization with:

- Allowed origin: `FRONTEND_ORIGIN` (default `http://localhost:5173`)
- `supports_credentials=True`
- Protected paths explicitly covered:
  - `/api/*`
  - `/ask`
  - `/address-review`

## Legacy Auth/UI Deletions

Removed all legacy shared-password auth routes and symbols:

- Deleted `LOGIN_PASSWORD = os.getenv("APP_LOGIN_PASSWORD", "test123")`
- Deleted `LOGIN_HTML` constant
- Deleted `@app.route("/login", methods=["GET", "POST"])`
- Deleted `@app.route("/logout")` (GET variant)
- Deleted `@app.route("/", methods=["GET"])` home route

Also removed obsolete Flask imports:

- `render_template_string`
- `redirect`

`url_for` remains in use inside the legacy `HTML` template constant.

## Route Protection + `/pdf` Fix

- Existing protected API routes still enforce the same `session.get("authenticated")` gate.
- `/pdf` no longer redirects to deleted `/login`; it now returns:
  - `401` JSON `{ "error": "Unauthorized" }` when unauthenticated
  - `404` JSON `{ "error": "PDF not found" }` when missing

## Test Results

Executed:

- `pytest tests/test_auth_otp.py tests/test_routes_auth.py tests/test_cors.py -x --tb=short`

Result:

- `43 passed`, `0 failed` (`23` unit OTP tests + `18` auth integration tests + `2` CORS tests)

## backend/code_website.py Line Count

- Base (pre-Plan 03 in current git HEAD): `1694`
- Post-Plan 03: `1849`

## Manual Follow-Up Needed

- Set `RESEND_API_KEY` in `backend/.env` before live OTP testing.
- Optionally set a verified `RESEND_FROM_EMAIL` for non-sandbox delivery.

## Phase 4 Planner Note

If frontend and backend are deployed on different origins in Render, revisit cookie/CORS behavior and likely move to `SameSite=None` + `Secure=True` for cross-site credentialed requests.
