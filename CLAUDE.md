<!-- GSD:project-start source:PROJECT.md -->
## Project

**Tampa Code AI — Frontend/Backend Split**

A Tampa building-permit RAG assistant that lets users look up code requirements by asking questions or entering a property address. Currently a Flask monolith with ~1,100 lines of inlined HTML/JS. This milestone separates it into a proper monorepo: a Python/Flask API backend and a Vite + React frontend with a modern UI.

**Core Value:** Users can instantly get permit code requirements for any Tampa address or question — the split must not break this core flow.

### Constraints

- **Stack**: Backend stays Python/Flask — no rewrite
- **Streaming**: React must handle the existing NDJSON streaming protocol — no changes to backend event format
- **Compatibility**: All existing API routes must keep the same paths and response shapes
- **Deploy**: Render (already in use) — two-service approach
- **Email**: Resend for OTP delivery — must add `resend` Python package to backend
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- Python 3.13.3 - All backend logic, API routes, data ingestion, GIS integration
- HTML/CSS/JavaScript (inline in `code_website.py`) - Frontend UI (rendered via `render_template_string`)
## Runtime
- Python 3.13.3 (local and production)
- pip
- Lockfile: Not present (only `requirements.txt` with unpinned versions)
## Frameworks
- Flask 3.1.3 - Web framework; all HTTP routes defined in `code_website.py`
- Flask-Limiter 4.1.1 - Rate limiting on `/ask` (60/hr, 10/min) and `/address-review` (30/hr, 5/min)
- gunicorn 25.3.0 - Production WSGI server (1 worker, 4 threads, 120s timeout)
- No test framework detected
## Key Dependencies
- `openai` 2.32.0 - OpenAI Python SDK used for completions and embeddings; client instantiated in `code_website.py` and `search.py`
- `faiss-cpu` 1.13.2 - Facebook AI Similarity Search; powers the vector similarity index
- `PyMuPDF` (fitz) 1.27.2.2 - PDF text extraction during ingestion (`ingest.py`)
- `requests` 2.33.1 - HTTP client for all Tampa ArcGIS REST API calls in `tampa_gis.py`
- `numpy` 2.4.4 - Array handling for FAISS embedding queries
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
- All runtime config loaded via `python-dotenv` from `.env`
- Key env vars:
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
- Python 3.13+
- All packages from `requirements.txt`
- `OPENAI_API_KEY` in `.env`
- Pre-built `tampa_code.index` and `chunks.json` (or run `python ingest.py` to generate)
- Heroku-compatible (Procfile present)
- Single-dyno deployment (1 gunicorn worker, 4 threads)
- `PORT` env var required (injected by Heroku)
- SQLite used for persistence (not suitable for multi-dyno; ephemeral on Heroku unless a mounted volume is configured)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Language and Runtime
## Naming Patterns
- `snake_case` throughout: `code_website.py`, `tampa_gis.py`, `search.py`, `ingest.py`
- Data utilities placed in `data/` subdirectory: `data/parse_tampa_docs.py`
- Public functions: `snake_case` — e.g., `search_with_distances`, `build_address_query`, `get_zoning_for_point`
- Private/internal functions: leading underscore — e.g., `_db`, `_init_db`, `_format_context`, `_check_guardrails`, `_compose_prompt`, `_get`, `_find_address_candidates`, `_planning_overlay_labels_from_identify`, `_address_match_key`, `_folio_from_parcel_envelope`, `_project_point_to_2237`
- Flask route handlers: `snake_case` without underscore prefix regardless of visibility — e.g., `login`, `logout`, `ask`, `address_review`, `api_address_suggest`, `api_property_context`
- Nested generator functions inside routes: always named `generate` — used in `ask()` and `address_review()` in `code_website.py`
- Local variables: `snake_case` — e.g., `raw_results`, `dist_list`, `cache_key`, `query_type`
- Module-level constants: `UPPER_SNAKE_CASE` — e.g., `SEARCH_K`, `GIS_CACHE_TTL_SEC`, `AUDIT_ENABLED`, `MULTI_QUERY_N`, `EMBED_MODEL`, `INDEX_PATH`, `CHUNKS_PATH`
- Short-lived path constants: `_BASE` (private with underscore prefix), `PDF_PATH`, `DB_PATH`
- No custom classes defined anywhere in the codebase. Dicts are used for all data objects (chunks, GIS results, requirements, cache entries).
- Module-level regex are `UPPER_SNAKE_CASE` with descriptive suffix — e.g., `SEC_RE`, `SUBSEC_RE`, `CHECKLIST_GROUP_RE`, `CHECKLIST_ITEM_RE`, `_REQ_LINE` in `code_website.py`
## Type Annotations
## Code Style
- No formatter config file present (no `black`, `ruff`, `autopep8` config detected)
- Indentation: 4 spaces consistently across all files
- Line alignment: multi-line function signatures use aligned parameter blocks — e.g., in `code_website.py` lines 116–117, `tampa_gis.py` lines 119–123
- No linting config (no `.flake8`, `.pylintrc`, `ruff.toml`, or `pyproject.toml`)
- `.gitignore` includes `.ruff_cache/` and `.mypy_cache/` entries — indicating these tools are planned but not yet configured
- f-strings used consistently for interpolation
- Multi-line f-string prompts use triple-quoted f-strings embedded directly in `_compose_prompt` in `code_website.py`
- SQL strings use parenthesized multi-line string concatenation with explicit `+` — e.g., lines 1689–1693 in `code_website.py`
## Import Organization
## Configuration Pattern
## Error Handling
## Logging
- Logger: `logger = logging.getLogger(__name__)` at module level
- Usage: `logger.exception(...)` for GIS errors only (captures full traceback)
## Comments
- Section separators use `# ── Section Name ──────────────────────` formatting consistently in `code_website.py` (lines 17, 22, 36, 49, 364)
- Block comments above groups of related constants explain purpose
- Individual config constants get inline comments on the same line — e.g., `# 1-hour persistent GIS cache`, `# RAG chunks retrieved per query`
- Complex regex patterns include an example in the comment above them
- `tampa_gis.py`: module-level docstring, and docstrings on all public functions. Format is prose description followed by structured "Returns" note for complex returns.
- `code_website.py`: docstrings on helper functions only (not on Flask route handlers). Route handlers use Flask's route decorator as implicit documentation.
- `search.py` and `ingest.py`: no docstrings on functions.
- `data/parse_tampa_docs.py`: module-level docstring with Usage/Inputs/Outputs/Notes. Function docstrings are single-line or brief multi-line.
## Function Design
- Functions return either a typed value or a structured error dict (GIS functions), never raise to callers
- Streaming routes return `flask.Response(generate(), mimetype="text/plain")` with a nested `generate()` generator
- Parse/search functions return `list` — empty list on failure, never `None`
## Module Design
- `code_website.py` — Flask app, routes, prompt construction, SQLite caching/audit, guardrails
- `search.py` — FAISS index loading, embedding, vector search
- `tampa_gis.py` — ArcGIS REST API wrappers, GIS data resolution
- `ingest.py` — PDF parsing, chunking, embedding, FAISS index building (offline CLI)
- `data/parse_tampa_docs.py` — Alternative structured PDF parser (offline CLI, richer schema)
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Single-file web server (`code_website.py`) containing all routes, business logic, prompt composition, helpers, and inlined HTML/CSS/JS templates
- Offline ingest pipeline (`ingest.py`) builds a FAISS vector index from PDF source documents; the web server loads this index at startup and never writes to it
- External GIS queries (City of Tampa ArcGIS REST APIs) are the authoritative source for property zoning/overlay data — the LLM only interprets the code, never determines zoning
- SQLite (`permitiq.db`) provides a persistent GIS response cache and audit/feedback logs; the vector index is read-only at runtime
- Streaming JSON-lines responses (newline-delimited JSON over `text/plain`) deliver LLM output incrementally to the browser
## Layers
- Purpose: Parse PDFs, chunk text, embed via OpenAI, build FAISS index
- Location: `ingest.py` (primary), `data/parse_tampa_docs.py` (alternate/legacy parser)
- Contains: PDF extraction (`fitz`/PyMuPDF), section splitting, chunking with overlap, batch embedding calls, FAISS index construction
- Depends on: `data/*.pdf` source PDFs, OpenAI Embeddings API
- Used by: Must be run manually before the web server starts; produces `tampa_code.index` and `chunks.json`
- Purpose: FAISS-backed semantic similarity search over Tampa code chunks
- Location: `search.py`
- Contains: `search()`, `search_with_distances()`, `get_embedding_cached()` (LRU-cached)
- Depends on: `tampa_code.index` (loaded at module import), `chunks.json` (loaded at module import), OpenAI Embeddings API
- Used by: `code_website.py` — `multi_search()` and `build_prompt()` / `build_address_prompt()`
- Purpose: Resolve address → coordinates → zoning district + overlays + folio from Tampa ArcGIS REST services
- Location: `tampa_gis.py`
- Contains: `suggest_tampa_addresses()`, `get_tampa_property_context()`, `get_zoning_for_point()`, `get_overlays_for_point()`, `is_inside_tampa_city_limits()`, `_folio_from_parcel_envelope()`
- Depends on: `requests`, City of Tampa public ArcGIS REST endpoints (URL-overridable via env vars)
- Used by: `code_website.py` — `/api/address-suggest`, `/api/property-context`, `/address-review`
- Purpose: HTTP routing, session auth, input validation, prompt construction, LLM streaming, SQLite persistence
- Location: `code_website.py`
- Contains: All Flask routes, RAG helpers (`build_prompt`, `build_address_prompt`, `expand_query`, `multi_search`, `parse_requirements`), GIS cache helpers (`gis_cache_get`, `gis_cache_set`), audit/feedback logging, inline HTML/CSS/JS templates
- Depends on: `search.py`, `tampa_gis.py`, `permitiq.db` (SQLite), OpenAI Responses API (streaming), Flask, flask-limiter
- Used by: Browser clients
- Purpose: GIS result caching (1-hour TTL) and audit/feedback logging
- Location: `permitiq.db` SQLite database (path configurable via `DB_PATH` env var)
- Tables: `gis_cache` (cache_key, data JSON, created_at), `audit_log` (ts, query_type, question, address, zoning, result_count, error), `feedback_log` (ts, query_type, question, address, zoning, answer_snippet, comment)
- Initialized: On application startup in `_init_db()` (`code_website.py` line 56)
## Data Flow
- Server-side session authentication via Flask signed cookies (`FLASK_SECRET_KEY`)
- Browser-side state held entirely in JavaScript variables (`lastRequirements`, `lastReviewAddress`, `lastSearchQuestion`, etc.) — no client-side framework
- No user accounts or persistent user state beyond the single password session
## Key Abstractions
- Purpose: Unit of indexed Tampa code text, carries provenance metadata
- Structure: `{ source, chapter, section, page, chunk_id, text, [distance] }`
- Examples: Created in `ingest.py:build_chunks()`, stored in `chunks.json`, loaded by `search.py`
- chunk_id format: `{source}-{section_id}-chunk-{idx}` (e.g., `tampa_code_5_27-5-101-chunk-0`)
- Purpose: Authoritative property metadata resolved from public ArcGIS services
- Structure: `{ inside_city, normalized_address, folio, zoning, overlays, x, y, spatial_reference, source, [error] }`
- Examples: `tampa_gis.py:get_tampa_property_context()`; cached in `gis_cache` SQLite table
- Purpose: Incremental delivery of LLM output and metadata to the browser
- Format: Newline-delimited JSON over `text/plain` (not SSE)
- Event types: `delta` (text token), `sources` (final chunk list or requirement list), `meta` (GIS property context), `error` (failure message)
- Purpose: Expand a single user query into N paraphrased variants to increase retrieval coverage
- Location: `expand_query()` → `multi_search()` in `code_website.py`
- Deduplication: By `chunk_id`; best (lowest) distance kept per chunk across all queries
## Entry Points
- Location: `code_website.py`
- Triggers: `gunicorn code_website:app` (production via `Procfile`); `flask run` or direct `python code_website.py` (development)
- Responsibilities: Initializes SQLite DB, loads OpenAI client, starts Flask app with rate limiter
- Location: `ingest.py` (root), `data/parse_tampa_docs.py` (legacy/alternate)
- Triggers: Manual CLI execution (`python ingest.py`)
- Responsibilities: Reads PDFs from `data/`, extracts text, chunks, embeds, writes `tampa_code.index` and `chunks.json` to project root
- Location: `search.py`
- Triggers: Module-level code runs at import time — loads FAISS index and chunks JSON immediately
- Responsibilities: Maintains in-memory FAISS index and chunks list for the lifetime of the process
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
- `audit()` wraps its database write in `try/except Exception: pass` — audit failure never propagates
- `expand_query()` returns `[]` on any exception — multi-query degrades gracefully to single-query search
- GIS lookup failures return HTTP 502 with `{ "error": ..., "detail": ... }` JSON
- Input validation via `_check_guardrails()` before any LLM or GIS call
- Distance threshold guard in `build_address_prompt()`: rejects retrieval if best match distance > `ADDRESS_SEARCH_MAX_DISTANCE` (default 2.5)
- Streaming generators catch `Exception` and yield an error event rather than raising
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| adapt | Adapt designs to work across different screen sizes, devices, contexts, or platforms. Implements breakpoints, fluid layouts, and touch targets. Use when the user mentions responsive design, mobile layouts, breakpoints, viewport adaptation, or cross-device compatibility. | `.agents/skills/adapt/SKILL.md` |
| animate | Review a feature and enhance it with purposeful animations, micro-interactions, and motion effects that improve usability and delight. Use when the user mentions adding animation, transitions, micro-interactions, motion design, hover effects, or making the UI feel more alive. | `.agents/skills/animate/SKILL.md` |
| audit | Run technical quality checks across accessibility, performance, theming, responsive design, and anti-patterns. Generates a scored report with P0-P3 severity ratings and actionable plan. Use when the user wants an accessibility check, performance audit, or technical quality review. | `.agents/skills/audit/SKILL.md` |
| bolder | Amplify safe or boring designs to make them more visually interesting and stimulating. Increases impact while maintaining usability. Use when the user says the design looks bland, generic, too safe, lacks personality, or wants more visual impact and character. | `.agents/skills/bolder/SKILL.md` |
| clarify | Improve unclear UX copy, error messages, microcopy, labels, and instructions to make interfaces easier to understand. Use when the user mentions confusing text, unclear labels, bad error messages, hard-to-follow instructions, or wanting better UX writing. | `.agents/skills/clarify/SKILL.md` |
| colorize | Add strategic color to features that are too monochromatic or lack visual interest, making interfaces more engaging and expressive. Use when the user mentions the design looking gray, dull, lacking warmth, needing more color, or wanting a more vibrant or expressive palette. | `.agents/skills/colorize/SKILL.md` |
| critique | Evaluate design from a UX perspective, assessing visual hierarchy, information architecture, emotional resonance, cognitive load, and overall quality with quantitative scoring, persona-based testing, automated anti-pattern detection, and actionable feedback. Use when the user asks to review, critique, evaluate, or give feedback on a design or component. | `.agents/skills/critique/SKILL.md` |
| delight | Add moments of joy, personality, and unexpected touches that make interfaces memorable and enjoyable to use. Elevates functional to delightful. Use when the user asks to add polish, personality, animations, micro-interactions, delight, or make an interface feel fun or memorable. | `.agents/skills/delight/SKILL.md` |
| distill | Strip designs to their essence by removing unnecessary complexity. Great design is simple, powerful, and clean. Use when the user asks to simplify, declutter, reduce noise, remove elements, or make a UI cleaner and more focused. | `.agents/skills/distill/SKILL.md` |
| impeccable | Create distinctive, production-grade frontend interfaces with high design quality. Generates creative, polished code that avoids generic AI aesthetics. Use when the user asks to build web components, pages, artifacts, posters, or applications, or when any design skill requires project context. Call with 'craft' for shape-then-build, 'teach' for design context setup, or 'extract' to pull reusable components and tokens into the design system. | `.agents/skills/impeccable/SKILL.md` |
| layout | Improve layout, spacing, and visual rhythm. Fixes monotonous grids, inconsistent spacing, and weak visual hierarchy. Use when the user mentions layout feeling off, spacing issues, visual hierarchy, crowded UI, alignment problems, or wanting better composition. | `.agents/skills/layout/SKILL.md` |
| optimize | Diagnoses and fixes UI performance across loading speed, rendering, animations, images, and bundle size. Use when the user mentions slow, laggy, janky, performance, bundle size, load time, or wants a faster, smoother experience. | `.agents/skills/optimize/SKILL.md` |
| overdrive | Pushes interfaces past conventional limits with technically ambitious implementations — shaders, spring physics, scroll-driven reveals, 60fps animations. Use when the user wants to wow, impress, go all-out, or make something that feels extraordinary. | `.agents/skills/overdrive/SKILL.md` |
| polish | Performs a final quality pass fixing alignment, spacing, consistency, and micro-detail issues before shipping. Use when the user mentions polish, finishing touches, pre-launch review, something looks off, or wants to go from good to great. | `.agents/skills/polish/SKILL.md` |
| quieter | Tones down visually aggressive or overstimulating designs, reducing intensity while preserving quality. Use when the user mentions too bold, too loud, overwhelming, aggressive, garish, or wants a calmer, more refined aesthetic. | `.agents/skills/quieter/SKILL.md` |
| shape | Plan the UX and UI for a feature before writing code. Runs a structured discovery interview, then produces a design brief that guides implementation. Use during the planning phase to establish design direction, constraints, and strategy before any code is written. | `.agents/skills/shape/SKILL.md` |
| typeset | Improves typography by fixing font choices, hierarchy, sizing, weight, and readability so text feels intentional. Use when the user mentions fonts, type, readability, text hierarchy, sizing looks off, or wants more polished, intentional typography. | `.agents/skills/typeset/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
