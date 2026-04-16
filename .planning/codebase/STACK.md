# Technology Stack

**Analysis Date:** 2026-04-16

## Languages

**Primary:**
- Python 3.13.3 - All backend logic, API routes, data ingestion, GIS integration
- HTML/CSS/JavaScript (inline in `code_website.py`) - Frontend UI (rendered via `render_template_string`)

## Runtime

**Environment:**
- Python 3.13.3 (local and production)

**Package Manager:**
- pip
- Lockfile: Not present (only `requirements.txt` with unpinned versions)

## Frameworks

**Core:**
- Flask 3.1.3 - Web framework; all HTTP routes defined in `code_website.py`
- Flask-Limiter 4.1.1 - Rate limiting on `/ask` (60/hr, 10/min) and `/address-review` (30/hr, 5/min)

**Build/Dev:**
- gunicorn 25.3.0 - Production WSGI server (1 worker, 4 threads, 120s timeout)
  - Command: `gunicorn code_website:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120`
  - Defined in `Procfile`

**Testing:**
- No test framework detected

## Key Dependencies

**Critical:**
- `openai` 2.32.0 - OpenAI Python SDK used for completions and embeddings; client instantiated in `code_website.py` and `search.py`
  - Uses `client.responses.create` and `client.responses.stream` (Responses API, not Chat Completions)
  - Uses `client.embeddings.create` for vector embedding generation
- `faiss-cpu` 1.13.2 - Facebook AI Similarity Search; powers the vector similarity index
  - Index file: `tampa_code.index` (FAISS `IndexFlatL2`, L2/squared Euclidean distance)
  - Chunk metadata: `chunks.json`
- `PyMuPDF` (fitz) 1.27.2.2 - PDF text extraction during ingestion (`ingest.py`)
- `requests` 2.33.1 - HTTP client for all Tampa ArcGIS REST API calls in `tampa_gis.py`
- `numpy` 2.4.4 - Array handling for FAISS embedding queries

**Infrastructure:**
- `python-dotenv` 1.2.2 - Loads environment variables from `.env` at startup; used in all modules
- `Flask-Limiter` 4.1.1 - In-memory rate limiter (`storage_uri="memory://"`) keyed by remote IP

## AI Models Used

| Purpose | Model | Configured via |
|---------|-------|----------------|
| Search/Q&A answers | `gpt-4o-mini` (default) | `SEARCH_MODEL` env var |
| Address review answers | `gpt-4o` (default) | `ADDRESS_MODEL` env var |
| Query expansion | `gpt-4o-mini` (hardcoded) | Not overridable |
| Text embeddings | `text-embedding-3-small` (hardcoded) | `EMBED_MODEL` in `search.py` / `ingest.py` |

## Configuration

**Environment:**
- All runtime config loaded via `python-dotenv` from `.env`
- Key env vars:
  - `OPENAI_API_KEY` - Required; OpenAI API authentication
  - `FLASK_SECRET_KEY` - Session encryption key (defaults to `"change-this-secret"`)
  - `APP_LOGIN_PASSWORD` - Single shared password for web login (defaults to `"test123"`)
  - `DB_PATH` - SQLite database path (defaults to `permitiq.db` in project root)
  - `SEARCH_MODEL` - Override LLM for Q&A (default `gpt-4o-mini`)
  - `ADDRESS_MODEL` - Override LLM for address review (default `gpt-4o`)
  - `SEARCH_K` - Number of RAG chunks retrieved per query (default `10`)
  - `GIS_CACHE_TTL_SEC` - GIS response cache TTL in seconds (default `3600`)
  - `AUDIT_ENABLED` - Toggle audit logging to SQLite (default `true`)
  - `MULTI_QUERY_ENABLED` - Toggle query expansion (default `true`)
  - `MULTI_QUERY_N` - Number of expanded queries to generate (default `3`)
  - `MAX_QUESTION_LEN` - Max input chars for `/ask` (default `1000`)
  - `MAX_DESC_LEN` - Max project description chars (default `600`)
  - `MAX_ADDRESS_LEN` - Max address chars (default `200`)
  - `PORT` - HTTP port (default `5000`; used by gunicorn via `Procfile`)
  - `TAMPA_GIS_REQUEST_TIMEOUT` - Timeout for GIS HTTP calls (default `25` seconds)
  - GIS URL overrides: `TAMPA_ARCGIS_BASE_URL`, `TAMPA_ADDRESS_GEOCODE_URL`, `TAMPA_CITY_LIMITS_LAYER_URL`, `TAMPA_ZONING_LAYER_URL`, `TAMPA_PLANNING_MAP_URL`, `TAMPA_TAX_PARCEL_LAYER_URL`

**Build:**
- No build step; Python source runs directly
- Ingestion pipeline: run `python ingest.py` to regenerate `tampa_code.index` and `chunks.json` from PDFs in `data/`

## Data Files

| File | Purpose |
|------|---------|
| `tampa_code.index` | Pre-built FAISS vector index (binary, not committed via git changes) |
| `chunks.json` | JSON array of all text chunks with metadata (page, section, chapter, source) |
| `permitiq.db` | SQLite database (created at runtime); holds GIS cache, audit log, feedback log |
| `data/tampa-code-5-27.pdf` | Primary Tampa Code of Ordinances PDF |
| `data/tampa-code-22-11-21-28-6-19-17.pdf` | Supplementary Tampa Code PDF |
| `data/csd-sufficiency-checklist_1.pdf` | CSD sufficiency checklist PDF |

## Platform Requirements

**Development:**
- Python 3.13+
- All packages from `requirements.txt`
- `OPENAI_API_KEY` in `.env`
- Pre-built `tampa_code.index` and `chunks.json` (or run `python ingest.py` to generate)

**Production:**
- Heroku-compatible (Procfile present)
- Single-dyno deployment (1 gunicorn worker, 4 threads)
- `PORT` env var required (injected by Heroku)
- SQLite used for persistence (not suitable for multi-dyno; ephemeral on Heroku unless a mounted volume is configured)

---

*Stack analysis: 2026-04-16*
