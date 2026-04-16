# Coding Conventions

**Analysis Date:** 2026-04-16

## Language and Runtime

This is a pure Python 3.10+ backend project (no frontend build pipeline). All source files are `.py`. HTML/CSS/JS is inlined inside Python strings in `code_website.py`. There are no TypeScript, JSX, or frontend toolchain files.

## Naming Patterns

**Files:**
- `snake_case` throughout: `code_website.py`, `tampa_gis.py`, `search.py`, `ingest.py`
- Data utilities placed in `data/` subdirectory: `data/parse_tampa_docs.py`

**Functions:**
- Public functions: `snake_case` — e.g., `search_with_distances`, `build_address_query`, `get_zoning_for_point`
- Private/internal functions: leading underscore — e.g., `_db`, `_init_db`, `_format_context`, `_check_guardrails`, `_compose_prompt`, `_get`, `_find_address_candidates`, `_planning_overlay_labels_from_identify`, `_address_match_key`, `_folio_from_parcel_envelope`, `_project_point_to_2237`
- Flask route handlers: `snake_case` without underscore prefix regardless of visibility — e.g., `login`, `logout`, `ask`, `address_review`, `api_address_suggest`, `api_property_context`
- Nested generator functions inside routes: always named `generate` — used in `ask()` and `address_review()` in `code_website.py`

**Variables:**
- Local variables: `snake_case` — e.g., `raw_results`, `dist_list`, `cache_key`, `query_type`
- Module-level constants: `UPPER_SNAKE_CASE` — e.g., `SEARCH_K`, `GIS_CACHE_TTL_SEC`, `AUDIT_ENABLED`, `MULTI_QUERY_N`, `EMBED_MODEL`, `INDEX_PATH`, `CHUNKS_PATH`
- Short-lived path constants: `_BASE` (private with underscore prefix), `PDF_PATH`, `DB_PATH`

**Types / Classes:**
- No custom classes defined anywhere in the codebase. Dicts are used for all data objects (chunks, GIS results, requirements, cache entries).

**Regex constants:**
- Module-level regex are `UPPER_SNAKE_CASE` with descriptive suffix — e.g., `SEC_RE`, `SUBSEC_RE`, `CHECKLIST_GROUP_RE`, `CHECKLIST_ITEM_RE`, `_REQ_LINE` in `code_website.py`

## Type Annotations

**Mixed styles present across files** — newer files use Python 3.10+ built-in generics; older utility script uses `typing` imports:

**`code_website.py` and `tampa_gis.py`** — use Python 3.10+ syntax (preferred going forward):
```python
def gis_cache_get(key: str) -> dict | None:
def expand_query(base_query: str, n: int = MULTI_QUERY_N) -> list[str]:
def multi_search(base_query: str, extra_queries: list[str], k_per: int, top_k: int) -> tuple[list, list]:
```

**`data/parse_tampa_docs.py`** — uses `typing` module (legacy, predates 3.10 adoption):
```python
from typing import Dict, List, Optional, Tuple
def extract_pages(pdf_path: str) -> List[Dict]:
def split_requirement_conditions(text: str) -> Tuple[str, Optional[str]]:
```

**`search.py` and `ingest.py`** — no type annotations at all.

**Rule:** New code should use Python 3.10+ built-in generics (`list[str]`, `dict | None`, `tuple[float, float]`), not `typing` imports.

## Code Style

**Formatting:**
- No formatter config file present (no `black`, `ruff`, `autopep8` config detected)
- Indentation: 4 spaces consistently across all files
- Line alignment: multi-line function signatures use aligned parameter blocks — e.g., in `code_website.py` lines 116–117, `tampa_gis.py` lines 119–123

**Linting:**
- No linting config (no `.flake8`, `.pylintrc`, `ruff.toml`, or `pyproject.toml`)
- `.gitignore` includes `.ruff_cache/` and `.mypy_cache/` entries — indicating these tools are planned but not yet configured

**String formatting:**
- f-strings used consistently for interpolation
- Multi-line f-string prompts use triple-quoted f-strings embedded directly in `_compose_prompt` in `code_website.py`
- SQL strings use parenthesized multi-line string concatenation with explicit `+` — e.g., lines 1689–1693 in `code_website.py`

## Import Organization

**Order observed (not enforced by tooling):**
1. Standard library (`os`, `json`, `re`, `sqlite3`, `time`, `datetime`, `logging`, `functools`)
2. Third-party packages (`flask`, `flask_limiter`, `openai`, `faiss`, `numpy`, `requests`, `fitz`)
3. Local modules (`from search import search_with_distances`, `from tampa_gis import get_tampa_property_context, suggest_tampa_addresses`)

**Pattern:** Each file calls `load_dotenv()` at module load time immediately after imports.

**Path Aliases:** None — no package structure, all imports are direct module names or relative.

