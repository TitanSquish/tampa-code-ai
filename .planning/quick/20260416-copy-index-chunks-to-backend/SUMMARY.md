---
id: 20260416-copy-index-chunks-to-backend
date: 2026-04-16
status: complete
---

# Summary: Copy FAISS Index and Chunks to Backend

## What Was Done
Copied pre-built permitting data files from a prior GSD agent worktree into backend/:
- `backend/tampa_code.index` (8.4 MB — FAISS flat L2 index)
- `backend/chunks.json` (2.7 MB — 1,426 Tampa code text chunks)

## Verification
Confirmed chunks.json contains valid Tampa permitting data:
- `tampa_code_5_27`: 889 chunks (Tampa Code of Ordinances, May 2027)
- `tampa_code_22_11_21_28_6_19_17`: 535 chunks (supplementary code)
- `csd_sufficiency_checklist`: 2 chunks (CSD sufficiency checklist)

## Notes
- These files are gitignored (generated artifacts). They were originally built by
  running `python ingest.py` in a prior agent session. The worktree at
  `.claude/worktrees/agent-a9768d74/` had both files from that run.
- To regenerate: place the three source PDFs in `backend/data/` and run
  `cd backend && python ingest.py` with a valid OPENAI_API_KEY.
- The backend will now start cleanly — `search.py` loads these files at import time.
