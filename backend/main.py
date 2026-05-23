from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect, Header, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, JSONResponse
import shutil
import os
from dotenv import load_dotenv

load_dotenv()

import uuid
import json
import time
import sqlite3
import threading
import queue
import logging
from datetime import datetime, timezone
from urllib.parse import urlparse
from services.transcriber import transcriber_service
from pydantic import BaseModel
from typing import List, Optional

APP_TITLE = "UPscribe API"
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "temp_uploads")
RESULTS_DIR = os.getenv("RESULTS_DIR", "results")
DB_PATH = os.getenv("DB_PATH", "transcriptions.db")
MAX_FILE_MB = int(os.getenv("MAX_FILE_MB", "200"))
DEFAULT_LANGUAGE = os.getenv("DEFAULT_LANGUAGE", "pt")
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
API_KEYS = {k.strip() for k in os.getenv("API_KEYS", "").split(",") if k.strip()}
API_KEY_TENANTS_RAW = os.getenv("API_KEY_TENANTS", "")
ALLOWED_DOWNLOAD_DOMAINS = {d.strip() for d in os.getenv("ALLOWED_DOWNLOAD_DOMAINS", "youtube.com,youtu.be,vimeo.com,tiktok.com").split(",") if d.strip()}
RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "20"))
JOB_RETENTION_DAYS = int(os.getenv("JOB_RETENTION_DAYS", "7"))


def parse_api_key_tenants(raw: str) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for item in raw.split(","):
        item = item.strip()
        if not item or ":" not in item:
            continue
        key, tenant = item.split(":", 1)
        key = key.strip()
        tenant = tenant.strip()
        if key and tenant:
            mapping[key] = tenant
    return mapping


API_KEY_TENANTS = parse_api_key_tenants(API_KEY_TENANTS_RAW)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title=APP_TITLE)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

_job_queue: "queue.Queue[str]" = queue.Queue()
_rate_limit_window: dict[str, list[float]] = {}
_rate_limit_lock = threading.Lock()


class TranscriptionResponse(BaseModel):
    text: str
    language: str
    segments: List[dict]
    diarized: bool


class TranslateRequest(BaseModel):
    text: str
    target_language: str


