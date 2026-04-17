# Phase 2: Email OTP Authentication - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a complete email OTP authentication system replacing the shared password login. The Flask backend gains two new API endpoints (`/api/auth/request-otp`, `/api/auth/verify-otp`) and a JSON logout endpoint (`/api/auth/logout`). OTP codes are stored in a new SQLite table and validated server-side. All existing protected routes continue using the `session.get("authenticated")` pattern unchanged. Flask-CORS is added to allow the Vite dev server to call the API. The old HTML login route, LOGIN_HTML template, and root `/` route are removed — the backend becomes a pure API server.

No frontend login UI is built in this phase (that is Phase 3). Backend endpoints can be tested via curl/Postman or the React app calling directly.

</domain>

<decisions>
## Implementation Decisions

### OTP Storage
- **D-01:** Pending OTP codes are stored in a new `otp_codes` table in the existing `permitiq.db` SQLite database. Consistent with how `gis_cache` and `audit_log` already work; survives Flask restarts; no new infrastructure.
- **D-02:** Expired OTP rows are cleaned up lazily — at verification time (`/api/auth/verify-otp`), expired rows are swept in the same transaction. No background job or scheduler needed.

### CORS
- **D-03:** Flask-CORS is added in Phase 2 (not deferred to Phase 4). This allows React to call the OTP endpoints from the Vite dev server immediately, enabling end-to-end auth testing during development.
- **D-04:** In Phase 2, the CORS allowed origin is `http://localhost:5173` (Vite default) only. The production Render origin is added in Phase 4 when the URL is known.

### Route Cleanup
- **D-05:** The old `/login` GET/POST route and the `LOGIN_HTML` Python string template are removed entirely in this phase. React owns the login UI from Phase 2 onward.
- **D-06:** The `/logout` GET-redirect route is replaced with a `POST /api/auth/logout` endpoint that clears the session and returns a JSON 200 response. React handles the client-side redirect.
- **D-07:** The root `/` route (which served the main HTML app) is removed. The Flask backend becomes a pure API server. There is no HTML to serve.

### Carried Forward from Phase 1
- **D-08:** Session auth mechanism stays `session["authenticated"] = True` via Flask signed cookie (`FLASK_SECRET_KEY`). No JWT. All existing protected routes keep their `session.get("authenticated")` checks unchanged.

### Claude's Discretion
- OTP table schema: column names, index strategy, whether to store email as-is or hashed — Claude's call as long as the expiry and single-use constraints are met.
- Session cookie flags (`SESSION_COOKIE_HTTPONLY`, `SESSION_COOKIE_SAMESITE`, `SESSION_COOKIE_SECURE`): set appropriately for a React SPA consuming httpOnly cookies — standard secure defaults.
- `flask-cors` package version: use whatever is current and compatible with Flask 3.x.
- Rate limiting on OTP endpoints: add per-IP limits consistent with existing limiter pattern (memory-based, `get_remote_address`) — values at Claude's discretion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Phase 2 requirements: AUTH-01 through AUTH-08

### Roadmap
- `.planning/ROADMAP.md` §Phase 2 — Success criteria (5 items), phase goal

### Prior Context
- `.planning/phases/01-monorepo-restructure-frontend-scaffold/01-CONTEXT.md` — Phase 1 decisions, especially D-09 (Vite proxy target `http://localhost:5000`) and the session cookie auth decision

### Project
- `.planning/PROJECT.md` — Constraints (session cookie not JWT, Resend for email, `resend` Python package required)

No external API specs — Resend API docs are public; researcher should fetch them.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_db()` / `_init_db()` in `backend/code_website.py`: existing SQLite connection helper and table init pattern — the new `otp_codes` table should be added inside `_init_db()` following the same `CREATE TABLE IF NOT EXISTS` pattern.
- `limiter` (Flask-Limiter instance at module level): existing rate limiting setup — OTP endpoints should use `@limiter.limit(...)` decorator consistent with `/ask` and `/address-review` limits.

### Established Patterns
- Auth check: `if not session.get("authenticated"): return jsonify({"error": "Unauthorized"}), 401` — this pattern is on every protected route and must remain unchanged.
- Session set: `session["authenticated"] = True` — set this after successful OTP verification, same as the old password check did.
- Error responses: `jsonify({"error": "...", "detail": "..."})` with appropriate HTTP status codes.
- `os.getenv(...)` for all config — `RESEND_API_KEY` should follow this pattern.

### Integration Points
- `_init_db()` is called at app startup (line ~56 in `code_website.py`) — add `otp_codes` table creation there.
- `backend/requirements.txt` needs `resend` and `flask-cors` added.
- `backend/.env` / `.env.example` needs `RESEND_API_KEY` and `RESEND_FROM_EMAIL` added.

</code_context>

<specifics>
## Specific Ideas

- No specific design references provided — standard OTP flow (request → email → verify).

</specifics>

<deferred>
## Deferred Ideas

- Email allowlist / access control: who can request an OTP was not discussed — per REQUIREMENTS.md v1, any email can request a code. v2 adds multi-email management (AUTH-V2-03). Phase 2 implements open access (no allowlist); planner should note this.
- Rate limiting per email address (AUTH-V2-01) is explicitly a v2 requirement — do not implement in Phase 2.

</deferred>

---

*Phase: 02-email-otp-authentication*
*Context gathered: 2026-04-16*
