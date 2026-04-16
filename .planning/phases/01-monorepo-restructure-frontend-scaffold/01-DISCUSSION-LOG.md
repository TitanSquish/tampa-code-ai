# Phase 1: Monorepo Restructure & Frontend Scaffold - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 01-monorepo-restructure-frontend-scaffold
**Areas discussed:** Backend directory scope, Frontend scaffold depth

---

## Backend Directory Scope

| Option | Description | Selected |
|--------|-------------|----------|
| backend/.env | Keeps secrets co-located with the server that uses them. Developers run Flask from backend/ so dotenv finds it automatically. | ✓ |
| Root .env, symlinked or copied | One env file for the whole repo. Less secure, but some teams prefer a single place for all vars. | |
| You decide | No strong preference. | |

**User's choice:** `backend/.env`

---

| Option | Description | Selected |
|--------|-------------|----------|
| data/ moves to backend/data/ | Keeps the ingest pipeline and source PDFs next to the backend that uses them. Runtime artifacts generated in backend/ at runtime. | ✓ |
| data/ stays at root | Keeps PDFs separate from backend code. Requires updating path constants. | |
| You decide | No strong preference on data/ placement. | |

**User's choice:** `backend/data/` (data/ moves with backend)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Python + deployment files only | Move: code_website.py, search.py, tampa_gis.py, ingest.py, requirements.txt, Procfile. Keep at root: skills-lock.json, .gitignore, .planning/, .agents/, .claude/ | ✓ |
| Everything backend-specific | Same plus .env.example and any backend-specific config files. | |

**User's choice:** Python + deployment files only

---

## Frontend Scaffold Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full tooling setup | Vite + React + TypeScript + shadcn/ui + Tailwind CSS + React Router in Phase 1. | ✓ |
| Minimal scaffold only | Just npm create vite@latest output with a plain placeholder page. | |
| React Router only | Routing structural, shadcn/ui waits for Phase 3. | |

**User's choice:** Full tooling setup (shadcn/ui + Tailwind CSS + React Router all in Phase 1)

---

| Option | Description | Selected |
|--------|-------------|----------|
| TypeScript | Standard for Vite+React+shadcn/ui. Components are TS by default. | ✓ |
| JavaScript | Simpler setup, no TS compiler. | |

**User's choice:** TypeScript

---

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal app shell with routing stubs | Routes wired (/login, /app) with placeholder content. Proves routing works. | ✓ |
| Dead simple — just "Tampa Code AI" text | Simplest possible page. | |
| You decide | No preference. | |

**User's choice:** Minimal app shell with routing stubs

---

## Claude's Discretion

- Concurrent dev setup (root package.json with concurrently vs. two-terminal documentation)
- Node.js version (current LTS)
- Which shadcn/ui base components to pre-install beyond initialization

## Deferred Ideas

None surfaced during discussion.
