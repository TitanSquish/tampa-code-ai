# Codebase Concerns

**Analysis Date:** 2026-04-16

---

## Security Considerations

**Hardcoded Insecure Defaults — Credentials:**
- Risk: Application ships with `"test123"` as the default login password and `"change-this-secret"` as the Flask secret key. If environment variables are not set in production these defaults are live.
- Files: `code_website.py` lines 44, 46
- Current mitigation: Values are overridable via `FLASK_SECRET_KEY` and `APP_LOGIN_PASSWORD` env vars, but there is no startup assertion or warning if defaults are used.
- Recommendations: Add a startup check (e.g., `if app.secret_key == "change-this-secret": raise RuntimeError(...)`) that refuses to boot with default credentials. Alternatively enforce via Pydantic settings with `required=True`.

**Login Route Has No Rate Limiting:**
- Risk: The `/login` POST route has no `@limiter.limit(...)` decorator, leaving it open to brute-force password attempts. The `Limiter` instance has `default_limits=[]`, so no global fallback applies.
- Files: `code_website.py` line 1595 (`@app.route("/login", ...)`) — no limiter decorator present
- Current mitigation: None.
- Recommendations: Add `@limiter.limit("10 per minute; 50 per hour")` to the login route.

**Rate Limiter Uses In-Process Memory Storage:**
- Risk: `storage_uri="memory://"` means rate limit counters reset on every Gunicorn worker restart and are not shared across processes. With `--workers 1 --threads 4` (Procfile) this is tolerable today, but any future scale-out silently breaks rate limiting entirely.
- Files: `code_website.py` lines 38–43
- Current mitigation: Single-worker deployment limits blast radius.
- Recommendations: Switch to Redis storage (`storage_uri="redis://..."`) when scaling beyond one worker.

**No CSRF Protection on State-Changing POST Routes:**
- Risk: `/ask`, `/address-review`, `/api/feedback`, and `/api/property-context` are all JSON POST endpoints with no CSRF tokens. Session cookies are not marked `SameSite=Strict` or `Secure` in code.
- Files: `code_website.py` — all `@app.route` POST handlers
- Current mitigation: The fetch calls send `Content-Type: application/json`, which browsers will not send cross-origin without a preflight, providing limited protection.
- Recommendations: Add `flask-wtf` CSRF, or set `SESSION_COOKIE_SAMESITE = "Strict"` and `SESSION_COOKIE_SECURE = True` in Flask config.

