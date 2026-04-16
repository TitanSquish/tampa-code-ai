# Phase 1: Monorepo Restructure & Frontend Scaffold — Pattern Map

**Mapped:** 2026-04-16
**Files analyzed:** 14 (7 backend moves + 7 new frontend files)
**Analogs found:** 7 / 14 (backend files are self-analog moves; frontend files are net-new)

---

## Overview

This phase has two completely independent workstreams:

1. **Backend move** — existing Python files are relocated to `backend/` with `git mv`. No code changes. All 7 files have themselves as their own pattern source (identity move).
2. **Frontend scaffold** — 7 new files are created from scratch. No React/TypeScript files exist in the repo. The pattern source for these is RESEARCH.md code examples plus the existing `code_website.py` inline HTML/CSS (for brand color and layout values).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/code_website.py` | controller (moved) | request-response + streaming | `code_website.py` (self) | identity move |
| `backend/search.py` | service (moved) | request-response | `search.py` (self) | identity move |
| `backend/tampa_gis.py` | service (moved) | request-response | `tampa_gis.py` (self) | identity move |
| `backend/ingest.py` | utility/CLI (moved) | batch | `ingest.py` (self) | identity move |
| `backend/requirements.txt` | config (moved) | — | `requirements.txt` (self) | identity move |
| `backend/Procfile` | config (moved) | — | `Procfile` (self) | identity move |
| `backend/data/parse_tampa_docs.py` | utility/CLI (moved) | batch | `data/parse_tampa_docs.py` (self) | identity move |
| `backend/.env.example` | config (new) | — | `.env` (root, content reference) | content-analog |
| `frontend/vite.config.ts` | config | request-response (proxy) | none in repo | no analog |
| `frontend/src/main.tsx` | entry point | — | none in repo | no analog |
| `frontend/src/App.tsx` | router | request-response | none in repo | no analog |
| `frontend/src/pages/LoginPage.tsx` | page component | request-response | `code_website.py` login HTML (lines 418–530) | partial (HTML→TSX) |
| `frontend/src/pages/AppShell.tsx` | page component | — | `code_website.py` main app HTML (lines 540–1100+) | partial (HTML→TSX) |
| `frontend/src/index.css` | config/theme | — | `code_website.py` inline CSS (lines 424–530) | partial (CSS vars) |
| `package.json` (root) | config | — | none in repo | no analog |
| `frontend/.env` / `frontend/.env.example` | config | — | `.env` (root) | content-analog |
| `.gitignore` (update) | config | — | `.gitignore` (self) | self-update |

---

## Pattern Assignments

### Backend Move Files (identity moves — no code changes)

All 7 files below are moved with `git mv` from root to `backend/`. Zero code edits. The patterns to follow are the files themselves.

**Command pattern** (from RESEARCH.md Pattern 4):
```bash
# Run from repo root
mkdir -p backend/data
git mv code_website.py backend/code_website.py
git mv search.py backend/search.py
git mv tampa_gis.py backend/tampa_gis.py
git mv ingest.py backend/ingest.py
git mv requirements.txt backend/requirements.txt
git mv Procfile backend/Procfile
git mv data/parse_tampa_docs.py backend/data/parse_tampa_docs.py
# .env is gitignored — copy manually:
# cp .env backend/.env && del .env   (Windows) or rm .env (Unix)
```

**Critical path constraint:** After the move, all Flask and gunicorn commands must be run from `backend/`. The existing `Procfile` command `gunicorn code_website:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120` is unchanged but must execute with `backend/` as the working directory.

---

### `backend/.env.example` (config, new)

**Analog:** `.env` at repo root (lines 1–3) — for key names only, not values.

**Content pattern** (key names from `.env`, sanitized):
```bash
# backend/.env.example
# Copy to backend/.env and fill in real values before running Flask.

# OpenAI
OPENAI_API_KEY=sk-...

# Flask session signing key — generate with: python -c "import secrets; print(secrets.token_hex(24))"
FLASK_SECRET_KEY=change-this-secret

# Application login password
APP_LOGIN_PASSWORD=change-this-password

# Optional overrides (defaults shown)
# SEARCH_MODEL=gpt-4o-mini
# ADDRESS_MODEL=gpt-4o
# SEARCH_K=10
# GIS_CACHE_TTL_SEC=3600
# AUDIT_ENABLED=true
# MULTI_QUERY_ENABLED=true
# MULTI_QUERY_N=3
# MAX_QUESTION_LEN=1000
# MAX_DESC_LEN=600
# MAX_ADDRESS_LEN=200
# DB_PATH=permitiq.db
```

**Source for key inventory:** `code_website.py` lines 23–46 (all `os.getenv(...)` calls).

---

### `frontend/vite.config.ts` (config, proxy + alias + plugin)

**Analog:** None in repo. Pattern is RESEARCH.md "Complete vite.config.ts" example (verified against official Vite docs).

**Complete file pattern:**
```typescript
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
        // NO rewrite — Flask routes are already prefixed with /api/
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

