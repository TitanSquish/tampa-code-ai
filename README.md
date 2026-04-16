# Tampa Code AI

A Tampa building-permit RAG assistant. Users get code requirements instantly by asking a question or entering a property address. Built as a monorepo with a Python/Flask API backend and a Vite + React + TypeScript + shadcn/ui frontend.

## Repository Layout

```
tampa-code-ai/
├── backend/                 # Python / Flask API
│   ├── code_website.py      # Flask app + all routes + inlined helpers
│   ├── search.py            # FAISS-backed semantic search
│   ├── tampa_gis.py         # City of Tampa ArcGIS REST client
│   ├── ingest.py            # Offline PDF → FAISS index pipeline
│   ├── requirements.txt     # Python dependencies
│   ├── Procfile             # Production gunicorn command
│   ├── .env                 # Local secrets (gitignored)
│   ├── .env.example         # Template — copy to .env and fill in
│   └── data/                # Source PDFs + parse utility (PDFs gitignored)
├── frontend/                # Vite + React + TypeScript SPA
│   ├── src/
│   │   ├── components/ui/   # shadcn/ui components
│   │   ├── pages/           # LoginPage, AppShell, future Phase 3 pages
│   │   ├── App.tsx          # Route definitions (react-router v7)
│   │   ├── main.tsx         # Entry point — mounts BrowserRouter
│   │   └── index.css        # Tailwind v4 + Geist + shadcn CSS variables
│   ├── vite.config.ts       # Vite + proxy + @/* alias + Tailwind plugin
│   ├── .env                 # VITE_API_BASE_URL (empty for dev)
│   └── .env.example         # Template
├── .planning/               # GSD planning artifacts (not shipped)
├── package.json             # Root — `npm run dev` boots both servers
└── README.md                # This file
```

## Prerequisites

- Python 3.13+ (project runs on 3.13.3)
- Node.js 20.19+ (the Vite 8 toolchain minimum; current stable is Node 24.x)
- npm 10+
- An OpenAI API key with access to `gpt-4o`, `gpt-4o-mini`, and `text-embedding-3-small`

## First-Time Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url> tampa-code-ai
cd tampa-code-ai

# Install root dev deps (concurrently for the single-command dev script)
npm install

# Install Python deps
cd backend
python -m venv .venv
source .venv/bin/activate          # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..

# Install frontend deps
cd frontend
npm install
cd ..
```

### 2. Configure environment variables

#### Backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set:

| Variable              | Required | Purpose                                                  |
|-----------------------|----------|----------------------------------------------------------|
| `OPENAI_API_KEY`      | yes      | OpenAI API key (starts with `sk-...`)                    |
| `FLASK_SECRET_KEY`    | yes      | Flask session signing key. Generate with:                |
|                       |          | `python -c "import secrets; print(secrets.token_hex(24))"` |
| `APP_LOGIN_PASSWORD`  | yes      | Shared password for the current auth (Phase 2 replaces this with email OTP) |

Optional overrides (all have defaults — see `backend/.env.example` for the full list):

- `SEARCH_MODEL` (default `gpt-4o-mini`) — model for the Code Search tab
- `ADDRESS_MODEL` (default `gpt-4o`) — model for the Address Review tab
- `EMBED_MODEL` (default `text-embedding-3-small`) — embedding model
- `SEARCH_K` (default `10`) — number of FAISS chunks to retrieve per query
- `GIS_CACHE_TTL_SEC` (default `3600`) — GIS response cache TTL
- `AUDIT_ENABLED`, `MULTI_QUERY_ENABLED`, `MULTI_QUERY_N`
- `MAX_QUESTION_LEN`, `MAX_DESC_LEN`, `MAX_ADDRESS_LEN`
- `ADDRESS_SEARCH_MAX_DISTANCE` (default `2.5`) — FAISS distance threshold
- `INDEX_PATH`, `CHUNKS_PATH`, `DB_PATH` — override default filesystem paths (all relative to `backend/`)

#### Frontend

```bash
cp frontend/.env.example frontend/.env
```

| Variable              | Required | Purpose                                                  |
|-----------------------|----------|----------------------------------------------------------|
| `VITE_API_BASE_URL`   | yes      | Base URL for Flask API calls. Leave empty for dev (Vite proxy forwards to `http://localhost:5000`). In prod, set to the deployed Flask service URL. |