**No Security Headers Configured:**
- Risk: The Flask app emits no `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, or `Strict-Transport-Security` headers.
- Files: `code_website.py` — Flask app init block
- Current mitigation: None.
- Recommendations: Add `flask-talisman` or manually set headers via `@app.after_request`.

**XSS Risk in `linkifyPageNumbers` Function:**
- Risk: The `linkifyPageNumbers` function escapes the source text but then builds an HTML string via string concatenation and assigns it to `container.innerHTML`. If the AI model ever produces a string matching the `page \d+` regex where the surrounding text is not properly escaped, XSS could occur. The escaping currently applied loses structure when combining `escapeHtml(container.textContent)` with a regex replacement injecting raw HTML.
- Files: `code_website.py` lines 1157–1167
- Current mitigation: Text is first passed through `escapeHtml`, but the replacement injects an unescaped `<span>` tag.
- Recommendations: Use `textContent` assignments + DOM manipulation rather than `innerHTML` string building for page number links.

---

## Tech Debt

**Massive Single-File Flask Application:**
- Issue: All routes, HTML templates, JavaScript, CSS, database helpers, prompt builders, and business logic are packed into a single 1,878-line file.
- Files: `code_website.py`
- Impact: Difficult to test individual components, navigate, or refactor. PRs touching the file will always conflict.
- Fix approach: Split into modules — `routes/ask.py`, `routes/address.py`, `db.py`, `prompts.py`, `templates/` (Jinja2 files), with `app.py` as a slim entry point.

**HTML/CSS/JS Embedded as Python String Literals:**
- Issue: Both `LOGIN_HTML` and `HTML` (1,100+ lines of frontend code) are Python string literals inside `code_website.py`. Template variables like `{{ url_for('logout') }}` are mixed into a raw string, making editor syntax highlighting, linting, and frontend tooling impossible.
- Files: `code_website.py` lines 417–1592
- Impact: Any frontend change requires navigating a Python file. JavaScript bugs are invisible to JS linters. CSS is un-minifiable.
- Fix approach: Move to `templates/` directory using Jinja2 `render_template()` instead of `render_template_string()`.

**Hardcoded Relative Paths for FAISS Index and Chunks File:**
- Issue: `search.py` uses bare relative paths `"tampa_code.index"` and `"chunks.json"` that resolve from the process working directory. `ingest.py` does the same.
- Files: `search.py` lines 13–14, `ingest.py` lines 19–20
- Impact: Running either script from any directory other than the project root will silently fail or load wrong data. `code_website.py` does use `os.path.dirname(__file__)` for `DB_PATH` and `PDF_PATH`, but the search module is inconsistent.
- Fix approach: Use `os.path.join(os.path.dirname(__file__), "tampa_code.index")` in `search.py` and `ingest.py`, mirroring the approach in `code_website.py`.

**`MULTI_QUERY_K` Is a Magic Constant, Not Configurable:**
- Issue: `MULTI_QUERY_K = 5` is hardcoded as a module-level comment-annotated constant in `code_website.py` but is not exposed as an env var, unlike `MULTI_QUERY_N` and `SEARCH_K`.
- Files: `code_website.py` line 31
- Impact: Tuning retrieval depth requires a code change and redeploy.
- Fix approach: Add `MULTI_QUERY_K = int(os.getenv("MULTI_QUERY_K", "5"))` alongside the existing env config block.

**Duplicate Address Candidate Fetch (Two SR Projections):**
- Issue: `get_tampa_property_context` calls `_find_address_candidates_2237` AND `_find_address_candidates` (SR 3857) in sequence for the same address string + magic key — two identical ArcGIS geocode requests differing only in output spatial reference.
- Files: `tampa_gis.py` lines 364–366
- Impact: Double the geocode API latency and network cost on every non-cached address lookup.
- Fix approach: Fetch candidates once in 3857, then use the Esri geometry project service (already implemented as `_project_point_to_2237`) to convert the single result, eliminating the second round trip.

**`future_land_use` Field Always Returns `None`:**
- Issue: The `get_tampa_property_context` return dict includes `"future_land_use": None` in every code path. The field is declared in the docstring as a returned key but is never populated.
- Files: `tampa_gis.py` lines 342, 405, 440
- Impact: API consumers and prompt builders receive a placeholder that looks like a real value. The `build_address_prompt` function does not include it in the search query either.
- Fix approach: Either implement a Future Land Use GIS layer query, or remove the field from the response schema and docstring to avoid confusion.

**`data/parse_tampa_docs.py` Is an Orphan Script:**
- Issue: `data/parse_tampa_docs.py` produces `parsed_chunks.json` and `parsed_chunks.jsonl` but neither file is consumed by `ingest.py`, `search.py`, or `code_website.py`. The outputs reference a `tampa-code.pdf` filename that does not match any file in the `data/` directory.
- Files: `data/parse_tampa_docs.py`, `data/parsed_chunks.json`, `data/parsed_chunks.jsonl`
- Impact: Stale tooling adds noise, the outputs are committed even though `.gitignore` lists them (they were committed before the ignore rule was added), and it is unclear whether this was a predecessor to `ingest.py`.
- Fix approach: Delete `data/parse_tampa_docs.py` and the two output files, or document explicitly that it is an experimental script.

---

## Performance Bottlenecks

**Each `/ask` Request Makes 1 + N OpenAI API Calls Before Streaming:**
- Problem: When `MULTI_QUERY_ENABLED=true` (default), every search request calls `expand_query()` which makes a synchronous `client.responses.create()` call to `gpt-4o-mini`, then fans out to FAISS `N+1` times, before the streaming answer call begins. With `MULTI_QUERY_N=3` the user waits for 1 expansion call + FAISS lookups before seeing any text stream.
- Files: `code_website.py` lines 283–290 (`build_prompt`), lines 205–224 (`expand_query`)
- Cause: `expand_query` is fully synchronous and blocking. Flask runs in a thread pool, but each request thread blocks on the OpenAI call before the generator yields anything.
- Improvement path: Cache expansion queries by their base query hash. Alternatively, run expansion and streaming concurrently using asyncio, or use background threads with a queue to start streaming the base-query result immediately while expansions complete.

**GIS Cache Never Evicts Stale Entries:**
- Problem: `gis_cache_get` checks TTL on read (returns `None` if expired) but never deletes the old row. `gis_cache_set` uses `INSERT OR REPLACE`, which overwrites on cache hits. However, addresses that are looked up once and never again leave permanently stale rows in the database.
- Files: `code_website.py` lines 95–113
- Cause: No periodic cleanup or `DELETE FROM gis_cache WHERE created_at < ?` query exists anywhere in the codebase.
- Improvement path: Add a background cleanup on app startup, or a periodic SQLite `DELETE` triggered inside `_init_db()` or via a scheduled endpoint.

**FAISS Brute-Force Linear Scan Index:**
- Problem: `ingest.py` builds a `faiss.IndexFlatL2` which performs exact nearest-neighbor search via a full linear scan over all vectors. This is fine for the current corpus size but scales at O(n) per query.
- Files: `ingest.py` line 150
- Cause: Simple initial implementation was never upgraded.
- Improvement path: For larger corpora switch to `IndexIVFFlat` (inverted file index) or `IndexHNSWFlat` for sub-linear approximate search.

**Address Review Makes 3 Sequential External API Calls Per Request (Uncached Path):**
- Problem: On a cache miss, `get_tampa_property_context` calls: (1) `_find_address_candidates_2237`, (2) `_find_address_candidates` (3857), (3) `_project_point_to_2237`, (4) `is_inside_tampa_city_limits`, (5) `get_zoning_for_point`, (6) `get_overlays_for_point`, (7) `_folio_from_parcel_envelope` — seven sequential external HTTPS requests each with a 25-second timeout.
- Files: `tampa_gis.py` lines 349–435
- Cause: Each GIS query is a separate REST call; none are parallelized.
- Improvement path: Calls 4–7 (city limits, zoning, overlays, folio) do not depend on each other and can be issued concurrently with `concurrent.futures.ThreadPoolExecutor` or `asyncio.gather`.

---

## Fragile Areas

**`search.py` Loads Index and Chunks at Module Import Time:**
- Files: `search.py` lines 18–22
- Why fragile: If `tampa_code.index` or `chunks.json` is missing at process start (e.g., after a fresh deploy before `ingest.py` is run), the entire Flask application crashes on import with an unhandled exception, taking down all routes — not just the search endpoint.
- Safe modification: Wrap the module-level loads in a try/except and raise a descriptive `RuntimeError`, or lazy-load on first request with a clear error response.
- Test coverage: No test exercises the missing-index failure path.

**`expand_query` JSON Parsing Is Fragile:**
- Files: `code_website.py` lines 218–220
- Why fragile: The function finds the first `[` and last `]` in the model response and attempts `json.loads` on the slice. If the model returns a JSON object with nested arrays (e.g., explanatory JSON), the slice will be wrong or include trailing text and silently return `[]` (falling back to base-query-only search).
- Safe modification: Use `response_format={"type": "json_object"}` in the API call to force structured output, then access a known key. Alternatively parse only the outermost array with stricter validation.
- Test coverage: None.

**`parse_requirements` Falls Back to Regex on JSON Parse Failure With No Warning:**
- Files: `code_website.py` lines 372–414
- Why fragile: The primary JSON path silently falls through to a regex dash-list parser if any parsing exception occurs. If the model returns malformed JSON due to a streaming truncation or model error, requirements are silently extracted via regex (or return an empty list) with no signal to the caller or audit log.
- Safe modification: Log a warning when JSON parse fails and the regex fallback is used, so failures are visible in the audit log.
- Test coverage: None.

**GIS `_folio_from_parcel_envelope` Uses a 40-Meter Fixed Bounding Box Fallback:**
- Files: `tampa_gis.py` lines 423–430
- Why fragile: When `x`/`y` coordinates are provided directly (without an address candidate extent), a hardcoded `dx = 40.0` meter bounding box is used to find the parcel. For large commercial parcels or addresses near parcel boundaries this can match the wrong parcel.
- Safe modification: Accept a configurable `dx` or derive it from property type context.
- Test coverage: None.

---

## Test Coverage Gaps

**Zero Automated Tests Exist:**
- What's not tested: The entire codebase has no test files. No `pytest`, `unittest`, or `conftest.py` files exist anywhere in the project.
- Files: All of `code_website.py`, `search.py`, `tampa_gis.py`, `ingest.py`
- Risk: Regressions in prompt construction, GIS parsing, requirements parsing, rate limiting, authentication, caching, and input guardrails are completely undetectable without manual QA.
- Priority: High

**Critical Untested Logic:**
- `_check_guardrails`: prompt-injection regex patterns are untested — a bad pattern could silently pass injections or over-block legitimate questions.
- `parse_requirements`: JSON → regex fallback logic is untested. A model format change would silently degrade output with no test catching it.
- `build_address_query`: keyword expansion logic is untested. Adding or removing a keyword could break retrieval with no safety net.
- `is_inside_tampa_city_limits`, `get_zoning_for_point`, `get_overlays_for_point`: all hit live external GIS APIs with no mock/stub, making them untestable in CI without VCR-style cassettes.
- Files: `code_website.py`, `tampa_gis.py`
- Priority: High

---

## Dependencies at Risk

**No Dependency Versions Pinned:**
- Risk: `requirements.txt` lists all nine dependencies without version constraints (no `==`, `~=`, or `>=`). Any `pip install -r requirements.txt` on a fresh environment may install incompatible versions.
- Files: `requirements.txt`
- Impact: Breaking API changes in `openai`, `flask-limiter`, or `faiss-cpu` will not be caught until deployment fails.
- Migration plan: Run `pip freeze > requirements.txt` to pin current versions, then manage upgrades intentionally. Consider adding `pip-tools` or `uv` for dependency locking.

**`openai` SDK Using Non-Stable `client.responses` API:**
- Risk: The code uses `client.responses.create()` and `client.responses.stream()` — the Responses API introduced in the `openai` Python SDK v1.66+. This API is newer and less documented than `client.chat.completions`. If the SDK or API evolves, both the `/ask` and `/address-review` streaming paths break simultaneously.
- Files: `code_website.py` lines 216, 1729, 1852; `search.py` uses `client.embeddings.create` (stable)
- Impact: Both primary user-facing endpoints depend on this API path.
- Migration plan: Add explicit SDK version pin; monitor OpenAI SDK changelog for Responses API changes.

---

## Missing Critical Features

**No Admin Interface for Audit / Feedback Logs:**
- Problem: `audit_log` and `feedback_log` tables accumulate data in `permitiq.db` with no way to view, filter, export, or act on them from the UI. The feedback "Flag answer" feature stores records but they are never surfaced anywhere.
- Blocks: Operators cannot identify bad answers, measure system quality, or act on user feedback.

**No Monitoring or Alerting:**
- Problem: There is no error tracking (no Sentry, no Rollbar), no structured logging beyond Python's `logging.exception` calls in `tampa_gis.py`, and no health-check endpoint (`/healthz` or equivalent).
- Files: `code_website.py` — no `@app.route("/health")` exists; `tampa_gis.py` uses `logger.exception` but the logger is never configured with handlers in `code_website.py`.
- Blocks: Silent failures in GIS lookups or OpenAI calls are invisible in production. Gunicorn will not automatically alert on repeated 502/500 responses.

**No PDF Serving Access Control Bypass Protection:**
- Problem: The `/pdf` route checks `session.get("authenticated")` but serves the full unredacted Tampa code PDF to any authenticated session. There is no audit log entry for PDF access, nor any page-range restriction.
- Files: `code_website.py` lines 1617–1623
- Risk: If session authentication is bypassed, the full PDF is exposed without any download audit trail.

---

*Concerns audit: 2026-04-16*
