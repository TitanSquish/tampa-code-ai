# Phase 2: Email OTP Authentication - Research

**Researched:** 2026-04-16
**Domain:** Flask session auth + email OTP delivery (Resend) + CORS for SPA
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**OTP Storage**
- **D-01:** Pending OTP codes are stored in a new `otp_codes` table in the existing `permitiq.db` SQLite database. Consistent with how `gis_cache` and `audit_log` already work; survives Flask restarts; no new infrastructure.
- **D-02:** Expired OTP rows are cleaned up lazily — at verification time (`/api/auth/verify-otp`), expired rows are swept in the same transaction. No background job or scheduler needed.

**CORS**
- **D-03:** Flask-CORS is added in Phase 2 (not deferred to Phase 4). This allows React to call the OTP endpoints from the Vite dev server immediately, enabling end-to-end auth testing during development.
- **D-04:** In Phase 2, the CORS allowed origin is `http://localhost:5173` (Vite default) only. The production Render origin is added in Phase 4 when the URL is known.

**Route Cleanup**
- **D-05:** The old `/login` GET/POST route and the `LOGIN_HTML` Python string template are removed entirely in this phase. React owns the login UI from Phase 2 onward.
- **D-06:** The `/logout` GET-redirect route is replaced with a `POST /api/auth/logout` endpoint that clears the session and returns a JSON 200 response. React handles the client-side redirect.
- **D-07:** The root `/` route (which served the main HTML app) is removed. The Flask backend becomes a pure API server. There is no HTML to serve.

**Carried Forward from Phase 1**
- **D-08:** Session auth mechanism stays `session["authenticated"] = True` via Flask signed cookie (`FLASK_SECRET_KEY`). No JWT. All existing protected routes keep their `session.get("authenticated")` checks unchanged.

### Claude's Discretion

- OTP table schema: column names, index strategy, whether to store email as-is or hashed — Claude's call as long as the expiry and single-use constraints are met.
- Session cookie flags (`SESSION_COOKIE_HTTPONLY`, `SESSION_COOKIE_SAMESITE`, `SESSION_COOKIE_SECURE`): set appropriately for a React SPA consuming httpOnly cookies — standard secure defaults.
- `flask-cors` package version: use whatever is current and compatible with Flask 3.x.
- Rate limiting on OTP endpoints: add per-IP limits consistent with existing limiter pattern (memory-based, `get_remote_address`) — values at Claude's discretion.

### Deferred Ideas (OUT OF SCOPE)

- **Email allowlist / access control:** who can request an OTP was not discussed — per REQUIREMENTS.md v1, any email can request a code. v2 adds multi-email management (AUTH-V2-03). Phase 2 implements open access (no allowlist); planner should note this.
- **Rate limiting per email address** (AUTH-V2-01) is explicitly a v2 requirement — do not implement in Phase 2.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can enter their email address to request a login OTP code | `POST /api/auth/request-otp` pattern, request-shape + validation — see **Pattern 1: OTP Request Endpoint** |
| AUTH-02 | User receives a 6-digit OTP code via Resend email within 30 seconds | Resend Python SDK 2.29.0, `resend.Emails.send()` — see **Standard Stack → resend** and **Pattern 3: Sending OTP via Resend** |
| AUTH-03 | User can enter the OTP code to authenticate and receive a session cookie | `POST /api/auth/verify-otp` + `hmac.compare_digest` + `session["authenticated"] = True` — see **Pattern 2: OTP Verify Endpoint** |
| AUTH-04 | OTP codes expire after 10 minutes and can only be used once | `otp_codes` table schema with `expires_at` + `used_at` columns + `DELETE ... WHERE expires_at < now` lazy sweep — see **Pattern 4: OTP Storage Schema** |
| AUTH-05 | User session persists across browser refresh (httpOnly cookie) | Flask `session` is already httpOnly by default; `PERMANENT_SESSION_LIFETIME` + `session.permanent = True` — see **Pattern 5: Session Cookie Configuration** |
| AUTH-06 | User can log out, clearing the session | `POST /api/auth/logout` → `session.clear()` → JSON 200 — see **Pattern 6: Logout Endpoint** |
| AUTH-07 | Unauthenticated requests to protected API routes return HTTP 401 | Existing `if not session.get("authenticated")` check pattern already in place on all protected routes — **no new work needed on existing routes**, only removal of redirect fallbacks |
| AUTH-08 | Flask backend exposes `/api/auth/request-otp` and `/api/auth/verify-otp` endpoints | Route registration in `backend/code_website.py` — see **Architecture Patterns** |
</phase_requirements>

## Summary

Phase 2 replaces the single-password login with a standard email-OTP flow. The backend gains three JSON endpoints (`/api/auth/request-otp`, `/api/auth/verify-otp`, `/api/auth/logout`), a new `otp_codes` SQLite table, and Flask-CORS wired for the Vite dev origin. The existing session mechanism (`session["authenticated"] = True` via Flask signed cookie) is preserved verbatim — every downstream route continues to work unchanged. The old HTML `/login`, `/logout`, and `/` routes are deleted; the backend becomes API-only.

The two non-trivial choices are (a) generating the OTP with `secrets.randbelow(1_000_000)` and comparing it with `hmac.compare_digest` to avoid timing attacks, and (b) setting `SESSION_COOKIE_SAMESITE='Lax'` for dev (same-site via Vite proxy) with `SESSION_COOKIE_SECURE=True` in production where Render serves HTTPS. Neither piece is novel — both are stdlib/first-party primitives.

**Primary recommendation:** Add three endpoints, one SQLite table, two packages (`resend==2.29.0`, `flask-cors==6.0.2`), and a small auth helper module (`backend/auth_otp.py`) that owns code generation, storage, verification, and email sending. Keep all existing protected-route decorators untouched; only delete the HTML routes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OTP code generation | API / Backend | — | Must be server-secret; `secrets.randbelow` runs server-side only |
| OTP code storage | Database / Storage | API / Backend | SQLite table is canonical; backend reads/writes |
| OTP email delivery | API / Backend → External (Resend) | — | Only backend holds `RESEND_API_KEY`; client never talks to Resend |
| Session cookie issuance | API / Backend | Browser / Client | Flask signs the cookie; browser stores it (httpOnly, JS cannot read) |
| Session validation | API / Backend | — | Every protected route already performs `session.get("authenticated")` check |
| Unauthenticated request rejection | API / Backend | — | Existing `return jsonify({"error": "Unauthorized"}), 401` pattern |
| CORS preflight + credentialed requests | API / Backend | — | Flask-CORS installed on backend; frontend only sets `credentials: 'include'` |
| Login UI | — | — | **Not in this phase** — Phase 3 (React) owns login UI |

