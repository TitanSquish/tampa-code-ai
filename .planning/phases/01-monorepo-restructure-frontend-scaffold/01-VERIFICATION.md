---
phase: 01-monorepo-restructure-frontend-scaffold
verified: 2026-04-16T23:45:00Z
re_verified: 2026-04-16T23:55:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
gaps: []
gap_fixes:
  - gap: "frontend/src/lib/utils.ts missing"
    fix: "Created and committed in fix(01-02): add missing utils.ts and scope lib/ gitignore to root only. Also fixed .gitignore /lib/ root-anchoring."
  - gap: "frontend/.env missing"
    fix: "Created frontend/.env locally with VITE_API_BASE_URL= (gitignored by design)"
  - gap: "root node_modules absent"
    fix: "Ran npm install at repo root — concurrently 9.2.1 confirmed"
  - gap: "Human checkpoint never completed"
    fix: "User approved checkpoint — typed 'approved' after Wave 1 merge"
---

# Phase 1: Monorepo Restructure & Frontend Scaffold — Verification Report

**Phase Goal:** The repo is a two-folder monorepo where the existing Flask backend still runs unchanged from `backend/` and a fresh Vite + React app in `frontend/` proxies API calls to it during local development.
**Verified:** 2026-04-16T23:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All existing Python files live under `backend/` and Flask boots with `gunicorn code_website:app` | VERIFIED | All 7 files present at `backend/`. `grep "app = Flask(__name__)" backend/code_website.py` — found. `load_dotenv()` present. Module imports (`from search import`, `from tampa_gis import`) intact. `git log --follow backend/code_website.py` shows 5+ commits including pre-move history. Procfile contains correct gunicorn command. |
| 2 | `frontend/` contains a working Vite + React scaffold that runs with `npm run dev` and renders a placeholder page | FAILED | `frontend/src/lib/utils.ts` does not exist. All 6 shadcn components import `cn` from `@/lib/utils` — build would fail. `frontend/node_modules/` also absent (npm install not run). Plan 02 Task 2 (human-verify) was never approved — SUMMARY states "awaiting user approval." |
| 3 | Requests from Vite dev server to `/api/*`, `/ask`, `/address-review` reach Flask without CORS | FAILED | Proxy config in `vite.config.ts` is correctly written with 3 rules targeting `http://localhost:5000`. No `rewrite` rule. Config is correct but the dev server cannot start (missing utils.ts, missing node_modules). Human verification checkpoint never completed. |
| 4 | `frontend/.env` exposes `VITE_API_BASE_URL` and frontend uses it to switch between dev and prod | FAILED | `frontend/.env` does not exist on the filesystem. It is gitignored via `.env.*` pattern and was not created or was lost. `frontend/.env.example` exists and correctly documents `VITE_API_BASE_URL=`. |
| 5 | Root `README.md` documents monorepo layout, how to run backend and frontend locally, and required env vars | VERIFIED | `README.md` exists at repo root, 209 lines. Contains all required sections: Repository Layout, Prerequisites, First-Time Setup, Running Locally, How the Dev Proxy Works, Production Build/Run, Gotchas, Project Phases. All env vars documented (OPENAI_API_KEY, FLASK_SECRET_KEY, APP_LOGIN_PASSWORD, VITE_API_BASE_URL). `python ingest.py` documented. `.env.example` references present. |

**Score:** 2/5 roadmap truths verified (3 failed)

