# Phase 1: Monorepo Restructure & Frontend Scaffold - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a functional two-folder monorepo foundation. The existing Flask backend moves unchanged into `backend/` and still boots with gunicorn. A fresh Vite + React + TypeScript app with shadcn/ui, Tailwind CSS, and React Router lives in `frontend/` and renders a minimal app shell with routing stubs. The Vite dev server proxies API calls to Flask. A root README documents the layout.

No UI is ported in this phase. The core Flask RAG flow is untouched — this is purely structural.

</domain>

<decisions>
## Implementation Decisions

### Backend Directory Layout
- **D-01:** Files that move to `backend/`: `code_website.py`, `search.py`, `tampa_gis.py`, `ingest.py`, `requirements.txt`, `Procfile`, and the entire `data/` directory (renamed `backend/data/`).
- **D-02:** `.env` moves to `backend/.env`. Flask is run from `backend/` so `python-dotenv` finds it automatically.
- **D-03:** Root-level config files stay at root: `.gitignore`, `skills-lock.json`, `.planning/`, `.agents/`, `.claude/`, and the new `README.md`.
- **D-04:** Runtime-generated artifacts (`tampa_code.index`, `chunks.json`, `permitiq.db`) are gitignored. After the move they are generated inside `backend/` at runtime — no git action needed, but README must document that `python ingest.py` and Flask must be run from `backend/`.
- **D-05:** `ingest.py` stays in `backend/` (not a separate top-level script). Developers run it from `backend/`.

### Frontend Scaffold
- **D-06:** Full tooling initialized in Phase 1 (not deferred to Phase 3): Vite + React + TypeScript + Tailwind CSS + shadcn/ui + React Router. Phase 3 can start building components immediately.
- **D-07:** TypeScript throughout — standard for shadcn/ui projects; components are TS by default.
- **D-08:** Placeholder page is a minimal app shell with routing stubs: `/login` and `/app` routes wired up with placeholder content (not blank). Proves routing works and gives Phase 3 a real starting point.

### Dev Proxy
- **D-09:** Vite `vite.config.ts` proxy targets `http://localhost:5000` (Flask default). Proxy rules cover `/api/*`, `/ask`, `/address-review`. No CORS config needed on Flask for local dev.
- **D-10:** `frontend/.env` exposes `VITE_API_BASE_URL`. During dev it is empty (Vite proxy handles routing). In production it points to the Render Flask service URL.

### README
- **D-11:** Root `README.md` documents: monorepo layout (`backend/`, `frontend/`), how to run Flask from `backend/` (including ingest prerequisite), how to run Vite dev server from `frontend/`, and all required env vars for each side.

### Claude's Discretion
- Concurrent dev setup: whether to add a root `package.json` with `concurrently` scripts or just document two-terminal setup in README is left to Claude. Either is acceptable.
- Node.js version: use whatever is current LTS; no constraint specified.
- shadcn/ui component initialization: which base components to pre-install (if any) is Claude's call — the requirement is that shadcn/ui is configured and usable, not that specific components are pre-scaffolded.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Phase 1 requirements: REPO-01, REPO-02, REPO-03, DEV-01, DEV-02

### Codebase Maps
- `.planning/codebase/STRUCTURE.md` — Current file layout; what exists at root today that must move to `backend/`
- `.planning/codebase/STACK.md` — Current dependencies, env vars, Procfile command, gunicorn config

### Roadmap
- `.planning/ROADMAP.md` §Phase 1 — Success criteria (5 items), phase goal, requirements list

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None in this phase — Phase 1 creates structure, not reusable code.

### Established Patterns
- Flask runs with: `gunicorn code_website:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120` (from `Procfile`)
- Path constants use `os.getenv("INDEX_PATH", "tampa_code.index")` pattern — relative paths work as long as Flask is run from `backend/`
- `python-dotenv` loaded at module level in `code_website.py` — `.env` must be in the working directory when Flask starts

### Integration Points
- Flask import target changes from `code_website:app` to still `code_website:app` — just run from `backend/` directory
- `data/` path references in `code_website.py` and `ingest.py` use relative `data/` path — no code changes needed if files move together to `backend/`

</code_context>

<specifics>
## Specific Ideas

- No specific references beyond the roadmap success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-monorepo-restructure-frontend-scaffold*
*Context gathered: 2026-04-16*
