# Phase 2: Email OTP Authentication - Pattern Map

**Mapped:** 2026-04-16
**Files analyzed:** 10 (4 created, 4 modified, 2 deleted)
**Analogs found:** 8 / 8 creatable/modifiable files (deletes need no analog)

## File Classification

| New/Modified File | Action | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `backend/auth_otp.py` | CREATE | service/utility module | CRUD (SQLite) + external request-response (Resend) | `backend/tampa_gis.py` (module structure) + `backend/code_website.py` lines 95-113 (cache helpers) | role-match |
| `backend/code_website.py` (routes) | MODIFY | route handler (controller) | request-response (JSON) | `backend/code_website.py:api_feedback` (lines 1676-1701) | exact |
| `backend/code_website.py` (_init_db) | MODIFY | schema/init | one-shot schema DDL | `backend/code_website.py:_init_db` (lines 56-89) | exact (extend existing) |
| `backend/code_website.py` (CORS/config) | MODIFY | config/bootstrap | bootstrap | `backend/code_website.py` lines 37-46 (Flask+Limiter init) | exact (extend existing) |
| `backend/code_website.py` (route removals) | MODIFY | cleanup | N/A | Lines to delete: 1595-1614 (login/logout), 1704-1708 (home), LOGIN_HTML string | N/A — pure deletion |
| `backend/code_website.py` (`/pdf` fix) | MODIFY | route handler | file serve | `backend/code_website.py:serve_pdf` lines 1617-1623 (just swap redirect → jsonify 401) | exact |
| `backend/requirements.txt` | MODIFY | config | — | `backend/requirements.txt` (append unpinned) | exact |
| `backend/.env.example` | MODIFY | config | — | `backend/.env.example` (append new keys) | exact |
| `backend/tests/test_auth_otp.py` | CREATE | test (unit) | pure fn + SQLite fixture | no existing test analog | NO ANALOG (new test infra) |
| `backend/tests/test_routes_auth.py` | CREATE | test (integration) | Flask test client | no existing test analog | NO ANALOG (new test infra) |

---

## Pattern Assignments

### `backend/auth_otp.py` (NEW service/utility module)

**Closest structural analog:** `backend/tampa_gis.py` (external-service helper module with env-driven config + private helpers + pure functions; no custom classes)
**Closest SQLite-helper analog:** `backend/code_website.py` lines 50-113 (`_db`, `_init_db`, `gis_cache_get`, `gis_cache_set`)

**Module docstring + env config pattern** (copy from `backend/tampa_gis.py` lines 1-23):
```python
"""
Email OTP auth helpers (Resend).

Responsibilities:
- Generate cryptographically secure 6-digit codes (secrets.randbelow)
- Store hashed codes in permitiq.db otp_codes table with TTL
- Constant-time verify + single-use consumption (hmac.compare_digest)
- Send codes via Resend API

Config via env vars (see _DEFAULTS below and backend/.env.example).
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
```

**Env-driven config constants** (copy pattern from `backend/tampa_gis.py` lines 25-68):
```python
# --- Config (override with env) ---
OTP_TTL_SEC = int(os.getenv("OTP_TTL_SEC", "600"))  # 10 minutes per AUTH-04
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "Tampa Code AI <onboarding@resend.dev>")

# Defensive: don't crash at import when key is missing (allows ingest.py etc. to import)
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY
```

**Private helper + SQL pattern** (copy from `backend/code_website.py:gis_cache_set` lines 107-113):
```python
def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()

def generate_and_store_otp(email: str, *, db_getter: Callable) -> str:
    """Generate a 6-digit code, store its hash with 10-min expiry, return plaintext."""
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = time.time()
    with db_getter() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO otp_codes "
            "(email, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (email, _hash_code(code), now + OTP_TTL_SEC, now),
        )
        conn.commit()
    return code
```

**Error-swallow + `logger.exception` pattern** (copy from `backend/code_website.py:audit` lines 116-130):
```python
def send_otp_email(to_email: str, code: str) -> None:
    """Send a 6-digit OTP via Resend. Raises on failure; caller logs+wraps."""
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
```

---

### `backend/code_website.py` — NEW route `/api/auth/request-otp` (controller, request-response)

**Closest analog:** `backend/code_website.py:api_feedback` (lines 1676-1701) — a POST JSON endpoint that validates input, writes to SQLite, and returns `{"ok": True}` on success with try/except wrapping.

