# Requirements: Tampa Code AI — Frontend/Backend Split

**Defined:** 2026-04-16
**Core Value:** Users can instantly get permit code requirements for any Tampa address or question — the split must not break this core flow.

## v1 Requirements

### Repo Structure

- [ ] **REPO-01**: Backend Python files (`code_website.py`, `search.py`, `tampa_gis.py`, `ingest.py`, `requirements.txt`, `Procfile`, data files) are moved into a `backend/` directory
- [ ] **REPO-02**: A `frontend/` directory is created with a Vite + React scaffold
- [ ] **REPO-03**: Root-level `README.md` documents the monorepo layout and local dev setup

### Auth

- [ ] **AUTH-01**: User can enter their email address to request a login OTP code
- [ ] **AUTH-02**: User receives a 6-digit OTP code via Resend email within 30 seconds
- [ ] **AUTH-03**: User can enter the OTP code to authenticate and receive a session cookie
- [ ] **AUTH-04**: OTP codes expire after 10 minutes and can only be used once
- [ ] **AUTH-05**: User session persists across browser refresh (httpOnly cookie)
- [ ] **AUTH-06**: User can log out, clearing the session
- [ ] **AUTH-07**: Unauthenticated requests to protected API routes return HTTP 401
- [ ] **AUTH-08**: Flask backend exposes `/api/auth/request-otp` and `/api/auth/verify-otp` endpoints

### Frontend — Core UI

- [ ] **UI-01**: React app renders a login page when unauthenticated (email input → OTP input flow)
- [ ] **UI-02**: React app renders the main app layout after authentication (tabs: Code Search, Address Review)
- [ ] **UI-03**: Code Search tab: user can type a question and receive a streaming answer with source citations
- [ ] **UI-04**: Address Review tab: user can enter an address (with autocomplete), select permit type, describe project, and receive streaming permit requirements
- [ ] **UI-05**: Streaming responses render token-by-token as they arrive from the backend
- [ ] **UI-06**: Source citations and permit requirement lists render correctly after streaming completes
- [ ] **UI-07**: Property context card (zoning, overlays, folio) displays during address review
- [ ] **UI-08**: User can export permit requirements as CSV
- [ ] **UI-09**: User can flag an answer as unhelpful (feedback)
- [ ] **UI-10**: UI is built with shadcn/ui components — fresh modern design

### Frontend — Dev Config

- [ ] **DEV-01**: Vite dev server proxies `/api/*`, `/ask`, `/address-review` to Flask backend (no CORS config needed)
- [ ] **DEV-02**: Frontend `.env` has `VITE_API_BASE_URL` for switching between dev and prod

### Deployment

- [ ] **DEPLOY-01**: `backend/` is deployable as a Render Web Service (gunicorn, existing Procfile adapted)
- [ ] **DEPLOY-02**: `frontend/` is deployable as a Render Static Site (`npm run build` → `dist/`)
- [ ] **DEPLOY-03**: Flask CORS config allows requests from the Render frontend URL in production
- [ ] **DEPLOY-04**: Render environment variables documented (which vars each service needs)

## v2 Requirements

### Auth Enhancements

- **AUTH-V2-01**: Rate limit OTP requests per email address (prevent abuse)
- **AUTH-V2-02**: Admin dashboard to view audit log and feedback log
- **AUTH-V2-03**: Multiple allowed emails (invite-only access list)

### UI Enhancements

- **UI-V2-01**: Mobile-responsive layout
- **UI-V2-02**: PDF viewer embedded in frontend (currently served directly from Flask)
- **UI-V2-03**: Dark/light mode toggle

## Out of Scope

| Feature | Reason |
|---------|--------|
| JWT tokens | Session cookies + OTP sufficient; JWT adds complexity without benefit |
| Next.js | Flask handles all data; SSR not needed |
| User accounts / profiles | Single shared workspace model is sufficient |
| Re-ingestion pipeline changes | `ingest.py` works; not part of this milestone |
| PostgreSQL migration | SQLite on Render persistent disk is acceptable |
| OAuth (Google, GitHub) | Email OTP is simpler and sufficient |
| Real-time features (websockets) | NDJSON streaming over HTTP is sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REPO-01 | Phase 1 | Pending |
| REPO-02 | Phase 1 | Pending |
| REPO-03 | Phase 1 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 2 | Pending |
| AUTH-06 | Phase 2 | Pending |
| AUTH-07 | Phase 2 | Pending |
| AUTH-08 | Phase 2 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| UI-05 | Phase 3 | Pending |
| UI-06 | Phase 3 | Pending |
| UI-07 | Phase 3 | Pending |
| UI-08 | Phase 3 | Pending |
| UI-09 | Phase 3 | Pending |
| UI-10 | Phase 3 | Pending |
| DEV-01 | Phase 1 | Pending |
| DEV-02 | Phase 1 | Pending |
| DEPLOY-01 | Phase 4 | Pending |
| DEPLOY-02 | Phase 4 | Pending |
| DEPLOY-03 | Phase 4 | Pending |
| DEPLOY-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-16*
*Last updated: 2026-04-16 after initial definition*
