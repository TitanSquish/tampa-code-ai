---
id: 20260416-copy-index-chunks-to-backend
date: 2026-04-16
status: in-progress
---

# Quick Task: Copy FAISS Index and Chunks to Backend

## Goal
Copy the pre-built permitting data files (tampa_code.index, chunks.json) from a prior
agent worktree into backend/ so search.py can load them at startup.

## Why
search.py uses bare relative paths (INDEX_PATH = "tampa_code.index") and loads them
at module import time. Without these files in backend/, the Flask server crashes on
startup before serving any requests.

## Steps
1. Copy .claude/worktrees/agent-a9768d74/backend/tampa_code.index → backend/
2. Copy .claude/worktrees/agent-a9768d74/backend/chunks.json → backend/
3. Verify files are present in backend/

## Files Changed
- backend/tampa_code.index (new — binary FAISS index, ~8.76 MB)
- backend/chunks.json (new — 11409-line JSON chunk metadata)