**Full pattern to copy** (from `backend/code_website.py` lines 1676-1701):
```python
@app.route("/api/feedback", methods=["POST"])
def api_feedback():
    """Store a user-flagged answer in feedback_log."""
    if not session.get("authenticated"):
        return jsonify({"error": "Unauthorized"}), 401
    data = request.get_json(silent=True) or {}
    query_type = (data.get("query_type") or "").strip()
    if not query_type:
        return jsonify({"error": "query_type required"}), 400
    ts = datetime.now(timezone.utc).isoformat()
    try:
        with _db() as conn:
            conn.execute(
                "INSERT INTO feedback_log "
                ...
            )
            conn.commit()
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify({"ok": True})
```

**Rate-limit decorator pattern** (copy from `backend/code_website.py:ask` lines 1711-1713):
```python
@app.route("/ask", methods=["POST"])
@limiter.limit("60 per hour; 10 per minute")
def ask():
    ...
```

**Apply to `/api/auth/request-otp`:** drop the `session.get("authenticated")` gate (this is the pre-auth endpoint), keep the rest of the shape. Use `@limiter.limit("5 per minute; 20 per hour")` per RESEARCH.md Pattern 1.

**Error response shape** (established throughout `code_website.py`): `jsonify({"error": "...", "detail": "..."}), 4xx`. Examples at lines 1637, 1670, 1700.

---

### `backend/code_website.py` — NEW route `/api/auth/verify-otp` (controller, request-response)

**Closest analog:** Same as above — `api_feedback` for overall structure; add `session["authenticated"] = True` after successful verification (the exact line currently set by `login()` at `backend/code_website.py:1604`).

**Session-set pattern** (copy verbatim from `login()` line 1604):
```python
session["authenticated"] = True
```

Per RESEARCH Pattern 2, also add `session.permanent = True` immediately after (AUTH-05 requires this; see Pitfall 3 in RESEARCH.md).

**Full shape (from RESEARCH.md Pattern 2, combining `api_feedback` error handling + `login()` session setting):**
```python
@app.route("/api/auth/verify-otp", methods=["POST"])
@limiter.limit("10 per minute; 40 per hour")
def auth_verify_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()
    if not email or not code:
        return jsonify({"error": "Email and code required"}), 400
    ok = verify_and_consume_otp(email, code, db_getter=_db)
    if not ok:
        return jsonify({"error": "Invalid or expired code"}), 401
    session["authenticated"] = True
    session.permanent = True
    return jsonify({"ok": True})
```

---

### `backend/code_website.py` — NEW route `/api/auth/logout` (controller, request-response)

**Closest analog:** Existing `logout()` at `backend/code_website.py:1611-1614` — same body (`session.clear()`), but return JSON instead of redirect. This route REPLACES the existing one per D-06.

**Current code to transform** (`backend/code_website.py:1611-1614`):
```python
@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))
```

**Transformed pattern:**
```python
@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    session.clear()
    return jsonify({"ok": True})
```

---

### `backend/code_website.py` — MODIFY `_init_db()` to add `otp_codes` table

**Closest analog:** `backend/code_website.py:_init_db` lines 56-89 — existing `CREATE TABLE IF NOT EXISTS` pattern.

**Exact pattern to extend** (copy from `backend/code_website.py` lines 56-64, the `gis_cache` stanza):
```python
def _init_db() -> None:
    with _db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS gis_cache (
                cache_key  TEXT PRIMARY KEY,
                data       TEXT NOT NULL,
                created_at REAL NOT NULL
            )
        """)
        # ... other existing tables ...
```

**Add this stanza (in the same style):**
```python
conn.execute("""
    CREATE TABLE IF NOT EXISTS otp_codes (
        email       TEXT PRIMARY KEY,
        code_hash   TEXT NOT NULL,
        expires_at  REAL NOT NULL,
        created_at  REAL NOT NULL
    )
""")
```

**Placement:** Inside `_init_db()` before the final `conn.commit()` at line 89, alongside the other `CREATE TABLE IF NOT EXISTS` calls. Indentation: 12 spaces inside the triple-quoted string per existing style.

---

### `backend/code_website.py` — MODIFY bootstrap (add CORS + session cookie hardening)