**Why these three proxy paths:** Flask routes in `code_website.py` are `/ask` (line ~1400 area), `/address-review`, and `/api/address-suggest`, `/api/property-context`, `/api/feedback`. The `/api` prefix match covers all three `/api/*` routes. No rewrite — Flask expects full paths.

---

### `frontend/tsconfig.json` (config, path alias)

**Analog:** None in repo. Pattern from RESEARCH.md "tsconfig.json path alias setup".

**Complete file pattern:**
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

The `tsconfig.app.json` is generated by `npm create vite@latest -- --template react-ts` and should not be manually created. Only `tsconfig.json` needs the `paths` addition for the `@/*` alias.

---

### `frontend/src/index.css` (config/theme, Tailwind v4 + CSS variables)

**Analog:** `code_website.py` inline CSS (lines 424–530) — brand color values only, not structure.

**Color values sourced from `code_website.py`:**
- `background: #f4f7fb` (line 428) → `oklch(0.975 0.005 240)`
- `color: #1f2937` (line 429) → `oklch(0.14 0.015 240)`
- `border: 1px solid #cbd5e1` (line 448) → `oklch(0.87 0.010 240)`
- `background: #2563eb` (line 455) → `oklch(0.49 0.19 255)`
- `color: #b91c1c` (line 466) → `oklch(0.50 0.19 25)`

**Complete file pattern** (from UI-SPEC.md color contract + RESEARCH.md Pattern 3):
```css
/* frontend/src/index.css */
@import "tailwindcss";
@import "geist/font/sans.css";

:root {
  /* Backgrounds */
  --background:        oklch(0.975 0.005 240);
  --foreground:        oklch(0.14  0.015 240);

  /* Cards and surfaces */
  --card:              oklch(1.0   0.000 0);
  --card-foreground:   oklch(0.14  0.015 240);

  /* Popover */
  --popover:           oklch(1.0   0.000 0);
  --popover-foreground: oklch(0.14 0.015 240);

  /* Primary — brand blue: buttons, active tabs, focus rings */
  --primary:           oklch(0.49  0.19  255);
  --primary-foreground: oklch(1.0  0.000 0);

  /* Secondary — muted surface */
  --secondary:         oklch(0.94  0.008 240);
  --secondary-foreground: oklch(0.35 0.015 240);

  /* Muted — helper text, placeholders, metadata */
  --muted:             oklch(0.94  0.008 240);
  --muted-foreground:  oklch(0.53  0.012 240);

  /* Accent — blue-50 tint */
  --accent:            oklch(0.94  0.012 250);
  --accent-foreground: oklch(0.30  0.13  255);

  /* Destructive */
  --destructive:       oklch(0.50  0.19  25);
  --destructive-foreground: oklch(1.0  0.000 0);

  /* Border and input */
  --border:            oklch(0.87  0.010 240);
  --input:             oklch(0.87  0.010 240);
  --ring:              oklch(0.49  0.19  255);

  /* Radius */
  --radius: 0.5rem;

  /* Font */
  --font-sans: "Geist", ui-sans-serif, system-ui, sans-serif;
}

body {
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.5;
  background-color: var(--background);
  color: var(--foreground);
}
```

**Note on Tailwind v4:** `@import "tailwindcss"` is the v4 single-import pattern. Do NOT use `@tailwind base; @tailwind components; @tailwind utilities` (v3 pattern). Do NOT create `tailwind.config.js` or `postcss.config.js`.

---

### `frontend/src/main.tsx` (entry point, BrowserRouter mount)

**Analog:** None in repo. Pattern from RESEARCH.md Pattern 2.

**Complete file pattern:**
```tsx
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
```

**Import note:** Import from `"react-router"` not `"react-router-dom"`. The v7 package merged these — `"react-router-dom"` re-exports still work but new code uses `"react-router"`.

---

### `frontend/src/App.tsx` (router, route definitions)

**Analog:** None in repo. Pattern from RESEARCH.md Pattern 2.

