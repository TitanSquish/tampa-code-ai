import os
import re
import json
import fitz
import faiss
import numpy as np
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

PDF_PATH = "data/tampa-code-5-27.pdf"
INDEX_PATH = "tampa_code.index"
CHUNKS_PATH = "chunks.json"
EMBED_MODEL = "text-embedding-3-small"

MAX_CHARS = 3500
OVERLAP = 350


def clean_text(text: str) -> str:
    text = text.replace("\r", "")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def extract_pages(pdf_path: str):
    doc = fitz.open(pdf_path)
    pages = []

    for i, page in enumerate(doc):
        text = page.get_text("text")
        text = clean_text(text)
        if text:
            pages.append({
                "page": i + 1,
                "text": text
            })

    return pages


def split_into_sections(page_text: str):
    pattern = r'(?=(Sec\.\s*(?:5|27)-[\w\.-]+\s*\.))'
    parts = re.split(pattern, page_text)

    sections = []
    i = 1
    while i < len(parts):
        heading = parts[i].strip()
        body = parts[i + 1].strip() if i + 1 < len(parts) else ""
        full = f"{heading}\n{body}".strip()
        if full:
            sections.append(full)
        i += 2

    if not sections and page_text.strip():
        sections = [page_text.strip()]

    return sections


def chunk_long_text(text: str, max_chars=MAX_CHARS, overlap=OVERLAP):
    if len(text) <= max_chars:
        return [text]

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 <= max_chars:
            current += ("\n\n" if current else "") + para
        else:
            if current:
                chunks.append(current)

            if chunks and overlap > 0:
                tail = chunks[-1][-overlap:]
                current = tail + "\n\n" + para
            else:
                current = para

    if current:
        chunks.append(current)

    return chunks


def get_section_id(text: str):
    match = re.search(r'Sec\.\s*((?:5|27)-[\w\.-]+)', text)
    return match.group(1) if match else None


def get_chapter(text: str):
    match = re.search(r'Sec\.\s*((5|27)-[\w\.-]+)', text)
    if match:
        return match.group(2)
    return None


def build_chunks(pages):
    all_chunks = []

    for page_obj in pages:
        page_num = page_obj["page"]
        page_text = page_obj["text"]

        sections = split_into_sections(page_text)

        for sec_idx, section_text in enumerate(sections):
            section_id = get_section_id(section_text) or f"page-{page_num}-section-{sec_idx}"
            chapter = get_chapter(section_text) or "unknown"

            subchunks = chunk_long_text(section_text)

            for chunk_idx, chunk_text in enumerate(subchunks):
                all_chunks.append({
                    "source": "tampa_code_5_27",
                    "chapter": chapter,
                    "section": section_id,
                    "page": page_num,
                    "chunk_id": f"{section_id}-chunk-{chunk_idx}",
                    "text": chunk_text
                })

    return all_chunks


def embed_texts(texts, batch_size=100):
    embeddings = []
    total = len(texts)
    for i in range(0, total, batch_size):
        batch = texts[i:i + batch_size]
        print(f"Embedding {i + 1}–{min(i + batch_size, total)} of {total}…")
        response = client.embeddings.create(model=EMBED_MODEL, input=batch)
        embeddings.extend([d.embedding for d in sorted(response.data, key=lambda x: x.index)])
    return np.array(embeddings, dtype="float32")


def save_index_and_chunks(chunks, embeddings):
    dim = embeddings.shape[1]
    index = faiss.IndexFlatL2(dim)
    index.add(embeddings)

    faiss.write_index(index, INDEX_PATH)

    with open(CHUNKS_PATH, "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2)

    print(f"Saved index to {INDEX_PATH}")
    print(f"Saved chunks to {CHUNKS_PATH}")


def main():
    print("Extracting pages...")
    pages = extract_pages(PDF_PATH)

    print("Building chunks...")
    chunks = build_chunks(pages)

    print(f"Built {len(chunks)} chunks")

    texts = [c["text"] for c in chunks]

    print("Generating embeddings...")
    embeddings = embed_texts(texts)

    print("Saving FAISS index...")
    save_index_and_chunks(chunks, embeddings)

    print("Done.")


if __name__ == "__main__":
    main()