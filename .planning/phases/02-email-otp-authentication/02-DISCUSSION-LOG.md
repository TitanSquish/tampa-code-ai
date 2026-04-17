# Phase 2: Email OTP Authentication - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 02-email-otp-authentication
**Areas discussed:** OTP storage backend, CORS timing, Route cleanup

---

## OTP Storage Backend

| Option | Description | Selected |
|--------|-------------|----------|
| SQLite table | New `otp_codes` table in existing `permitiq.db`. Survives restarts, consistent with GIS cache/audit log. | ✓ |
| In-memory dict | Module-level dict keyed by email. Zero setup, codes lost on restart. | |
| Flask session | Store pending code in the session cookie itself. Stateless server-side. | |

**User's choice:** SQLite table

---

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy cleanup | Sweep expired rows at verification time — same transaction as code check. | ✓ |
| On every request-otp | Sweep expired rows whenever a new OTP is requested. | |

**User's choice:** Lazy cleanup

---

## CORS Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 2 | Add Flask-CORS now so React can call OTP endpoints during development. Full auth flow testable end-to-end. | ✓ |
| Phase 4 | Defer to Render deploy phase. Test backend via curl/Postman in Phase 2. | |

**User's choice:** Phase 2

---

| Option | Description | Selected |
|--------|-------------|----------|
| Vite dev origin only | Allow `http://localhost:5173`. Tight, correct for dev. Tighten in Phase 4. | ✓ |
| Env var controlled | Read `CORS_ALLOWED_ORIGIN` from `.env`. More flexible. | |
| Wildcard (*) | Allow all origins — must tighten before Phase 4. | |

**User's choice:** Vite dev origin only (`http://localhost:5173`)

---

## Route Cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Remove /login entirely | Delete route + LOGIN_HTML template. React owns login UI. | ✓ |
| Keep temporarily | Leave old /login intact through Phase 2 as fallback. | |
| Convert to redirect | Have /login return 302 to React app's login URL. | |

**User's choice:** Remove /login entirely

---

| Option | Description | Selected |
|--------|-------------|----------|
| JSON endpoint | POST /api/auth/logout clears session, returns 200 JSON. React handles redirect. | ✓ |
| Keep as redirect | GET /logout redirects to /login. Mixes redirect + SPA navigation. | |

**User's choice:** JSON endpoint (POST /api/auth/logout)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Remove / entirely | Backend becomes pure API server. React Static Site serves the SPA. | ✓ |
| Return health-check JSON | GET / returns {"status": "ok"} for Render health checks. | |
| Keep old HTML temporarily | Leaves existing monolith UI at / until Phase 3. | |

**User's choice:** Remove / entirely

---

## Claude's Discretion

- OTP table schema details (column names, indexing)
- Session cookie security flags (`SESSION_COOKIE_HTTPONLY`, `SESSION_COOKIE_SAMESITE`, `SESSION_COOKIE_SECURE`)
- `flask-cors` package version
- Rate limiting values on OTP endpoints

## Deferred Ideas

- Email allowlist (who can request OTP) — deferred; v1 is open access, v2 adds management (AUTH-V2-03)
- Per-email rate limiting (AUTH-V2-01) — explicitly v2
