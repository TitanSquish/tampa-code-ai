---
phase: 02-email-otp-authentication
plan: "01"
subsystem: backend-config
tags: [dependencies, env-config, test-infra, resend, flask-cors, pytest]
dependency_graph:
  requires: []
  provides:
    - backend/requirements.txt with resend + flask-cors
    - backend/requirements-dev.txt with pytest test infra
    - backend/.env.example documenting all OTP auth env vars
    - backend/pytest.ini for test discovery
  affects:
    - backend/requirements.txt
    - backend/requirements-dev.txt
    - backend/.env.example
    - backend/pytest.ini
tech_stack:
  added:
    - resend 2.29.0 (production dep — OTP email delivery)
    - flask-cors 6.0.2 (production dep — CORS for React frontend)
    - pytest 9.0.3 (dev dep — test runner)
    - pytest-flask 1.3.0 (dev dep — Flask integration test fixtures)
    - responses 0.26.0 (dev dep — HTTP mock for Resend API calls)
  patterns:
    - Unpinned deps matching existing requirements.txt convention
    - Separate requirements-dev.txt for test-only deps (not installed in production)
key_files:
  modified:
    - backend/requirements.txt
    - backend/.env.example
  created:
    - backend/requirements-dev.txt
    - backend/pytest.ini
decisions:
  - "APP_LOGIN_PASSWORD commented out (not deleted) in .env.example — Plan 03 removes the consumer code; leaving a commented entry with DEPRECATED marker provides a clear migration signal to operators"
  - "requirements-dev.txt kept separate from requirements.txt — test deps (pytest, responses) must not be installed in the Render production runtime"
  - "pytest.ini placed in backend/ root so `cd backend && pytest` resolves testpaths = tests without extra flags"
metrics:
  duration: "2m"
  completed: "2026-04-17T13:14:17Z"
  tasks_completed: 4
  tasks_total: 4
  files_modified: 2
  files_created: 2
---

# Phase 02 Plan 01: Dependency and Environment Scaffolding Summary

Added `resend` and `flask-cors` production deps, created `requirements-dev.txt` with pytest test infra, updated `.env.example` to document all OTP auth env vars and deprecate `APP_LOGIN_PASSWORD`, and created `pytest.ini` for test discovery rooted at `backend/tests/`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add resend + flask-cors to backend/requirements.txt | bb054b8 | backend/requirements.txt |
| 2 | Create backend/requirements-dev.txt with test infra deps | d0cb7cb | backend/requirements-dev.txt (new) |
| 3 | Update backend/.env.example with OTP env vars and deprecate APP_LOGIN_PASSWORD | b03b207 | backend/.env.example |
| 4 | Create backend/pytest.ini for test discovery | 689d83f | backend/pytest.ini (new) |

## Package Versions Resolved

During `pip install --dry-run`:

| Package | Version | File |
|---------|---------|------|
| resend | 2.29.0 | requirements.txt |
| flask-cors | 6.0.2 | requirements.txt |
| pytest | 9.0.3 | requirements-dev.txt (already installed) |
| pytest-flask | 1.3.0 | requirements-dev.txt |
| responses | 0.26.0 | requirements-dev.txt |

## Final requirements-dev.txt Contents

```
pytest
pytest-flask
responses
```

## Env Vars Added to .env.example

| Var | Default | Required | Purpose |
|-----|---------|----------|---------|
| RESEND_API_KEY | `re_...` | Yes | Resend API key for OTP email delivery |
| RESEND_FROM_EMAIL | `Tampa Code AI <onboarding@resend.dev>` | No (has safe default) | Sender identity; sandbox default only delivers to Resend account holder |
| FRONTEND_ORIGIN | `http://localhost:5173` | No (has default) | CORS allowed origin for Vite dev server |
| OTP_TTL_SEC | `600` | No (optional override) | OTP TTL in seconds; commented out |
| FLASK_ENV | `production` | No (optional override) | Makes session cookie Secure on Render; commented out |

## APP_LOGIN_PASSWORD Disposition

**Commented out** (not deleted) with `DEPRECATED (Phase 2 / D-05)` marker. The active `APP_LOGIN_PASSWORD=change-this-password` line was replaced with a three-line deprecation comment block. Plan 03 removes the `LOGIN_PASSWORD = os.getenv(...)` consumer and the `/login` route — after that, any lingering value in operator `.env` files becomes inert.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The `.env.example` contains only placeholder values (`re_...`, `change-this-secret`) as required by T-02-01 — no real secrets were committed.

## Self-Check: PASSED

| Item | Result |
|------|--------|
| backend/requirements.txt | FOUND |
| backend/requirements-dev.txt | FOUND |
| backend/.env.example | FOUND |
| backend/pytest.ini | FOUND |
| commit bb054b8 (Task 1) | FOUND |
| commit d0cb7cb (Task 2) | FOUND |
| commit b03b207 (Task 3) | FOUND |
| commit 689d83f (Task 4) | FOUND |