**Complete file pattern:**
```tsx
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

**Wildcard redirect:** `path="*"` catches all unmatched routes and redirects to `/login`. This satisfies D-08 (routing stubs) and gives Phase 2 a real redirect target once auth is wired.

---

### `frontend/src/pages/LoginPage.tsx` (page component, request-response)

**Analog:** `code_website.py` login HTML template (lines 418–530) — layout structure and copy only, not implementation.

**Copy sourced from UI-SPEC.md copywriting contract:**
- App name: "Tampa Code AI"
- Tagline: "Tampa building permit code assistant"
- Email label: "Email address"
- CTA: "Continue with Email"
- Footer: "You'll receive a sign-in code by email."

**Layout reference from `code_website.py` lines 430–440:** centered card, max-width ~420px, vertically centered on viewport.

**Pattern** (placeholder — no logic, form is non-functional per D-08):
```tsx
// frontend/src/pages/LoginPage.tsx
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px] space-y-6">
        <div className="space-y-1">
          <h1 className="text-[28px] font-semibold leading-[1.15] text-foreground">
            Tampa Code AI
          </h1>
          <p className="text-[13px] font-normal leading-[1.4] text-muted-foreground">
            Tampa building permit code assistant
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[13px] font-medium">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="w-full"
            />
          </div>
          <Button className="w-full" disabled>
            Continue with Email
          </Button>
          <p className="text-[13px] text-muted-foreground text-center">
            You'll receive a sign-in code by email.
          </p>
        </div>
      </div>
    </div>
  )
}
```

**Note:** Button is `disabled` in Phase 1 — no logic is wired. Phase 2 implements OTP flow.

---

### `frontend/src/pages/AppShell.tsx` (page component, tab layout)

**Analog:** `code_website.py` main app HTML (lines 540+) — tab structure and copy only, not implementation.

**Copy sourced from UI-SPEC.md:**
- Header title: "Tampa Code AI"
- Sign out button: "Sign out"
- Tab 1: "Code Search"
- Tab 2: "Address Review"
- Badge: "Coming in Phase 3"

**Layout spec from UI-SPEC.md:**
- Header: 56px height, `--card` background, `1px solid var(--border)` bottom border
- Content: max-width 800px, centered
- shadcn `<Tabs>` component for the two-panel layout

**Pattern:**
```tsx
// frontend/src/pages/AppShell.tsx
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

export default function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top header bar */}
      <header className="h-14 bg-card border-b border-border flex items-center px-6">
        <span className="text-[15px] font-semibold text-foreground flex-1">
          Tampa Code AI
        </span>
        <Button variant="ghost" size="sm">
          Sign out
        </Button>
      </header>

      {/* Content area */}
      <main className="max-w-[800px] mx-auto px-6 py-8">
        <Tabs defaultValue="code-search">
          <TabsList className="w-full">
            <TabsTrigger value="code-search" className="flex-1">
              Code Search
            </TabsTrigger>
            <TabsTrigger value="address-review" className="flex-1">
              Address Review
            </TabsTrigger>
          </TabsList>

          <TabsContent value="code-search" className="mt-6 space-y-3">
            <h2 className="text-[20px] font-semibold leading-[1.25] text-foreground">
              Code Search
            </h2>
            <p className="text-[15px] text-muted-foreground max-w-[72ch]">
              Ask a question about Tampa building codes and permit requirements.
            </p>
            <Badge variant="secondary">Coming in Phase 3</Badge>
          </TabsContent>

          <TabsContent value="address-review" className="mt-6 space-y-3">
            <h2 className="text-[20px] font-semibold leading-[1.25] text-foreground">
              Address Review
            </h2>
            <p className="text-[15px] text-muted-foreground max-w-[72ch]">
              Enter a Tampa property address to get permit requirements for your project.
            </p>
            <Badge variant="secondary">Coming in Phase 3</Badge>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
```

---

### `package.json` (root, concurrently dev script)

**Analog:** None in repo. Pattern from RESEARCH.md "Root package.json concurrently script".

**Complete file pattern:**
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

**Rationale for including:** `concurrently` is cross-platform (works on Windows, the dev environment per env metadata), provides colored output per process, and avoids the `&` backgrounding fragility in Windows cmd. This is Claude's discretion call — recommended per RESEARCH.md.

---

### `frontend/.env` and `frontend/.env.example` (config, Vite env)

**Analog:** `.env` at repo root — structural reference only.

**Content pattern:**
```bash
# frontend/.env  — safe to commit; contains no secrets (VITE_API_BASE_URL is a URL, not a credential)
VITE_API_BASE_URL=

# frontend/.env.example — documents production value pattern
VITE_API_BASE_URL=https://tampa-code-ai.onrender.com
```

**Usage pattern for future phases** (from RESEARCH.md Pattern 5):
```typescript
const apiBase = import.meta.env.VITE_API_BASE_URL ?? ""
const res = await fetch(`${apiBase}/ask`, { method: "POST", body: ... })
```

**gitignore note:** The root `.gitignore` pattern `.env` covers `frontend/.env` recursively (git gitignore applies exact filename matches in any subdirectory). The `!.env.example` negation covers `frontend/.env.example` too — it will be tracked. `frontend/.env` with only `VITE_API_BASE_URL=` has no secrets and can optionally be committed (confirmed safe by RESEARCH.md security section).

---

### `.gitignore` update (root)

**Analog:** `.gitignore` (self).

**Required additions:**
```gitignore
# Node
node_modules/
frontend/dist/
frontend/.vite/