class SummarizeRequest(BaseModel):
    text: str


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def db_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = db_conn()
    with conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                input_path TEXT,
                request_json TEXT,
                result_json TEXT,
                error TEXT,
                tenant_id TEXT
            )
            """
        )
    try:
        conn.execute("SELECT tenant_id FROM jobs LIMIT 1")
    except sqlite3.OperationalError:
        with conn:
            conn.execute("ALTER TABLE jobs ADD COLUMN tenant_id TEXT")
    with conn:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_tenant_created_at ON jobs(tenant_id, created_at DESC)")
        conn.execute("UPDATE jobs SET tenant_id='legacy' WHERE tenant_id IS NULL OR tenant_id=''")
    conn.close()


def validate_runtime_config() -> None:
    if not API_KEYS:
        raise RuntimeError("API_KEYS must be configured for production usage")
    if API_KEY_TENANTS:
        missing = [k for k in API_KEYS if k not in API_KEY_TENANTS]
        if missing:
            raise RuntimeError(f"API_KEY_TENANTS is missing mappings for {len(missing)} key(s)")


def insert_job(job_id: str, input_path: str, request_payload: dict, tenant_id: str) -> None:
    now = utc_now_iso()
    conn = db_conn()
    with conn:
        conn.execute(
            "INSERT INTO jobs(id, status, created_at, updated_at, input_path, request_json, tenant_id) VALUES(?,?,?,?,?,?,?)",
            (job_id, "queued", now, now, input_path, json.dumps(request_payload, ensure_ascii=False), tenant_id),
        )
    conn.close()


def update_job(job_id: str, status: str, result: Optional[dict] = None, error: Optional[str] = None) -> None:
    conn = db_conn()
    with conn:
        conn.execute(
            "UPDATE jobs SET status=?, updated_at=?, result_json=?, error=? WHERE id=?",
            (status, utc_now_iso(), json.dumps(result, ensure_ascii=False) if result else None, error, job_id),
        )
    conn.close()


def get_job(job_id: str, tenant_id: str) -> Optional[sqlite3.Row]:
    conn = db_conn()
    row = conn.execute("SELECT * FROM jobs WHERE id=? AND tenant_id=?", (job_id, tenant_id)).fetchone()
    conn.close()
    return row


def get_job_by_id(job_id: str) -> Optional[sqlite3.Row]:
    conn = db_conn()
    row = conn.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
    conn.close()
    return row


def delete_job_for_tenant(job_id: str, tenant_id: str) -> Optional[str]:
    conn = db_conn()
    row = conn.execute("SELECT input_path FROM jobs WHERE id=? AND tenant_id=?", (job_id, tenant_id)).fetchone()
    if not row:
        conn.close()
        return None
    with conn:
        conn.execute("DELETE FROM jobs WHERE id=? AND tenant_id=?", (job_id, tenant_id))
    conn.close()
    return row["input_path"]


def purge_old_jobs() -> int:
    cutoff = datetime.now(timezone.utc).timestamp() - (JOB_RETENTION_DAYS * 86400)
    conn = db_conn()
    rows = conn.execute("SELECT id, input_path, created_at FROM jobs").fetchall()
    to_delete: list[tuple[str, Optional[str]]] = []
    for row in rows:
        try:
            created_ts = datetime.fromisoformat(row["created_at"]).timestamp()
        except Exception:
            continue
        if created_ts < cutoff:
            to_delete.append((row["id"], row["input_path"]))
    if to_delete:
        with conn:
            conn.executemany("DELETE FROM jobs WHERE id=?", [(job_id,) for job_id, _ in to_delete])
    conn.close()
    for _, path in to_delete:
        remove_local_file(path)
    return len(to_delete)


def remove_local_file(path: Optional[str]) -> None:
    if path and os.path.exists(path):
        os.remove(path)


def validate_api_key(x_api_key: Optional[str]) -> str:
    if not API_KEYS:
        raise HTTPException(status_code=503, detail="Server misconfigured: API_KEYS is required")
    if not x_api_key or x_api_key not in API_KEYS:
        raise HTTPException(status_code=401, detail="Invalid API key")
    if API_KEY_TENANTS and x_api_key not in API_KEY_TENANTS:
        raise HTTPException(status_code=401, detail="API key tenant mapping missing")
    return API_KEY_TENANTS.get(x_api_key, x_api_key[-8:])


def check_rate_limit(client_id: str) -> None:
    now = time.time()
    with _rate_limit_lock:
        window = _rate_limit_window.setdefault(client_id, [])
        one_min_ago = now - 60
        window[:] = [t for t in window if t >= one_min_ago]
        if len(window) >= RATE_LIMIT_PER_MIN:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        window.append(now)


def allowed_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return False
    host = parsed.hostname or ""
    return any(host == d or host.endswith(f".{d}") for d in ALLOWED_DOWNLOAD_DOMAINS)


def format_timestamp(seconds: float, srt: bool = False) -> str:
    ms = int((seconds - int(seconds)) * 1000)
    s = int(seconds)
    h = s // 3600
    m = (s % 3600) // 60
    sec = s % 60
    sep = "," if srt else "."
    return f"{h:02d}:{m:02d}:{sec:02d}{sep}{ms:03d}"


def to_srt(segments: list[dict]) -> str:
    out = []
    for idx, seg in enumerate(segments, start=1):
        start = format_timestamp(float(seg.get("start", 0)), srt=True)
        end = format_timestamp(float(seg.get("end", 0)), srt=True)
        speaker = seg.get("speaker")
        text = seg.get("text", "").strip()
        line = f"{speaker}: {text}" if speaker else text
        out.append(f"{idx}\n{start} --> {end}\n{line}\n")
    return "\n".join(out)


def to_vtt(segments: list[dict]) -> str:
    out = ["WEBVTT\n"]
    for seg in segments:
        start = format_timestamp(float(seg.get("start", 0)))
        end = format_timestamp(float(seg.get("end", 0)))
        speaker = seg.get("speaker")
        text = seg.get("text", "").strip()
        line = f"<v {speaker}>{text}" if speaker else text
        out.append(f"{start} --> {end}\n{line}\n")
    return "\n".join(out)


def process_job(job_id: str) -> None:
    row = get_job_by_id(job_id)
    if not row:
        return

    req = json.loads(row["request_json"])
    update_job(job_id, "processing")

    try:
        logger.info(f"JOB_STARTED: {job_id}")
        result = transcriber_service.transcribe(
            row["input_path"],
            diarize=req.get("diarize", False),
            translate=req.get("translate", False),
            restore_audio=req.get("restore_audio", False),
            mode=req.get("mode", "rapido"),
            language=req.get("language", DEFAULT_LANGUAGE),
        )
        update_job(job_id, "completed", result=result)
        logger.info(f"JOB_COMPLETED: {job_id}")
    except Exception as exc:
        logger.exception(f"JOB_FAILED: {job_id}", extra={"job_id": job_id})
        update_job(job_id, "failed", error=str(exc))
    # Note: We no longer delete the local file here to allow user downloads.
    # remove_local_file(row["input_path"])


def worker() -> None:
    logger.info("WORKER_THREAD_READY")
    while True:
        job_id = _job_queue.get()
        try:
            logger.info(f"WORKER_PICKED_JOB: {job_id}")
            process_job(job_id)
        except Exception as e:
            logger.error(f"WORKER_CRITICAL_ERROR: {e}")
        finally:
            _job_queue.task_done()


@app.on_event("startup")
def startup() -> None:
    validate_runtime_config()
    init_db()
    deleted_count = purge_old_jobs()
    
    # Re-queue unfinished jobs
    conn = db_conn()
    unfinished = conn.execute("SELECT id FROM jobs WHERE status IN ('queued', 'processing')").fetchall()
    conn.close()
    
    for row in unfinished:
        _job_queue.put(row["id"])
        logger.info(f"JOB_REQUEUED (status logic): {row['id']}")
        
    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    logger.info("service_started", extra={"app": APP_TITLE, "requeued_count": len(unfinished), "purged_jobs": deleted_count})


@app.get("/healthz")
def healthz():
    return {"status": "ok", "time": utc_now_iso()}


@app.get("/readyz")
def readyz():
    conn = db_conn()
    conn.execute("SELECT 1")
    conn.close()
    return {"status": "ready"}


@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio_sync(
    request: Request,
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    diarize: bool = Form(False),
    language: str = Form(DEFAULT_LANGUAGE),
    translate: bool = Form(False),
    restore_audio: bool = Form(False),
    mode: str = Form("rapido"),
    x_api_key: Optional[str] = Header(None),
):
    tenant_id = validate_api_key(x_api_key)
    check_rate_limit(f"{tenant_id}:{request.client.host if request.client else 'unknown'}")

    if not file and not url:
        raise HTTPException(status_code=400, detail="Either file or url must be provided")

    file_id = str(uuid.uuid4())
    temp_path = ""

    if file:
        if file.size and file.size > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (max {MAX_FILE_MB}MB)")

        allowed_extensions = (".mp3", ".wav", ".m4a", ".ogg", ".flac", ".opus", ".mp4", ".mpeg", ".webm")
        filename = file.filename or "audio"
        if not filename.lower().endswith(allowed_extensions) and not (file.content_type or "").startswith(("audio/", "video/")):
            raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}")

        ext = os.path.splitext(filename)[1] or ".mp3"
        temp_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    else:
        if not allowed_url(url or ""):
            raise HTTPException(status_code=400, detail="URL domain is not allowed")
        temp_template = os.path.join(UPLOAD_DIR, f"{file_id}.%(ext)s")
        temp_path = transcriber_service.download_from_url(url or "", temp_template)

    if not temp_path or not os.path.exists(temp_path):
        raise HTTPException(status_code=500, detail="Error retrieving audio file.")

    try:
        result = transcriber_service.transcribe(
            temp_path,
            diarize=diarize,
            translate=translate,
            restore_audio=restore_audio,
            mode=mode,
            language=language,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        remove_local_file(temp_path)


@app.post("/jobs/transcribe")
async def transcribe_audio_job(
    request: Request,
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    diarize: bool = Form(False),
    language: str = Form(DEFAULT_LANGUAGE),
    translate: bool = Form(False),
    restore_audio: bool = Form(False),
    mode: str = Form("rapido"),
    x_api_key: Optional[str] = Header(None),
):
    tenant_id = validate_api_key(x_api_key)
    check_rate_limit(f"{tenant_id}:{request.client.host if request.client else 'unknown'}")

    if not file and not url:
        raise HTTPException(status_code=400, detail="Either file or url must be provided")

    job_id = str(uuid.uuid4())
    input_path = ""

    if file:
        filename = file.filename or "audio"
        ext = os.path.splitext(filename)[1] or ".mp3"
        input_path = os.path.join(UPLOAD_DIR, f"{job_id}{ext}")
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    else:
        if not allowed_url(url or ""):
            raise HTTPException(status_code=400, detail="URL domain is not allowed")
        input_template = os.path.join(UPLOAD_DIR, f"{job_id}.%(ext)s")
        input_path = transcriber_service.download_from_url(url or "", input_template)

    payload = {
        "diarize": diarize,
        "language": language,
        "translate": translate,
        "restore_audio": restore_audio,
        "mode": mode,
    }

    payload["tenant_id"] = tenant_id
    insert_job(job_id, input_path, payload, tenant_id)
    _job_queue.put(job_id)
    return {"job_id": job_id, "status": "queued"}


@app.get("/jobs")
def list_all_jobs(x_api_key: Optional[str] = Header(None)):
    tenant_id = validate_api_key(x_api_key)
    conn = db_conn()
    rows = conn.execute(
        "SELECT id, status, created_at, updated_at, input_path, error FROM jobs WHERE tenant_id=? ORDER BY created_at DESC"
    , (tenant_id,)).fetchall()
    conn.close()
    
    return [
        {
            "job_id": r["id"],
            "status": r["status"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "filename": os.path.basename(r["input_path"]) if r["input_path"] else "Online URL",
            "error": r["error"]
        }
        for r in rows
    ]


@app.get("/jobs/{job_id}")
def job_status(job_id: str, x_api_key: Optional[str] = Header(None)):
    tenant_id = validate_api_key(x_api_key)
    row = get_job(job_id, tenant_id)
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": row["id"],
        "status": row["status"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "error": row["error"],
    }


@app.get("/jobs/{job_id}/result")
def job_result(
    job_id: str,
    format: str = Query("json", pattern="^(json|txt|srt|vtt)$"),
    x_api_key: Optional[str] = Header(None),
):
    tenant_id = validate_api_key(x_api_key)
    row = get_job(job_id, tenant_id)
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")
    if row["status"] != "completed":
        raise HTTPException(status_code=409, detail=f"Job status is {row['status']}")

    result = json.loads(row["result_json"])
    segments = result.get("segments", [])

    if format == "json":
        return JSONResponse(content=result)
    if format == "txt":
        return PlainTextResponse(result.get("text", ""), media_type="text/plain")
    if format == "srt":
        return PlainTextResponse(to_srt(segments), media_type="text/plain")
    if format == "vtt":
        return PlainTextResponse(to_vtt(segments), media_type="text/vtt")
    raise HTTPException(status_code=400, detail="Unsupported format")


@app.get("/jobs/{job_id}/audio")
def download_job_audio(job_id: str, x_api_key: Optional[str] = Header(None)):
    tenant_id = validate_api_key(x_api_key)
    row = get_job(job_id, tenant_id)
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")
    
    path = row["input_path"]
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Audio file not found or already deleted")
    
    from fastapi.responses import FileResponse
    filename = os.path.basename(path)
    return FileResponse(path, filename=f"audio_{job_id}{os.path.splitext(filename)[1]}")


@app.delete("/jobs/{job_id}")
def delete_job(job_id: str, x_api_key: Optional[str] = Header(None)):
    tenant_id = validate_api_key(x_api_key)
    input_path = delete_job_for_tenant(job_id, tenant_id)
    if input_path is None:
        raise HTTPException(status_code=404, detail="Job not found")
    remove_local_file(input_path)
    return {"job_id": job_id, "deleted": True}


@app.post("/translate_text")
async def translate_text_endpoint(req: TranslateRequest):
    try:
        from deep_translator import GoogleTranslator

        translator = GoogleTranslator(source="auto", target=req.target_language)

        chunk_size = 4000
        chunks = [req.text[i:i + chunk_size] for i in range(0, len(req.text), chunk_size)]
        translated_chunks = [translator.translate(chunk) for chunk in chunks]

        return {"translated_text": " ".join(translated_chunks)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/summarize")
async def summarize_endpoint(req: SummarizeRequest):
    try:
        from sumy.parsers.plaintext import PlaintextParser
        from sumy.nlp.tokenizers import Tokenizer
        from sumy.summarizers.lsa import LsaSummarizer

        parser = PlaintextParser.from_string(req.text, Tokenizer("portuguese"))
        summarizer = LsaSummarizer()

        sentences = summarizer(parser.document, 4)
        summary = " ".join(str(s) for s in sentences)

        if not summary.strip():
            summary = req.text[:500] + "..." if len(req.text) > 500 else req.text

        return {"summary": summary}
    except Exception as exc:
        logger.warning("summary_error=%s", exc)
        return {"summary": req.text[:500] + "..." if len(req.text) > 500 else req.text}


@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    await websocket.accept()
    logger.info("websocket_connected")

    rolling_buffer = []
    max_chunks = 4

    try:
        while True:
            data = await websocket.receive_bytes()
            chunk_id = str(uuid.uuid4())
            chunk_path = os.path.join(UPLOAD_DIR, f"chunk_{chunk_id}.wav")

            with open(chunk_path, "wb") as file_obj:
                file_obj.write(data)

            rolling_buffer.append(chunk_path)
            if len(rolling_buffer) > max_chunks:
                old = rolling_buffer.pop(0)
                remove_local_file(old)

            result = transcriber_service.transcribe(chunk_path, diarize=False)
            await websocket.send_json({"text": result["text"], "partial": True})

    except WebSocketDisconnect:
        logger.info("websocket_disconnected")
    except Exception as exc:
        logger.exception("websocket_error=%s", exc)
        await websocket.close()
    finally:
        for path in rolling_buffer:
            remove_local_file(path)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