*Note: The root `package.json` concurrently script and the 3rd party dependency install are required to achieve SC-2. They are verified as structurally correct but not functionally runnable due to missing `node_modules/`.*

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/code_website.py` | Flask app | VERIFIED | Present, contains `app = Flask(__name__)` |
| `backend/search.py` | FAISS search module | VERIFIED | Present, contains `def search_with_distances` |
| `backend/tampa_gis.py` | ArcGIS client | VERIFIED | Present, contains `def get_tampa_property_context` |
| `backend/ingest.py` | PDF ingestion CLI | VERIFIED | Present |
| `backend/requirements.txt` | Python dependencies | VERIFIED | Present, contains `flask` |
| `backend/Procfile` | gunicorn command | VERIFIED | Contains `gunicorn code_website:app` verbatim |
| `backend/data/parse_tampa_docs.py` | Alternate PDF parser | VERIFIED | Present |
| `backend/.env.example` | Env var template | VERIFIED | Contains OPENAI_API_KEY=, FLASK_SECRET_KEY= |
| `.gitignore` | Updated ignore rules | VERIFIED | Contains `**/data/*.pdf`, `node_modules/`, `frontend/dist/`, `frontend/.vite/`. `backend/.env` is ignored, `backend/.env.example` is tracked. |
| `frontend/package.json` | Frontend manifest | VERIFIED | Present, contains vite, react, tailwindcss@^4 |
| `frontend/vite.config.ts` | Vite config with proxy | VERIFIED | Proxy for /api, /ask, /address-review to :5000. @/* alias. tailwindcss() plugin. No rewrite. |
| `frontend/tsconfig.json` | TS root config | VERIFIED | Contains `@/*: ./src/*` path alias |
| `frontend/tsconfig.app.json` | TS app config | VERIFIED | Contains `@/*: ./src/*` and `baseUrl: "."` |
| `frontend/src/main.tsx` | Entry point | VERIFIED | BrowserRouter from `"react-router"`, React.StrictMode |
| `frontend/src/App.tsx` | Route table | VERIFIED | /login, /app, wildcard→/login routes. Imports from `"react-router"`. |
| `frontend/src/index.css` | Tailwind v4 + theme | VERIFIED | `@import "tailwindcss"`, `@import "@fontsource-variable/geist"`, correct CSS variables (--primary: oklch(0.49 0.19 255), --radius: 0.5rem) |
| `frontend/src/pages/LoginPage.tsx` | Login placeholder | VERIFIED | Contains "Tampa Code AI", "Tampa building permit code assistant", "Email address", "Continue with Email", `disabled` on Button |
| `frontend/src/pages/AppShell.tsx` | App shell placeholder | VERIFIED | Contains "Code Search", "Address Review", "Coming in Phase 3", TabsTrigger, max-w-[72ch] |
| `frontend/components.json` | shadcn config | PARTIAL | Present. Contains `"tailwind"` key and CSS path. Plan specified `contains: "tailwindcss"` but shadcn init used `base-nova` style / `neutral` base — config structure differs from plan spec but functions correctly. |
| `frontend/src/components/ui/button.tsx` | shadcn Button | VERIFIED | Present |
| `frontend/src/components/ui/input.tsx` | shadcn Input | VERIFIED | Present |
| `frontend/src/components/ui/label.tsx` | shadcn Label | VERIFIED | Present |
| `frontend/src/components/ui/tabs.tsx` | shadcn Tabs | VERIFIED | Present, contains `TabsTrigger` |
| `frontend/src/components/ui/card.tsx` | shadcn Card | VERIFIED | Present |
| `frontend/src/components/ui/badge.tsx` | shadcn Badge | VERIFIED | Present |
| `frontend/src/lib/utils.ts` | shadcn cn utility | MISSING | File does not exist. All 6 shadcn components import `cn` from `@/lib/utils`. Build fails without it. |
| `frontend/.env` | Local dev env | MISSING | File does not exist on filesystem. Gitignored — was not committed and was either not created or cleaned up. |
| `frontend/.env.example` | Frontend env template | VERIFIED | Present, contains `VITE_API_BASE_URL=` |
| `README.md` | Monorepo documentation | VERIFIED | 209 lines, all required sections and env vars documented |
| `package.json` (root) | concurrently dev script | VERIFIED | Contains `"dev"` script with `concurrently -n backend,frontend`, `cd backend`, `cd frontend && npm run dev`, `concurrently ^9.2.1` in devDependencies |
| `package-lock.json` (root) | Root lockfile | VERIFIED | Present and tracked by git |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/ CWD` | `backend/code_website.py` module imports | Python path + relative imports | VERIFIED | `from search import search_with_distances` and `from tampa_gis import ...` confirmed in code_website.py |
| `backend/code_website.py load_dotenv()` | `backend/.env` | python-dotenv CWD lookup | VERIFIED | `load_dotenv()` present in code_website.py |
| `backend/search.py INDEX_PATH` | `backend/tampa_code.index` | relative path from backend/ CWD | VERIFIED | `INDEX_PATH = "tampa_code.index"` found in search.py |
| `frontend/src/main.tsx` | `frontend/src/App.tsx` | BrowserRouter wraps App | VERIFIED | `<BrowserRouter><App /></BrowserRouter>` confirmed |
| `frontend/src/App.tsx` | `LoginPage.tsx` and `AppShell.tsx` | react-router `<Route element={...}>` | VERIFIED | Both routes confirmed with correct paths |
| `frontend/vite.config.ts` proxy | `http://localhost:5000` (Flask) | server.proxy configuration | VERIFIED (config only) | All 3 proxy rules present, targeting :5000, no rewrite |
| `frontend/src/components/ui/*.tsx` | `@/lib/utils` | cn import | BROKEN | All 6 components import `cn` from `@/lib/utils` but the file does not exist |

### Data-Flow Trace (Level 4)

Not applicable — this phase delivers structural scaffolding and placeholder UI only. LoginPage and AppShell render static copy with no dynamic data. No data-flow verification needed.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend modules import cleanly from backend/ | `cd backend && python -c "import code_website"` | Import succeeded (confirmed by SUMMARY and git history) | PASS (per SUMMARY) |
| Frontend build succeeds | `cd frontend && npm run build` | Cannot verify — node_modules missing, utils.ts missing | SKIP (broken prerequisites) |
| Root concurrently resolves | `npx concurrently --version` | node_modules/ absent at repo root | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| REPO-01 | 01-01-PLAN.md | Backend Python files moved into `backend/` | SATISFIED | All 7 files present at backend/, git mv history preserved |
| REPO-02 | 01-02-PLAN.md | `frontend/` directory with Vite + React scaffold | BLOCKED | frontend/ exists and most files are present, but utils.ts missing and node_modules absent — scaffold is not runnable |
| REPO-03 | 01-03-PLAN.md | Root README.md documents monorepo layout and local dev setup | SATISFIED | README.md 209 lines, all required content present |
| DEV-01 | 01-02-PLAN.md | Vite dev server proxies API routes to Flask (no CORS config needed) | BLOCKED | Proxy config correct in code, but dev server not runnable due to missing utils.ts and node_modules; human checkpoint never completed |
| DEV-02 | 01-02-PLAN.md | `frontend/.env` has `VITE_API_BASE_URL` | BLOCKED | frontend/.env does not exist on filesystem |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/components/ui/button.tsx` | 1 | `import { cn } from "@/lib/utils"` — target does not exist | Blocker | All 6 shadcn components fail to resolve this import; build fails |
| `frontend/src/pages/AppShell.tsx` | 36, 45 | `<Badge variant="secondary">Coming in Phase 3</Badge>` | Info | Intentional placeholder per D-08; Phase 3 will replace |
| `frontend/src/pages/LoginPage.tsx` | 29 | `<Button ... disabled>` | Info | Intentional per D-08; Phase 2 will wire OTP auth |

### Human Verification Required

#### 1. Visual Rendering of /login and /app Routes

**Test:** After fixing utils.ts and running `npm install`, start Vite (`cd frontend && npm run dev`). Visit http://localhost:5173/login and http://localhost:5173/app in a browser.
**Expected:** /login shows "Tampa Code AI" title, email input, disabled "Continue with Email" button, muted footer. /app shows header bar + Code Search/Address Review tabs with "Coming in Phase 3" badges. http://localhost:5173/ redirects to /login.
**Why human:** Visual appearance and CSS rendering cannot be verified programmatically.

#### 2. Vite Proxy Verification

**Test:** With both servers running (Flask on :5000, Vite on :5173), run: `curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:5173/api/address-suggest?q=test`
**Expected:** A numeric HTTP status code from Flask (not "connection refused"). Flask terminal should show a request log line.
**Why human:** Requires both servers running simultaneously.

#### 3. No CORS Errors in Browser

**Test:** Open browser DevTools on http://localhost:5173/login with both servers running.
**Expected:** No CORS errors in the Console tab.
**Why human:** Browser CORS behavior cannot be verified with static analysis.

### Gaps Summary

**3 gaps blocking goal achievement:**

**Gap 1 — Missing `frontend/src/lib/utils.ts` (BLOCKER):** The shadcn CLI initialized components that depend on a `cn` utility function (`clsx + tailwind-merge`). This file should be at `frontend/src/lib/utils.ts`. The SUMMARY claims it was created, but it does not exist in the committed codebase or on the filesystem. This is the root cause blocking the entire frontend from building. All 6 UI components fail without it.

**Gap 2 — Missing `frontend/.env` (BLOCKER for SC-4):** The plan required creating `frontend/.env` with `VITE_API_BASE_URL=` for local dev. This is a gitignored file that must exist on the filesystem. It was either never created or was cleaned up. Without it, VITE_API_BASE_URL is undefined and Roadmap SC-4 is unmet.

**Gap 3 — Human checkpoint never completed (BLOCKER for SC-2 and SC-3):** Plan 02 Task 2 is a blocking human-verify gate. The SUMMARY explicitly states it is "awaiting user approval." This checkpoint requires the developer to run both servers and visually confirm the UI renders correctly and the proxy reaches Flask. It was never passed.

**Gap 4 — Root `node_modules/` missing (BLOCKER for `npm run dev` at repo root):** The `concurrently` package was installed as documented in SUMMARY and `package-lock.json` is committed, but `node_modules/` is absent from the repo root. `npm install` must be run at the repo root before `npm run dev` can work.

**Root cause analysis:** Gaps 1, 2, and 4 likely stem from the same event — a filesystem cleanup or machine change that removed gitignored directories and files after the executor ran. The committed codebase is structurally correct. The three missing items (`frontend/src/lib/utils.ts`, `frontend/.env`, `node_modules/`) need to be recreated. Gap 3 (human checkpoint) is a process gap independent of the code state.

---

_Verified: 2026-04-16T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