`VITE_API_BASE_URL` is a URL, not a secret — it is safe to commit the `.env.example` value.

### 3. Add the Tampa code PDFs

The source PDFs are gitignored and must be placed manually in `backend/data/`:

- `backend/data/tampa-code-5-27.pdf` — Tampa Code of Ordinances (primary)
- `backend/data/tampa-code-22-11-21-28-6-19-17.pdf` — supplementary
- `backend/data/csd-sufficiency-checklist_1.pdf` — CSD checklist

### 4. Build the FAISS index

From `backend/` (this creates `backend/tampa_code.index` and `backend/chunks.json`):

```bash
cd backend
python ingest.py
cd ..
```

Expect this to take ~2–5 minutes depending on your OpenAI rate limits. The files produced are gitignored and stay on your machine.

## Running Locally

### Option A — Single command (recommended)

From the repo root:

```bash
npm run dev
```

This uses `concurrently` to boot both services side-by-side with colored output:

- `backend` (blue) — Flask on http://localhost:5000
- `frontend` (green) — Vite on http://localhost:5173

Open http://localhost:5173 in your browser.

### Option B — Two terminals

Terminal A (backend):
```bash
cd backend
source .venv/bin/activate   # Windows: .venv\Scripts\activate
python -m flask --app code_website run --port 5000
```

Terminal B (frontend):
```bash
cd frontend
npm run dev
```

## How the Dev Proxy Works

During development, the Vite dev server (port 5173) proxies these paths to the Flask backend (port 5000):

- `/api/*` — Flask routes like `/api/address-suggest`, `/api/property-context`, `/api/feedback`
- `/ask` — Code Search streaming endpoint
- `/address-review` — Address Review streaming endpoint

Because Vite handles the forwarding, the browser only ever talks to `http://localhost:5173`, so there is NO CORS configuration needed on Flask during local development. See `frontend/vite.config.ts` for the full proxy rules.

In production, the two services are deployed separately (Phase 4) and `VITE_API_BASE_URL` points the React bundle at the Flask service URL. CORS is configured on Flask for that origin.

## Production Build (Frontend)

```bash
cd frontend
npm run build
```

Outputs a static bundle to `frontend/dist/`. Phase 4 deploys this directory to Render as a Static Site.

## Production Run (Backend)

From `backend/`:

```bash
gunicorn code_website:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120
```

Render runs this automatically via `backend/Procfile`. The `$PORT` env var is injected by Render.

## Gotchas

- **Always run Flask from `backend/`.** Running `gunicorn code_website:app` from the repo root causes `ModuleNotFoundError: No module named 'search'` because `search.py` and `tampa_gis.py` are siblings of `code_website.py` inside `backend/`.
- **Always run `python ingest.py` from `backend/`.** The script writes `tampa_code.index` and `chunks.json` to the current working directory.
- **`.env` files live next to the code that uses them** — `backend/.env` for Flask, `frontend/.env` for Vite. `python-dotenv` and Vite both load from CWD.
- **Do not create `tailwind.config.js` or `postcss.config.js` in `frontend/`.** This project uses Tailwind v4 via the `@tailwindcss/vite` plugin — configuration lives in `frontend/src/index.css` (CSS variables) and `frontend/vite.config.ts` (plugin registration).
- **Import React Router from `"react-router"`**, not `"react-router-dom"`. The v7 package merged these; new code uses the shorter path.
- **Do not put secrets in `VITE_*` env vars.** Anything prefixed `VITE_` is baked into the client bundle and visible to end users. `VITE_API_BASE_URL` is a URL, which is fine.

## Project Phases

- Phase 1 (current) — Monorepo Restructure & Frontend Scaffold
- Phase 2 — Email OTP Authentication (replaces shared password)
- Phase 3 — React UI Port (shadcn/ui components, streaming, citations, export, feedback)
- Phase 4 — Render Two-Service Deployment

See `.planning/ROADMAP.md` for the full plan.

## License

Proprietary — not for redistribution.
