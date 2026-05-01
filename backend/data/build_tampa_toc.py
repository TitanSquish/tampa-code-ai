from __future__ import annotations

import json
import re
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[2]
PRIMARY_PDF = ROOT / "data" / "Tampa-code-toc.pdf"
CURATED_PDFS = [
    ROOT / "data" / "tampa-code-5-27.pdf",
    ROOT / "data" / "tampa-code-22-11-21-28-6-19-17.pdf",
]
OUTPUT_JSON = ROOT / "frontend" / "src" / "data" / "tampaCodeToc.json"

LEVEL_ORDER = {"chapter": 0, "article": 1, "division": 2, "section": 3, "other": 4}

PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^(Chapter\s+\d+[A-Za-z-]*)\s*[-.]\s*(.+)$", re.I), "chapter"),
    (re.compile(r"^(ARTICLE\s+[IVXLC0-9]+)\.?\s*[-.]\s*(.+)$", re.I), "article"),
    (re.compile(r"^(DIVISION\s+(?:[IVXLC0-9]+|\d+))\.?\s*[-.]\s*(.+)$", re.I), "division"),
    (re.compile(r"^(Sec\.\s*[0-9A-Za-z\-.]+)\.?\s*[-.]\s*(.+)$", re.I), "section"),
]
PAGE_PATTERN = re.compile(r"\.{2,}\s*(\d+)\s*$|\s(\d+)\s*$")


def extract_lines(pdf_path: Path) -> list[str]:
    doc = fitz.open(pdf_path)
    lines: list[str] = []
    for page in doc:
        for raw in page.get_text("text").splitlines():
            normalized = " ".join(raw.split()).strip()
            if normalized:
                lines.append(normalized)
    return lines


def parse_line(line: str) -> dict[str, object] | None:
    page = None
    line_body = line
    page_match = PAGE_PATTERN.search(line)
    if page_match:
        page = int(page_match.group(1) or page_match.group(2))
        line_body = line[: page_match.start()].strip(" .")

    for pattern, level in PATTERNS:
        match = pattern.match(line_body)
        if not match:
            continue
        label = match.group(1).strip()
        title = match.group(2).strip()
        item_id = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
        return {"id": item_id, "level": level, "label": label, "title": title, "page": page, "children": []}

    return None


def build_tree(entries: list[dict[str, object]]) -> list[dict[str, object]]:
    roots: list[dict[str, object]] = []
    stack: list[dict[str, object]] = []

    for entry in entries:
        level = str(entry["level"])
        while stack and LEVEL_ORDER[str(stack[-1]["level"])] >= LEVEL_ORDER[level]:
            stack.pop()

        if stack:
            stack[-1]["children"].append(entry)
        else:
            roots.append(entry)

        stack.append(entry)

    return roots


def dedupe_ids(entries: list[dict[str, object]]) -> None:
    seen: dict[str, int] = {}
    for entry in entries:
        base = str(entry["id"])
        count = seen.get(base, 0)
        if count:
            entry["id"] = f"{base}-{count + 1}"
        seen[base] = count + 1


def main() -> None:
    sources = [PRIMARY_PDF] if PRIMARY_PDF.exists() else [pdf for pdf in CURATED_PDFS if pdf.exists()]
    if not sources:
        raise FileNotFoundError("Could not find data/Tampa-code-toc.pdf or curated code PDFs in data/ directory")

    parsed: list[dict[str, object]] = []
    for source in sources:
        lines = extract_lines(source)
        parsed.extend(item for item in (parse_line(line) for line in lines) if item is not None)

    dedupe_ids(parsed)
    tree = build_tree(parsed)

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(tree, indent=2), encoding="utf-8")
    source_names = ", ".join(source.name for source in sources)
    print(f"Generated {OUTPUT_JSON} from [{source_names}] with {len(parsed)} TOC entries.")


if __name__ == "__main__":
    main()
