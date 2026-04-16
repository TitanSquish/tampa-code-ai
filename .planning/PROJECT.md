# Tampa Code AI — Frontend/Backend Split

## What This Is

A Tampa building-permit RAG assistant that lets users look up code requirements by asking questions or entering a property address. Currently a Flask monolith with ~1,100 lines of inlined HTML/JS. This milestone separates it into a proper monorepo: a Python/Flask API backend and a Vite + React frontend with a modern UI.

## Core Value

Users can instantly get permit code requirements for any Tampa address or question — the split must not break this core flow.

## Requirements

### Validated

- ✓ Code search (`/ask`) — RAG over Tampa Code of Ordinances via FAISS + OpenAI — existing
- ✓ Address review (`/address-review`) — GIS-backed permit requirements from address input — existing
- ✓ Address autocomplete (`/api/address-suggest`) — Tampa ArcGIS suggestions — existing
- ✓ Property context (`/api/property-context`) — zoning/overlays from ArcGIS — existing
- ✓ Feedback logging (`/api/feedback`) — user flags bad answers to SQLite — existing
- ✓ Rate limiting — 60/hr on `/ask`, 30/hr on `/address-review` — existing
- ✓ PDF viewer (`/pdf`) — serves Tampa Code PDF inline — existing
- ✓ Streaming responses — newline-delimited JSON for incremental LLM output — existing
- ✓ Multi-query RAG — query expansion to improve retrieval coverage — existing
- ✓ GIS cache — 1-hour SQLite cache for ArcGIS responses — existing

### Active

- [ ] Monorepo restructure — `backend/` and `frontend/` folders; all Python files move to `backend/`
- [ ] Vite + React frontend with shadcn/ui — port existing UI into React components
- [ ] Email OTP auth — replace password login with Resend-sent 6-digit code; no stored passwords
- [ ] Flask API adapted for React — CORS config, JSON auth responses, token or session for React
- [ ] Render deploy config — two services: Flask Web Service + React Static Site
- [ ] Vite proxy config — dev server proxies `/api`, `/ask`, `/address-review` to Flask

### Out of Scope

- JWT token auth — session cookies + OTP is sufficient; JWT adds complexity without benefit for v1
- Next.js — Flask handles all data; SSR framework not needed
- User accounts / profiles — single shared workspace is the current model
- Re-ingestion pipeline changes — `ingest.py` works and is out of scope for this milestone
- Multi-dyno / PostgreSQL migration — SQLite on Render with a persistent disk is acceptable for now

## Context

**Existing stack:**
- Python 3.13, Flask 3.1.1, gunicorn, flask-limiter
- OpenAI Responses API (streaming), FAISS vector index, SQLite for cache/audit
- Tampa ArcGIS REST APIs for GIS data (geocode, zoning, overlays, parcel)
- Currently deployed on Render as a single web service via `Procfile`

**Frontend today:**
- ~1,100 lines of HTML/CSS/JS inlined as Python string literals (`HTML` and `LOGIN_HTML` in `code_website.py`)
- Vanilla JS — no framework, all state in browser variables
- Dark theme, tabs for Code Search vs Address Review, streaming result rendering

**Streaming protocol (must be preserved):**
- Newline-delimited JSON over `text/plain` — NOT SSE
- Events: `delta` (text token), `sources` (chunks/requirements), `meta` (GIS context), `error`

**Auth today:**
- Single shared password in `APP_LOGIN_PASSWORD` env var
- Flask signed session cookie (`session["authenticated"]`)

**Render deployment:**
- Currently: single Web Service running gunicorn
- After split: Flask Web Service (backend) + Static Site (React build)

## Constraints

- **Stack**: Backend stays Python/Flask — no rewrite
- **Streaming**: React must handle the existing NDJSON streaming protocol — no changes to backend event format
- **Compatibility**: All existing API routes must keep the same paths and response shapes
- **Deploy**: Render (already in use) — two-service approach
- **Email**: Resend for OTP delivery — must add `resend` Python package to backend

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Monorepo over separate repos | Simpler to manage, atomic commits span both frontend and backend | — Pending |
| Email OTP via Resend (no passwords) | User preference; Resend has simple API and generous free tier | — Pending |
| shadcn/ui for React components | Modern, accessible, composable — fits a "fresh design" goal | — Pending |
| Session cookie auth (not JWT) | Simpler migration from existing Flask sessions; React reads httpOnly cookie | — Pending |
| Two Render services | Standard pattern; React static site is free tier on Render | — Pending |
| Vite proxy for dev | Eliminates CORS config during development | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-16 after initialization*
