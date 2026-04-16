---
phase: 1
slug: monorepo-restructure-frontend-scaffold
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) / manual shell checks (backend) |
| **Config file** | `frontend/vite.config.ts` (vitest config inline) |
| **Quick run command** | `cd frontend && npm run dev -- --host` (smoke) |
| **Full suite command** | `cd frontend && npm run build && cd ../backend && python -c "import code_website"` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -c "import code_website; print('OK')"` (backend import check)
- **After every plan wave:** Run full suite command above
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | REPO-01 | — | N/A | shell | `ls backend/code_website.py` | ✅ | ⬜ pending |
| 1-01-02 | 01 | 1 | REPO-02 | — | N/A | shell | `cd backend && python -c "import code_website; print('OK')"` | ✅ | ⬜ pending |
| 1-02-01 | 02 | 1 | REPO-03 | — | N/A | shell | `ls frontend/package.json && ls frontend/vite.config.ts` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 2 | DEV-01 | — | N/A | shell | `grep -r "VITE_API_BASE_URL" frontend/.env` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | DEV-02 | — | N/A | shell | `grep "proxy" frontend/vite.config.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/` directory created with `npm create vite@latest`
- [ ] `frontend/package.json` exists with react + typescript template
- [ ] `frontend/vite.config.ts` exists for proxy + vitest config

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vite dev server proxies `/ask` to Flask | DEV-01 | Requires both servers running | Run `cd backend && flask run --port 5000` and `cd frontend && npm run dev`, then `curl -X POST http://localhost:5173/ask` and verify response |
| Flask boots from `backend/` without PYTHONPATH changes | REPO-02 | Requires runtime environment | `cd backend && gunicorn code_website:app --bind 0.0.0.0:5000` should start without ImportError |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
