# Architecture

**Analysis Date:** 2026-04-16

## Pattern Overview

**Overall:** Monolithic Flask RAG (Retrieval-Augmented Generation) web application

**Key Characteristics:**
- Single-file web server (`code_website.py`) containing all routes, business logic, prompt composition, helpers, and inlined HTML/CSS/JS templates
- Offline ingest pipeline (`ingest.py`) builds a FAISS vector index from PDF source documents; the web server loads this index at startup and never writes to it
- External GIS queries (City of Tampa ArcGIS REST APIs) are the authoritative source for property zoning/overlay data — the LLM only interprets the code, never determines zoning
- SQLite (`permitiq.db`) provides a persistent GIS response cache and audit/feedback logs; the vector index is read-only at runtime
- Streaming JSON-lines responses (newline-delimited JSON over `text/plain`) deliver LLM output incrementally to the browser

## Layers

**Ingest / Offline Pipeline:**
- Purpose: Parse PDFs, chunk text, embed via OpenAI, build FAISS index
- Location: `ingest.py` (primary), `data/parse_tampa_docs.py` (alternate/legacy parser)
- Contains: PDF extraction (`fitz`/PyMuPDF), section splitting, chunking with overlap, batch embedding calls, FAISS index construction
- Depends on: `data/*.pdf` source PDFs, OpenAI Embeddings API
- Used by: Must be run manually before the web server starts; produces `tampa_code.index` and `chunks.json`

**Vector Search Layer:**
- Purpose: FAISS-backed semantic similarity search over Tampa code chunks
- Location: `search.py`
- Contains: `search()`, `search_with_distances()`, `get_embedding_cached()` (LRU-cached)
- Depends on: `tampa_code.index` (loaded at module import), `chunks.json` (loaded at module import), OpenAI Embeddings API
- Used by: `code_website.py` — `multi_search()` and `build_prompt()` / `build_address_prompt()`

**GIS Integration Layer:**
- Purpose: Resolve address → coordinates → zoning district + overlays + folio from Tampa ArcGIS REST services
- Location: `tampa_gis.py`
- Contains: `suggest_tampa_addresses()`, `get_tampa_property_context()`, `get_zoning_for_point()`, `get_overlays_for_point()`, `is_inside_tampa_city_limits()`, `_folio_from_parcel_envelope()`
- Depends on: `requests`, City of Tampa public ArcGIS REST endpoints (URL-overridable via env vars)
- Used by: `code_website.py` — `/api/address-suggest`, `/api/property-context`, `/address-review`

**Web Application / Orchestration Layer:**
- Purpose: HTTP routing, session auth, input validation, prompt construction, LLM streaming, SQLite persistence
- Location: `code_website.py`
- Contains: All Flask routes, RAG helpers (`build_prompt`, `build_address_prompt`, `expand_query`, `multi_search`, `parse_requirements`), GIS cache helpers (`gis_cache_get`, `gis_cache_set`), audit/feedback logging, inline HTML/CSS/JS templates
- Depends on: `search.py`, `tampa_gis.py`, `permitiq.db` (SQLite), OpenAI Responses API (streaming), Flask, flask-limiter
- Used by: Browser clients

**Persistence Layer:**
- Purpose: GIS result caching (1-hour TTL) and audit/feedback logging
- Location: `permitiq.db` SQLite database (path configurable via `DB_PATH` env var)
- Tables: `gis_cache` (cache_key, data JSON, created_at), `audit_log` (ts, query_type, question, address, zoning, result_count, error), `feedback_log` (ts, query_type, question, address, zoning, answer_snippet, comment)
- Initialized: On application startup in `_init_db()` (`code_website.py` line 56)

## Data Flow

**Code Search Flow (`/ask`):**

1. Browser POSTs `{ question }` to `/ask`
2. `_check_guardrails()` validates input length and screens for prompt injection patterns
3. `build_prompt()` calls `expand_query()` (GPT-4o-mini) to generate N paraphrased queries
4. `multi_search()` runs FAISS search for base query + expanded queries via `search_with_distances()`; deduplicates by `chunk_id`, sorts by ascending L2 distance, trims to `SEARCH_K` results
5. `_compose_prompt()` assembles system prompt with retrieved context chunks (mode=`ask`)
6. Flask streams OpenAI Responses API output as newline-delimited JSON: `{"type":"delta","text":"..."}` events followed by a single `{"type":"sources","results":[...]}` event
7. Browser renders streamed answer and source chunk list with confidence badges

**Address Review Flow (`/address-review`):**

1. Browser POSTs `{ address, x, y, permit_type, project_description }` to `/address-review`
2. Input guardrails applied to address, permit_type, project_description
3. GIS property context loaded: checks `gis_cache` in SQLite; on miss calls `get_tampa_property_context()` → multiple ArcGIS REST calls (geocode → city limits check → zoning → overlays → parcel folio)
4. `build_address_query()` expands permit type + description into semantic search terms
5. `build_address_prompt()` runs multi-search RAG; validates minimum distance threshold (`ADDRESS_SEARCH_MAX_DISTANCE`)
6. Streaming response emits: `{"type":"meta",...}` (zoning/overlays/folio), then `{"type":"delta",...}` tokens, then `{"type":"sources","requirements":[...],"raw_text":"..."}` after full response parsed by `parse_requirements()`
7. Browser renders structured requirements list (name/value/page) with PDF page links; supports CSV export and clipboard copy

