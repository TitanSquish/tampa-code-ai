
"""
Parse Tampa code and the CSD sufficiency checklist into structured chunks.

Usage:
    python parse_tampa_docs.py

Inputs expected in the same folder as this script:
    - tampa-code.pdf
    - csd-sufficiency-checklist_1.pdf

Outputs:
    - parsed_chunks.json
    - parsed_chunks.jsonl

Notes:
    - This parser does NOT require an OpenAI API key.
    - API keys are only needed later if you choose OpenAI embeddings or OpenAI chat models.
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import fitz  # PyMuPDF


TAMPA_FILE = "tampa-code.pdf"
CHECKLIST_FILE = "csd-sufficiency-checklist_1.pdf"
OUTPUT_JSON = "parsed_chunks.json"
OUTPUT_JSONL = "parsed_chunks.jsonl"


# -------------------------
# Regex patterns
# -------------------------

# Example: Sec. 5-105.1. - Required.
SEC_RE = re.compile(
    r"^Sec\.\s*(\d+-\d+(?:\.\d+)*)\.\s*[-–]\s*(.+?)\s*$",
    re.IGNORECASE,
)

# Example: 5-107.3.5. Minimum plan review criteria for buildings.
SUBSEC_RE = re.compile(
    r"^(\d+-\d+(?:\.\d+)+)\.?\s+(.+?)\s*$"
)

CHECKLIST_GROUP_RE = re.compile(
    r"^(LAND DEVELOPMENT QUICK TIPS|LOCAL\s*/\s*SITE|Sufficiency Details|Permit Application Guide)$",
    re.IGNORECASE,
)

CHECKLIST_ITEM_RE = re.compile(r"^(\d+)\.\s*(.+?)\s*$")


def clean_line(line: str) -> str:
    line = line.replace("\u00a0", " ")
    line = line.replace("\xad", "")
    line = re.sub(r"\s+", " ", line).strip()
    return line


def should_skip_line(line: str) -> bool:
    if not line:
        return True
    bad_starts = [
        "2/23/26,",
        "about:blank",
        "<PARSED TEXT FOR PAGE:",
        "<IMAGE FOR PAGE:",
        "Page ",
    ]
    return any(line.startswith(x) for x in bad_starts)


def extract_pages(pdf_path: str) -> List[Dict]:
    doc = fitz.open(pdf_path)
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text("text")
        raw_lines = text.splitlines()
        lines = [clean_line(x) for x in raw_lines]
        lines = [x for x in lines if x and not should_skip_line(x)]
        pages.append({"page": i + 1, "lines": lines})
    return pages


def slugify(text: Optional[str]) -> str:
    if not text:
        return "unknown"
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def looks_like_authority(text: str) -> bool:
    prefixes = [
        "COT ",
        "FBC ",
        "F.S. ",
        "Stormwater ",
        "Sec. ",
    ]
    return any(text.startswith(p) for p in prefixes)


def infer_code_tags(text: str, section_title: Optional[str], subsection_title: Optional[str]) -> List[str]:
    hay = " ".join(filter(None, [text, section_title, subsection_title])).lower()
    mapping = {
        "permit": "permit_required",
        "submittal": "submittal_documents",
        "construction documents": "submittal_documents",
        "geotechnical": "geotechnical",
        "stormwater": "stormwater",
        "drainage": "drainage",
        "setback": "setbacks",
        "zoning": "zoning",
        "tree": "trees",
        "landscape": "landscape",
        "utility": "utilities",
        "inspection": "inspections",
        "flood": "floodplain",
        "parking": "parking",
        "right-of-way": "right_of_way",
        "demolition": "demolition",
        "site plan": "site_plan",
        "special inspection": "special_inspections",
    }
    tags = [tag for needle, tag in mapping.items() if needle in hay]
    return sorted(set(tags))


def infer_checklist_tags(requirement: Optional[str], conditions: Optional[str]) -> List[str]:
    hay = " ".join(filter(None, [requirement, conditions])).lower()
    mapping = {
        "geotechnical": "geotechnical",
        "percolation": "geotechnical",
        "soils": "geotechnical",
        "drainage": "drainage",
        "tree": "trees",
        "utility": "utilities",
        "fdot": "fdot",
        "right-of-way": "right_of_way",
        "demolition": "demolition",
        "parking": "parking",
        "address verification": "addressing",
        "aviation": "aviation",
        "epc": "environmental",
        "downtown": "downtown_development",
        "affordable housing": "affordable_housing",
        "certificate of occupancy": "certificate_of_occupancy",
        "special use": "special_use",
        "rezoning": "rezoning",
    }
    tags = [tag for needle, tag in mapping.items() if needle in hay]
    return sorted(set(tags))


def build_embedding_text(chunk: Dict) -> str:
    """
    This is the text you would embed later.
    Building this structured form improves retrieval quality.
    """
    lines = [
        f"Document Type: {chunk.get('doc_type')}",
        f"Source File: {chunk.get('source_file')}",
    ]

    ordered_fields = [
        ("chapter_number", "Chapter"),
        ("section_number", "Section Number"),
        ("section_title", "Section Title"),
        ("subsection_number", "Subsection Number"),
        ("subsection_title", "Subsection Title"),
        ("checklist_group", "Checklist Group"),
        ("checklist_item_number", "Checklist Item"),
        ("authority", "Authority"),
        ("requirement", "Requirement"),
        ("conditions", "Conditions"),
        ("page_start", "Page Start"),
        ("page_end", "Page End"),
    ]

    for key, label in ordered_fields:
        value = chunk.get(key)
        if value:
            lines.append(f"{label}: {value}")

    tags = chunk.get("topic_tags") or []
    if tags:
        lines.append("Topics: " + ", ".join(tags))

    cites = chunk.get("citations") or []
    if cites:
        lines.append("Citations: " + ", ".join(cites))

    lines.append("")
    lines.append("Text:")
    lines.append(chunk.get("text", "").strip())
    return "\n".join(lines)


def split_requirement_conditions(text: str) -> Tuple[str, Optional[str]]:
    """
    Tries to split:
        "Geotechnical Report ... (commercial new construction and LSP only)."
    into
        requirement, conditions
    """
    text = text.strip()
    m = re.match(r"^(.*?)(?:\((.*?)\))?\.?$", text)
    if not m:
        return text, None
    requirement = (m.group(1) or "").strip()
    conditions = (m.group(2) or "").strip() or None
    return requirement, conditions


def split_long_text(text: str, max_chars: int = 2200, overlap: int = 250) -> List[str]:
    """
    Fallback splitter for oversized sections/subsections.
    """
    text = text.strip()
    if len(text) <= max_chars:
        return [text]

    pieces = []
    start = 0
    while start < len(text):
        end = min(len(text), start + max_chars)
        pieces.append(text[start:end].strip())
        if end == len(text):
            break
        start = max(0, end - overlap)
    return pieces


def parse_tampa_code(pdf_path: str) -> List[Dict]:
    pages = extract_pages(pdf_path)
    chunks: List[Dict] = []

    current_section: Optional[Dict] = None
    current_subsection: Optional[Dict] = None
    current_lines: List[str] = []
    current_page_start: Optional[int] = None
    current_page_end: Optional[int] = None

    def flush_current():
        nonlocal current_lines, current_page_start, current_page_end
        if not current_lines:
            return

        text = "\n".join(current_lines).strip()
        current_lines = []

        if not text:
            return

        section_number = current_section["section_number"] if current_section else None
        section_title = current_section["section_title"] if current_section else None
        subsection_number = current_subsection["subsection_number"] if current_subsection else None
        subsection_title = current_subsection["subsection_title"] if current_subsection else None

        for idx, piece in enumerate(split_long_text(text)):
            citation_base = subsection_number or section_number
            chunk = {
                "chunk_id": f"tampa_code::{section_number or 'unknown'}::{subsection_number or 'root'}::{current_page_start or 'p?'}::{idx}",
                "doc_type": "tampa_code",
                "source_file": Path(pdf_path).name,
                "chapter_number": section_number.split("-")[0] if section_number else None,
                "section_number": section_number,
                "section_title": section_title,
                "subsection_number": subsection_number,
                "subsection_title": subsection_title,
                "checklist_group": None,
                "checklist_item_number": None,
                "authority": None,
                "requirement": None,
                "conditions": None,
                "page_start": current_page_start,
                "page_end": current_page_end,
                "citations": [f"Sec. {citation_base}"] if citation_base else [],
                "topic_tags": infer_code_tags(piece, section_title, subsection_title),
                "text": piece,
            }
            chunk["embedding_text"] = build_embedding_text(chunk)
            chunks.append(chunk)

    for page in pages:
        page_num = page["page"]

        for line in page["lines"]:
            # Main code section header
            m_sec = SEC_RE.match(line)
            if m_sec:
                flush_current()
                current_section = {
                    "section_number": m_sec.group(1),
                    "section_title": m_sec.group(2).strip(),
                }
                current_subsection = None
                current_page_start = page_num
                current_page_end = page_num
                continue

            # Subsection under current section
            m_sub = SUBSEC_RE.match(line)
            if m_sub and current_section:
                candidate_num = m_sub.group(1)
                candidate_title = m_sub.group(2).strip()

                # Only treat as subsection if it belongs to current section
                if candidate_num.startswith(current_section["section_number"]):
                    flush_current()
                    current_subsection = {
                        "subsection_number": candidate_num,
                        "subsection_title": candidate_title,
                    }
                    current_page_start = page_num
                    current_page_end = page_num
                    continue

            if current_page_start is None:
                current_page_start = page_num
            current_page_end = page_num
            current_lines.append(line)

    flush_current()
    return chunks


def parse_checklist(pdf_path: str) -> List[Dict]:
    pages = extract_pages(pdf_path)
    chunks: List[Dict] = []

    current_group: Optional[str] = None
    current_item_number: Optional[str] = None
    current_authority: Optional[str] = None
    current_lines: List[str] = []
    current_page: Optional[int] = None

    def flush_item():
        nonlocal current_item_number, current_authority, current_lines, current_page
        if current_item_number is None:
            return

        joined = " ".join(current_lines).strip()
        current_lines = []

        if not joined:
            return

        requirement, conditions = split_requirement_conditions(joined)

        chunk = {
            "chunk_id": f"checklist::{slugify(current_group)}::{current_item_number}::p{current_page}",
            "doc_type": "sufficiency_checklist",
            "source_file": Path(pdf_path).name,
            "chapter_number": None,
            "section_number": None,
            "section_title": None,
            "subsection_number": None,
            "subsection_title": None,
            "checklist_group": current_group,
            "checklist_item_number": current_item_number,
            "authority": current_authority,
            "requirement": requirement,
            "conditions": conditions,
            "page_start": current_page,
            "page_end": current_page,
            "citations": [f"{current_group} item {current_item_number}"] + ([current_authority] if current_authority else []),
            "topic_tags": infer_checklist_tags(requirement, conditions),
            "text": joined,
        }
        chunk["embedding_text"] = build_embedding_text(chunk)
        chunks.append(chunk)

    for page in pages:
        page_num = page["page"]

        for line in page["lines"]:
            if line in {
                "CSD Sufficiency Checklist",
                "Please be advised if any of the following items are applicable to your permit, it may delay your permit application acceptance.",
                "Acronyms",
            }:
                continue

            m_group = CHECKLIST_GROUP_RE.match(line)
            if m_group:
                flush_item()
                current_group = m_group.group(1)
                current_item_number = None
                current_authority = None
                continue

            m_item = CHECKLIST_ITEM_RE.match(line)
            if m_item:
                text_after_num = m_item.group(2).strip()

                # If the line looks like an authority line, start a new item.
                if looks_like_authority(text_after_num):
                    flush_item()
                    current_item_number = m_item.group(1)
                    current_authority = text_after_num
                    current_page = page_num
                    current_lines = []
                    continue

            if current_item_number is not None:
                current_lines.append(line)

    flush_item()
    return chunks


def main():
    base = Path(".")
    tampa_path = base / TAMPA_FILE
    checklist_path = base / CHECKLIST_FILE

    if not tampa_path.exists():
        raise FileNotFoundError(f"Missing {TAMPA_FILE}")
    if not checklist_path.exists():
        raise FileNotFoundError(f"Missing {CHECKLIST_FILE}")

    tampa_chunks = parse_tampa_code(str(tampa_path))
    checklist_chunks = parse_checklist(str(checklist_path))
    all_chunks = tampa_chunks + checklist_chunks

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(all_chunks, f, ensure_ascii=False, indent=2)

    with open(OUTPUT_JSONL, "w", encoding="utf-8") as f:
        for item in all_chunks:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    print(f"Tampa code chunks: {len(tampa_chunks)}")
    print(f"Checklist chunks: {len(checklist_chunks)}")
    print(f"Total chunks: {len(all_chunks)}")
    print(f"Wrote {OUTPUT_JSON}")
    print(f"Wrote {OUTPUT_JSONL}")

    print("\nSample chunks:")
    for sample in all_chunks[:3]:
        print("-" * 80)
        print(sample["chunk_id"])
        print(sample["doc_type"])
        print((sample["text"][:300] + "...") if len(sample["text"]) > 300 else sample["text"])


if __name__ == "__main__":
    main()
