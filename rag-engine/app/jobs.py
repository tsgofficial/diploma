"""Background ingest jobs.

Ingestion is CPU/GPU-bound (OCR, embedding) and can take minutes, so admin
endpoints return a job id immediately and the work runs on a single worker
thread — serialised, because the embedding models are shared singletons and
must not be driven from two threads at once. State is in-memory: the engine is
one process, and a job that is lost on restart is simply re-run.
"""
from __future__ import annotations

import threading
import time
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from typing import Any, Callable, Optional

_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="ingest")
_lock = threading.Lock()
_jobs: dict[str, "Job"] = {}
MAX_JOBS_KEPT = 100


@dataclass
class Job:
    id: str
    kind: str                     # "ingest" | "reingest"
    status: str = "queued"        # queued | running | done | failed
    progress: list[str] = field(default_factory=list)
    result: Optional[dict] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    finished_at: Optional[float] = None

    def to_dict(self) -> dict:
        return asdict(self)


def submit(kind: str, fn: Callable[[Callable[[str], None]], Any]) -> Job:
    """Queue `fn(progress)` on the worker. `progress(msg)` appends a status
    line the client can poll."""
    job = Job(id=uuid.uuid4().hex, kind=kind)
    with _lock:
        _jobs[job.id] = job
        _trim()

    def progress(msg: str) -> None:
        with _lock:
            job.progress.append(msg)

    def run() -> None:
        with _lock:
            job.status = "running"
            job.started_at = time.time()
        try:
            result = fn(progress)
            with _lock:
                job.result = result if isinstance(result, dict) else {"result": result}
                job.status = "done"
        except Exception as exc:  # noqa: BLE001 — report any failure to the poller
            with _lock:
                job.status = "failed"
                job.error = f"{type(exc).__name__}: {exc}"
                job.progress.append(traceback.format_exc().strip().splitlines()[-1])
        finally:
            with _lock:
                job.finished_at = time.time()

    _executor.submit(run)
    return job


def get(job_id: str) -> Optional[Job]:
    with _lock:
        return _jobs.get(job_id)


def list_jobs() -> list[Job]:
    with _lock:
        return sorted(_jobs.values(), key=lambda j: j.created_at, reverse=True)


def _trim() -> None:
    if len(_jobs) <= MAX_JOBS_KEPT:
        return
    finished = sorted(
        (j for j in _jobs.values() if j.status in ("done", "failed")), key=lambda j: j.created_at
    )
    for j in finished[: len(_jobs) - MAX_JOBS_KEPT]:
        _jobs.pop(j.id, None)
