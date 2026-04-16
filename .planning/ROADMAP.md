# Roadmap: Tampa Code AI — Frontend/Backend Split

## Overview

This milestone transforms Tampa Code AI from a ~1,100-line Flask monolith (with inlined HTML/JS) into a proper monorepo: a Python/Flask API backend and a modern Vite + React + shadcn/ui frontend. The journey runs foundation-first — restructure the repo and scaffold the React app with a working dev proxy so both sides can run concurrently (Phase 1); swap the shared password for email OTP auth via Resend with a session cookie surface React can consume (Phase 2); port the existing two-tab UI (Code Search, Address Review) into React components that correctly handle NDJSON streaming, citations, autocomplete, property context, CSV export, and feedback (Phase 3); and finally split the Render deployment into two services — a Flask Web Service and a React Static Site — with CORS and documented env vars (Phase 4). The core user flow (instant permit code requirements for any Tampa address or question) must remain intact end-to-end after every phase.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Monorepo Restructure & Frontend Scaffold** - Move backend to `backend/`, scaffold Vite+React in `frontend/`, wire dev proxy, document setup
- [ ] **Phase 2: Email OTP Authentication** - Replace shared password with Resend-based 6-digit OTP flow, session cookie, protected API routes
- [ ] **Phase 3: React UI Port** - Port Code Search + Address Review tabs into React with shadcn/ui, streaming, citations, autocomplete, export, feedback
- [ ] **Phase 4: Render Two-Service Deployment** - Deploy Flask backend as Web Service and React frontend as Static Site with CORS and documented env vars

## Phase Details

### Phase 1: Monorepo Restructure & Frontend Scaffold
**Goal**: The repo is a two-folder monorepo where the existing Flask backend still runs unchanged from `backend/` and a fresh Vite + React app in `frontend/` proxies API calls to it during local development.
**Depends on**: Nothing (first phase)
**Requirements**: REPO-01, REPO-02, REPO-03, DEV-01, DEV-02
**Success Criteria** (what must be TRUE):
  1. All existing Python files (`code_website.py`, `search.py`, `tampa_gis.py`, `ingest.py`, `requirements.txt`, `Procfile`, `data/`, index/chunks files) live under `backend/` and the Flask app still boots with `gunicorn code_website:app` from that directory
  2. A `frontend/` directory contains a working Vite + React scaffold that runs with `npm run dev` and renders a placeholder page
  3. Requests from the Vite dev server to `/api/*`, `/ask`, and `/address-review` reach the Flask backend without CORS configuration
  4. `frontend/.env` exposes `VITE_API_BASE_URL` and the frontend uses it to switch between dev and prod API origins
  5. Root `README.md` documents the monorepo layout, how to run backend and frontend locally, and the required env vars
**Plans:** 3 plans
Plans:
- [ ] 01-01-PLAN.md — Move backend Python/config files to `backend/` via `git mv`; create `backend/.env.example`; update root `.gitignore`
- [ ] 01-02-PLAN.md — Scaffold `frontend/` with Vite + React + TS + Tailwind v4 + shadcn/ui + React Router v7; wire Vite dev proxy to Flask on :5000; expose `VITE_API_BASE_URL`
- [ ] 01-03-PLAN.md — Write root `README.md` (monorepo layout, env vars, dev/prod commands); add root `package.json` with `concurrently` for `npm run dev`
**UI hint**: yes

### Phase 2: Email OTP Authentication
**Goal**: Users can sign in to Tampa Code AI using a one-time code emailed to them by Resend, with a session cookie the React app can rely on and protected API routes that reject unauthenticated callers.
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08
**Success Criteria** (what must be TRUE):
  1. A user can POST their email to `/api/auth/request-otp` and receive a 6-digit code via Resend email within 30 seconds
  2. A user can POST the code plus email to `/api/auth/verify-otp` and receive an httpOnly session cookie that persists across browser refresh
  3. OTP codes become invalid after 10 minutes or after a single successful verification, whichever comes first
  4. Authenticated users can log out via an endpoint that clears the session cookie
  5. Existing protected routes (`/ask`, `/address-review`, `/api/property-context`, `/api/feedback`, `/api/address-suggest`) return HTTP 401 when the session cookie is missing or invalid

### Phase 3: React UI Port
**Goal**: The React frontend fully replaces the inlined HTML/JS UI, delivering the login flow, both tabs (Code Search and Address Review), streaming answers, source citations, property context, CSV export, and feedback — all built with shadcn/ui.
**Depends on**: Phase 2
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10
**Success Criteria** (what must be TRUE):
  1. Unauthenticated users see a login page that collects email, then the OTP code, and transitions to the main app on success
  2. Authenticated users see the main app layout with two tabs (Code Search, Address Review) built from shadcn/ui components
  3. On the Code Search tab, a user can submit a question and watch the answer render token-by-token as NDJSON `delta` events arrive, followed by a source citation list
  4. On the Address Review tab, a user can pick an address with autocomplete, see property context (zoning, overlays, folio), choose a permit type, describe their project, and receive streaming permit requirements parsed into a structured list
  5. A user can export the current permit requirements as CSV and flag any answer as unhelpful via a feedback control
**Plans**: TBD
**UI hint**: yes

### Phase 4: Render Two-Service Deployment
**Goal**: The application runs in production on Render as two independent services — a Flask Web Service serving the API and a Static Site serving the built React frontend — with CORS properly configured and every required environment variable documented.
**Depends on**: Phase 3
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04
**Success Criteria** (what must be TRUE):
  1. The `backend/` directory deploys cleanly to a Render Web Service using an adapted Procfile and gunicorn, and all existing API routes respond at the service URL
  2. The `frontend/` directory deploys cleanly to a Render Static Site where `npm run build` emits `dist/` and the site loads in a browser
  3. From the production Static Site URL, a logged-in user can complete both a code search and an address review end-to-end — including streaming responses — without CORS errors
  4. The repo documents which Render environment variables each service requires (OpenAI key, Flask secret, Resend key, frontend API base URL, allowed CORS origin, etc.)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Monorepo Restructure & Frontend Scaffold | 0/3 | Not started | - |
| 2. Email OTP Authentication | 0/TBD | Not started | - |
| 3. React UI Port | 0/TBD | Not started | - |
| 4. Render Two-Service Deployment | 0/TBD | Not started | - |