**Closest analog:** `backend/code_website.py` lines 37-46 — existing Flask app + Limiter init block.

**Current bootstrap block (lines 36-46):**
```python
# ── Flask app + limiter ───────────────────────────────────────────────────────
app = Flask(__name__)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],
    storage_uri="memory://",
)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "change-this-secret")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
LOGIN_PASSWORD = os.getenv("APP_LOGIN_PASSWORD", "test123")  # DELETE per D-05
```

**Section comment style to copy** (from `backend/code_website.py:36, 49, 17, 22`): `# ── Section Name ──────────────────────`.

**Additions (RESEARCH.md Patterns 5 & 7, inline-commented like the existing constants at lines 22-34):**
```python
# ── Session cookie hardening (AUTH-05) ───────────────────────────────────────
from datetime import timedelta
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=(os.getenv("FLASK_ENV") == "production"),
    PERMANENT_SESSION_LIFETIME=timedelta(days=7),
)

# ── CORS (Vite dev origin; production origin added in Phase 4 per D-04) ──────
from flask_cors import CORS
_FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
CORS(
    app,
    resources={
        r"/api/*":           {"origins": [_FRONTEND_ORIGIN]},
        r"/ask":             {"origins": [_FRONTEND_ORIGIN]},
        r"/address-review":  {"origins": [_FRONTEND_ORIGIN]},
    },
    supports_credentials=True,
)
```

**Env constant naming convention** (copy from `backend/code_website.py` line 23-34): `UPPER_SNAKE_CASE` for module-level, `_UPPER_SNAKE_CASE` for private. `_FRONTEND_ORIGIN` follows the latter (private; only used inside CORS init).

---

### `backend/code_website.py` — MODIFY `/pdf` route (fix broken `url_for("login")` redirect per Pitfall 6)

**Closest analog:** `backend/code_website.py:api_address_suggest` lines 1626-1637 — existing API route that returns `jsonify({"error": "Unauthorized"}), 401` instead of redirecting.

**Current code (`backend/code_website.py` lines 1617-1623):**
```python
@app.route("/pdf")
def serve_pdf():
    if not session.get("authenticated"):
        return redirect(url_for("login"))  # BREAKS after D-05 deletes login endpoint
    if not os.path.exists(PDF_PATH):
        return "PDF not found", 404
    return send_file(PDF_PATH, mimetype="application/pdf", as_attachment=False)
```

**Transformed (swap redirect for JSON 401, matching `api_address_suggest` line 1630):**
```python
@app.route("/pdf")
def serve_pdf():
    if not session.get("authenticated"):
        return jsonify({"error": "Unauthorized"}), 401
    if not os.path.exists(PDF_PATH):
        return jsonify({"error": "PDF not found"}), 404
    return send_file(PDF_PATH, mimetype="application/pdf", as_attachment=False)
```

---

### `backend/code_website.py` — DELETIONS (per D-05, D-07)

Pure removals — no analog needed. Specific lines to delete:
- Lines 1595-1608: `@app.route("/login", methods=["GET", "POST"])` def `login()`
- Lines 1611-1614: `@app.route("/logout")` def `logout()` (replaced by POST JSON variant elsewhere)
- Lines 1704-1708: `@app.route("/", methods=["GET"])` def `home()`
- Line 46: `LOGIN_PASSWORD = os.getenv("APP_LOGIN_PASSWORD", "test123")`
- The `LOGIN_HTML` string constant (large inline HTML block — locate via `Grep "LOGIN_HTML ="` before deletion)
- The `HTML` string constant backing `home()` IF no other route references it (verify via grep before deleting; Phase 3 frontend replaces it)
- Import cleanup: drop `render_template_string`, `redirect`, `url_for` from the top-level Flask import at line 1 IF grep confirms no remaining references after the deletions above.

---

### `backend/requirements.txt` — MODIFY (append 2 packages)

**Current contents** (`backend/requirements.txt`):
```
flask
flask-limiter
requests
openai
python-dotenv
faiss-cpu
pymupdf
numpy
gunicorn
```

**Convention:** All deps are unpinned, one per line, no comments. Append `resend` and `flask-cors` at the end of the list in the same unpinned style. Do NOT introduce version pins — inconsistent with project convention.

---

### `backend/.env.example` — MODIFY (append new keys + remove/annotate stale)

**Closest analog:** `backend/.env.example` itself — section-header comment style is already established.

