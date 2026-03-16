from flask import Flask, request, render_template_string, redirect, url_for, session, Response, jsonify, send_file
from search import search
from openai import OpenAI
from dotenv import load_dotenv
import os
import json

load_dotenv()

app = Flask(__name__)
PDF_PATH = os.path.join(os.path.dirname(__file__), "data", "tampa-code-5-27.pdf")
app.secret_key = os.getenv("FLASK_SECRET_KEY", "change-this-secret")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
LOGIN_PASSWORD = os.getenv("APP_LOGIN_PASSWORD", "test123")


def build_prompt(question: str):
    results = search(question, k=5)

    context_blocks = []
    for r in results:
        context_blocks.append(
            f"[Page {r['page']} | {r['chunk_id']}]\n{r['text']}"
        )

    context = "\n\n".join(context_blocks)

    prompt = f"""
You are assisting a permit reviewer who is testing an AI city code search tool.

Use ONLY the provided code excerpts.
If the answer is not clearly supported, say: "I could not confirm that from the indexed code excerpts."
Do not make legal conclusions.
Be concise and practical.
Always cite the page numbers used.

If the user asks for a checklist, requirements, submittals, inspections, or plan review items,
extract the items from the context and format them as bullet points instead of summarizing.

Question:
{question}

Context:
{context}
"""
    return prompt, results


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
  </style>
</head>
<body>
  <div class="tabs">
    <button type="button" class="tab active" data-tab="search">Search</button>
    <button type="button" class="tab" data-tab="pdf">Tampa Code PDF</button>
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
                  const div = document.createElement("div");
                  div.className = "chunk";
                  div.innerHTML = `
                    <div class="meta"><span class="page-link" data-page="${r.page}">Page ${r.page}</span> | ${r.chunk_id}</div>
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


@app.route("/", methods=["GET"])
def home():
    if not session.get("authenticated"):
        return redirect(url_for("login"))
    return render_template_string(HTML, url_for=url_for)


@app.route("/ask", methods=["POST"])
def ask():
    if not session.get("authenticated"):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()

    if not question:
        return jsonify({"error": "Missing question"}), 400

    prompt, results = build_prompt(question)

    def generate():
        try:
            with client.responses.stream(
                model="gpt-5-mini",
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
            yield json.dumps({
                "type": "error",
                "text": str(e)
            }) + "\n"

    return Response(generate(), mimetype="text/plain")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)