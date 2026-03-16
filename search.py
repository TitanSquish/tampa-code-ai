import os
import json
import faiss
import numpy as np
from openai import OpenAI
from dotenv import load_dotenv
from functools import lru_cache

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

INDEX_PATH = "tampa_code.index"
CHUNKS_PATH = "chunks.json"
EMBED_MODEL = "text-embedding-3-small"

# Load index and chunks once (FAST)
index = faiss.read_index(INDEX_PATH)

with open(CHUNKS_PATH, "r", encoding="utf-8") as f:
    chunks = json.load(f)


@lru_cache(maxsize=256)
def get_embedding_cached(text: str):
    response = client.embeddings.create(
        model=EMBED_MODEL,
        input=text
    )
    return tuple(response.data[0].embedding)


def search(query: str, k: int = 3):

    query_embedding = np.array(
        [get_embedding_cached(query)],
        dtype="float32"
    )

    distances, indices = index.search(query_embedding, k)

    results = []

    for idx in indices[0]:
        if 0 <= idx < len(chunks):
            results.append(chunks[idx])

    return results