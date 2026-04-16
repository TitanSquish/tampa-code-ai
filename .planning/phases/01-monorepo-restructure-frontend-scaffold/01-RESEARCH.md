# Phase 1: Monorepo Restructure & Frontend Scaffold — Research

**Researched:** 2026-04-16
**Domain:** Git-based file reorganization, Vite + React + TypeScript scaffold, shadcn/ui, Vite dev proxy
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Files that move to `backend/`: `code_website.py`, `search.py`, `tampa_gis.py`, `ingest.py`, `requirements.txt`, `Procfile`, and the entire `data/` directory (renamed `backend/data/`).
- **D-02:** `.env` moves to `backend/.env`. Flask is run from `backend/` so `python-dotenv` finds it automatically.
- **D-03:** Root-level config files stay at root: `.gitignore`, `skills-lock.json`, `.planning/`, `.agents/`, `.claude/`, and the new `README.md`.
- **D-04:** Runtime-generated artifacts (`tampa_code.index`, `chunks.json`, `permitiq.db`) are gitignored. After the move they are generated inside `backend/` at runtime — no git action needed, but README must document that `python ingest.py` and Flask must be run from `backend/`.
- **D-05:** `ingest.py` stays in `backend/` (not a separate top-level script). Developers run it from `backend/`.
- **D-06:** Full tooling initialized in Phase 1: Vite + React + TypeScript + Tailwind CSS + shadcn/ui + React Router.
- **D-07:** TypeScript throughout.
- **D-08:** Placeholder page is a minimal app shell with routing stubs: `/login` and `/app` routes wired up with placeholder content (not blank).
- **D-09:** Vite `vite.config.ts` proxy targets `http://localhost:5000`. Proxy rules cover `/api/*`, `/ask`, `/address-review`. No CORS config needed on Flask for local dev.
- **D-10:** `frontend/.env` exposes `VITE_API_BASE_URL`. During dev it is empty (Vite proxy handles routing). In production it points to the Render Flask service URL.
- **D-11:** Root `README.md` documents: monorepo layout, how to run Flask from `backend/`, how to run Vite dev server from `frontend/`, and all required env vars.

### Claude's Discretion

- Concurrent dev setup: whether to add a root `package.json` with `concurrently` scripts or just document two-terminal setup in README is left to Claude.
- Node.js version: use whatever is current LTS; no constraint specified.
- shadcn/ui component initialization: which base components to pre-install (if any) is Claude's call — the requirement is that shadcn/ui is configured and usable.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REPO-01 | Backend Python files moved into `backend/` directory | Git mv pattern; runtime artifact handling; `.gitignore` update for new paths |
| REPO-02 | `frontend/` directory created with Vite + React scaffold | Vite `create vite@latest --template react-ts`; full shadcn/ui init chain |
| REPO-03 | Root-level `README.md` documents monorepo layout and local dev setup | Content spec derived from D-11 + env var inventory from STACK.md |
| DEV-01 | Vite dev server proxies `/api/*`, `/ask`, `/address-review` to Flask (no CORS) | Vite `server.proxy` config; no `rewrite` needed because Flask expects full paths |
| DEV-02 | Frontend `.env` has `VITE_API_BASE_URL` for dev/prod switching | Vite env var prefix convention; `.env.example` pattern |

</phase_requirements>

---

## Summary

Phase 1 is a structural reorganization phase with no logic changes. It has two independent workstreams: (1) moving the existing Flask monolith into a `backend/` subdirectory using `git mv` to preserve history, and (2) scaffolding a new Vite + React + TypeScript + shadcn/ui frontend in `frontend/`. These two workstreams can be planned as sequential tasks (backend move first, then frontend scaffold) or in independent waves.

The backend move is the simpler task — no code changes are needed because all path references use relative paths (`data/`, `tampa_code.index`, `chunks.json`, `permitiq.db`) and `python-dotenv` loads `.env` from the working directory. As long as Flask is run from `backend/`, everything resolves correctly. The only required update is the `.gitignore` — gitignored paths like `*.index`, `*.db`, `chunks.json` are already root-relative globs, so they continue matching files inside `backend/` without changes.