**Address Autocomplete Flow (`/api/address-suggest`):**

1. Browser GETs `/api/address-suggest?q=<partial>`
2. `suggest_tampa_addresses()` calls Tampa ArcGIS SiteAddressLocator `/suggest` endpoint
3. Returns list of `{ label, address, magicKey }` objects for dropdown rendering
4. User selects suggestion → browser POSTs `{ address, magicKey, x, y }` to `/api/property-context` to load zoning before form submission

**State Management:**
- Server-side session authentication via Flask signed cookies (`FLASK_SECRET_KEY`)
- Browser-side state held entirely in JavaScript variables (`lastRequirements`, `lastReviewAddress`, `lastSearchQuestion`, etc.) — no client-side framework
- No user accounts or persistent user state beyond the single password session

## Key Abstractions

**Chunk:**
- Purpose: Unit of indexed Tampa code text, carries provenance metadata
- Structure: `{ source, chapter, section, page, chunk_id, text, [distance] }`
- Examples: Created in `ingest.py:build_chunks()`, stored in `chunks.json`, loaded by `search.py`
- chunk_id format: `{source}-{section_id}-chunk-{idx}` (e.g., `tampa_code_5_27-5-101-chunk-0`)

**GIS Property Context:**
- Purpose: Authoritative property metadata resolved from public ArcGIS services
- Structure: `{ inside_city, normalized_address, folio, zoning, overlays, x, y, spatial_reference, source, [error] }`
- Examples: `tampa_gis.py:get_tampa_property_context()`; cached in `gis_cache` SQLite table

**Streaming Response Protocol:**
- Purpose: Incremental delivery of LLM output and metadata to the browser
- Format: Newline-delimited JSON over `text/plain` (not SSE)
- Event types: `delta` (text token), `sources` (final chunk list or requirement list), `meta` (GIS property context), `error` (failure message)

**Multi-Query RAG:**
- Purpose: Expand a single user query into N paraphrased variants to increase retrieval coverage
- Location: `expand_query()` → `multi_search()` in `code_website.py`
- Deduplication: By `chunk_id`; best (lowest) distance kept per chunk across all queries

## Entry Points

**Web Server:**
- Location: `code_website.py`
- Triggers: `gunicorn code_website:app` (production via `Procfile`); `flask run` or direct `python code_website.py` (development)
- Responsibilities: Initializes SQLite DB, loads OpenAI client, starts Flask app with rate limiter

**Ingest Pipeline:**
- Location: `ingest.py` (root), `data/parse_tampa_docs.py` (legacy/alternate)
- Triggers: Manual CLI execution (`python ingest.py`)
- Responsibilities: Reads PDFs from `data/`, extracts text, chunks, embeds, writes `tampa_code.index` and `chunks.json` to project root

**Search Module:**
- Location: `search.py`
- Triggers: Module-level code runs at import time — loads FAISS index and chunks JSON immediately
- Responsibilities: Maintains in-memory FAISS index and chunks list for the lifetime of the process

**Routes:**
- `GET/POST /login` — password auth, sets session cookie
- `GET /logout` — clears session
- `GET /` — main application UI (requires auth)
- `GET /pdf` — serves `data/tampa-code-5-27.pdf` inline (requires auth)
- `POST /ask` — code search with streaming response (rate limited: 60/hr, 10/min)
- `POST /address-review` — address-based permit code review with streaming response (rate limited: 30/hr, 5/min)
- `GET /api/address-suggest` — GIS address autocomplete
- `POST /api/property-context` — GIS property context with SQLite cache
- `POST /api/feedback` — store user-flagged answer in feedback_log

## Error Handling

**Strategy:** Defensive — never crash the request over logging/non-critical failures; return structured JSON error responses for API routes; stream `{"type":"error","text":"..."}` events for streaming routes

**Patterns:**
- `audit()` wraps its database write in `try/except Exception: pass` — audit failure never propagates
- `expand_query()` returns `[]` on any exception — multi-query degrades gracefully to single-query search
- GIS lookup failures return HTTP 502 with `{ "error": ..., "detail": ... }` JSON
- Input validation via `_check_guardrails()` before any LLM or GIS call
- Distance threshold guard in `build_address_prompt()`: rejects retrieval if best match distance > `ADDRESS_SEARCH_MAX_DISTANCE` (default 2.5)
- Streaming generators catch `Exception` and yield an error event rather than raising

## Cross-Cutting Concerns

**Logging:** No structured logger; `audit()` function writes to `audit_log` SQLite table. `tampa_gis.py` uses `logging.getLogger(__name__)` but no handlers are configured — effectively silent at runtime.

**Validation:** `_check_guardrails()` in `code_website.py` — enforces max length and regex-based prompt injection detection on all user text inputs before LLM or GIS calls.

**Authentication:** Single shared password stored in `APP_LOGIN_PASSWORD` env var; Flask signed session cookie (`session["authenticated"]`). All routes check `session.get("authenticated")`. Rate limiting via `flask-limiter` on `/ask` and `/address-review`.

**Configuration:** All tunable parameters are environment-variable overridable with sensible defaults (see `code_website.py` lines 23–33 and `tampa_gis.py` lines 26–68).

---

*Architecture analysis: 2026-04-16*