**Style to match** (lines 5-6, 8-10, 12-13):
```
# Description of the var, noting required/optional
VAR_NAME=placeholder-or-default
```

**Additions to append:**
```
# Resend API key (required — get from https://resend.com/api-keys)
RESEND_API_KEY=re_...

# Sender identity for OTP emails. Use onboarding@resend.dev in dev
# (only delivers to the Resend account holder's inbox) until a domain is verified.
RESEND_FROM_EMAIL=Tampa Code AI <onboarding@resend.dev>

# CORS allowed origin for the Vite dev server (required for Phase 2 dev;
# production origin is added in Phase 4 once the Render URL is known)
FRONTEND_ORIGIN=http://localhost:5173

# OTP code TTL in seconds (optional — default 600 = 10 minutes)
# OTP_TTL_SEC=600

# Flask env flag — set to "production" in Render so session cookie becomes Secure
# FLASK_ENV=production
```

**Stale-key treatment (per RESEARCH Runtime State Inventory):** `APP_LOGIN_PASSWORD` (line 12-13) can remain temporarily but should get a `# DEPRECATED (Phase 2): replaced by email OTP — safe to remove` comment above it. Planner decides whether to delete outright or deprecate; lean toward deletion since D-05 deletes the consumer.

---

### `backend/tests/test_auth_otp.py` (NEW unit tests) — NO ANALOG

No test files exist in the project today. Use RESEARCH.md "Code Examples → Test fixture for OTP flow (pytest)" as the authoritative template. Planner should create `backend/tests/__init__.py` (empty) and `backend/tests/conftest.py` alongside.

---

### `backend/tests/test_routes_auth.py` (NEW integration tests) — NO ANALOG

No Flask integration test exists. Use RESEARCH.md "Validation Architecture → Phase Requirements → Test Map" for the test case list. `app.test_client()` is the standard Flask pattern; pytest-flask provides fixtures. Planner should add `pytest`, `pytest-flask`, and `responses` to a new `backend/requirements-dev.txt`.

---

## Shared Patterns

### Auth gate (unauthenticated request rejection)
**Source:** `backend/code_website.py:api_address_suggest` line 1630 (also lines 1644, 1679, 1714, 1757)
**Apply to:** Every protected route — LEAVE UNCHANGED per D-08. Only new thing: the pre-auth routes (`/api/auth/request-otp`, `/api/auth/verify-otp`) OMIT this gate.
```python
if not session.get("authenticated"):
    return jsonify({"error": "Unauthorized"}), 401
```

### Rate limiting
**Source:** `backend/code_website.py:ask` line 1712 and `address_review` line 1755
**Apply to:** Both new `/api/auth/*` endpoints
```python
@limiter.limit("60 per hour; 10 per minute")  # example — OTP values are at Claude's discretion per CONTEXT
```

### Error response shape
**Source:** `backend/code_website.py` lines 1637, 1670, 1700 (three examples of the same pattern)
**Apply to:** All new routes + the `/pdf` fix
```python
return jsonify({"error": "<user-facing msg>", "detail": str(e)}), <status>
# or, for cases without a detail:
return jsonify({"error": "<user-facing msg>"}), <status>
```

### SQLite access (connection + row_factory)
**Source:** `backend/code_website.py:_db` lines 50-53
**Apply to:** Every SQLite call in `auth_otp.py` (via the injected `db_getter` parameter — auth_otp does not import `_db` directly; `code_website.py` passes it in for testability)
```python
def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
```

### SQL write idiom (INSERT OR REPLACE, parameterized)
**Source:** `backend/code_website.py:gis_cache_set` lines 107-113
**Apply to:** `generate_and_store_otp` in `auth_otp.py`
```python
with _db() as conn:
    conn.execute(
        "INSERT OR REPLACE INTO gis_cache (cache_key, data, created_at) VALUES (?, ?, ?)",
        (key, json.dumps(data), time.time()),
    )
    conn.commit()
```

### Env-var config with default (no crash on missing key)
**Source:** Used throughout — e.g., `backend/code_website.py` lines 20, 23-34, 44
**Apply to:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `FRONTEND_ORIGIN`, `OTP_TTL_SEC`
```python
DB_PATH   = os.getenv("DB_PATH", os.path.join(_BASE, "permitiq.db"))
SEARCH_K  = int(os.getenv("SEARCH_K", "10"))
```