The frontend scaffold follows the official shadcn/ui Vite installation flow. The current standard stack (as of April 2026) uses Tailwind CSS v4 via the `@tailwindcss/vite` Vite plugin — not v3 with PostCSS. This is a material difference from training-era knowledge and has been verified against the current npm registry and official docs. The Vite dev proxy eliminates all CORS configuration during local development: requests to `/api/*`, `/ask`, and `/address-review` are transparently forwarded to `http://localhost:5000` without path rewriting (Flask already handles these paths with their full prefixes).

**Primary recommendation:** Use `git mv` for the backend restructure (history preservation), scaffold `frontend/` with `npm create vite@latest frontend -- --template react-ts`, then follow the official shadcn/ui Vite manual setup with Tailwind v4. Add a root `package.json` with `concurrently` for the dev convenience script (Claude's discretion; recommended).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File reorganization | — (git operation) | — | Pure filesystem/VCS work, no runtime tier |
| Flask API serving | Backend (Python/Flask) | — | Unchanged; all routes stay in `code_website.py` |
| Static asset serving (dev) | Frontend (Vite dev server) | — | Vite serves `frontend/` in dev |
| API request proxying (dev) | Frontend (Vite dev server) | Backend (Flask) | Vite proxy forwards to Flask; no CORS needed |
| React rendering | Browser | Frontend build (Vite) | SPA; Vite bundles, browser renders |
| Environment config (frontend) | Frontend (Vite build) | — | `VITE_*` vars baked at build time |
| Environment config (backend) | Backend (python-dotenv) | — | `.env` in `backend/` loaded at Flask startup |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vite | 8.0.8 | Frontend build tool and dev server | Current standard for React SPAs; instant HMR |
| @vitejs/plugin-react | 6.0.1 | React fast refresh plugin for Vite | Official React plugin for Vite |
| react | 19.2.5 | UI library | Project requirement |
| react-dom | 19.2.5 | React DOM renderer | Required with react |
| typescript | (bundled with template) | Type safety | D-07 locked |
| tailwindcss | 4.2.2 | Utility-first CSS | Locked via D-06; shadcn/ui requires it |
| @tailwindcss/vite | 4.2.2 | Tailwind v4 Vite plugin | Replaces PostCSS config in Tailwind v4 |
| shadcn/ui (CLI) | 4.3.0 | Component scaffolding CLI | D-06 locked; copies components into project |
| react-router | 7.14.1 | Client-side routing | D-06 locked; declarative mode for SPA |
| lucide-react | 1.8.0 | Icon library | Default for shadcn/ui projects per UI-SPEC |
| geist | 1.7.0 | Font package | UI-SPEC locked font choice |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| concurrently | 9.2.1 | Run multiple npm scripts in parallel | Root `package.json` dev convenience script (Claude's discretion) |
| @types/node | (devDep) | Node.js types for `path` in vite.config.ts | Required for `path.resolve(__dirname, ...)` in Vite config |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tailwindcss v4 + @tailwindcss/vite | tailwindcss v3 + postcss | v3 requires postcss.config.js and tailwind.config.js; v4 is the current shadcn/ui default and simpler |
| react-router (library mode) | react-router framework mode | Framework mode requires a root.tsx entry and changes Vite config significantly; library mode is lighter for an SPA |
| concurrently | npm-run-all2 | Either works; concurrently has more active maintenance and better output coloring |

**Installation (frontend):**
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss @tailwindcss/vite @types/node
npm install react-router lucide-react geist
npx shadcn@latest init
npx shadcn@latest add button input label tabs card badge
```

**Version verification (performed 2026-04-16):**
- `vite`: 8.0.8 [VERIFIED: npm registry]
- `react`: 19.2.5 [VERIFIED: npm registry]
- `@vitejs/plugin-react`: 6.0.1 [VERIFIED: npm registry]
- `tailwindcss` / `@tailwindcss/vite`: 4.2.2 [VERIFIED: npm registry]
- `shadcn`: 4.3.0 [VERIFIED: npm registry]
- `react-router`: 7.14.1 [VERIFIED: npm registry]
- `lucide-react`: 1.8.0 [VERIFIED: npm registry]
- `geist`: 1.7.0 [VERIFIED: npm registry]
- `concurrently`: 9.2.1 [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
Developer Workstation
│
├─ Terminal A: cd backend && flask run / gunicorn
│   └─ Flask (localhost:5000)
│       ├─ GET/POST /ask          ──► FAISS + OpenAI ──► NDJSON stream
│       ├─ POST /address-review   ──► GIS + OpenAI ──► NDJSON stream
│       └─ GET /api/*             ──► GIS / feedback / property context
│
└─ Terminal B: cd frontend && npm run dev
    └─ Vite dev server (localhost:5173)
        ├─ Serves React SPA (static assets)
        ├─ /api/* ──proxy──► localhost:5000/api/*
        ├─ /ask   ──proxy──► localhost:5000/ask
        └─ /address-review ──proxy──► localhost:5000/address-review
            │
            └─ Browser
                └─ React SPA
                    ├─ Route /login  ──► LoginPage (placeholder)
                    └─ Route /app    ──► AppShell (placeholder)
```

### Recommended Project Structure

```
tampa-code-ai/              # git root
├── backend/                # Python/Flask backend
│   ├── code_website.py
│   ├── search.py
│   ├── tampa_gis.py
│   ├── ingest.py
│   ├── requirements.txt
│   ├── Procfile
│   ├── .env                # (gitignored)
│   └── data/               # Tampa code PDFs + parse script
│       └── parse_tampa_docs.py
├── frontend/               # Vite + React + TypeScript SPA
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/         # shadcn/ui copied components
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   └── AppShell.tsx
│   │   ├── App.tsx         # Route definitions
│   │   ├── main.tsx        # BrowserRouter + ReactDOM.render
│   │   └── index.css       # @import "tailwindcss" + CSS vars
│   ├── .env                # VITE_API_BASE_URL= (empty for dev)
│   ├── .env.example        # VITE_API_BASE_URL=https://...
│   ├── vite.config.ts      # proxy + @/* alias + tailwind plugin
│   ├── tsconfig.json       # baseUrl + paths for @/*
│   ├── tsconfig.app.json   # same
│   └── package.json
├── package.json            # (optional) concurrently dev script
├── .gitignore              # root-level; covers backend/ and frontend/
├── skills-lock.json
└── README.md               # monorepo layout + dev instructions
```

### Pattern 1: Vite Dev Server Proxy (DEV-01)

**What:** The Vite dev server intercepts requests whose paths match the proxy rules and forwards them to the Flask backend. No `rewrite` is needed because Flask's routes already use the full paths (`/api/address-suggest`, `/ask`, `/address-review`).

**When to use:** Any request from the React SPA to a Flask endpoint during local dev.

**Example:**
```typescript
// Source: https://vite.dev/config/server-options.html#server-proxy
// frontend/vite.config.ts
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        // No rewrite — Flask expects /api/* paths as-is
      },
      "/ask": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/address-review": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
})
```

### Pattern 2: React Router Declarative Mode (library mode)

**What:** BrowserRouter wraps the app in `main.tsx`; Routes/Route components define the page tree in `App.tsx`. This is the lightweight declarative mode (not framework mode, which would require a root.tsx).

**When to use:** All client-side routing in the SPA.

**Example:**
```tsx
// Source: https://reactrouter.com/start/library/installation
// frontend/src/main.tsx
import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router"
import App from "./App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)

// frontend/src/App.tsx
import { Routes, Route, Navigate } from "react-router"
import LoginPage from "./pages/LoginPage"
import AppShell from "./pages/AppShell"

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={<AppShell />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
```

### Pattern 3: Tailwind v4 CSS Variable Setup

**What:** Tailwind v4 uses a single CSS import; no `tailwind.config.js` needed. Custom CSS variables for shadcn/ui go in `index.css` after the import.

**When to use:** Replacing Tailwind v3 PostCSS setup; first-time Tailwind v4 setup.

**Example:**
```css
/* Source: https://ui.shadcn.com/docs/installation/vite */
/* frontend/src/index.css */
@import "tailwindcss";

:root {
  --background:        oklch(0.975 0.005 240);
  --foreground:        oklch(0.14  0.015 240);
  /* ... full CSS variable block from UI-SPEC ... */
  --radius: 0.5rem;
}
```

### Pattern 4: Backend File Move with git mv

**What:** Moving Python source files to `backend/` using `git mv` preserves git history in `git log --follow`.

**When to use:** Any tracked file that needs to move to a new path.

**Example:**
```bash
# From repo root
mkdir -p backend/data
git mv code_website.py backend/code_website.py
git mv search.py backend/search.py
git mv tampa_gis.py backend/tampa_gis.py
git mv ingest.py backend/ingest.py
git mv requirements.txt backend/requirements.txt
git mv Procfile backend/Procfile
git mv data/parse_tampa_docs.py backend/data/parse_tampa_docs.py
# .env is gitignored — move manually, not with git mv
# Runtime artifacts (*.index, chunks.json, *.db) are gitignored — no git action needed
```

### Pattern 5: VITE_API_BASE_URL Convention (DEV-02)

**What:** Vite exposes env vars prefixed with `VITE_` to client code. An empty value means "use the proxy" (relative paths); a production URL means "prepend to all API calls".

**When to use:** All API calls from the React SPA.

**Example:**
```
# frontend/.env (dev — checked into git as .env.example equivalent)
VITE_API_BASE_URL=

# frontend/.env.production (or set on Render deploy)
VITE_API_BASE_URL=https://tampa-code-ai.onrender.com
```

```typescript
// Usage pattern in future phases
const apiBase = import.meta.env.VITE_API_BASE_URL ?? ""
const res = await fetch(`${apiBase}/ask`, { method: "POST", body: ... })
```

### Anti-Patterns to Avoid

- **Adding a rewrite to the Vite proxy for `/api`:** Flask routes ARE prefixed with `/api/` (e.g., `/api/address-suggest`). Stripping the prefix would break those routes. Only add `rewrite` if the backend lacks the prefix.
- **Moving `.env` with `git mv`:** `.env` is gitignored and should not be tracked. Move it manually with a regular file system operation. Committing it accidentally would expose secrets.
- **Running gunicorn from the repo root after the move:** `gunicorn code_website:app` must be run from `backend/` so that relative imports (`search`, `tampa_gis`) and path constants (`data/`, `tampa_code.index`) resolve correctly.
- **Using Tailwind v3 config files with a v4 install:** `@tailwindcss/vite` is the v4 plugin; it does not use `tailwind.config.js` or `postcss.config.js`. Adding those files would cause conflicts.
- **Shadcn init with `shadcn-ui` (old package name):** The current CLI is `shadcn`, not `shadcn-ui`. Using `npx shadcn-ui@latest` will install an outdated version.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-path dev proxy to Flask | Custom Express middleware | Vite `server.proxy` | Built into Vite; zero deps, hot-reloads with config |
| UI component primitives (buttons, inputs, tabs) | Custom React components | shadcn/ui + Radix UI | Accessibility, keyboard nav, ARIA built-in |
| CSS utility classes | Custom class naming system | Tailwind CSS v4 | Design constraint enforcement, no dead CSS |
| Client-side routing | Custom history/hash router | react-router v7 | Handles history API, relative paths, nested routes |
| Icon SVGs | Inline SVG markup | lucide-react | Tree-shakeable, consistent stroke weight, TypeScript-typed |
| Parallel dev process running | Shell `&` with backgrounding | concurrently | Cross-platform (works on Windows cmd, bash, fish); colored output per process |

**Key insight:** The proxy, routing, and component layers each have well-maintained, zero-configuration solutions. Every hour spent hand-rolling any of these creates maintenance surface without upside.

---

## Runtime State Inventory

> This phase involves a rename/restructure (moving files into `backend/`).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `permitiq.db` SQLite — path defaults to `permitiq.db` (relative, configurable via `DB_PATH` env var) | No data migration — db is gitignored and runtime-generated; after move it will be created at `backend/permitiq.db` automatically on first Flask start |
| Live service config | None — no external services (n8n, Datadog, etc.) configured; app is in dev state | None |
| OS-registered state | None — no Task Scheduler tasks, pm2 processes, or systemd units detected | None |
| Secrets/env vars | `.env` at root contains `OPENAI_API_KEY`, `FLASK_SECRET_KEY`, `APP_LOGIN_PASSWORD` — must move to `backend/.env` manually | Manual file copy: `cp .env backend/.env` then delete root `.env`; key names unchanged |
| Build artifacts | `__pycache__/`, `tampa_code.index`, `chunks.json` — all gitignored; will need to be regenerated inside `backend/` | Regenerate: `cd backend && python ingest.py` after move; no git action |

**Nothing found for live service config or OS-registered state — verified by review of STRUCTURE.md, STACK.md, and codebase file listing.**

---

## Common Pitfalls

### Pitfall 1: Flask can't find modules after move
**What goes wrong:** Running `gunicorn code_website:app` from the repo root instead of `backend/` causes `ModuleNotFoundError` for `search` and `tampa_gis` (since they're no longer on the Python path).
**Why it happens:** Flask/gunicorn uses the working directory to find local modules.
**How to avoid:** Always run from `backend/`: `cd backend && gunicorn code_website:app ...`
**Warning signs:** `ModuleNotFoundError: No module named 'search'` in gunicorn output.

### Pitfall 2: python-dotenv can't find .env
**What goes wrong:** Flask boots but `OPENAI_API_KEY` is None, causing OpenAI client init to fail.
**Why it happens:** `python-dotenv` looks for `.env` in the current working directory. If Flask is run from root after the move, it won't find `backend/.env`.
**How to avoid:** Run Flask from `backend/`; `.env` lives at `backend/.env` (D-02).
**Warning signs:** `AuthenticationError: No API key provided` on first request.

### Pitfall 3: Vite proxy strips /api prefix (rewrite bug)
**What goes wrong:** Adding `rewrite: (path) => path.replace(/^\/api/, "")` to the `/api` proxy rule causes Flask to receive `/address-suggest` instead of `/api/address-suggest`, returning 404.
**Why it happens:** Flask routes are already prefixed with `/api/` — rewriting removes a prefix the backend expects.
**How to avoid:** Do NOT add a rewrite rule for `/api`. The proxy entry `"/api": { target: "http://localhost:5000", changeOrigin: true }` is sufficient.
**Warning signs:** `404 Not Found` responses from Flask for all `/api/*` calls.

### Pitfall 4: shadcn init installs wrong Tailwind version
**What goes wrong:** shadcn CLI detects an existing Tailwind config and offers to use it; developer accepts a v3 config by mistake.
**Why it happens:** Some tutorial paths install `tailwindcss` v3 before running `npx shadcn@latest init`.
**How to avoid:** Install `tailwindcss@latest` and `@tailwindcss/vite` first (both are 4.x), then run `npx shadcn@latest init`. Confirm `@import "tailwindcss"` appears in `index.css` (v4 pattern), not `@tailwind base` (v3 pattern).
**Warning signs:** shadcn CLI creates `tailwind.config.js` or `postcss.config.js` — these are v3 artifacts.

### Pitfall 5: .env committed to git during backend move
**What goes wrong:** Developer uses `git mv .env backend/.env` or `git add -A` and accidentally stages the `.env` file.
**Why it happens:** `.env` is gitignored at root, but the `.gitignore` glob `*.env.*` and `.env` patterns may not cover `backend/.env` if the gitignore is not updated.
**How to avoid:** Verify `.gitignore` covers `backend/.env` — the existing pattern `.env` is root-relative. Add `backend/.env` or keep the existing `.env` glob which git respects recursively for exact filename matches.
**Warning signs:** `git status` shows `backend/.env` as an untracked new file that appears in staging.

> **Git .gitignore behavior note:** The existing `.gitignore` entry `.env` matches files named exactly `.env` in ANY subdirectory because git applies gitignore patterns recursively. `backend/.env` will be ignored automatically. [VERIFIED: git documentation behavior]

### Pitfall 6: Vite 7 requires Node 20.19+
**What goes wrong:** `npm create vite@latest` installs Vite 8.x which requires Node.js 20.19+. On older Node installs, the scaffold fails or behaves unexpectedly.
**Why it happens:** Vite 7+ dropped Node 18 support (EOL April 2025). The current environment runs Node 24.14.1 [VERIFIED: shell], so this is not a risk for this project — documented for completeness.
**How to avoid:** Already satisfied — Node 24.14.1 is installed.

---

## Code Examples

### Complete vite.config.ts (proxy + alias + tailwind)
```typescript
// Source: https://vite.dev/config/server-options.html#server-proxy
// Source: https://ui.shadcn.com/docs/installation/vite
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/ask": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/address-review": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
})
```

### tsconfig.json path alias setup
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

### Root package.json concurrently script (Claude's discretion — recommended)
```json
{
  "name": "tampa-code-ai",
  "private": true,
  "scripts": {
    "dev": "concurrently -n backend,frontend -c blue,green \"cd backend && flask run\" \"cd frontend && npm run dev\""
  },
  "devDependencies": {
    "concurrently": "^9.2.1"
  }
}
```

### Geist font integration in index.css (Tailwind v4)
```css
/* Source: https://www.npmjs.com/package/geist */
@import "tailwindcss";
@import "geist/font/sans.css";

:root {
  --font-sans: "Geist", ui-sans-serif, system-ui, sans-serif;
  /* shadcn/ui CSS variables from UI-SPEC ... */
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 with postcss.config.js + tailwind.config.js | Tailwind v4 with `@tailwindcss/vite` plugin, `@import "tailwindcss"` in CSS | Nov 2024 (Tailwind v4 beta), stable 2025 | No config files needed; simpler setup |
| `shadcn-ui` npm package name | `shadcn` npm package name | 2024 | `npx shadcn@latest init` not `npx shadcn-ui@latest init` |
| `react-router-dom` package | `react-router` package (v7 merged into single package) | React Router v7 (Dec 2024) | Install `react-router`, import from `"react-router"` not `"react-router-dom"` |
| Vite React template: `@vitejs/plugin-react-swc` | `@vitejs/plugin-react` (Babel) OR `react-swc` — both valid | — | Either works; `react-ts` template uses Babel plugin by default |

**Deprecated/outdated:**
- `react-router-dom`: Replaced by `react-router` in v7. Importing from `"react-router-dom"` still works (re-export) but new code should use `"react-router"`.
- `npx shadcn-ui@latest`: Old package name. Use `npx shadcn@latest`.
- `tailwind.config.js` with `content: [...]`: Tailwind v4 uses different configuration. Not needed for this stack.
- `postcss.config.js` for Tailwind: Replaced by `@tailwindcss/vite` plugin in Tailwind v4.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The existing `.gitignore` pattern `.env` covers `backend/.env` without modification | Common Pitfalls #5 | `.env` could be accidentally committed with secrets |
| A2 | Flask's relative path constants (`data/`, `tampa_code.index`) resolve correctly from `backend/` with no code changes | Architecture Patterns (Pattern 4) | Flask would fail to load FAISS index or find PDFs; ingest would write to wrong location |

**A1 mitigation:** Planner should include a task to verify `git check-ignore -v backend/.env` after the move, or add an explicit `backend/.env` line to `.gitignore` for certainty.

**A2 mitigation:** Confirmed by CONTEXT.md code_context section: "Relative paths work as long as Flask is run from `backend/`". Risk is LOW — this is how python-dotenv and Flask always work.

---

## Open Questions

1. **Root `.env.example` for backend?**
   - What we know: `backend/.env` is the right location. `.gitignore` already excludes `.env`.
   - What's unclear: Should a `backend/.env.example` be committed for developer onboarding? CONTEXT.md D-02 does not specify.
   - Recommendation: Include creating `backend/.env.example` with all env var names from STACK.md. Low-effort, high developer experience value.

2. **`frontend/.env` gitignore behavior**
   - What we know: The root `.gitignore` has `.env` and `.env.*` patterns (with `!.env.example` exception).
   - What's unclear: `!.env.example` exception — does it cover `frontend/.env.example`?
   - Recommendation: The `!.env.example` gitignore negation applies to `*.env.example` recursively, so `frontend/.env.example` will be tracked. Planner should commit `frontend/.env.example` with `VITE_API_BASE_URL=` and also commit `frontend/.env` if it only contains the empty `VITE_API_BASE_URL=` value (no secrets).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend scaffold, Vite dev server | ✓ | v24.14.1 | — |
| npm | Package installation | ✓ | 11.11.0 | — |
| Python | Backend (already exists) | ✓ | 3.13.3 (per STACK.md) | — |
| git | File moves with history | ✓ | (present — git repo confirmed) | Manual mv + commit |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

> `nyquist_validation: true` in config.json — section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in current repo (STRUCTURE.md confirms no test files) |
| Config file | none — Wave 0 must create if tests are added |
| Quick run command | N/A — no tests exist yet |
| Full suite command | N/A |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REPO-01 | `backend/` contains all Python files; Flask boots from `backend/` | manual smoke | `cd backend && python -c "import code_website; print('ok')"` | ❌ Wave 0 (manual) |
| REPO-02 | `frontend/` scaffold runs `npm run dev` without errors | manual smoke | `cd frontend && npm run dev` (observe no errors) | ❌ Wave 0 (manual) |
| REPO-03 | README.md exists at root with required sections | manual review | — | ❌ Wave 0 |
| DEV-01 | Vite proxy forwards `/api/*`, `/ask`, `/address-review` to Flask | manual smoke | `curl http://localhost:5173/api/address-suggest?q=test` (with both servers running) | ❌ Wave 0 (manual) |
| DEV-02 | `VITE_API_BASE_URL` defined in `frontend/.env` | file check | `cat frontend/.env | grep VITE_API_BASE_URL` | ❌ Wave 0 |

**Note:** This is a structural/scaffold phase. No unit tests are applicable — validation is smoke testing (does the server start, does the file structure match). The planner should include manual verification steps as acceptance criteria, not automated test files.

### Sampling Rate
- **Per task commit:** Smoke test the affected component (Flask boot or Vite dev start)
- **Per wave merge:** Full two-server smoke: Flask starts from `backend/`, Vite starts from `frontend/`, proxy forwards a request
- **Phase gate:** All 5 success criteria from ROADMAP.md verified before `/gsd-verify-work`

### Wave 0 Gaps
- No test framework to install — this is a structural phase
- Manual verification commands are the test suite for this phase

*(No test infrastructure setup needed — all validation is manual smoke testing)*

---

## Security Domain

> `security_enforcement` not explicitly set to `false` — section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not in scope for Phase 1 (Phase 2) |
| V3 Session Management | No | Not in scope for Phase 1 (Phase 2) |
| V4 Access Control | No | Not in scope for Phase 1 (Phase 2) |
| V5 Input Validation | No | No user input flows in Phase 1 |
| V6 Cryptography | No | No crypto operations in Phase 1 |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Accidental `.env` commit | Information Disclosure | Verify `.gitignore` covers `backend/.env` before committing; use `git status` review before each commit |
| `VITE_*` vars exposed in bundle | Information Disclosure | Do NOT put secrets in `VITE_*` vars — they are baked into the client bundle. `VITE_API_BASE_URL` is a URL, not a secret. |

**Key security note for Phase 1:** The only security-relevant action is ensuring `.env` files are never committed. The `VITE_API_BASE_URL` env var is a URL (not a credential) and is safe to expose in the bundle. No auth, session, or crypto is introduced in this phase.

---

## Sources

### Primary (HIGH confidence)
- Vite official docs (https://vite.dev/config/server-options.html#server-proxy) — proxy configuration options and multi-path example
- shadcn/ui official docs (https://ui.shadcn.com/docs/installation/vite) — Vite installation steps for Tailwind v4
- React Router official docs (https://reactrouter.com/start/library/installation) — declarative mode BrowserRouter + Routes setup
- npm registry — version verification for all packages listed

### Secondary (MEDIUM confidence)
- WebSearch results corroborating Tailwind v4 being current shadcn default [VERIFIED against npm registry]
- WebSearch confirming `react-router-dom` → `react-router` package rename in v7 [VERIFIED against npm registry]

### Tertiary (LOW confidence)
- None — all critical claims verified via official sources or npm registry

---

## Metadata

**Confidence breakdown:**
- Backend file move: HIGH — pure git mv + path behavior verified in CONTEXT.md code_context
- Vite proxy config: HIGH — verified against official Vite docs
- shadcn/ui + Tailwind v4 setup: HIGH — verified against official shadcn/ui docs and npm registry
- React Router v7 library mode: HIGH — verified against official docs
- Package versions: HIGH — verified against npm registry on 2026-04-16

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable stack, 30-day window reasonable)
