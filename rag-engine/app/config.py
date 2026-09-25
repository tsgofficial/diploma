"""Central configuration. Read once at import time."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
PDFS_DIR = ROOT / "pdfs"

# Load .env (if present) before anything else reads os.environ. Optional dep —
# pip install python-dotenv. Silently skipped if missing.
try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ImportError:
    pass

# SQLite
DB_PATH = DATA_DIR / "policies.db"

# Qdrant
QDRANT_HOST = os.environ.get("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.environ.get("QDRANT_PORT", "6333"))
COLLECTION = "policies"

# API — shared secret the Node core-backend must present on every request.
# The rag-engine is internal-only; it should never be exposed to the browser.
INTERNAL_API_KEY = os.environ.get("RAG_INTERNAL_KEY", "dev-internal-key-change-me")

# Embeddings
EMBED_MODEL_NAME = "BAAI/bge-m3"
EMBED_DIM = 1024

# Chunking (characters). Chunks never cross a detected section heading.
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100
MIN_CHUNK_SIZE = 200   # a section shorter than this merges into the next chunk

# Retrieval
TOP_K = 5              # chunks handed to the LLM
CANDIDATE_K = 20       # candidates pulled from Qdrant before reranking
# Hybrid search: dense (bge-m3 cosine) + sparse (bge-m3 lexical weights),
# fused with Reciprocal Rank Fusion inside Qdrant. Catches exact tokens
# (order numbers, dates, codes) that dense embeddings blur.
HYBRID_SEARCH = os.environ.get("HYBRID_SEARCH", "1") != "0"
# Cross-encoder rerank of the CANDIDATE_K fused candidates down to TOP_K.
RERANK = os.environ.get("RERANK", "1") != "0"
RERANK_MODEL = "BAAI/bge-reranker-v2-m3"
# Prefix the document title to each passage the reranker judges. On this
# knowledge base it lifted fragmentary chunks (e.g. the 2030 strategy goals)
# above the gate without leaking any near-miss question; set to "0" to A/B.
RERANK_INCLUDE_TITLE = os.environ.get("RERANK_INCLUDE_TITLE", "1") != "0"
# After reranking, also keep the best RESCUE_K fused (dense+sparse) candidates
# in the LLM context if the reranker demoted them out of TOP_K. Cross-encoders
# misjudge terse table rows and clause lists; this keeps recall at the small
# cost of a few extra chunks.
RESCUE_K = 5
# Refusal gates. Below the gate we answer "мэдээлэл олдсонгүй" without
# calling the LLM. When RERANK is on, the gate is the reranker's sigmoid
# relevance of the best chunk; otherwise it is the best dense cosine score.
MIN_RELEVANCE_SCORE = 0.54
MIN_RERANK_SCORE = 0.20

# LLM (Gemini)
# Free tier gives each model its own daily quota: 2.5-flash allows only ~20
# requests/day, 3.1-flash-lite ~500 with equal answer quality on our prompts.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")
GEMINI_MAX_OUTPUT_TOKENS = 2048
# Query understanding: before retrieval, one small LLM call turns whatever the
# student typed (slang, English, abbreviations, follow-ups) into a formal
# Mongolian search query plus keyword variants. Off → raw question is used.
QUERY_REWRITE = os.environ.get("QUERY_REWRITE", "1") != "0"
# Defaults to the main model; set to a cheaper one if your key has it. A 400/404 falls back automatically.
GEMINI_REWRITE_MODEL = os.environ.get("GEMINI_REWRITE_MODEL", GEMINI_MODEL)
