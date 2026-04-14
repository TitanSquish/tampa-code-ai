from flask import Flask, request, render_template_string, redirect, url_for, session, Response, jsonify, send_file
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from search import search_with_distances
from tampa_gis import get_tampa_property_context, suggest_tampa_addresses
from openai import OpenAI
from dotenv import load_dotenv
import os
import json
import re
import sqlite3
import time
from datetime import datetime, timezone

load_dotenv()

# ── Paths ────────────────────────────────────────────────────────────────────
_BASE = os.path.dirname(__file__)
PDF_PATH  = os.path.join(_BASE, "data", "tampa-code-5-27.pdf")
DB_PATH   = os.getenv("DB_PATH", os.path.join(_BASE, "permitiq.db"))

# ── Config (all overridable via environment variables) ───────────────────────
ADDRESS_SEARCH_MAX_DISTANCE = float(os.getenv("ADDRESS_SEARCH_MAX_DISTANCE", "2.5"))
SEARCH_K          = int(os.getenv("SEARCH_K", "10"))          # RAG chunks retrieved per query
GIS_CACHE_TTL_SEC = int(os.getenv("GIS_CACHE_TTL_SEC", "3600"))  # 1-hour persistent GIS cache
AUDIT_ENABLED     = os.getenv("AUDIT_ENABLED", "true").lower() != "false"
SEARCH_MODEL      = os.getenv("SEARCH_MODEL", "gpt-4o-mini")
ADDRESS_MODEL     = os.getenv("ADDRESS_MODEL", "gpt-4o-mini")

# ── Flask app + limiter ───────────────────────────────────────────────────────
app = Flask(__name__)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],
    storage_uri="memory://",
)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "change-this-secret")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
LOGIN_PASSWORD = os.getenv("APP_LOGIN_PASSWORD", "test123")


# ── SQLite: persistent GIS cache + audit log ─────────────────────────────────
def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    with _db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS gis_cache (
                cache_key  TEXT PRIMARY KEY,
                data       TEXT NOT NULL,
                created_at REAL NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                ts           TEXT    NOT NULL,
                query_type   TEXT    NOT NULL,
                question     TEXT,
                address      TEXT,
                zoning       TEXT,
                result_count INTEGER,
                error        TEXT
            )
        """)
        conn.commit()


_init_db()


def gis_cache_get(key: str) -> dict | None:
    with _db() as conn:
        row = conn.execute(
            "SELECT data, created_at FROM gis_cache WHERE cache_key = ?", (key,)
        ).fetchone()
    if not row:
        return None
    if time.time() - row["created_at"] > GIS_CACHE_TTL_SEC:
        return None
    return json.loads(row["data"])


def gis_cache_set(key: str, data: dict) -> None:
    with _db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO gis_cache (cache_key, data, created_at) VALUES (?, ?, ?)",
            (key, json.dumps(data), time.time()),
        )
        conn.commit()


def audit(query_type: str, *, question: str = None, address: str = None,
          zoning: str = None, result_count: int = None, error: str = None) -> None:
    if not AUDIT_ENABLED:
        return
    ts = datetime.now(timezone.utc).isoformat()
    try:
        with _db() as conn:
            conn.execute(
                "INSERT INTO audit_log (ts, query_type, question, address, zoning, result_count, error) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (ts, query_type, question, address, zoning, result_count, error),
            )
            conn.commit()
    except Exception:
        pass  # never crash the request over a log write


def build_address_query(
    permit_type: str,
    project_description: str,
    zoning: str,
    overlays=None,
) -> str:
    """
    Build a semantic search query from permit type and project description.
    Expands known keywords into zoning / land-use search terms.
    """
    parts = []
    text = f"{permit_type} {project_description}".lower()
    z = (zoning or "").strip()
    if not z:
        z = "Tampa zoning district"

    keyword_expansions = [
        (("duplex", "two-family", "two family"), "duplex two-family residential"),
        (("single family", "single-family", "sfd", "detached"), "single-family residential detached dwelling"),
        (("multifamily", "multi-family", "apartment"), "multifamily residential"),
        (("parking", "stall", "spaces"), "parking spaces vehicle"),
        (("setback", "yard", "build line"), "setbacks yards lot lines"),
        (("height", "stories", "story"), "building height stories"),
        (("lot width", "lot area", "lot size"), "lot area lot width dimensional standards"),
        (("accessory", "adu", "garage"), "accessory structure"),
        (("flood", "floodplain"), "floodplain elevation"),
        (("overlay", "historic"), "overlay district"),
    ]

    for keywords, expansion in keyword_expansions:
        if any(kw in text for kw in keywords):
            parts.append(expansion)

    if permit_type.strip():
        parts.append(permit_type.strip())

    # Base zoning / code vocabulary for strong retrieval
    base = (
        f"{z} zoning district dimensional standards "
        "minimum lot area lot width front side rear setback maximum height "
        "land development code Tampa"
    )
    parts.append(base)

    if project_description.strip():
        parts.append(project_description.strip())

    if overlays:
        for o in overlays:
            o = (o or "").strip()
            if o:
                parts.append(o)

    # De-duplicate while preserving order
    seen = set()
    merged = []
    for p in parts:
        p = p.strip()
        if p and p not in seen:
            seen.add(p)
            merged.append(p)

    return " ".join(merged)


def _format_context(results: list) -> str:
    context_blocks = []
    for r in results:
        context_blocks.append(f"[Page {r['page']} | {r['chunk_id']}]\n{r['text']}")
    return "\n\n".join(context_blocks)


def build_prompt(search_query: str, display_question: str):
    raw_results, distances = search_with_distances(search_query, k=SEARCH_K)
    results = [dict(r, distance=round(d, 4)) for r, d in zip(raw_results, distances)]
    prompt = _compose_prompt(display_question, results, mode="ask")
    return prompt, results


def _compose_prompt(display_question: str, results: list, mode: str) -> str:
    context = _format_context(results)
    if mode == "address":
        return f"""You are a zoning and land use reviewer.