### Logging (module-level, `logger.exception` for errors)
**Source:** `backend/tampa_gis.py` line 23 (declaration); also referenced in CLAUDE.md conventions
**Apply to:** `backend/auth_otp.py` — declare `logger = logging.getLogger(__name__)` at module top. Route handlers in `code_website.py` use `app.logger.exception(...)` (e.g., RESEARCH.md Pattern 1).
```python
logger = logging.getLogger(__name__)
# at point of failure:
logger.exception("OTP send failed for %s", email)
```

### Section-separator comments
**Source:** `backend/code_website.py` lines 17, 22, 36, 49 — `# ── Name ───────────────`
**Apply to:** Every new block added to `code_website.py` (CORS init, session config, OTP routes)
```python
# ── Auth: email OTP endpoints ────────────────────────────────────────────────
```

### Input validation pattern (reject with 400)
**Source:** `backend/code_website.py:_check_guardrails` lines 227-258 (full-featured) + `api_feedback` lines 1683-1684 (simple "required field" check)
**Apply to:** `/api/auth/request-otp` (email format validation — use the simple style, NOT the full injection-detection regex; email is a short structured field). `/api/auth/verify-otp` for "email and code required" check.
```python
# Simple required-field style (from api_feedback line 1683):
if not query_type:
    return jsonify({"error": "query_type required"}), 400
```

### Deferred route-handler docstring policy
**Source:** CLAUDE.md convention — "`code_website.py`: docstrings on helper functions only (not on Flask route handlers)."
**Apply to:** All three new `/api/auth/*` handlers — NO docstring. Helper functions in `auth_otp.py` DO get docstrings (matches `tampa_gis.py` style).

---

## No Analog Found

| File | Role | Data Flow | Reason | Planner Guidance |
|------|------|-----------|--------|------------------|
| `backend/tests/test_auth_otp.py` | unit test | pytest + tmp SQLite | No test infrastructure exists in the project yet | Use RESEARCH.md "Code Examples → Test fixture for OTP flow (pytest)" as the template; create `backend/tests/__init__.py` and `backend/tests/conftest.py` alongside |
| `backend/tests/test_routes_auth.py` | integration test | Flask test client | Same — no existing test harness | Use RESEARCH.md "Validation Architecture → Phase Requirements → Test Map" for the required test cases; `app.test_client()` is the Flask-builtin entry point |
| `backend/tests/conftest.py` | pytest fixtures | fixture setup | No existing conftest | Build fixtures for (a) Flask test app with tmp SQLite path injected via `DB_PATH` env var, (b) a `responses`-or-`monkeypatch`-mocked `resend.Emails.send`, (c) authenticated + unauthenticated client variants |
| `backend/requirements-dev.txt` | config | — | Project has no dev-vs-prod split in requirements today | Simple append-only text file; list `pytest`, `pytest-flask`, `responses` unpinned, same convention as `requirements.txt` |

---

## Metadata

**Analog search scope:**
- `backend/code_website.py` (1800 LOC; read lines 1-150, 220-258, 1580-1779; grepped all route definitions)
- `backend/tampa_gis.py` (read lines 1-80 for module structure)
- `backend/search.py` (read lines 1-30 for import/env pattern)
- `backend/requirements.txt` (read in full)
- `backend/.env.example` (read in full)

**Files scanned:** 5 Python source files + 2 config files in `backend/` (the active monorepo location — worktree copies ignored)

**Pattern extraction date:** 2026-04-16

**Conventions cross-checked against CLAUDE.md:**
- `snake_case` for modules/functions — all examples comply
- Private helpers `_prefix` — `_hash_code`, `_FRONTEND_ORIGIN` comply
- Route handlers `snake_case` no prefix — `auth_request_otp`, `auth_verify_otp`, `auth_logout` comply
- No custom classes — all data is dicts, all OTP storage uses `sqlite3.Row` dicts (verified compliant)
- Error returns structured dicts, never raise to caller — all patterns use `jsonify({"error": ...}), <code>`
- `os.getenv(...)` for all config — every new constant follows this
- Parameterized SQL, multi-line with explicit concatenation — complies (matches `gis_cache_set` style)
- Module docstring on `auth_otp.py` — complies (matches `tampa_gis.py` style)
- No route-handler docstrings — complies