# Runtime artifacts now inside backend/
# (existing globs *.index, *.db, chunks.json already match backend/ subdirectory — no change needed)
```

**Verification:** The existing patterns `*.index`, `*.db`, `chunks.json` are glob patterns that git applies recursively — they already cover `backend/tampa_code.index`, `backend/permitiq.db`, `backend/chunks.json`. The `data/*.pdf` pattern is root-relative and will need updating to `backend/data/*.pdf` — or changing to `**/data/*.pdf` to cover both root and backend paths. Planner should verify with `git check-ignore -v backend/data/tampa-code-5-27.pdf`.

---

## Shared Patterns

### Path Alias (`@/*` → `./src/*`)

**Source:** `vite.config.ts` + `tsconfig.json` (both required for alias to work in both Vite bundling and TypeScript type checking)
**Apply to:** All `import` statements in `frontend/src/**/*.tsx` — use `@/components/ui/button` not `../../components/ui/button`

### shadcn/ui Component Import Convention

**Source:** shadcn/ui CLI output (components written to `frontend/src/components/ui/`)
**Apply to:** `LoginPage.tsx`, `AppShell.tsx`, and all future Phase 3 components
```typescript
// Correct — use path alias
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
```

### Typography Scale (Tailwind utility pattern)

**Source:** UI-SPEC.md typography contract
**Apply to:** All text elements in Phase 1 and Phase 3 components

| Role | Classes |
|------|---------|
| Display (login title) | `text-[28px] font-semibold leading-[1.15]` |
| Heading (section titles) | `text-[20px] font-semibold leading-[1.25]` |
| Body | `text-[15px] font-normal leading-[1.5]` |
| Label | `text-[13px] font-medium leading-[1.4]` |
| Body text area max-width | `max-w-[72ch]` |

Only two weights: `font-normal` (400) for body/label, `font-semibold` (600) for headings/display. Do not introduce `font-bold`, `font-medium` on headings, or any other weight.

### CSS Variable Color Convention

**Source:** `index.css` `:root` block (derived from `code_website.py` lines 428–466)
**Apply to:** All components — use CSS variable references via Tailwind's semantic classes (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, etc.) not raw hex values.

```tsx
// Correct
<div className="bg-background text-foreground border-border">

// Wrong — do not hardcode legacy hex values
<div style={{ background: "#f4f7fb", color: "#1f2937" }}>
```

### Flask Module Execution Context

**Source:** `code_website.py` line 7 (`load_dotenv()`), `search.py` lines 13–14 (relative index paths)
**Apply to:** All `backend/` run instructions in README.md and developer docs

The entire `backend/` directory must be the working directory when running any Python command. This is enforced by:
- `load_dotenv()` finds `backend/.env` only when CWD is `backend/`
- `INDEX_PATH = "tampa_code.index"` in `search.py` (line 13) resolves relative to CWD
- Module imports `from search import ...` and `from tampa_gis import ...` in `code_website.py` (lines 4–5) require CWD on Python path

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend/vite.config.ts` | config | proxy/build | No build tooling exists in repo yet |
| `frontend/src/main.tsx` | entry point | — | No React/TS in repo |
| `frontend/src/App.tsx` | router | — | No React Router in repo |
| `frontend/src/pages/LoginPage.tsx` | page component | — | No React components in repo (HTML analog exists in `code_website.py`) |
| `frontend/src/pages/AppShell.tsx` | page component | — | No React components in repo (HTML analog exists in `code_website.py`) |
| `frontend/src/index.css` | theme config | — | No Tailwind in repo (CSS analog exists in `code_website.py`) |
| `package.json` (root) | config | — | No Node.js tooling in repo |

**For all frontend files:** Use RESEARCH.md code examples as the authoritative pattern source. The code examples in RESEARCH.md were verified against official Vite, React Router, and shadcn/ui documentation as of 2026-04-16.

---

## Metadata

**Analog search scope:** Entire repo root (all `.py`, `.txt`, config files)
**Files scanned:** 8 source files + 4 config files
**No frontend files exist:** Zero `.ts`, `.tsx`, `.jsx`, `.js` (non-config) files in repo
**Pattern extraction date:** 2026-04-16

**Key finding:** This is a "greenfield frontend + identity-move backend" phase. The pattern challenge is not finding analogs but correctly threading the brand values from `code_website.py`'s inline CSS into the new Tailwind/shadcn CSS variable system. The color mapping in the `index.css` pattern assignment above is the most critical pattern bridge in this phase.
