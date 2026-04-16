---
plan: 01-02
phase: 01-monorepo-restructure-frontend-scaffold
status: checkpoint
completed_tasks: 1
total_tasks: 2
checkpoint_task: 2
subsystem: frontend
tags:
  - frontend
  - scaffold
  - vite
  - react
  - shadcn
  - tailwind
dependency_graph:
  requires: []
  provides:
    - frontend scaffold (Vite + React + TS)
    - Tailwind v4 CSS pipeline
    - shadcn/ui component library
    - React Router v7 routing
    - Vite dev proxy to Flask backend
  affects:
    - Phase 3 UI implementation plans
tech_stack:
  added:
    - vite@^8.0.4
    - react@^19.2.4
    - react-router@^7.14.1
    - tailwindcss@^4.2.2 (v4 via @tailwindcss/vite plugin)
    - "@fontsource-variable/geist@^5.2.8"
    - lucide-react@^1.8.0
    - shadcn/ui (button, input, label, tabs, card, badge)
  patterns:
    - Tailwind CSS v4 imported as @import "tailwindcss" (no config file)
    - shadcn components in frontend/src/components/ui/
    - React Router v7 in library mode (BrowserRouter + Routes)
    - Vite dev proxy forwards /api/*, /ask, /address-review to Flask:5000
key_files:
  created:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/vite.config.ts
    - frontend/tsconfig.json
    - frontend/tsconfig.app.json
    - frontend/tsconfig.node.json
    - frontend/index.html
    - frontend/components.json
    - frontend/src/main.tsx
    - frontend/src/App.tsx
    - frontend/src/index.css
    - frontend/src/lib/utils.ts
    - frontend/src/components/ui/button.tsx
    - frontend/src/components/ui/input.tsx
    - frontend/src/components/ui/label.tsx
    - frontend/src/components/ui/tabs.tsx
    - frontend/src/components/ui/card.tsx
    - frontend/src/components/ui/badge.tsx
    - frontend/src/pages/LoginPage.tsx
    - frontend/src/pages/AppShell.tsx
    - frontend/.env.example
  modified:
    - .gitignore (already staged from Plan 01-01)
decisions:
  - geist font loaded via @fontsource-variable/geist (not geist/font/sans.css — that path is Next.js-only)
metrics:
  completed: "2026-04-16"
---

# Phase 01 Plan 02: Frontend Scaffold Summary

**One-liner:** Vite 8 + React 19 + TypeScript + Tailwind v4 + shadcn/ui scaffold with React Router v7 stubs and Flask dev proxy.

## Status

Task 1 complete. Task 2 (human-verify) awaiting user approval.

## What Was Built

Full Vite + React + TypeScript frontend scaffold in `frontend/`:

- **Build tooling**: Vite 8.0.4 + @vitejs/plugin-react 6.0.1 + @tailwindcss/vite 4.2.2
- **Styling**: Tailwind CSS v4 (via plugin — no tailwind.config.js, no postcss.config.js)
- **Font**: Geist loaded via `@fontsource-variable/geist` (imported in index.css)
- **UI components**: shadcn/ui initialized; button, input, label, tabs, card, badge installed
- **Router**: React Router v7 (`react-router` package — NOT `react-router-dom`)
- **Routes**: `/login` → LoginPage, `/app` → AppShell, `*` → redirect to `/login`
- **Dev proxy**: Vite proxies `/api/*`, `/ask`, `/address-review` to `http://localhost:5000`
- **Env vars**: `frontend/.env` (VITE_API_BASE_URL=, gitignored), `frontend/.env.example` (tracked)

## Package Versions (from frontend/package.json)

### dependencies
| Package | Version |
|---------|---------|
| react | ^19.2.4 |
| react-dom | ^19.2.4 |
| react-router | ^7.14.1 |
| @fontsource-variable/geist | ^5.2.8 |
| geist | ^1.7.0 |
| lucide-react | ^1.8.0 |
| class-variance-authority | ^0.7.1 |
| clsx | ^2.1.1 |
| tailwind-merge | ^3.5.0 |
| tw-animate-css | ^1.4.0 |
| shadcn | ^4.3.0 |
| @base-ui/react | ^1.4.0 |

### devDependencies
| Package | Version |
|---------|---------|
| vite | ^8.0.4 |
| @vitejs/plugin-react | ^6.0.1 |
| @tailwindcss/vite | ^4.2.2 |
| tailwindcss | ^4.2.2 |
| typescript | ~6.0.2 |
| @types/node | ^24.12.2 |
| @types/react | ^19.2.14 |
| @types/react-dom | ^19.2.3 |

## Proxy Config (from vite.config.ts)

```typescript
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
```

## Build Output

`npm run build` exited 0. `frontend/dist/` created (417ms build, 303KB JS bundle gzipped to 97KB).

## Checkpoint — Human Verification Required (Task 2)

Task 2 is a blocking human-verify checkpoint. The user must run both Flask and Vite dev servers simultaneously and confirm:

1. `cd backend && python -m flask --app code_website run --port 5000` — Flask starts on port 5000
2. `cd frontend && npm run dev` — Vite starts on port 5173
3. http://localhost:5173/login renders LoginPage with correct copy
4. http://localhost:5173/app renders AppShell with tabs
5. http://localhost:5173/ redirects to /login
6. `curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:5173/api/address-suggest?q=test` returns a Flask status code
7. No CORS errors in browser DevTools

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] geist/font/sans.css is not a valid import path in Vite**
- **Found during:** Post-commit verification
- **Issue:** The plan specified `@import "geist/font/sans.css"` in index.css. The `geist` package v1.7.0 is a Next.js font loader — its `./font/sans` export resolves to a JS module (`dist/sans.js`), not a CSS file. Tailwind's Vite plugin resolves imports under the `"style"` condition, which `geist` does not export for `./font/sans`. Running `npm run build` with the plan's import path failed with: `"./font/sans.css" is not exported under the condition "style"`.
- **Fix:** The previous executor had already used `@import "@fontsource-variable/geist"` (the `@fontsource-variable/geist` package, also installed), which works correctly and ships the same Geist woff2 font files. Reverted to this working import.
- **Files modified:** `frontend/src/index.css`
- **Commit:** a0026f2

**2. [Deviation] Nested .git directory from npm create vite@latest**
- **Found during:** Previous executor's Task 1
- **Issue:** `npm create vite@latest` created a nested `.git` inside `frontend/`. This prevented git from tracking the scaffold as part of the worktree.
- **Fix:** Orchestrator removed `frontend/.git` before this continuation agent ran. Normal git tracking restored.
- **Files modified:** None (orchestrator action)

## Known Stubs

- `frontend/src/pages/LoginPage.tsx` — Button has `disabled` prop; email input is non-functional. Intentional per D-08 (Phase 1 scaffold only). Phase 3 will wire OTP auth.
- `frontend/src/pages/AppShell.tsx` — Tab content shows "Coming in Phase 3" badge. Intentional. Phase 3 will implement Code Search and Address Review UI.

## Self-Check: PASSED

All key files verified present. Commit a0026f2 confirmed in git log. `frontend/dist/` created by successful build.