**Why this matters:** All auth logic belongs on the backend. The React app from Phase 3 will only (a) POST JSON to `/api/auth/*` endpoints with `credentials: 'include'` and (b) trust the cookie. No token handling, no localStorage, no client-side session state.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | 2.29.0 | Send OTP code emails via Resend's API | Official first-party SDK from Resend; the project already committed to Resend in PROJECT.md decisions [VERIFIED: pip install --dry-run returned 2.29.0, PyPI release 2026-04-16] |
| `flask-cors` | 6.0.2 | Allow `http://localhost:5173` (Vite) to call Flask with credentials | De-facto Flask CORS extension; works with Flask 3.x [VERIFIED: pip install --dry-run accepted it alongside Flask 3.1.3 and Werkzeug 3.1.8] |

### Supporting (already installed, no install needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `secrets` (stdlib) | Python 3.13 | Generate cryptographically secure OTP codes via `secrets.randbelow(1_000_000)` | **Always** — never use `random.randint` for OTP [CITED: https://docs.python.org/3/library/secrets.html] |
| `hmac` (stdlib) | Python 3.13 | `hmac.compare_digest()` for constant-time OTP comparison | **Always** — plain `==` leaks timing side-channel [CITED: https://docs.python.org/3/library/hmac.html#hmac.compare_digest] |
| `sqlite3` (stdlib) | Python 3.13 | Store pending OTP codes in `permitiq.db` | Per D-01, table lives alongside `gis_cache` |
| `flask` (already present) | 3.1.3 | Session cookie, route handlers, `jsonify` | Already in `backend/requirements.txt` |
| `flask-limiter` (already present) | 4.1.1 | Rate limit `/api/auth/request-otp` and `/api/auth/verify-otp` per IP | Same `@limiter.limit(...)` decorator as `/ask` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `secrets.randbelow(1_000_000)` + `str(n).zfill(6)` | `pyotp` library | `pyotp` is for TOTP/HOTP (time-based or counter-based). For a one-shot email code with server-side storage, it adds a dependency without solving any problem. [ASSUMED — decision based on problem shape, not library comparison] |
| Storing plain code in SQLite | Hashing with SHA-256 before storage | OTPs are short-lived (10 min) and single-use. Hashing defends against DB-dump attackers — worth doing for code hygiene even though risk is low. See **Claude's Discretion** in CONTEXT.md. |
| `resend` SDK | Raw `requests.post` to `api.resend.com/emails` | Would avoid one dependency but lose typed params, exception classes (`ResendError`, `RateLimitError`, etc.), and idiomatic API. The project already requires the `resend` package per PROJECT.md. |
| `flask-cors` | Custom CORS middleware | Hand-rolling CORS is a classic "don't hand-roll" — preflight handling, origin matching, and credential rules are edge-case-heavy. |

**Installation:**
```bash
# Add to backend/requirements.txt, then:
pip install -r backend/requirements.txt
# Effective new installs: resend==2.29.0, flask-cors==6.0.2
```

**Version verification (2026-04-16):**
- `resend` 2.29.0 — published 2026-04-16 [VERIFIED: https://pypi.org/project/resend/]
- `flask-cors` 6.0.2 — published 2025-12-12 [VERIFIED: https://pypi.org/project/flask-cors/]

Pin both or leave unpinned consistent with the project's current `requirements.txt` convention (all deps are unpinned today — see `backend/requirements.txt` lines 1-9). Recommend adding these unpinned to match existing style, but callers should be aware of the specific tested versions above.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────┐
│  React (Vite)   │  user types email → POST /api/auth/request-otp (credentials: include)
│  localhost:5173 │                                                     │
└────────┬────────┘                                                     │
         │ Vite dev proxy OR direct fetch with CORS                     │
         ▼                                                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  Flask backend (backend/code_website.py) @ localhost:5000                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  /api/auth/request-otp                                              │     │
│  │    1. rate-limit (@limiter.limit)                                   │     │
│  │    2. validate email format                                         │     │
│  │    3. generate 6-digit code (secrets.randbelow)                     │     │
│  │    4. hash + store in otp_codes with expires_at = now + 10 min      │     │
│  │    5. send email via resend.Emails.send()                           │     │
│  │    6. return 200 {ok: true}  (never leak whether email existed)     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  /api/auth/verify-otp                                               │     │
│  │    1. rate-limit (@limiter.limit)                                   │     │
│  │    2. sweep expired rows (DELETE WHERE expires_at < now)            │     │
│  │    3. lookup by email, hmac.compare_digest against stored hash      │     │
│  │    4. mark used_at or DELETE row (single-use)                       │     │
│  │    5. set session["authenticated"] = True; session.permanent = True │     │
│  │    6. return 200 {ok: true}                                         │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  /api/auth/logout                                                   │     │
│  │    session.clear() → return 200 {ok: true}                          │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  All other protected routes (unchanged):                            │     │
│  │    /ask, /address-review, /api/*                                    │     │
│  │    Gate: if not session.get("authenticated"): 401                   │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│                        │                                   │                 │
│                        ▼                                   ▼                 │
│        ┌──────────────────────┐             ┌─────────────────────────┐      │
│        │  permitiq.db SQLite  │             │  Resend API             │      │
│        │  • otp_codes (NEW)   │             │  api.resend.com/emails  │      │
│        │  • gis_cache         │             │  (outbound HTTPS)       │      │
│        │  • audit_log         │             └─────────────────────────┘      │
│        │  • feedback_log      │                                              │
│        └──────────────────────┘                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
backend/
├── code_website.py       # existing Flask app — add 3 new routes + CORS init
├── auth_otp.py           # NEW: OTP generation, storage, verification, email send
├── search.py             # unchanged
├── tampa_gis.py          # unchanged
├── ingest.py             # unchanged
├── requirements.txt      # ADD: resend, flask-cors
├── .env                  # ADD: RESEND_API_KEY, RESEND_FROM_EMAIL, FRONTEND_ORIGIN
├── .env.example          # ADD: same keys with empty values
└── permitiq.db           # runtime; _init_db creates otp_codes alongside gis_cache
```

**Why a separate `auth_otp.py` module:** The OTP logic is cohesive and testable in isolation (pure functions for code generation, SQLite helpers for storage, one network call for email). Putting it in its own file keeps `code_website.py` from growing (it's already 1,100+ lines). Flask routes in `code_website.py` orchestrate; `auth_otp.py` holds the primitives.

### Pattern 1: OTP Request Endpoint

**What:** Accept an email, generate a code, store a hash, send the email, return 200.
**When to use:** This is the entry point for AUTH-01/AUTH-02.

```python
# In backend/code_website.py
from auth_otp import generate_and_store_otp, send_otp_email, is_valid_email

@app.route("/api/auth/request-otp", methods=["POST"])
@limiter.limit("5 per minute; 20 per hour")  # per-IP rate limit
def auth_request_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not is_valid_email(email):
        return jsonify({"error": "Valid email required"}), 400
    try:
        code = generate_and_store_otp(email, db_getter=_db)
        send_otp_email(email, code)
    except Exception as e:
        # Do NOT leak internal details — log and return generic success
        app.logger.exception("OTP send failed for %s", email)
        return jsonify({"error": "Could not send code"}), 502
    # Intentionally return 200 even if email doesn't "exist" —
    # Phase 2 has no user-allowlist (see Deferred Ideas AUTH-V2-03)
    return jsonify({"ok": True})
```

**Sources:** Flask-Limiter decorator pattern — already in use on `/ask` at `backend/code_website.py:1712`.

### Pattern 2: OTP Verify Endpoint

```python
# In backend/code_website.py
from auth_otp import verify_and_consume_otp

@app.route("/api/auth/verify-otp", methods=["POST"])
@limiter.limit("10 per minute; 40 per hour")
def auth_verify_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()
    if not email or not code:
        return jsonify({"error": "Email and code required"}), 400
    # verify_and_consume_otp performs lazy sweep of expired rows (D-02),
    # looks up by email, compares with hmac.compare_digest, and
    # deletes the row on success (single-use per AUTH-04)
    ok = verify_and_consume_otp(email, code, db_getter=_db)
    if not ok:
        return jsonify({"error": "Invalid or expired code"}), 401
    session["authenticated"] = True
    session.permanent = True  # honor PERMANENT_SESSION_LIFETIME
    return jsonify({"ok": True})
```

### Pattern 3: Sending OTP via Resend

```python
# In backend/auth_otp.py
import os
import resend
from resend.exceptions import ResendError

resend.api_key = os.getenv("RESEND_API_KEY")  # set once at import

_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "Tampa Code AI <onboarding@resend.dev>")

def send_otp_email(to_email: str, code: str) -> None:
    """Send a 6-digit OTP to to_email. Raises ResendError on failure."""
    params: resend.Emails.SendParams = {
        "from": _FROM_EMAIL,
        "to": [to_email],
        "subject": f"Your Tampa Code AI login code: {code}",
        "html": (
            f"<p>Your one-time login code is:</p>"
            f"<p style='font-size:24px;font-weight:bold;letter-spacing:4px'>{code}</p>"
            f"<p>This code expires in 10 minutes.</p>"
        ),
    }
    # Returns a SendResponse dict with "id" field (verified from SDK source);
    # on failure raises a ResendError subclass (MissingApiKeyError,
    # InvalidApiKeyError, ValidationError, RateLimitError, ApplicationError)
    resend.Emails.send(params)
```

**Sources:**
- Resend Python SDK README — https://github.com/resend/resend-python [VERIFIED: read file contents]
- `SendResponse` TypedDict has `id: str` and optional `http_headers` [VERIFIED: raw.githubusercontent.com/resend/resend-python/main/resend/emails/_emails.py]
- Exception classes (`ResendError` base, `RateLimitError`, `MissingApiKeyError`, `InvalidApiKeyError`, `ValidationError`, `ApplicationError`) [VERIFIED: raw.githubusercontent.com/resend/resend-python/main/resend/exceptions.py]

### Pattern 4: OTP Storage Schema + Helpers

```python
# In backend/auth_otp.py
import hashlib
import hmac
import secrets
import time
from typing import Callable

OTP_TTL_SEC = 600  # 10 minutes per AUTH-04

def _init_otp_table(conn) -> None:
    """Called from _init_db() in code_website.py alongside other tables."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS otp_codes (
            email       TEXT NOT NULL,
            code_hash   TEXT NOT NULL,
            expires_at  REAL NOT NULL,
            created_at  REAL NOT NULL,
            PRIMARY KEY (email)
        )
    """)
    # PRIMARY KEY on email means requesting a new code replaces the old one —
    # correct behavior: if a user requests twice, only the latest code works.

def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()

def generate_and_store_otp(email: str, *, db_getter: Callable) -> str:
    """Generate a 6-digit code, store its hash with 10-min expiry, return plaintext."""
    code = f"{secrets.randbelow(1_000_000):06d}"  # zero-padded 6-digit string
    now = time.time()
    with db_getter() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO otp_codes "
            "(email, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (email, _hash_code(code), now + OTP_TTL_SEC, now),
        )
        conn.commit()
    return code

def verify_and_consume_otp(email: str, code: str, *, db_getter: Callable) -> bool:
    """Return True iff (email, code) matches an unexpired row. Consumes on success.
    Performs lazy sweep of expired rows per D-02."""
    now = time.time()
    with db_getter() as conn:
        # D-02: lazy sweep of expired rows in same transaction
        conn.execute("DELETE FROM otp_codes WHERE expires_at < ?", (now,))
        row = conn.execute(
            "SELECT code_hash FROM otp_codes WHERE email = ?", (email,)
        ).fetchone()
        if not row:
            conn.commit()
            return False
        # hmac.compare_digest for constant-time comparison
        if not hmac.compare_digest(row["code_hash"], _hash_code(code)):
            conn.commit()
            return False
        # Single-use: delete on success
        conn.execute("DELETE FROM otp_codes WHERE email = ?", (email,))
        conn.commit()
    return True
```

**Sources:**
- `secrets.randbelow()` for cryptographically secure randomness [CITED: https://docs.python.org/3/library/secrets.html]
- `hmac.compare_digest()` for timing-safe comparison [CITED: https://docs.python.org/3/library/hmac.html#hmac.compare_digest]
- Storage pattern mirrors existing `gis_cache` in `backend/code_website.py:56-114`

### Pattern 5: Session Cookie Configuration

```python
# In backend/code_website.py, near app = Flask(__name__)
from datetime import timedelta

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "change-this-secret")

# Session cookie hardening (AUTH-05: persist across refresh)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,     # JS cannot read cookie (XSS defense)
    SESSION_COOKIE_SAMESITE="Lax",    # CSRF defense; dev works via Vite proxy (same-site)
    SESSION_COOKIE_SECURE=(os.getenv("FLASK_ENV") == "production"),
    PERMANENT_SESSION_LIFETIME=timedelta(days=7),
)
```

**Why `SESSION_COOKIE_SAMESITE='Lax'`:** In dev, Vite proxies requests so origin is same-site and Lax works. In production (Phase 4), the frontend and backend will be on different Render URLs. If they end up on different eTLD+1 origins (e.g., `tampa-code.onrender.com` vs `tampa-code-api.onrender.com`), the cookie must be `SameSite=None; Secure` to cross origins. **Phase 4 will need to re-evaluate this** — document the deferral here.

**Why `SESSION_COOKIE_SECURE` conditional:** In dev (HTTP localhost) `Secure` cookies are blocked. Tying it to `FLASK_ENV == "production"` is a common pattern.

**Sources:** Miguel Grinberg's cookie security guide; Flask default is httpOnly=True, Lax is the Flask default [CITED: https://blog.miguelgrinberg.com/post/cookie-security-for-flask-applications]

### Pattern 6: Logout Endpoint

```python
@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    session.clear()
    return jsonify({"ok": True})
```

Replaces the existing `/logout` GET-redirect at `backend/code_website.py:1611-1614`. D-06 specifies POST (not GET) so React can trigger it programmatically without a form submission.

### Pattern 7: Flask-CORS Initialization

```python
# In backend/code_website.py, after app = Flask(__name__)
from flask_cors import CORS

_FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
CORS(
    app,
    resources={r"/api/*": {"origins": [_FRONTEND_ORIGIN]},
               r"/ask":   {"origins": [_FRONTEND_ORIGIN]},
               r"/address-review": {"origins": [_FRONTEND_ORIGIN]}},
    supports_credentials=True,  # required for cookie auth across origins
)
```

**Why `supports_credentials=True`:** Without it, browsers strip cookies from cross-origin requests and the session cookie never reaches the backend [CITED: https://flask-cors.readthedocs.io/en/latest/api.html]. The React app MUST send `credentials: 'include'` on every fetch — document this for Phase 3 planning.

**Why per-route `resources` config:** More explicit than a bare `CORS(app)` which would allow any origin by default. Locks down surface area to the three proxied paths.

**Sources:** flask-cors 6.0.2 docs [VERIFIED: https://pypi.org/project/flask-cors/]

### Anti-Patterns to Avoid

- **Don't store OTP plaintext.** Hash with SHA-256 before DB insert. If the DB is dumped, the attacker needs to brute-force 1M possibilities per email — still cheap, but hashing costs us nothing and tightens hygiene.
- **Don't use `==` to compare OTP codes.** Plain equality short-circuits on first byte mismatch, enabling timing attacks. Always `hmac.compare_digest`.
- **Don't leak user enumeration.** `/api/auth/request-otp` returns 200 regardless of whether the email exists (AUTH-V2-03 is deferred). Returning 404 for unknown emails leaks the allowlist.
- **Don't forget to remove `/login` GET/POST and `LOGIN_HTML`.** Per D-05, these are deleted. Leaving them as dead code invites confusion; deleting makes the backend unambiguously an API server.
- **Don't set `SESSION_COOKIE_SAMESITE='Strict'`.** Strict blocks the cookie on top-level navigations from external sites, breaking any link sharing. Lax is the standard SPA default.
- **Don't `CORS(app)` (bare / wildcard).** That accepts all origins and opens CSRF surface. Pin the origin list.
- **Don't mix GET with auth state changes.** The old `/logout` was GET + redirect — convenient for HTML links but wrong for an API. `POST /api/auth/logout` per D-06.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OTP code generation | Custom PRNG with `random.randint` | `secrets.randbelow(1_000_000)` | `random` is seeded predictably and not CSPRNG; secrets is designed for this |
| OTP comparison | `if stored == submitted` | `hmac.compare_digest(stored, submitted)` | Timing-attack resistant |
| CORS headers | Custom `@app.after_request` middleware | `flask-cors` | Preflight, origin matching, credentials, and headers have many edge cases |
| Email sending | `smtplib` + `smtp.resend.com` | `resend` Python SDK | Typed params, exception classes, HTTPS API, retries built-in |
| Session cookie | Custom JWT + manual cookie set | Flask's built-in `session` with signed cookie | Already solved — itsdangerous signing, httpOnly default, battle-tested |
| Email validation | Complex regex | Simple `"@" in email and "." in email.split("@")[1]` + len check | Full RFC 5322 is a rabbit hole; OTP delivery succeeds or fails — the email system is the real validator |
| Rate limiting | Manual in-memory dict | Existing `flask-limiter` decorator | Already instantiated; just add `@limiter.limit(...)` |

**Key insight:** This phase is almost entirely glue code. The stdlib handles randomness and comparison; Flask handles sessions and cookies; Resend handles email; Flask-CORS handles CORS; Flask-Limiter handles throttling. The only code actually written is the orchestration — four endpoints, one table, ~100 lines of auth_otp.py.

## Runtime State Inventory

Phase 2 is additive + removal of specific routes. Audit each category:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `permitiq.db`: `gis_cache`, `audit_log`, `feedback_log` tables are unaffected. NEW: `otp_codes` table created on next startup via updated `_init_db()`. No existing sessions to migrate (Flask sessions are cookie-based, not server-stored). | Add `otp_codes` table creation to `_init_db()`. Existing users with active session cookies will remain authenticated (cookies are signed, not invalidated by backend changes) — this is desired behavior, but note that `FLASK_SECRET_KEY` must not change during deployment or all sessions invalidate. |
| Live service config | None — Phase 2 introduces Resend, but the Resend API key is configured purely via env var, not via any live-service UI that needs rotation. | Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to env setup. |
| OS-registered state | None — no OS-level services register the old `/login` route. Render deployment will be reconfigured in Phase 4. | None. |
| Secrets/env vars | NEW: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `FRONTEND_ORIGIN` must be added to `backend/.env` and `backend/.env.example`. Existing `APP_LOGIN_PASSWORD` env var becomes obsolete (old `/login` route deleted). | Remove `APP_LOGIN_PASSWORD` reference from `code_website.py` (currently line 46). It can stay in `.env` for a release but is dead code after D-05. |
| Build artifacts | None — no compiled artifacts. `permitiq.db` is gitignored and regenerates. FAISS index/chunks are unaffected. | None. |

**Canonical question answered:** After every file is updated, no external runtime state still references the old password flow. The only cached state is user session cookies — and those SHOULD continue working across this change (users stay logged in). If Phase 2 is deployed simultaneously with Phase 1 (monorepo shift), Render will redeploy with fresh process state and `FLASK_SECRET_KEY` may change — note this in deploy sequencing for Phase 4.

## Common Pitfalls

### Pitfall 1: CORS with credentials requires BOTH sides to opt in

**What goes wrong:** Backend sets `supports_credentials=True` but React fetches without `credentials: 'include'`. Cookie is never sent, `/ask` returns 401, user looks "logged out" instantly after OTP verify.

**Why it happens:** CORS with credentials is a two-sided handshake: server sends `Access-Control-Allow-Credentials: true` header, client MUST send `credentials: 'include'` on the fetch. Neither alone is enough.

**How to avoid:** Document in RESEARCH output for Phase 3 that every `fetch()` call must include `credentials: 'include'`. Even in dev, if the React app ever calls `http://localhost:5000/...` directly (bypassing Vite proxy), the credential flag is required.

**Warning signs:** OTP verify returns 200 `{ok: true}` but immediately the next protected call returns 401.

### Pitfall 2: `SameSite=Lax` cookie doesn't cross origins in production

**What goes wrong:** In Phase 4, Render deploys frontend and backend on different subdomains (e.g., `*.onrender.com`). `SameSite=Lax` blocks the session cookie on cross-origin XHR. Users cannot stay authenticated.

**Why it happens:** Lax allows cookies on top-level navigation but not on cross-origin subresource requests. A React app fetching from a different origin is cross-origin even if both are `*.onrender.com`.

**How to avoid:** Plan for Phase 4 to set `SAMESITE=None; Secure` if frontend and backend end up on different origins. Phase 2 uses Lax because dev traffic goes through Vite proxy (same-site) — this is the right choice for Phase 2 but NOT a commitment for Phase 4.

**Warning signs:** Production login succeeds, first protected API call returns 401, browser devtools shows cookie was set but not sent.

### Pitfall 3: Flask's `session.permanent` default is `False`

**What goes wrong:** `SESSION_COOKIE_HTTPONLY` and `PERMANENT_SESSION_LIFETIME` are set correctly, but after closing the browser the session is gone. AUTH-05 fails.

**Why it happens:** Flask sessions without `session.permanent = True` are "browser session cookies" — they expire when the browser process closes, ignoring `PERMANENT_SESSION_LIFETIME`.

**How to avoid:** Set `session.permanent = True` immediately after `session["authenticated"] = True` in `/api/auth/verify-otp`.

**Warning signs:** Refresh works (AUTH-05 half-passes); closing and reopening browser loses session.

### Pitfall 4: Lazy sweep still needs an index on `expires_at` if the table grows

**What goes wrong:** `DELETE FROM otp_codes WHERE expires_at < ?` does a full scan. Low volume (one OTP per login attempt, 10-min TTL) means this never materializes, but it's a latent issue.

**Why it happens:** SQLite doesn't auto-index based on WHERE clauses.

**How to avoid:** For Phase 2's expected volume (<1000 active OTPs), no index is needed. Note for future work: if the table ever grows beyond 10K active rows, add `CREATE INDEX idx_otp_expires ON otp_codes(expires_at)`.

**Warning signs:** Slow verification queries logged by `flask-limiter` or slow request logs. Not expected in Phase 2.

### Pitfall 5: Resend sandbox domain blocks arbitrary recipients

**What goes wrong:** Using `onboarding@resend.dev` as `from`, emails only deliver to `delivered@resend.dev` and the Resend account owner's email. Real user emails get rejected.

**Why it happens:** Resend requires a verified sender domain before it will deliver to arbitrary addresses [CITED: https://resend.com/docs/send-with-python — examples use `onboarding@resend.dev` as the default sandbox sender].

**How to avoid:** Verify a domain in the Resend dashboard (e.g., `mail.tampacodeai.com`) and set `RESEND_FROM_EMAIL=Tampa Code AI <noreply@mail.tampacodeai.com>`. For Phase 2 development, `onboarding@resend.dev` to the project owner's email is sufficient; planner should flag this as a prerequisite for any external-user testing.

**Warning signs:** OTP email never arrives for emails other than the Resend account holder. Resend dashboard shows "delivered" but only to the account-verified inbox.

### Pitfall 6: Deleting `/` route breaks the PDF inline viewer at `/pdf`

**What goes wrong:** The `/pdf` route at `backend/code_website.py:1617-1623` uses `redirect(url_for("login"))` on unauth. D-05 deletes the `login` endpoint. `url_for("login")` now throws `BuildError`.

**Why it happens:** Three routes (`/pdf` line 1620, `/` line 1707) redirect to `login`. When `login` is deleted, these redirects fail at runtime.

**How to avoid:** Either (a) change `/pdf` to return `jsonify({"error": "Unauthorized"}), 401` matching the API pattern, or (b) delete `/pdf` entirely if it's unused by the new React frontend (Phase 3 will decide whether to serve the PDF or link to it). Planner MUST decide — recommend (a) to keep the endpoint as a pure-API 401.

**Warning signs:** After D-05 is executed, hitting `/pdf` without a session returns HTTP 500 with BuildError in logs instead of 401.

### Pitfall 7: `session.clear()` does not force the cookie to be deleted from the browser

**What goes wrong:** Logout clears server-side session data, but the cookie remains in the browser until expiry. This is usually fine, but subtle — the cleared cookie still authenticates nothing because `session.get("authenticated")` returns None from an empty session.

**Why it happens:** Flask sessions are signed cookies; "clearing" sets an empty payload and re-signs. Browser keeps the cookie (with empty payload) until expiry.

**How to avoid:** This is actually correct behavior. Do NOT try to manually expire the cookie — Flask handles it. Just be aware in debugging that a "cookie still exists" is not a logout bug.

**Warning signs:** None — behavior is correct. Mentioned only so debugging doesn't chase a false lead.

## Code Examples

Additional verified patterns:

### Reading Resend API key from env with validation

```python
# In backend/auth_otp.py, module-level
import os
import resend

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY
# If key is None, resend.Emails.send() raises MissingApiKeyError at call time.
# Do not crash at import — allow tests and ingest.py to import without the key.
```

### Test fixture for OTP flow (pytest)

```python
# tests/test_auth_otp.py
import pytest
import time
from auth_otp import generate_and_store_otp, verify_and_consume_otp, OTP_TTL_SEC

def test_otp_roundtrip(tmp_path, monkeypatch):
    import sqlite3
    db_path = str(tmp_path / "test.db")
    def db_getter():
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn
    with db_getter() as c:
        c.execute("""CREATE TABLE otp_codes (email TEXT PRIMARY KEY,
                     code_hash TEXT NOT NULL, expires_at REAL NOT NULL,
                     created_at REAL NOT NULL)""")
        c.commit()
    code = generate_and_store_otp("a@b.com", db_getter=db_getter)
    assert len(code) == 6 and code.isdigit()
    assert verify_and_consume_otp("a@b.com", code, db_getter=db_getter)
    # Single-use: second attempt fails
    assert not verify_and_consume_otp("a@b.com", code, db_getter=db_getter)

def test_otp_expiry(tmp_path):
    # ... generate, manually fast-forward expires_at, assert verify returns False
    pass

def test_otp_wrong_code(tmp_path):
    # ... generate, submit wrong code, assert False and row NOT consumed
    pass
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Shared password + `render_template_string(LOGIN_HTML)` | Per-user email OTP + JSON endpoints | This phase | Backend becomes API-only; login UX moves to React |
| `/logout` GET redirect | `POST /api/auth/logout` returning JSON | This phase (D-06) | Matches SPA conventions; no browser redirect semantics |
| `random.randint` for secrets | `secrets.randbelow` | Python 3.6+ (long standard) | Cryptographically secure |
| `a == b` for credential comparison | `hmac.compare_digest(a, b)` | Long-standing best practice | Timing-attack resistant |

**Deprecated/outdated:**
- `APP_LOGIN_PASSWORD` env var (read at line 46 of `code_website.py`) — becomes dead code after D-05. Can stay in `.env` briefly but remove in cleanup.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.13 | Backend runtime | ✓ | 3.13.3 | — |
| Flask | Existing backend | ✓ | 3.1.3 | — |
| Flask-Limiter | Existing rate limiting | ✓ | 4.1.1 | — |
| `resend` PyPI package | OTP email delivery | ✗ | — | None — must install |
| `flask-cors` PyPI package | SPA cross-origin requests | ✗ | — | None — must install |
| Resend API account + API key | Email delivery | ? (user-managed) | — | Without key, all OTP requests return 502; for Phase 2 dev this can be acceptable if tested by the Resend account owner; tests use mocks |
| Verified sender domain in Resend | External email delivery to arbitrary recipients | ? (user-managed) | — | Use `onboarding@resend.dev` for dev (only delivers to Resend account owner's email); flag as a prerequisite for any external-user testing |
| pytest (for test infrastructure) | Test validation step | ✗ | — | Install via `pip install pytest pytest-flask responses` |

**Missing dependencies with no fallback:**
- `resend` and `flask-cors` Python packages — must be installed; no workaround (pip install handles this, `requirements.txt` update required).

**Missing dependencies with fallback:**
- Verified Resend sender domain — for Phase 2 dev, use sandbox sender `onboarding@resend.dev` (only delivers to Resend account holder's email). **Planner should flag this** as a known limitation; full external delivery requires domain verification that is out of scope for Phase 2.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest + pytest-flask + responses (all three must be installed — none currently present) |
| Config file | None yet (Wave 0 creates `backend/pyproject.toml` or `backend/pytest.ini`) |
| Quick run command | `cd backend && pytest tests/test_auth_otp.py -x` |
| Full suite command | `cd backend && pytest -x` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | `POST /api/auth/request-otp` accepts valid email, returns 200 | integration | `pytest backend/tests/test_routes_auth.py::test_request_otp_ok -x` | ❌ Wave 0 |
| AUTH-01 | Invalid email format returns 400 | integration | `pytest backend/tests/test_routes_auth.py::test_request_otp_invalid_email -x` | ❌ Wave 0 |
| AUTH-02 | Resend called with correct sender/recipient/subject/html | unit w/mock | `pytest backend/tests/test_auth_otp.py::test_send_otp_email_calls_resend -x` | ❌ Wave 0 |
| AUTH-02 | 30-second delivery target | manual-only | N/A — real email delivery from a dev SMTP sandbox is nondeterministic; SLA belongs to Resend. Covered by unit mock that asserts `resend.Emails.send` was called. | N/A |
| AUTH-03 | `POST /api/auth/verify-otp` with correct code sets session | integration | `pytest backend/tests/test_routes_auth.py::test_verify_otp_success -x` | ❌ Wave 0 |
| AUTH-03 | Session cookie is set on response | integration | `pytest backend/tests/test_routes_auth.py::test_verify_otp_sets_cookie -x` | ❌ Wave 0 |
| AUTH-04 | OTP rejected after 10-min expiry | unit | `pytest backend/tests/test_auth_otp.py::test_otp_expiry -x` | ❌ Wave 0 |
| AUTH-04 | OTP is single-use (second attempt fails) | unit | `pytest backend/tests/test_auth_otp.py::test_otp_single_use -x` | ❌ Wave 0 |
| AUTH-04 | Wrong code does not consume the row | unit | `pytest backend/tests/test_auth_otp.py::test_otp_wrong_code -x` | ❌ Wave 0 |
| AUTH-05 | Session cookie is httpOnly and persists | integration | `pytest backend/tests/test_routes_auth.py::test_session_cookie_httponly -x` | ❌ Wave 0 |
| AUTH-06 | `POST /api/auth/logout` clears session | integration | `pytest backend/tests/test_routes_auth.py::test_logout_clears_session -x` | ❌ Wave 0 |
| AUTH-07 | Protected routes return 401 without session | integration | `pytest backend/tests/test_routes_auth.py::test_protected_routes_require_auth -x` | ❌ Wave 0 |
| AUTH-08 | Endpoints exist at `/api/auth/request-otp` and `/api/auth/verify-otp` | integration | Covered by AUTH-01/AUTH-03 route tests | — |
| (ops) | CORS preflight OPTIONS returns correct headers | integration | `pytest backend/tests/test_cors.py::test_preflight_headers -x` | ❌ Wave 0 |
| (ops) | Lazy expiry sweep works | unit | `pytest backend/tests/test_auth_otp.py::test_lazy_sweep_removes_expired -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && pytest backend/tests/test_auth_otp.py -x` (unit-only, <3s)
- **Per wave merge:** `cd backend && pytest -x` (full suite with Flask test client + mocked Resend)
- **Phase gate:** Full suite green + a manual smoke test that actually sends one OTP to the developer's inbox via Resend (validates env + sender domain)

### Wave 0 Gaps

- [ ] `backend/tests/conftest.py` — Flask app fixture, tmp_path SQLite DB fixture, monkeypatched `resend.Emails.send`
- [ ] `backend/tests/test_auth_otp.py` — unit tests for `generate_and_store_otp`, `verify_and_consume_otp`, `_hash_code`, lazy-sweep
- [ ] `backend/tests/test_routes_auth.py` — integration tests for all three new routes using `app.test_client()`
- [ ] `backend/tests/test_cors.py` — CORS preflight smoke test
- [ ] Framework install: add `pytest`, `pytest-flask`, `responses` to a `backend/requirements-dev.txt` (separate from production `requirements.txt`)
- [ ] `backend/pytest.ini` OR `pyproject.toml` section — test discovery roots (`testpaths = tests`)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | YES | OTP via email; 10-min TTL; single-use; rate-limited (V2.2 — throttle auth attempts) |
| V3 Session Management | YES | Flask signed cookie with `HttpOnly`, `Secure` (prod), `SameSite=Lax`; 7-day lifetime |
| V4 Access Control | YES | Every protected route checks `session.get("authenticated")`; 401 on missing |
| V5 Input Validation | YES | Email format validation, OTP length validation, request body size (Flask default) |
| V6 Cryptography | YES | `secrets.randbelow()` for OTP gen, `hmac.compare_digest()` for comparison, SHA-256 for storage hash — all stdlib, no hand-rolling |
| V11 Business Logic | YES | Rate limit prevents OTP-flooding attack on a single email (per-IP; v2 adds per-email) |
| V13 API Security | YES | CORS allowlist (not wildcard); credentials required; no GET for state-changing ops |

### Known Threat Patterns for Flask + SQLite + Resend stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| OTP brute force (guess 6-digit code within 10 min) | Spoofing | Rate limit `/api/auth/verify-otp` to 10/min per IP; 1M search space × 10/min = ~100 years to exhaust (one email has a 1-in-166 chance per minute — acceptable for 10-min window) |
| Timing attack on OTP comparison | Information Disclosure | `hmac.compare_digest` — constant-time |
| Session cookie theft via XSS | Elevation of Privilege | `HttpOnly` flag — JS cannot read the cookie |
| Session cookie theft via network sniff | Information Disclosure | `Secure` flag in production — HTTPS-only transmission |
| CSRF (attacker-site triggers state change on victim's browser) | Tampering | `SameSite=Lax` default; JSON-only POST endpoints (browsers don't send form-encoded CSRF by default for JSON); no GET for state change |
| User enumeration via `/api/auth/request-otp` responses | Information Disclosure | Endpoint returns 200 regardless of email existence (AUTH-V2-03 allowlist deferred) |
| OTP replay | Tampering | Single-use: row deleted on successful verify |
| Email spoofing of sender | Spoofing | Use verified Resend sender domain with SPF/DKIM/DMARC (Resend handles DKIM automatically on verified domains) |
| Rate-limit bypass via IP rotation | Denial of Service (abuse) | Deferred to AUTH-V2-01 (per-email rate limit). Phase 2 accepts per-IP rate limit as sufficient baseline. |
| SQL injection in OTP table queries | Tampering | Parameterized queries throughout (pattern already established in `gis_cache_get`/`set`) |
| Open redirect after logout | Spoofing | D-06 eliminates redirect — logout returns JSON, React handles navigation client-side |

## Project Constraints (from CLAUDE.md)

- **Stack: Backend stays Python/Flask — no rewrite.** Confirmed — this phase is additive Python changes.
- **Streaming: React must handle NDJSON; backend event format unchanged.** No streaming endpoints touched in Phase 2. Unaffected.
- **Compatibility: All existing API routes must keep same paths and response shapes.** Confirmed — only new routes added (`/api/auth/*`). Protected routes keep their 401 response shape `{"error": "Unauthorized"}`.
- **Email: Resend for OTP delivery — must add `resend` Python package to backend.** Confirmed — added to requirements.txt in this phase.
- **Conventions: `snake_case` for modules/functions; private helpers prefixed `_`; route handlers `snake_case` without prefix.** Followed in Pattern examples above (e.g., `auth_request_otp`, `auth_verify_otp`, `_hash_code`, `generate_and_store_otp`).
- **Error handling: Return JSON `{error, detail}` with correct status codes, never raise to callers.** Followed in Pattern 1/2/6.
- **Logging: `logger = logging.getLogger(__name__)` at module level; `logger.exception(...)` for errors.** Applied in Pattern 1 (`app.logger.exception`).
- **Config: `os.getenv(...)` for all config.** Applied for `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `FRONTEND_ORIGIN`.
- **SQL: Parameterized queries, multi-line with explicit `+`.** Applied in Pattern 4 DDL and queries.
- **No custom classes — dicts for data objects.** Applied — OTP row is a dict from `sqlite3.Row`.
- **GSD workflow: Do not edit outside GSD commands.** Researcher writes RESEARCH.md only; planner/executor handles actual implementation.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pyotp` adds dependency without solving the email-OTP problem | Standard Stack → Alternatives | Low — we're choosing stdlib over a lib; if pyotp actually provided value, worst case is slightly more boilerplate than needed |
| A2 | Render-production frontend and backend origins will differ (forcing `SameSite=None`) in Phase 4 | Pattern 5 note, Pitfall 2 | Medium — if Phase 4 uses a single-domain setup (reverse proxy / same origin), `Lax` stays correct. Planner should verify during Phase 4 planning. |
| A3 | OTP code hashing with SHA-256 is acceptable (not bcrypt/argon2) given 10-min TTL and 1M search space | Pattern 4 | Low — the rate-limit on `/api/auth/verify-otp` is the real brute-force defense; hash only guards against DB dump, and single-use + short TTL limits the exposure window |
| A4 | No active users currently have sessions that need migration | Runtime State Inventory | Low — Phase 1 has not deployed yet; current app runs locally only with dev sessions. If Phase 2 ships to a production with active sessions, changing `FLASK_SECRET_KEY` would log everyone out (acceptable given shared-password model is being removed anyway) |
| A5 | Frontend will send `credentials: 'include'` on fetches | Pattern 7 commentary | Medium — this is a Phase 3 contract, not Phase 2. If Phase 3 forgets, auth appears broken. Mentioned as a hand-off note for Phase 3 planning. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.
(Table is not empty — A2 is the most worth flagging to the user before Phase 4 planning.)

## Open Questions

1. **Should `/pdf` be deleted or converted to a JSON 401 endpoint?**
   - What we know: `/pdf` currently uses `redirect(url_for("login"))` on unauth (line 1620). D-05 deletes the `login` endpoint, breaking this redirect.
   - What's unclear: Whether Phase 3's React frontend needs the `/pdf` endpoint. The original app embedded the PDF viewer directly.
   - Recommendation: Planner should either (a) convert `/pdf` to return `jsonify({"error": "Unauthorized"}), 401` on unauth (consistent with other API routes), or (b) defer decision to Phase 3. Recommend (a) — it's a 1-line change and preserves optionality.

2. **Does `ingest.py` need to boot without a RESEND_API_KEY?**
   - What we know: `ingest.py` currently imports from `code_website.py`? (Need to verify — `search.py` is imported at module level in `code_website.py`, but the reverse is unclear).
   - What's unclear: Whether adding `import resend; resend.api_key = os.getenv("RESEND_API_KEY")` at module-level in `auth_otp.py` would break `ingest.py` if Resend's key is missing.
   - Recommendation: The Pattern 3 code uses a conditional `if RESEND_API_KEY: resend.api_key = ...` so the import never fails. This is the defensive choice. Planner should verify ingest.py is unaffected by running it after implementation.

3. **What email `from` address should dev use?**
   - What we know: Resend's sandbox `onboarding@resend.dev` only delivers to the Resend account holder's email.
   - What's unclear: Whether the user has already verified a sender domain in their Resend account.
   - Recommendation: Use `onboarding@resend.dev` in `.env.example`. Planner adds a note to README that full email delivery to arbitrary recipients requires domain verification in Resend dashboard.

4. **Should the OTP table index email as PRIMARY KEY (as recommended) or allow multiple active codes per email?**
   - What we know: Pattern 4 uses `PRIMARY KEY (email)` with `INSERT OR REPLACE`. This means requesting a new code invalidates the previous one — standard UX.
   - What's unclear: Whether the user wants a user-requested-new-code-keeps-old-code-valid model (unusual but possible).
   - Recommendation: Ship with PRIMARY KEY (email). This is the conventional behavior. Per CONTEXT Claude's Discretion.

## Sources

### Primary (HIGH confidence)

- Python docs — `secrets` module: https://docs.python.org/3/library/secrets.html
- Python docs — `hmac.compare_digest`: https://docs.python.org/3/library/hmac.html#hmac.compare_digest
- Resend Python SDK README (GitHub main branch): https://github.com/resend/resend-python [VERIFIED: fetched raw README.md]
- Resend Python SDK exceptions: https://raw.githubusercontent.com/resend/resend-python/main/resend/exceptions.py [VERIFIED]
- Resend Python SDK SendResponse type: https://raw.githubusercontent.com/resend/resend-python/main/resend/emails/_emails.py [VERIFIED]
- Resend API error reference: https://resend.com/docs/api-reference/errors [VERIFIED]
- Resend Python guide: https://resend.com/docs/send-with-python [VERIFIED]
- PyPI `resend` 2.29.0 (published 2026-04-16): https://pypi.org/project/resend/ [VERIFIED]
- PyPI `flask-cors` 6.0.2 (published 2025-12-12): https://pypi.org/project/flask-cors/ [VERIFIED]
- Flask-CORS API reference: https://flask-cors.readthedocs.io/en/latest/api.html [CITED]

### Secondary (MEDIUM confidence)

- Miguel Grinberg — Cookie Security for Flask Applications: https://blog.miguelgrinberg.com/post/cookie-security-for-flask-applications [CITED — well-known Flask author]
- TestDriven.io — Session-based Auth with Flask for SPAs: https://testdriven.io/blog/flask-spa-auth/ [CITED]
- Existing project file `backend/code_website.py` lines 1-130, 1595-1710 [VERIFIED by Read]
- Phase 1 `.planning/phases/01-monorepo-restructure-frontend-scaffold/01-CONTEXT.md` [VERIFIED by Read]

### Tertiary (LOW confidence)

- None — every claim above is anchored to an official source, SDK source code, or existing project file.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via PyPI and `pip install --dry-run` against the local Python 3.13.3 + Flask 3.1.3 environment
- Architecture: HIGH — follows existing project patterns (SQLite via `_db()`, Flask-Limiter, session, `jsonify({"error":...}), 401`) verified by reading `backend/code_website.py`
- Pitfalls: HIGH — all derived from verified official sources (Flask docs, MDN on cookies, Resend docs) or observed in the existing code (the `/pdf` redirect issue in Pitfall 6 was found by grep)
- Security: HIGH — stdlib primitives (`secrets`, `hmac`) and ASVS mapping based on standard threat patterns

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (30 days — stack is stable, no imminent Flask/Resend/Flask-CORS major releases expected)
