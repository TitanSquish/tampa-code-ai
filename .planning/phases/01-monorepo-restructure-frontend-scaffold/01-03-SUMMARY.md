---
phase: 01-monorepo-restructure-frontend-scaffold
plan: 03
subsystem: docs
tags:
  - docs
  - monorepo
  - dev-experience
dependency_graph:
  requires:
    - 01-01 (backend/ directory with all Python files)
    - 01-02 (frontend/ scaffold with Vite + React)
  provides:
    - README.md (root — single source of truth for onboarding and local dev)
    - package.json (root — concurrently dev convenience script)
  affects:
    - Developer onboarding flow
tech_stack:
  added:
    - concurrently ^9.2.1 (root devDependency)
  patterns:
    - Root package.json with concurrently for parallel dev process management
    - Separate .env files per service (backend/.env, frontend/.env)
key_files:
  created:
    - README.md
    - package.json
    - package-lock.json
  modified: []
decisions:
  - "Used concurrently (not two-terminal only) per CONTEXT.md Claude's Discretion + RESEARCH.md recommendation for cross-platform safety"
  - "Pinned concurrently to ^9.2.1 per RESEARCH.md Standard Stack verification"
  - "Committed package-lock.json (not gitignored) for reproducible installs per T-01-14 supply chain mitigation"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-16T23:24:33Z"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 1 Plan 3: Developer Documentation and Root Dev Script Summary

**One-liner:** Root README with full monorepo onboarding docs plus concurrently root package.json for single-command `npm run dev`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write root README.md documenting the monorepo and local dev | e350c23 | README.md (209 lines) |
| 2 | Create root package.json with concurrently dev script | c49331f | package.json, package-lock.json |

## What Was Built

### README.md (209 lines)

Complete developer documentation covering:

- **Repository Layout** — annotated directory tree with `backend/` and `frontend/` components
- **Prerequisites** — Python 3.13+, Node.js 20.19+, npm 10+, OpenAI API key
- **First-Time Setup** — four numbered steps: clone + install, configure env vars, add PDFs, build FAISS index
- **Running Locally** — Option A (single `npm run dev` via concurrently) and Option B (two terminals)
- **How the Dev Proxy Works** — explains Vite proxy forwarding to Flask on port 5000, why no CORS config needed in dev, and how production differs
- **Production Build (Frontend)** — `npm run build` → `frontend/dist/`
- **Production Run (Backend)** — gunicorn command matching `backend/Procfile`
- **Gotchas** — six pitfalls from RESEARCH.md: Flask CWD, ingest CWD, .env placement, Tailwind v4 config files, react-router package name, VITE_* secret exposure
- **Project Phases** — four-phase roadmap overview with link to `.planning/ROADMAP.md`

All required env vars documented with required/optional distinction:
- Backend required: `OPENAI_API_KEY`, `FLASK_SECRET_KEY`, `APP_LOGIN_PASSWORD`
- Backend optional: 10+ overrides with defaults listed
- Frontend: `VITE_API_BASE_URL` with dev-vs-prod behavior explained

### package.json + package-lock.json

Root `package.json` with exactly one script (`dev`) and one devDependency (`concurrently ^9.2.1`):

```json
{
  "name": "tampa-code-ai",
  "private": true,
  "version": "0.0.0",
  "description": "Tampa Code AI — monorepo root. Runs backend (Flask) and frontend (Vite) in parallel for local development.",
  "scripts": {
    "dev": "concurrently -n backend,frontend -c blue,green \"cd backend && python -m flask --app code_website run --port 5000\" \"cd frontend && npm run dev\""
  },
  "devDependencies": {
    "concurrently": "^9.2.1"
  }
}
```

`npm install` completed successfully. `concurrently 9.2.1` installed. `package-lock.json` committed (not gitignored).

### Concurrently version confirmed

```
9.2.1
```

### package-lock.json tracking confirmed

`git check-ignore -v package-lock.json` exits 1 — lockfile is tracked by git.

## Deviations from Plan

None — plan executed exactly as written. README content was derived from the exact spec in the plan task action block. Package.json content matches the specified structure.

## Known Stubs

None — this plan produces documentation and tooling only. No UI components or data flows.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan creates static documentation and a dev tooling config file. No threat flags.

T-01-12 (Secret leaks in README): Verified — README uses `sk-...` placeholder only, no real keys.
T-01-14 (Supply chain — concurrently version drift): Mitigated — pinned to `^9.2.1`, `package-lock.json` committed.

## Self-Check: PASSED

Files created:
- README.md: FOUND
- package.json: FOUND
- package-lock.json: FOUND

Commits:
- e350c23: FOUND (docs(01-03): add root README.md documenting monorepo layout and local dev)
- c49331f: FOUND (chore(01-03): add root package.json with concurrently dev script)