## Configuration Pattern

All tunable values are read from environment variables at module load time in `code_website.py`, with sensible defaults:
```python
SEARCH_K          = int(os.getenv("SEARCH_K", "10"))
GIS_CACHE_TTL_SEC = int(os.getenv("GIS_CACHE_TTL_SEC", "3600"))
MULTI_QUERY_ENABLED = os.getenv("MULTI_QUERY_ENABLED", "true").lower() != "false"
```
GIS service URLs in `tampa_gis.py` follow the same pattern — all overridable via env vars.

## Error Handling

**Strategies used (in priority order):**

**1. Broad exception swallowing for non-critical paths** — used in audit log writes, query expansion, and requirements parsing so a failure never crashes the main request:
```python
except Exception:
    pass  # never crash the request over a log write
```

**2. Specific exception tuples for expected failure modes:**
```python
except (requests.RequestException, ValueError, KeyError, TypeError) as e:
    logger.exception("Tampa GIS error: %s", e)
    return _err("Could not load property data from Tampa GIS.", ...)
```

**3. Error propagation via structured return dicts** — GIS functions return a dict with `"error"` key rather than raising. Callers check `ctx.get("error")`:
```python
def _err(msg: str, *, inside: bool = False, ...) -> dict[str, Any]:
    return {"inside_city": inside, "error": msg, ...}
```

**4. HTTP error responses** — Flask routes return `jsonify({"error": "..."})` with appropriate HTTP status codes (400, 401, 502)

**5. Generator-safe exceptions** — inside streaming `generate()` functions, exceptions are caught and yielded as JSON error events rather than propagated:
```python
except Exception as e:
    audit("search", question=question, error=str(e))
    yield json.dumps({"type": "error", "text": str(e)}) + "\n"
```

**6. `raise_for_status()`** — used in `_get()` in `tampa_gis.py` to convert HTTP errors to exceptions immediately at the HTTP layer.

## Logging

**Framework:** Python standard `logging` module — used only in `tampa_gis.py`.
- Logger: `logger = logging.getLogger(__name__)` at module level
- Usage: `logger.exception(...)` for GIS errors only (captures full traceback)

**Elsewhere:** No logging configured. `code_website.py`, `search.py`, `ingest.py` use `print()` for progress output in CLI scripts (`ingest.py`) and rely on the audit SQLite log for runtime observability in web routes.

**Audit log pattern (web requests):** A dedicated `audit()` function in `code_website.py` writes to the `audit_log` SQLite table with query type, question, address, zoning, result count, and error. Silent on failure (`except Exception: pass`).

## Comments

**When to Comment:**
- Section separators use `# ── Section Name ──────────────────────` formatting consistently in `code_website.py` (lines 17, 22, 36, 49, 364)
- Block comments above groups of related constants explain purpose
- Individual config constants get inline comments on the same line — e.g., `# 1-hour persistent GIS cache`, `# RAG chunks retrieved per query`
- Complex regex patterns include an example in the comment above them

**Docstrings:**
- `tampa_gis.py`: module-level docstring, and docstrings on all public functions. Format is prose description followed by structured "Returns" note for complex returns.
- `code_website.py`: docstrings on helper functions only (not on Flask route handlers). Route handlers use Flask's route decorator as implicit documentation.
- `search.py` and `ingest.py`: no docstrings on functions.
- `data/parse_tampa_docs.py`: module-level docstring with Usage/Inputs/Outputs/Notes. Function docstrings are single-line or brief multi-line.

## Function Design

**Size:** Helper functions are small and focused (< 30 lines). Flask route handlers are longer (50–100 lines) because they inline validation, GIS lookup, prompt construction, and streaming response logic.

**Parameters:** Keyword-only parameters enforced with `*` for optional audit metadata — e.g., `audit(query_type: str, *, question: str = None, ...)`.

**Return Values:**
- Functions return either a typed value or a structured error dict (GIS functions), never raise to callers
- Streaming routes return `flask.Response(generate(), mimetype="text/plain")` with a nested `generate()` generator
- Parse/search functions return `list` — empty list on failure, never `None`

## Module Design

**Exports:** No `__all__` defined. Public API is implied by naming convention (underscore = private).

**Barrel Files:** Not applicable — no package structure. Modules are imported directly by name.

**Module responsibilities:**
- `code_website.py` — Flask app, routes, prompt construction, SQLite caching/audit, guardrails
- `search.py` — FAISS index loading, embedding, vector search
- `tampa_gis.py` — ArcGIS REST API wrappers, GIS data resolution
- `ingest.py` — PDF parsing, chunking, embedding, FAISS index building (offline CLI)
- `data/parse_tampa_docs.py` — Alternative structured PDF parser (offline CLI, richer schema)

---

*Convention analysis: 2026-04-16*
