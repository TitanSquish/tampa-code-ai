# External Integrations

**Analysis Date:** 2026-04-16

## APIs & External Services

**OpenAI Platform:**
- Used for: LLM completions (Q&A, address review, query expansion) and text embeddings
  - SDK: `openai` 2.32.0 (`from openai import OpenAI`)
  - Client instantiation: `code_website.py` line 45, `search.py` line 11, `ingest.py` line 12
  - Auth: `OPENAI_API_KEY` env var
  - API surface used: `client.responses.create` (non-streaming), `client.responses.stream` (streaming SSE), `client.embeddings.create`
  - Note: Uses the **Responses API** (`client.responses.*`), not the older Chat Completions API

**City of Tampa ArcGIS REST Services (Public, no auth):**
All calls made via `requests.get` in `tampa_gis.py`. No API key required — these are public ArcGIS endpoints.

| Service | Default URL | Purpose |
|---------|-------------|---------|
| Address Geocoder (suggest) | `https://arcgis.tampagov.net/arcgis/rest/services/Locators/SiteAddressLocator/GeocodeServer/suggest` | Address autocomplete (`/api/address-suggest`) |
| Address Geocoder (resolve) | `https://arcgis.tampagov.net/arcgis/rest/services/Locators/SiteAddressLocator/GeocodeServer/findAddressCandidates` | Geocode selected address to coordinates in SR 3857 and SR 2237 |
| Municipal Boundary | `https://arcgis.tampagov.net/arcgis/rest/services/AdministrativeArea/MunicipalBoundary/FeatureServer/0/query` | Point-in-polygon check: is address inside City of Tampa? |
| Zoning Layer (TA Zoning) | `https://gis.tpcmaps.org/arcgis/rest/services/Rezoning/Zoning/MapServer/1/query` | Get zoning district code (e.g., RS-50, CBD-2) for a point |
| Planning MapServer (Overlays) | `https://arcgis.tampagov.net/arcgis/rest/services/OpenData/Planning/MapServer/identify` | Identify historic and overlay districts at a point (sublayers 1, 2, 3) |
| Tax Parcel FeatureServer | `https://arcgis.tampagov.net/arcgis/rest/services/Parcels/TaxParcel/FeatureServer/0/query` | Retrieve folio number via envelope-intersect with parcel layer |
| Geometry Service (Projection) | `https://arcgis.tampagov.net/arcgis/rest/services/Utilities/Geometry/GeometryServer/project` | Reproject coordinates from Web Mercator (EPSG:3857) to Florida State Plane (EPSG:2237) |

All GIS URLs are overridable via environment variables (see STACK.md for variable names).

## Data Storage

**Databases:**
- SQLite via Python `sqlite3` stdlib (no ORM)
  - DB file: `permitiq.db` (path overridable via `DB_PATH` env var)
  - Connection helper: `_db()` function in `code_website.py` (line 50)
  - Tables:
    - `gis_cache` — Caches GIS property context responses keyed by `address|x|y`; TTL controlled by `GIS_CACHE_TTL_SEC` (default 1 hour)
    - `audit_log` — Logs every `/ask` and `/address-review` request with timestamp, query type, question, address, zoning, result count, and error
    - `feedback_log` — Stores user-flagged answers submitted via the "Flag answer" UI

**Vector Index:**
- FAISS `IndexFlatL2` (flat L2 / squared Euclidean distance)
  - Index file: `tampa_code.index` (read at startup in `search.py`)
  - Chunk metadata: `chunks.json` (read at startup in `search.py`)
  - Embedding model: `text-embedding-3-small` (1536-dim vectors)
  - In-process LRU cache for embeddings: `@lru_cache(maxsize=256)` in `search.py`

**File Storage:**
- Local filesystem only
  - PDFs served directly from `data/tampa-code-5-27.pdf` via `/pdf` route (`send_file`)
  - No cloud file storage

**Caching:**
- In-process: Python `functools.lru_cache` for query embeddings (`search.py`)
- Persistent: SQLite `gis_cache` table for GIS property lookups (`code_website.py`)
- Rate limiter storage: in-memory (`storage_uri="memory://"` in Flask-Limiter; resets on server restart)

## Authentication & Identity

**Auth Provider:**
- Custom single-password session auth (no external auth provider)
  - Implementation: Flask `session` with `session["authenticated"] = True`
  - Password: `APP_LOGIN_PASSWORD` env var (default `"test123"`)
  - Secret key: `FLASK_SECRET_KEY` env var (default `"change-this-secret"` — must be changed in production)
  - Routes: `GET/POST /login`, `GET /logout`
  - All protected routes check `session.get("authenticated")` and return 401 or redirect to `/login`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, or similar)

**Audit Logging:**
- Custom SQLite-based audit log in `audit_log` table
  - Logs: timestamp, query type (`search` or `address_review`), question text, address, zoning, result count, error string
  - Toggle: `AUDIT_ENABLED` env var (default `true`)
  - Never raises exceptions — audit failures are silently swallowed to avoid breaking requests

**Feedback Logging:**
- User-submitted feedback via "Flag answer" UI stored in `feedback_log` table
  - Endpoint: `POST /api/feedback`

**Application Logs:**
- Python `logging` module used only in `tampa_gis.py` (`logger.exception(...)`)
- No structured logging framework; Flask default logging otherwise

## CI/CD & Deployment

**Hosting:**
- Heroku (inferred from `Procfile`)
  - `web: gunicorn code_website:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120`

**CI Pipeline:**
- None detected

## Webhooks & Callbacks

**Incoming:**
- None (no webhook endpoints)

**Outgoing:**
- All external HTTP calls are synchronous request/response (ArcGIS REST, OpenAI API)
- OpenAI streaming uses server-sent chunked HTTP responses (not WebSockets)

## Streaming

**Pattern:**
- `/ask` and `/address-review` both use Flask `Response` with a generator function
- Client reads via `response.body.getReader()` (Fetch Streams API)
- Wire format: newline-delimited JSON (`{"type": "delta"|"sources"|"meta"|"error", ...}\n`)
- OpenAI streaming via `client.responses.stream(...)` context manager, consuming `response.output_text.delta` events

## Environment Configuration

**Required env vars (application will fail or behave insecurely without these):**
- `OPENAI_API_KEY` — Required for all LLM and embedding calls
- `FLASK_SECRET_KEY` — Must be set to a strong random value in production (default is insecure)
- `APP_LOGIN_PASSWORD` — Must be set to a strong value in production (default `test123` is insecure)

**Optional env vars with defaults:**
- `DB_PATH`, `PORT`, `SEARCH_MODEL`, `ADDRESS_MODEL`, `SEARCH_K`, `GIS_CACHE_TTL_SEC`, `AUDIT_ENABLED`, `MULTI_QUERY_ENABLED`, `MULTI_QUERY_N`, `MAX_QUESTION_LEN`, `MAX_DESC_LEN`, `MAX_ADDRESS_LEN`, `TAMPA_GIS_REQUEST_TIMEOUT`, and all GIS URL overrides

**Secrets location:**
- `.env` file in project root (gitignored; confirmed present locally)

---

*Integration audit: 2026-04-16*
