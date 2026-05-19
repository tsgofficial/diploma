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

# Embeddings
EMBED_MODEL_NAME = "BAAI/bge-m3"
EMBED_DIM = 1024

# Chunking
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100

# Retrieval
TOP_K = 5
# Below this cosine score, we treat retrieval as a miss and short-circuit
# to "мэдээлэл олдсонгүй" without calling the LLM.
MIN_RELEVANCE_SCORE = 0.45

# LLM (Gemini)
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_MAX_OUTPUT_TOKENS = 2048
