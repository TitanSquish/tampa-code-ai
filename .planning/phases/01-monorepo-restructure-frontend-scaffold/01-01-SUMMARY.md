---
phase: 01-monorepo-restructure-frontend-scaffold
plan: "01"
subsystem: backend
tags:
  - monorepo
  - backend
  - restructure
  - git-mv
dependency_graph:
  requires: []
  provides:
    - backend/ directory with all Flask source files
    - backend/.env.example onboarding template
    - updated .gitignore covering backend/ paths
  affects:
    - all downstream plans expecting backend/ layout
tech_stack:
  added: []
  patterns:
    - git mv for history-preserving file relocation
    - backend/ CWD convention for Flask + python-dotenv
key_files:
  created:
    - backend/code_website.py
    - backend/search.py
    - backend/tampa_gis.py
    - backend/ingest.py
    - backend/requirements.txt
    - backend/Procfile
    - backend/data/parse_tampa_docs.py
    - backend/.env.example
  modified:
    - .gitignore
decisions:
  - D-01 through D-05 implemented as planned: backend/ is the new home for all Flask source
  - .env.example added to document all env vars; gitignore negation (!.env.example) ensures it is tracked
  - data/*.pdf glob replaced with **/data/*.pdf to cover backend/data/ layout
metrics:
  duration: "~8 minutes"
  completed: "2026-04-16"
  tasks_completed: 2
  tasks_total: 2
  files_created: 8
  files_modified: 1
---

# Phase 01 Plan 01: Backend Relocation to backend/ Summary

Move all existing Flask backend Python source and config files from the repo root into `backend/` using `git mv` to preserve history; add `backend/.env.example`; update `.gitignore` for the new monorepo layout.

## What Was Built

The repo root's Flask monolith files were relocated to `backend/` with full git history preservation. The application boots unchanged from its new working directory — `python -c "import code_website"` from `backend/` succeeds. A `backend/.env.example` documents every env var consumed by `code_website.py`. The root `.gitignore` was updated so `backend/data/*.pdf`, `backend/tampa_code.index`, `backend/chunks.json`, `backend/permitiq.db`, and `backend/.env` are all properly ignored.

## Files Moved (source path → destination path)

| Source | Destination | Method |
|--------|-------------|--------|
| `code_website.py` | `backend/code_website.py` | `git mv` (R100) |
| `search.py` | `backend/search.py` | `git mv` (R100) |
| `tampa_gis.py` | `backend/tampa_gis.py` | `git mv` (R100) |
| `ingest.py` | `backend/ingest.py` | `git mv` (R100) |
| `requirements.txt` | `backend/requirements.txt` | `git mv` (R100) |
| `Procfile` | `backend/Procfile` | `git mv` (R100) |
| `data/parse_tampa_docs.py` | `backend/data/parse_tampa_docs.py` | `git mv` (R100) |
| `tampa_code.index` | `backend/tampa_code.index` | plain `mv` (gitignored) |
| `chunks.json` | `backend/chunks.json` | plain `mv` (gitignored) |
| `data/*.pdf` | `backend/data/*.pdf` | plain `mv` (gitignored) |
| `data/parsed_chunks.*` | `backend/data/parsed_chunks.*` | plain `mv` (gitignored) |

## .gitignore Diff

```diff
-# Large source PDFs (not committed to repo)
-data/*.pdf
+# Large source PDFs (not committed to repo)
+**/data/*.pdf

-# Generated parse outputs
-data/parsed_chunks.json
-data/parsed_chunks.jsonl
+# Generated parse outputs
+**/data/parsed_chunks.json
+**/data/parsed_chunks.jsonl

 .claude
 .agents
+
+# Node / frontend
+node_modules/
+frontend/dist/
+frontend/.vite/
```

## History Preservation

```
git log --follow --oneline backend/code_website.py | head -5
8b4659e feat(01-01): move backend Python/config files to backend/ via git mv
5483d8f Added Complete Permit Codes
660723d feat: Enhance search functionality with multi-query support and feedback logging
4e49ab9 Enhance permit type selection and export functionality in the web interface
b522abd Add Procfile and implement SQLite caching for GIS and audit logging
```

History predating this plan is visible — `git mv` preserved full rename tracking.

## Backend Boot Verification

```
cd backend && python -c "import code_website; import search; import tampa_gis; print('all_imports_ok')"
all_imports_ok
```

Exit 0, all three modules import cleanly from `backend/` CWD.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `8b4659e` | feat(01-01): move backend Python/config files to backend/ via git mv |
| Task 2 | `6059baa` | chore(01-01): add backend/.env.example and update .gitignore for monorepo layout |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Previously tracked gitignored files removed from index**
- **Found during:** Task 1
- **Issue:** `chunks.json`, `tampa_code.index`, `data/*.pdf`, and `data/parsed_chunks.*` were tracked in the worktree's git index (committed in an earlier state of main). Moving them with plain `mv` left them as staged deletions in the index. Without explicitly running `git rm --cached`, these would have committed as deletions with no corresponding addition (since they are gitignored and won't be re-added).
- **Fix:** Ran `git rm --cached` on all six previously-tracked gitignored files to cleanly untrack them. Physical files were moved to `backend/data/` or `backend/` as intended.
- **Files modified:** none (index-only operation)
- **Commit:** `8b4659e`

No other deviations. D-01 through D-05 implemented exactly as planned.

## Known Stubs

None. This plan contains no UI rendering or data-wiring — pure file relocation.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- `backend/code_website.py` exists: FOUND
- `backend/search.py` exists: FOUND
- `backend/tampa_gis.py` exists: FOUND
- `backend/ingest.py` exists: FOUND
- `backend/requirements.txt` exists: FOUND
- `backend/Procfile` exists: FOUND
- `backend/data/parse_tampa_docs.py` exists: FOUND
- `backend/.env.example` exists: FOUND
- `.gitignore` updated: FOUND
- Commit `8b4659e` exists: FOUND
- Commit `6059baa` exists: FOUND
- `code_website.py` at repo root: ABSENT (correct)
- `backend/` imports work: VERIFIED (all_imports_ok)