Extract ONLY explicit code requirements from the provided excerpts.

Return your answer as a JSON array and nothing else — no prose before or after.
Each element must have exactly these fields:
  "name"  — the requirement name (string)
  "value" — the requirement value (string)
  "page"  — the page number where it appears (integer)

Example output:
[
  {{"name": "Minimum front setback", "value": "25 feet", "page": 42}},
  {{"name": "Maximum building height", "value": "35 feet", "page": 44}}
]

If a requirement is not found in the excerpts, omit it entirely — do not include a placeholder row.
If nothing relevant is found at all, return an empty array: []

Use ONLY the provided code excerpts below.

Task:
{display_question}

Context:
{context}
"""
    return f"""
You are assisting a permit reviewer.

Use ONLY the provided code excerpts.
If the answer is not clearly supported, say: "I could not confirm that from the indexed code excerpts."
Be concise and practical.
Always cite page numbers used.

Question:
{display_question}

Context:
{context}
"""


def build_address_prompt(search_query: str, display_question: str):
    """
    RAG prompt for address review.
    Returns (prompt, results, error) — results carry a 'distance' field for confidence display.
    """
    raw_results, distances = search_with_distances(search_query, k=SEARCH_K)
    if not raw_results or not distances:
        return None, None, "Unable to find relevant code sections for this request."
    if distances[0] > ADDRESS_SEARCH_MAX_DISTANCE:
        return None, None, "Unable to find relevant code sections for this request."
    results = [dict(r, distance=round(d, 4)) for r, d in zip(raw_results, distances)]
    prompt = _compose_prompt(display_question, results, mode="address")
    return prompt, results, None


# Regex fallback — handles dash/bullet, p./pg./page, and page ranges like (pages 5–7).
_REQ_LINE = re.compile(
    r"^\s*[-•*]\s*(?P<name>[^:\n]+?):\s*(?P<value>[^\n]+?)\s*"
    r"\(\s*p(?:ages?|gs?)?\.?\s*(?P<page>\d+)(?:\s*[-–]\s*\d+)?\s*\)\s*$",
    re.IGNORECASE | re.MULTILINE,
)


def parse_requirements(raw_text: str) -> list:
    """
    Parse structured requirements from the model's output.

    Primary:  JSON array  [{"name":..., "value":..., "page":...}, ...]
    Fallback: dash-list   - Name: value (page N)
    """
    text = (raw_text or "").strip()

    # ── Primary: JSON array ──────────────────────────────────────────────────
    try:
        start = text.find("[")
        end   = text.rfind("]") + 1
        if start >= 0 and end > start:
            data = json.loads(text[start:end])
            if isinstance(data, list):
                out = []
                for r in data:
                    try:
                        out.append({
                            "name":  str(r["name"]).strip(),
                            "value": str(r["value"]).strip(),
                            "page":  int(r["page"]),
                        })
                    except (KeyError, TypeError, ValueError):
                        continue
                if out:
                    return out
    except (ValueError, TypeError):
        pass

    # ── Fallback: regex dash-list ────────────────────────────────────────────
    out = []
    for m in _REQ_LINE.finditer(text):
        try:
            out.append({
                "name":  m.group("name").strip(),
                "value": m.group("value").strip(),
                "page":  int(m.group("page")),
            })
        except (ValueError, AttributeError):
            continue
    return out


LOGIN_HTML = """
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Permit Code Test Login</title>
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f4f7fb;
      color: #1f2937;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      width: 100%;
      max-width: 420px;
      background: white;
      border-radius: 18px;
      padding: 28px;
      box-shadow: 0 12px 28px rgba(0,0,0,0.12);
    }
    h1 { margin-top: 0; }
    input {
      width: 100%;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid #cbd5e1;
      font-size: 16px;
      box-sizing: border-box;
      margin-top: 8px;
    }
    button {
      margin-top: 14px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 12px;
      padding: 12px 18px;
      font-size: 16px;
      cursor: pointer;
      font-weight: 600;
      width: 100%;
    }
    .error {
      color: #b91c1c;
      margin-top: 12px;
    }
    .muted {
      color: #64748b;
      font-size: 14px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Permit Code Test</h1>
    <p class="muted">Enter the access password to open the reviewer test page.</p>
    <form method="POST">
      <label for="password"><strong>Password</strong></label>
      <input id="password" name="password" type="password" placeholder="Enter password" />
      <button type="submit">Log In</button>
    </form>
    {% if error %}<div class="error">{{ error }}</div>{% endif %}
  </div>
</body>
</html>
"""

HTML = """
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Permit Code Test</title>
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f4f7fb;
      color: #1f2937;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .tabs {
      display: flex;
      gap: 4px;
      padding: 12px 20px 0;
      background: #f4f7fb;
      border-bottom: 1px solid #e2e8f0;
    }
    .tab {
      padding: 10px 20px;
      border-radius: 10px 10px 0 0;
      background: #e2e8f0;
      color: #64748b;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      border: 1px solid #e2e8f0;
      border-bottom: none;
      margin-bottom: -1px;
    }
    .tab:hover {
      background: #cbd5e1;
      color: #475569;
    }
    .tab.active {
      background: white;
      color: #1d4ed8;
      border-color: #cbd5e1;
      z-index: 1;
    }
    .tab-content {
      flex: 1;
      overflow: hidden;
      display: none;
    }
    .tab-content.active {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .main-panel {
      flex: 1;
      overflow-y: auto;
      min-width: 0;
    }
    .wrap {
      max-width: 980px;
      margin: 0 auto;
      padding: 32px 20px 60px;
    }
    .pdf-panel {
      flex: 1;
      background: #1e293b;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .pdf-panel-header {
      padding: 12px 16px;
      background: #0f172a;
      color: white;
      font-weight: 600;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .pdf-goto {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pdf-goto input {
      width: 56px;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid #475569;
      background: #1e293b;
      color: white;
      font-size: 14px;
    }
    .pdf-goto button {
      padding: 4px 10px;
      font-size: 13px;
      margin-top: 0;
    }
    .pdf-viewer-container {
      flex: 1;
      overflow: hidden;
      position: relative;
    }
    .pdf-viewer-container iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    .page-link {
      color: #2563eb;
      cursor: pointer;
      text-decoration: underline;
      font-weight: 600;
    }
    .page-link:hover {
      color: #1d4ed8;
    }
    .hero {
      background: linear-gradient(135deg, #0f172a, #1d4ed8);
      color: white;
      border-radius: 18px;
      padding: 28px;
      box-shadow: 0 12px 28px rgba(0,0,0,0.14);
      margin-bottom: 20px;
    }
    .hero h1 {
      margin: 0 0 10px;
      font-size: 32px;
    }
    .hero p {
      margin: 0;
      line-height: 1.5;
      color: rgba(255,255,255,0.9);
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }
    .logout {
      text-decoration: none;
      color: #1d4ed8;
      font-weight: 700;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 22px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
      margin-top: 18px;
    }
    textarea {
      width: 100%;
      min-height: 120px;
      border-radius: 12px;
      border: 1px solid #cbd5e1;
      padding: 14px;
      font-size: 16px;
      box-sizing: border-box;
      resize: vertical;
    }
    button {
      margin-top: 14px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 12px;
      padding: 12px 18px;
      font-size: 16px;
      cursor: pointer;
      font-weight: 600;
    }
    button:hover {
      background: #1d4ed8;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .answer {
      white-space: pre-wrap;
      line-height: 1.6;
      font-size: 16px;
    }
    .chunk {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
      margin-top: 12px;
    }
    .confidence-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 99px;
      margin-left: 8px;
      vertical-align: middle;
      letter-spacing: 0.03em;
    }
    .meta {
      font-weight: 700;
      margin-bottom: 8px;
      color: #0f172a;
    }
    .muted {
      color: #64748b;
      font-size: 14px;
      line-height: 1.5;
    }
    .typing::after {
      content: "▋";
      animation: blink 1s step-end infinite;
      margin-left: 2px;
    }
    @keyframes blink {
      50% { opacity: 0; }
    }
    .hidden {
      display: none;
    }
    .autocomplete-wrap {
      position: relative;
    }
    .address-suggestions {
      position: absolute;
      left: 0;
      right: 0;
      top: calc(100% + 4px);
      background: white;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      max-height: 240px;
      overflow-y: auto;
      z-index: 30;
      box-shadow: 0 8px 24px rgba(0,0,0,0.1);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .address-suggestions li {
      padding: 10px 14px;
      cursor: pointer;
      font-size: 15px;
      border-bottom: 1px solid #f1f5f9;
    }
    .address-suggestions li:last-child { border-bottom: none; }
    .address-suggestions li:hover,
    .address-suggestions li.active {
      background: #eff6ff;
    }
    .property-context-card {
      margin-top: 14px;
      padding: 14px 16px;
      border-radius: 12px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      font-size: 14px;
      line-height: 1.55;
    }
    .property-context-card.error {
      background: #fef2f2;
      border-color: #fecaca;
    }
    .property-context-card strong { color: #0f172a; }
    #addressForm input[type="text"] {
      width: 100%;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid #cbd5e1;
      font-size: 16px;
      box-sizing: border-box;
      margin-top: 8px;
    }
    #addressForm label { display: block; margin-top: 12px; }
    #addressForm label:first-of-type { margin-top: 0; }
    #addressForm select {
      width: 100%;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid #cbd5e1;
      font-size: 16px;
      box-sizing: border-box;
      margin-top: 8px;
      background: white;
      color: #1f2937;
      appearance: auto;
    }
    .btn-export {
      margin-top: 0;
      padding: 6px 14px;
      font-size: 13px;
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-export:hover { background: #e2e8f0; }
  </style>
</head>
<body>
  <div class="tabs">
    <button type="button" class="tab active" data-tab="search">Search</button>
    <button type="button" class="tab" data-tab="pdf">Tampa Code PDF</button>
    <button type="button" class="tab" data-tab="address">Address Review</button>
  </div>

  <div id="tab-search" class="tab-content active">
  <div class="main-panel">
  <div class="wrap">
    <div class="topbar">
      <div></div>
      <a class="logout" href="{{ url_for('logout') }}">Log out</a>
    </div>

    <div class="hero">
      <h1>Permit Code Test</h1>
      <p>Test questions against the indexed city code. This tool returns an answer based only on retrieved code excerpts and shows the source chunks used.</p>
    </div>

    <div class="card">
      <form id="askForm">
        <label for="question"><strong>Ask a permit/code question</strong></label>
        <textarea id="question" name="question" placeholder="Example: What is the minimum front setback for a residential lot?"></textarea>
        <br>
        <button id="submitBtn" type="submit">Run Test</button>
      </form>
      <p class="muted">For testing only. Verify all results against the official code before relying on them.</p>
    </div>

    <div id="answerCard" class="card hidden">
      <h2>Answer</h2>
      <div id="answer" class="answer"></div>
    </div>

    <div id="resultsCard" class="card hidden">
      <h2>Retrieved Code Excerpts</h2>
      <div id="results"></div>
    </div>
  </div>
  </div>
  </div>

  <div id="tab-pdf" class="tab-content">
  <div class="pdf-panel">
    <div class="pdf-panel-header">
      <span>Tampa Code (5-27) — Click page numbers to view</span>
      <div class="pdf-goto">
        <input type="number" id="pdfPageInput" min="1" placeholder="Page" />
        <button type="button" id="pdfGoBtn">Go</button>
      </div>
    </div>
    <div class="pdf-viewer-container">
      <iframe id="pdfFrame" src="{{ url_for('serve_pdf') }}#page=1" title="Tampa Code PDF"></iframe>
    </div>
  </div>
  </div>
  <div id="tab-address" class="tab-content">
    <div class="main-panel">
    <div class="wrap">

      <div class="card">
        <h2>Address-Based Code Review</h2>

        <form id="addressForm">
          <label for="address"><strong>Property Address</strong></label>
          <div class="autocomplete-wrap">
            <input id="address" type="text" autocomplete="off" placeholder="Start typing a Tampa address…" />
            <ul id="addressSuggestions" class="address-suggestions hidden" role="listbox"></ul>
          </div>
          <input type="hidden" id="propX" />
          <input type="hidden" id="propY" />
          <input type="hidden" id="propMagicKey" />

          <div id="propertyContextCard" class="property-context-card hidden"></div>

          <label for="permitType"><strong>Permit Type</strong></label>
          <select id="permitType">
            <option value="">— Select a permit type —</option>
            <optgroup label="Residential">
              <option>Single-Family New Construction</option>
              <option>Single-Family Addition / Alteration</option>
              <option>Duplex New Construction</option>
              <option>Accessory Dwelling Unit (ADU)</option>
              <option>Accessory Structure (shed, garage, carport)</option>
              <option>Pool / Spa</option>
              <option>Fence</option>
              <option>Deck / Patio</option>
            </optgroup>
            <optgroup label="Multifamily / Commercial">
              <option>Multifamily New Construction</option>
              <option>Commercial New Construction</option>
              <option>Commercial Renovation / Tenant Improvement</option>
            </optgroup>
            <optgroup label="Other">
              <option>Demolition</option>
              <option>Site Plan Review</option>
              <option value="__other__">Other — type below</option>
            </optgroup>
          </select>
          <input id="permitTypeOther" type="text" class="hidden" placeholder="Describe permit type…" style="margin-top:6px;" />

          <label for="projectDesc"><strong>Project Description</strong></label>
          <textarea id="projectDesc" placeholder="Example: setbacks and building height"></textarea>

          <button id="addressSubmitBtn" type="submit" disabled>Get Requirements</button>
        </form>
        <p class="muted" style="margin-top:10px;">Zoning and overlays load from City of Tampa GIS — not from the AI. You must select an address and load property context before running a review.</p>
      </div>

      <div id="addressResultCard" class="card hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <h2 style="margin:0;">Code Requirements</h2>
          <div id="exportBtns" class="hidden" style="display:flex;gap:8px;">
            <button type="button" id="copyBtn" class="btn-export">Copy</button>
            <button type="button" id="csvBtn" class="btn-export">Download CSV</button>
          </div>
        </div>
        <div id="addressMeta" class="muted" style="margin-bottom:14px;"></div>
        <ul id="addressRequirements" style="margin:0;padding-left:22px;line-height:1.6;"></ul>
        <div id="addressAnswer" class="answer" style="margin-top:12px;"></div>
        <details id="addressDebugWrap" class="hidden" style="margin-top:14px;">
          <summary class="muted" style="cursor:pointer;">Model output (debug)</summary>
          <pre id="addressDebug" style="white-space:pre-wrap;font-size:13px;margin:8px 0 0;"></pre>
        </details>
      </div>
    </div>

  </div>
</div>
  <script>
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
      });
    });

    const form = document.getElementById("askForm");
    const submitBtn = document.getElementById("submitBtn");
    const questionEl = document.getElementById("question");
    const answerCard = document.getElementById("answerCard");
    const answerEl = document.getElementById("answer");
    const resultsCard = document.getElementById("resultsCard");
    const resultsEl = document.getElementById("results");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const question = questionEl.value.trim();
      if (!question) return;

      submitBtn.disabled = true;
      submitBtn.textContent = "Thinking...";

      answerCard.classList.remove("hidden");
      resultsCard.classList.remove("hidden");
      answerEl.textContent = "";
      answerEl.classList.add("typing");
      resultsEl.innerHTML = "";

      try {
        const response = await fetch("/ask", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ question })
        });

        if (!response.ok) {
          answerEl.classList.remove("typing");
          answerEl.textContent = "There was an error processing your request.";
          submitBtn.disabled = false;
          submitBtn.textContent = "Run Test";
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";
        let answerStarted = false;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\\n");
          buffer = parts.pop();

          for (const line of parts) {
            if (!line.trim()) continue;

            try {
              const msg = JSON.parse(line);

              if (msg.type === "delta") {
                if (!answerStarted) {
                  answerStarted = true;
                  answerEl.textContent = "";
                }
                answerEl.textContent += msg.text;
              } else if (msg.type === "sources") {
                answerEl.classList.remove("typing");
                resultsEl.innerHTML = "";
                linkifyPageNumbers(answerEl);

                msg.results.forEach((r) => {
                  const conf = confidenceBadge(r.distance);
                  const div = document.createElement("div");
                  div.className = "chunk";
                  div.innerHTML = `
                    <div class="meta">
                      <span class="page-link" data-page="${r.page}">Page ${r.page}</span> | ${r.chunk_id}
                      ${conf ? `<span class="confidence-badge" style="background:${conf.bg};color:${conf.fg};">${conf.label}</span>` : ""}
                    </div>
                    <div>${escapeHtml((r.text || "").slice(0, 1500))}</div>
                  `;
                  div.querySelector(".page-link").addEventListener("click", () => goToPdfPage(r.page));
                  resultsEl.appendChild(div);
                });
              } else if (msg.type === "error") {
                answerEl.classList.remove("typing");
                answerEl.textContent = msg.text;
              }
            } catch (err) {
            }
          }
        }

        answerEl.classList.remove("typing");
      } catch (err) {
        answerEl.classList.remove("typing");
        answerEl.textContent = "There was an error processing your request.";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Run Test";
      }
    });

    function confidenceBadge(dist) {
      if (dist === undefined || dist === null) return null;
      if (dist < 0.3) return { label: "Very High", bg: "#dcfce7", fg: "#166534" };
      if (dist < 0.6) return { label: "High",      bg: "#dbeafe", fg: "#1e40af" };
      if (dist < 1.0) return { label: "Moderate",  bg: "#fef9c3", fg: "#854d0e" };
      if (dist < 1.5) return { label: "Low",       bg: "#ffedd5", fg: "#9a3412" };
      return                 { label: "Weak",       bg: "#fee2e2", fg: "#991b1b" };
    }

    function escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    const pdfFrame = document.getElementById("pdfFrame");
    const pdfBaseUrl = pdfFrame.src.split("#")[0];

    document.getElementById("pdfGoBtn").addEventListener("click", () => {
      const p = parseInt(document.getElementById("pdfPageInput").value, 10);
      if (p >= 1) goToPdfPage(p);
    });
    document.getElementById("pdfPageInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("pdfGoBtn").click();
    });

    function goToPdfPage(page) {
      pdfFrame.src = pdfBaseUrl + "#page=" + page;
      document.querySelector(".tab[data-tab='pdf']").click();
    }

    function linkifyPageNumbers(container) {
      if (!container || !container.textContent) return;
      let html = escapeHtml(container.textContent);
      html = html.replace(/(\\bpage\\s+)(\\d+)(\\b)/gi, (match, prefix, num, suffix) =>
        prefix + '<span class="page-link" data-page="' + num + '">' + num + '</span>' + suffix
      );
      container.innerHTML = html;
      container.querySelectorAll(".page-link[data-page]").forEach((el) => {
        el.addEventListener("click", () => goToPdfPage(parseInt(el.dataset.page, 10)));
      });
    }
  const addressForm = document.getElementById("addressForm");
  const addressInput = document.getElementById("address");
  const addressSuggestions = document.getElementById("addressSuggestions");
  const propX = document.getElementById("propX");
  const propY = document.getElementById("propY");
  const propMagicKey = document.getElementById("propMagicKey");
  const propertyContextCard = document.getElementById("propertyContextCard");
  const addressResultCard = document.getElementById("addressResultCard");
  const addressMeta = document.getElementById("addressMeta");
  const addressRequirements = document.getElementById("addressRequirements");
  const addressAnswer = document.getElementById("addressAnswer");
  const addressDebugWrap = document.getElementById("addressDebugWrap");
  const addressDebug = document.getElementById("addressDebug");
  const addressSubmitBtn = document.getElementById("addressSubmitBtn");

  let suggestTimer = null;
  let activeSuggestIndex = -1;
  let lastSuggestions = [];
  let lastRequirements = [];
  let lastReviewAddress = "";
  let lastReviewZoning  = "";

  // Permit type "Other" toggle
  const permitTypeEl      = document.getElementById("permitType");
  const permitTypeOtherEl = document.getElementById("permitTypeOther");
  permitTypeEl.addEventListener("change", () => {
    if (permitTypeEl.value === "__other__") {
      permitTypeOtherEl.classList.remove("hidden");
      permitTypeOtherEl.focus();
    } else {
      permitTypeOtherEl.classList.add("hidden");
      permitTypeOtherEl.value = "";
    }
  });

  function hideSuggestions() {
    addressSuggestions.classList.add("hidden");
    addressSuggestions.innerHTML = "";
    activeSuggestIndex = -1;
    lastSuggestions = [];
  }

  function renderSuggestionHighlight() {
    const items = addressSuggestions.querySelectorAll("li");
    items.forEach((el, i) => {
      el.classList.toggle("active", i === activeSuggestIndex);
    });
  }

  async function loadPropertyContextFromSelection(addrText, magicKey) {
    propertyContextCard.classList.remove("hidden");
    propertyContextCard.classList.remove("error");
    propertyContextCard.innerHTML = "<span class='muted'>Loading property from Tampa GIS…</span>";
    propX.value = "";
    propY.value = "";
    addressSubmitBtn.disabled = true;

    try {
      const res = await fetch("/api/property-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: addrText,
          magic_key: magicKey || undefined
        })
      });
      const ctx = await res.json();
      if (ctx.error && !ctx.inside_city) {
        propertyContextCard.classList.add("error");
        propertyContextCard.innerHTML =
          "<strong>GIS</strong><br>" + escapeHtml(ctx.error);
        return;
      }
      if (ctx.error) {
        propertyContextCard.classList.add("error");
        propertyContextCard.innerHTML =
          "<strong>GIS</strong><br>" + escapeHtml(ctx.error);
        return;
      }
      if (!ctx.inside_city) {
        propertyContextCard.classList.add("error");
        propertyContextCard.innerHTML =
          "<strong>Outside city limits</strong><br>" +
          escapeHtml(ctx.error || "Address appears to be outside the City of Tampa.");
        return;
      }
      propX.value = ctx.x != null ? String(ctx.x) : "";
      propY.value = ctx.y != null ? String(ctx.y) : "";
      const ov = (ctx.overlays && ctx.overlays.length) ? ctx.overlays.join(", ") : "None";
      propertyContextCard.classList.remove("error");
      propertyContextCard.innerHTML =
        "<strong>Selected property</strong><br>" +
        "<strong>Address:</strong> " + escapeHtml(ctx.normalized_address || addrText) + "<br>" +
        "<strong>Inside Tampa:</strong> yes<br>" +
        "<strong>Folio:</strong> " + escapeHtml(ctx.folio || "—") + "<br>" +
        "<strong>Zoning (GIS):</strong> " + escapeHtml(ctx.zoning || "—") + "<br>" +
        "<strong>Overlays (GIS):</strong> " + escapeHtml(ov);
      addressSubmitBtn.disabled = !(ctx.zoning && propX.value && propY.value);
    } catch (err) {
      propertyContextCard.classList.add("error");
      propertyContextCard.innerHTML = "Could not reach the property lookup service.";
    }
  }

  function selectSuggestion(index) {
    const s = lastSuggestions[index];
    if (!s) return;
    hideSuggestions();
    addressInput.value = s.label || s.address;
    propMagicKey.value = s.magicKey || "";
    loadPropertyContextFromSelection(addressInput.value, propMagicKey.value);
  }

  addressInput.addEventListener("input", () => {
    if (suggestTimer) clearTimeout(suggestTimer);
    const q = addressInput.value.trim();
    propMagicKey.value = "";
    propX.value = "";
    propY.value = "";
    propertyContextCard.classList.add("hidden");
    addressSubmitBtn.disabled = true;
    if (q.length < 3) {
      hideSuggestions();
      return;
    }
    suggestTimer = setTimeout(async () => {
      try {
        const res = await fetch("/api/address-suggest?q=" + encodeURIComponent(q));
        const data = await res.json();
        if (data.error) {
          hideSuggestions();
          return;
        }
        lastSuggestions = Array.isArray(data) ? data : [];
        addressSuggestions.innerHTML = "";
        if (!lastSuggestions.length) {
          addressSuggestions.classList.add("hidden");
          return;
        }
        lastSuggestions.forEach((s, i) => {
          const li = document.createElement("li");
          li.setAttribute("role", "option");
          li.textContent = s.label || s.address;
          li.addEventListener("mousedown", (e) => {
            e.preventDefault();
            selectSuggestion(i);
          });
          addressSuggestions.appendChild(li);
        });
        addressSuggestions.classList.remove("hidden");
        activeSuggestIndex = -1;
      } catch (err) {
        hideSuggestions();
      }
    }, 250);
  });

  addressInput.addEventListener("keydown", (e) => {
    if (addressSuggestions.classList.contains("hidden")) return;
    const n = lastSuggestions.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeSuggestIndex = Math.min(activeSuggestIndex + 1, n - 1);
      renderSuggestionHighlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeSuggestIndex = Math.max(activeSuggestIndex - 1, 0);
      renderSuggestionHighlight();
    } else if (e.key === "Enter" && activeSuggestIndex >= 0) {
      e.preventDefault();
      selectSuggestion(activeSuggestIndex);
    } else if (e.key === "Escape") {
      hideSuggestions();
    }
  });

  document.addEventListener("click", (e) => {
    if (!addressSuggestions.contains(e.target) && e.target !== addressInput) {
      hideSuggestions();
    }
  });

  addressForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const address = document.getElementById("address").value.trim();
    const rawPermitType = permitTypeEl.value;
    const permitType = rawPermitType === "__other__"
      ? permitTypeOtherEl.value.trim()
      : rawPermitType;
    const projectDesc = document.getElementById("projectDesc").value;
    const x = propX.value;
    const y = propY.value;

    if (!address) return;
    if (!x || !y) {
      alert("Select an address from the suggestions and wait for Tampa GIS property context to load.");
      return;
    }

    addressResultCard.classList.remove("hidden");
    addressMeta.textContent = "";
    addressRequirements.innerHTML = "";
    addressAnswer.textContent = "";
    addressAnswer.classList.add("typing");
    addressDebugWrap.classList.add("hidden");
    addressDebug.textContent = "";

    addressSubmitBtn.disabled = true;
    addressSubmitBtn.textContent = "Analyzing...";

    try {
      const res = await fetch("/address-review", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          address,
          x: parseFloat(x),
          y: parseFloat(y),
          permit_type: permitType,
          project_description: projectDesc
        })
      });

      if (!res.ok) {
        let errText = "There was an error processing your request.";
        try {
          const errBody = await res.json();
          if (errBody.error) errText = errBody.error;
        } catch (e2) {}
        addressAnswer.classList.remove("typing");
        addressAnswer.textContent = errText;
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\\n");
        buffer = parts.pop();

        for (const line of parts) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);

            if (msg.type === "delta") {
              addressAnswer.textContent += msg.text;
            } else if (msg.type === "meta") {
              const zoning = msg.zoning || "";
              const overlays = msg.overlays || [];
              const folio = msg.folio;
              const inside = msg.inside_city !== false;
              lastReviewAddress = msg.address || document.getElementById("address").value.trim();
              lastReviewZoning  = zoning;
              addressMeta.innerHTML =
                "<strong>Inside Tampa:</strong> " + (inside ? "yes" : "no") + "<br>" +
                "<strong>Folio:</strong> " + escapeHtml(folio || "—") + "<br>" +
                "<strong>Zoning (GIS):</strong> " + escapeHtml(zoning) +
                "<br><strong>Overlays (GIS):</strong> " +
                escapeHtml((overlays && overlays.length) ? overlays.join(", ") : "None");
            } else if (msg.type === "sources") {
              addressAnswer.classList.remove("typing");

              const reqs = msg.requirements || [];
              const raw = msg.raw_text || "";
              addressRequirements.innerHTML = "";
              lastRequirements = reqs;

              if (reqs.length) {
                addressAnswer.textContent = "";
                reqs.forEach((r) => {
                  const li = document.createElement("li");
                  const page = r.page;
                  li.innerHTML =
                    "<strong>" + escapeHtml(r.name) + ":</strong> " +
                    escapeHtml(r.value) +
                    ' (<span class="page-link" data-page="' + page + '">page ' + page + "</span>)";
                  li.querySelector(".page-link").addEventListener("click", () => goToPdfPage(page));
                  addressRequirements.appendChild(li);
                });
                document.getElementById("exportBtns").classList.remove("hidden");
              } else if (raw) {
                addressAnswer.textContent = raw;
                linkifyPageNumbers(addressAnswer);
                document.getElementById("exportBtns").classList.add("hidden");
              } else {
                addressAnswer.textContent = "";
                document.getElementById("exportBtns").classList.add("hidden");
              }

              if (raw) {
                addressDebug.textContent = raw;
                addressDebugWrap.classList.remove("hidden");
              }
            } else if (msg.type === "error") {
              addressAnswer.classList.remove("typing");
              addressAnswer.textContent = msg.text;
              addressRequirements.innerHTML = "";
            }
          } catch (err) {}
        }
      }

      addressAnswer.classList.remove("typing");
    } catch (err) {
      addressAnswer.classList.remove("typing");
      addressAnswer.textContent = "There was an error processing your request.";
    } finally {
      addressSubmitBtn.disabled = false;
      addressSubmitBtn.textContent = "Get Requirements";
    }
  });

  // ── Export helpers ────────────────────────────────────────────────────────
  document.getElementById("csvBtn").addEventListener("click", () => {
    if (!lastRequirements.length) return;
    const header = ["Requirement", "Value", "Page"];
    const rows = lastRequirements.map(r => [r.name, r.value, r.page]);
    const csv = [header, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    const slug = lastReviewAddress.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
    a.href     = url;
    a.download = `requirements-${slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("copyBtn").addEventListener("click", () => {
    if (!lastRequirements.length) return;
    const lines = [
      `Code Requirements — ${lastReviewAddress}`,
      `Zoning: ${lastReviewZoning}`,
      "",
      ...lastRequirements.map(r => `• ${r.name}: ${r.value} (page ${r.page})`),
      "",
      "Generated by PermitIQ — verify against official Tampa City Code before relying on these results.",
    ];
    navigator.clipboard.writeText(lines.join("\\n")).then(() => {
      const btn = document.getElementById("copyBtn");
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = "Copy"; }, 2000);
    });
  });
  </script>
</body>
</html>
"""


@app.route("/login", methods=["GET", "POST"])
def login():
    if session.get("authenticated"):
        return redirect(url_for("home"))

    error = None
    if request.method == "POST":
        password = request.form.get("password", "")
        if password == LOGIN_PASSWORD:
            session["authenticated"] = True
            return redirect(url_for("home"))
        error = "Incorrect password"

    return render_template_string(LOGIN_HTML, error=error)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/pdf")
def serve_pdf():
    if not session.get("authenticated"):
        return redirect(url_for("login"))
    if not os.path.exists(PDF_PATH):
        return "PDF not found", 404
    return send_file(PDF_PATH, mimetype="application/pdf", as_attachment=False)


@app.route("/api/address-suggest", methods=["GET"])
def api_address_suggest():
    """Tampa GIS-backed address autocomplete (ArcGIS Locator /suggest)."""
    if not session.get("authenticated"):
        return jsonify({"error": "Unauthorized"}), 401
    q = (request.args.get("q") or "").strip()
    if len(q) < 3:
        return jsonify([])
    try:
        return jsonify(suggest_tampa_addresses(q))
    except Exception as e:
        return jsonify({"error": "Address search failed.", "detail": str(e)}), 502


@app.route("/api/property-context", methods=["POST"])
def api_property_context():
    """Resolve zoning, overlays, folio, and city limits from Tampa GIS (no LLM).
    Results are cached in SQLite for GIS_CACHE_TTL_SEC seconds."""
    if not session.get("authenticated"):
        return jsonify({"error": "Unauthorized"}), 401
    data = request.get_json(silent=True) or {}
    address = (data.get("address") or "").strip()
    magic_key = data.get("magic_key") or data.get("magicKey")
    x = data.get("x")
    y = data.get("y")
    try:
        xf = float(x) if x is not None else None
        yf = float(y) if y is not None else None
    except (TypeError, ValueError):
        xf = yf = None

    cache_key = f"{address.lower()}|{round(xf or 0, 4)}|{round(yf or 0, 4)}"
    cached = gis_cache_get(cache_key)
    if cached:
        return jsonify(cached)

    try:
        ctx = get_tampa_property_context(
            address=address,
            x=xf,
            y=yf,
            magic_key=magic_key,
        )
    except Exception as e:
        return jsonify({"error": "GIS lookup failed.", "detail": str(e)}), 502

    gis_cache_set(cache_key, ctx)
    return jsonify(ctx)


@app.route("/", methods=["GET"])
def home():
    if not session.get("authenticated"):
        return redirect(url_for("login"))
    return render_template_string(HTML, url_for=url_for)


@app.route("/ask", methods=["POST"])
@limiter.limit("60 per hour; 10 per minute")
def ask():
    if not session.get("authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()

    if not question:
        return jsonify({"error": "Missing question"}), 400

    prompt, results = build_prompt(question, question)
    audit("search", question=question, result_count=len(results))

    def generate():
        try:
            with client.responses.stream(
                model=SEARCH_MODEL,
                input=prompt
            ) as stream:
                for event in stream:
                    if event.type == "response.output_text.delta":
                        yield json.dumps({
                            "type": "delta",
                            "text": event.delta
                        }) + "\n"

            yield json.dumps({
                "type": "sources",
                "results": results
            }) + "\n"

        except Exception as e:
            audit("search", question=question, error=str(e))
            yield json.dumps({
                "type": "error",
                "text": str(e)
            }) + "\n"

    return Response(generate(), mimetype="text/plain")

@app.route("/address-review", methods=["POST"])
@limiter.limit("30 per hour; 5 per minute")
def address_review():
    if not session.get("authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}

    address = (data.get("address") or "").strip()
    permit_type = (data.get("permit_type") or "").strip()
    project_description = (data.get("project_description") or "").strip()

    if not address:
        return jsonify({"error": "Missing address"}), 400

    try:
        x = float(data.get("x"))
        y = float(data.get("y"))
    except (TypeError, ValueError):
        return jsonify({
            "error": "Property location required. Select an address and load property context from Tampa GIS first.",
        }), 400

    cache_key = f"{address.lower()}|{round(x, 4)}|{round(y, 4)}"
    ctx = gis_cache_get(cache_key)
    if ctx is None:
        try:
            ctx = get_tampa_property_context(address=address, x=x, y=y)
            gis_cache_set(cache_key, ctx)
        except Exception as e:
            return jsonify({"error": "Could not verify property with Tampa GIS.", "detail": str(e)}), 502

    if ctx.get("error"):
        return jsonify({"error": ctx["error"]}), 400
    if not ctx.get("inside_city"):
        return jsonify({
            "error": ctx.get("error") or "Address appears to be outside the City of Tampa.",
        }), 400

    zoning = ctx.get("zoning")
    overlays = list(ctx.get("overlays") or [])
    if not zoning:
        return jsonify({"error": "Zoning could not be determined from GIS."}), 400

    normalized = (ctx.get("normalized_address") or address).strip()
    search_query = build_address_query(
        permit_type, project_description, zoning=zoning, overlays=overlays
    )

    display_question = f"""Property address: {normalized}
Zoning district (from City of Tampa GIS): {zoning}
Overlays (from GIS): {", ".join(overlays) if overlays else "None"}
Folio (from parcel GIS, if matched): {ctx.get("folio") or "Not matched"}
Permit / project type: {permit_type or "(not specified)"}
Project description: {project_description or "(not specified)"}

Extract explicit code requirements that apply to this scenario from the excerpts (dimensional standards, setbacks, height, parking, lot size, and any other requirements clearly stated in the excerpts)."""

    prompt, results, prep_error = build_address_prompt(search_query, display_question)
    audit("address_review", address=normalized, zoning=zoning,
          result_count=len(results) if results else 0,
          error=prep_error)

    def generate():
        if prep_error:
            yield json.dumps({
                "type": "meta",
                "address": normalized,
                "zoning": zoning,
                "overlays": overlays,
                "folio": ctx.get("folio"),
                "inside_city": True,
            }) + "\n"
            yield json.dumps({"type": "error", "text": prep_error}) + "\n"
            return

        try:
            yield json.dumps({
                "type": "meta",
                "address": normalized,
                "zoning": zoning,
                "overlays": overlays,
                "folio": ctx.get("folio"),
                "inside_city": True,
            }) + "\n"

            full_text = []
            with client.responses.stream(
                model=ADDRESS_MODEL,
                input=prompt
            ) as stream:
                for event in stream:
                    if event.type == "response.output_text.delta":
                        full_text.append(event.delta)
                        yield json.dumps({"type": "delta", "text": event.delta}) + "\n"

            raw_text = "".join(full_text)
            requirements = parse_requirements(raw_text)

            yield json.dumps({
                "type": "sources",
                "results": results,
                "requirements": requirements,
                "raw_text": raw_text,
            }) + "\n"

        except Exception as e:
            audit("address_review", address=normalized, zoning=zoning, error=str(e))
            yield json.dumps({"type": "error", "text": str(e)}) + "\n"

    return Response(generate(), mimetype="text/plain")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)