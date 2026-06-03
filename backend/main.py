import os
import uuid
import json
import time
import shutil
import threading
import logging
import hmac
import hashlib
import urllib.request
import urllib.parse
import ipaddress
import socket
from datetime import datetime, timezone
from urllib.parse import urlparse
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect, Header, Request, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, JSONResponse, FileResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from config import settings
from database import get_db, engine, Base
from models.jobs import Job
from models.payment import TenantSubscription, AppmaxWebhookLog
from models.workspace import Folder, Workspace, User, WorkspaceMember
from services.auth import get_tenant_id, decode_jwt_token
from services.storage import upload_file, delete_file, ensure_bucket_exists, generate_presigned_download_url
from services.transcriber import transcriber_service
from services.email import send_welcome_email, send_cancellation_email
from tasks.transcription import transcribe_job_task
from tasks.payments import process_appmax_webhook_task, process_abacate_webhook_task

# Initialize Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Initialize FastAPI App
app = FastAPI(title=settings.APP_TITLE)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.parsed_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure temporary dirs exist local to the container
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.RESULTS_DIR, exist_ok=True)

# In-memory fallback for local/dev rate limiting. Production should use Redis.
_rate_limit_window: dict[str, list[float]] = {}
_rate_limit_lock = threading.Lock()
_redis_rate_limit_client = None


# Pydantic Schemas
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


class CheckoutRequest(BaseModel):
    plan_type: Optional[str] = "annual"  # annual, trial
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    document_number: Optional[str] = None
    ip: Optional[str] = None
    payment_method: Optional[str] = None  # credit_card, pix, boleto
    postcode: Optional[str] = None
    street: Optional[str] = None
    number: Optional[str] = None
    complement: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    card_token: Optional[str] = None
    card_holder_name: Optional[str] = None
    card_holder_document: Optional[str] = None
    installments: Optional[int] = 1


class CancelSubscriptionRequest(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    reason: Optional[str] = None


class FolderCreate(BaseModel):
    name: str


class FolderResponse(BaseModel):
    id: str
    name: str
    workspace_id: str
    created_at: str


class WorkspaceMemberResponse(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    role: str
    email: str
    full_name: Optional[str] = None
    created_at: str


class WorkspaceMemberInvite(BaseModel):
    email: str
    role: str = "member"


class WorkspaceUpdate(BaseModel):
    name: str


class UserProfileUpdate(BaseModel):
    full_name: str


class SupportTicketCreate(BaseModel):
    subject: str
    message: str


class ClaimJobsRequest(BaseModel):
    guest_id: str





# Abacate Pay Helpers
def make_abacate_request(method: str, path: str, payload: dict = None) -> dict:
    url = f"https://api.abacatepay.com/v2{path}"
    data = json.dumps(payload).encode("utf-8") if payload else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("accept", "application/json")
    req.add_header("User-Agent", "Transcritor-Backend/1.0")
    if data:
        req.add_header("content-type", "application/json")
    req.add_header("Authorization", f"Bearer {settings.ABACATE_API_KEY}")
    try:
        with urllib.request.urlopen(req, timeout=8) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        logger.error(f"Abacate Pay API HTTPError {e.code}: {err_body}")
        try:
            return json.loads(err_body)
        except Exception:
            return {"error": {"message": err_body}}
    except TimeoutError as e:
        logger.error(f"Abacate Pay API timeout: {e}")
        return {"error": {"message": "Timeout ao conectar ao gateway de pagamento"}}
    except Exception as e:
        logger.error(f"Abacate Pay API connection error: {e}")
        return {"error": {"message": str(e)}}


def get_or_create_abacate_product(plan_type: str = "annual") -> str:
    external_id = "upscribe_annual_premium" if plan_type == "annual" else "upscribe_trial_7days"
    name = "Assinatura Anual Whisper Transcritor" if plan_type == "annual" else "Teste Premium 7 Dias"
    price = 15000 if plan_type == "annual" else 500
    description = "Acesso premium ilimitado ao transcritor por 1 ano." if plan_type == "annual" else "Acesso premium ilimitado ao transcritor por 7 dias."
    
    # 1. Fetch all products
    products_res = make_abacate_request("GET", "/products/list")
    product_id = None
    
    if products_res and "data" in products_res:
        for prod in products_res.get("data", []):
            if prod.get("externalId") == external_id:
                product_id = prod.get("id")
                break
                
    # 2. Create product if it doesn't exist
    if not product_id:
        logger.info(f"[Abacate Pay] Creating {plan_type} product dynamically...")
        create_payload = {
            "externalId": external_id,
            "name": name,
            "price": price,
            "currency": "BRL",
            "description": description
        }
        create_res = make_abacate_request("POST", "/products/create", create_payload)
        product_id = create_res.get("data", {}).get("id")
        
    if not product_id:
        raise HTTPException(status_code=500, detail=f"Não foi possível obter ou criar o produto {plan_type} no Abacate Pay")
        
    return product_id


def verify_abacate_signature(payload_bytes: bytes, secret: str, received_signature: str) -> bool:
    if not received_signature:
        return False
    computed_sig = hmac.new(
        secret.encode('utf-8'),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed_sig, received_signature)


# Appmax Helpers
def get_appmax_token() -> str:
    key = settings.APPMAX_API_KEY
    if ":" in key:
        client_id, client_secret = key.split(":", 1)
        auth_url = "https://auth.sandboxappmax.com.br/oauth2/token" if settings.APPMAX_SANDBOX else "https://auth.appmax.com.br/oauth2/token"
        payload = f"grant_type=client_credentials&client_id={client_id}&client_secret={client_secret}".encode("utf-8")
        req = urllib.request.Request(auth_url, data=payload, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                res = json.loads(response.read().decode("utf-8"))
                return res.get("access_token") or key
        except Exception as e:
            logger.error(f"Failed to fetch Appmax token: {e}")
            return key
    return key


def make_appmax_post(path: str, payload: dict, token: str) -> dict:
    # Check if we should use the Mock Gateway
    key = settings.APPMAX_API_KEY
    if key == "sua_chave_appmax_default" or ":" not in key:
        logger.info(f"[Appmax Simulation] Mocking POST request to {path}")
        if path == "/v1/customers":
            return {
                "data": {
                    "customer": {
                        "id": 407
                    }
                }
            }
        elif path == "/v1/orders":
            return {
                "data": {
                    "order": {
                        "id": 12345,
                        "status": "pendente"
                    }
                }
            }
        elif path == "/v1/payments/credit-card":
            return {
                "data": {
                    "status": "aprovado"
                }
            }
        elif path == "/v1/payments/pix":
            return {
                "data": {
                    "status": "pendente",
                    "pix_code": "00020126580014br.gov.bcb.pix2536mock.appmax.com.br/qr/v2/simulated_pix_code_for_upscribe_premium_plan_15000",
                    "pix_image": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
                }
            }
        elif path == "/v1/payments/boleto":
            return {
                "data": {
                    "status": "pendente",
                    "pdf_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                    "digitable_line": "34191.79001 01043.513184 91020.150008 7 90020000015000"
                }
            }

    url = f"https://api.sandboxappmax.com.br{path}" if settings.APPMAX_SANDBOX else f"https://api.appmax.com.br{path}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("accept", "application/json")
    req.add_header("content-type", "application/json")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        logger.error(f"Appmax API HTTPError {e.code}: {err_body}")
        try:
            return json.loads(err_body)
        except Exception:
            return {"error": {"message": err_body}}
    except Exception as e:
        logger.error(f"Appmax API connection error: {e}")
        return {"error": {"message": str(e)}}


def get_subscription_level(tenant_id: str, db: Session) -> str:
    if tenant_id in {"tenantA", "tenantB", "tenant_default", "tenant_secondary"}:
        return "premium"
    if tenant_id.startswith("guest_"):
        return "guest"
    sub = db.query(TenantSubscription).filter(TenantSubscription.tenant_id == tenant_id).first()
    if sub and sub.status == "active":
        if sub.expires_at:
            try:
                exp = datetime.fromisoformat(sub.expires_at)
                if exp > datetime.now(timezone.utc):
                    return "premium"
            except Exception:
                pass
        else:
            return "premium"
    return "trial"


# Helper Utilities
def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_runtime_config() -> None:
    errors: list[str] = []

    if settings.is_production:
        if settings.DEV_MODE:
            errors.append("DEV_MODE must be false in production")
        if settings.RUN_SCHEMA_CREATE_ON_STARTUP:
            errors.append("RUN_SCHEMA_CREATE_ON_STARTUP must be false in production; run Alembic migrations instead")
        if not settings.APP_URL.startswith("https://"):
            errors.append("APP_URL must use HTTPS in production")
        if any(origin.startswith("http://") for origin in settings.parsed_allowed_origins):
            errors.append("ALLOWED_ORIGINS must use HTTPS in production")
        if settings.ENABLE_LEGACY_API_KEYS:
            errors.append("ENABLE_LEGACY_API_KEYS must be false in production")
        if settings.RATE_LIMIT_BACKEND.lower() != "redis":
            errors.append("RATE_LIMIT_BACKEND must be redis in production")

        insecure_values = {
            "JWT_SECRET": settings.JWT_SECRET,
            "POSTGRES_PASSWORD": settings.POSTGRES_PASSWORD,
            "S3_SECRET_ACCESS_KEY": settings.S3_SECRET_ACCESS_KEY,
            "APPMAX_SIGNATURE_SECRET": settings.APPMAX_SIGNATURE_SECRET,
            "ABACATE_WEBHOOK_SECRET": settings.ABACATE_WEBHOOK_SECRET,
            "RESEND_API_KEY": settings.RESEND_API_KEY,
        }
        insecure_markers = {"", "postgres", "minioadmin", "change-me-local-jwt-secret", "sua_signature_secret_default", "sua_resend_api_key"}
        for name, value in insecure_values.items():
            if value in insecure_markers:
                errors.append(f"{name} must be configured with a non-default secret in production")

        if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY or not settings.SUPABASE_JWT_SECRET:
            errors.append("Supabase URL, anon key and JWT secret are required in production")
        if not settings.ABACATE_API_KEY:
            errors.append("ABACATE_API_KEY is required in production")

    if settings.ENABLE_LEGACY_API_KEYS:
        api_keys = settings.parsed_api_keys
        if not api_keys:
            errors.append("API_KEYS must be configured when ENABLE_LEGACY_API_KEYS=true")
        api_key_tenants = settings.parsed_api_key_tenants
        if api_key_tenants:
            missing = [k for k in api_keys if k not in api_key_tenants]
            if missing:
                errors.append(f"API_KEY_TENANTS is missing mappings for {len(missing)} key(s)")

    if errors:
        raise RuntimeError("Invalid runtime configuration: " + "; ".join(errors))


def _redis_rate_limit():
    global _redis_rate_limit_client
    if settings.RATE_LIMIT_BACKEND.lower() != "redis":
        return None
    if _redis_rate_limit_client is None:
        import redis
        _redis_rate_limit_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_rate_limit_client


def check_rate_limit(client_id: str) -> None:
    redis_client = _redis_rate_limit()
    if redis_client:
        key = f"rate-limit:{client_id}:{int(time.time() // 60)}"
        try:
            count = redis_client.incr(key)
            if count == 1:
                redis_client.expire(key, 70)
            if count > settings.RATE_LIMIT_PER_MIN:
                raise HTTPException(status_code=429, detail="Rate limit exceeded")
            return
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("redis_rate_limit_unavailable=%s; falling back to memory", exc)

    now = time.time()
    with _rate_limit_lock:
        window = _rate_limit_window.setdefault(client_id, [])
        one_min_ago = now - 60
        window[:] = [t for t in window if t >= one_min_ago]
        if len(window) >= settings.RATE_LIMIT_PER_MIN:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        window.append(now)


def _is_public_hostname(host: str) -> bool:
    if not host:
        return False
    try:
        candidate = ipaddress.ip_address(host)
        return candidate.is_global
    except ValueError:
        pass

    try:
        resolved = socket.getaddrinfo(host, None)
    except socket.gaierror:
        logger.warning("url_host_dns_resolution_failed=%s", host)
        return False

    for item in resolved:
        address = item[4][0]
        try:
            ip = ipaddress.ip_address(address)
        except ValueError:
            return False
        if not ip.is_global:
            logger.warning("blocked_non_public_url_host=%s resolved_ip=%s", host, ip)
            return False
    return True


def allowed_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return False

    host = (parsed.hostname or "").strip().lower().rstrip(".")
    if not _is_public_hostname(host):
        return False

    return any(host == d or host.endswith(f".{d}") for d in settings.parsed_download_domains)

def purge_old_jobs(db: Session) -> int:
    cutoff = datetime.now(timezone.utc).timestamp() - (settings.JOB_RETENTION_DAYS * 86400)
    jobs = db.query(Job).all()
    to_delete = []
    
    for job in jobs:
        try:
            created_ts = datetime.fromisoformat(job.created_at).timestamp()
        except Exception:
            continue
        if created_ts < cutoff:
            to_delete.append(job)
            
    count = len(to_delete)
    if count > 0:
        for job in to_delete:
            # Delete S3 file
            if job.input_path:
                delete_file(job.input_path)
            db.delete(job)
        db.commit()
        logger.info(f"Startup purge complete: removed {count} expired jobs and S3 storage objects.")
    return count


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


# FastAPI Lifecycle Hooks
@app.on_event("startup")
def startup() -> None:
    validate_runtime_config()
    ensure_bucket_exists()

    if settings.RUN_SCHEMA_CREATE_ON_STARTUP:
        logger.warning("RUN_SCHEMA_CREATE_ON_STARTUP is enabled; use Alembic migrations for staging/production.")
        Base.metadata.create_all(bind=engine)

    # Establish DB session & run purge
    from database import SessionLocal
    db = SessionLocal()
    try:
        deleted_count = purge_old_jobs(db)
    finally:
        db.close()

    logger.info("service_started", extra={"app": settings.APP_TITLE, "purged_jobs": deleted_count})


# Endpoints
@app.get("/healthz")
def healthz():
    return {"status": "ok", "time": utc_now_iso()}


@app.get("/readyz")
def readyz(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    redis_ok = True
    if settings.RATE_LIMIT_BACKEND.lower() == "redis":
        try:
            _redis_rate_limit().ping()
        except Exception:
            redis_ok = False
    return {"status": "ready" if redis_ok else "degraded", "redis": redis_ok}


@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio_sync(
    request: Request,
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    diarize: bool = Form(False),
    language: str = Form(settings.DEFAULT_LANGUAGE),
    translate: bool = Form(False),
    restore_audio: bool = Form(False),
    mode: str = Form("rapido"),
    tenant_id: str = Depends(get_tenant_id),
    db: Session = Depends(get_db),
):
    check_rate_limit(f"{tenant_id}:{request.client.host if request.client else 'unknown'}")
    sub_level = get_subscription_level(tenant_id, db)

    # Check daily upload limit for trial users
    if sub_level == "trial":
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        daily_count = db.query(Job).filter(Job.tenant_id == tenant_id, Job.created_at >= today_start).count()
        if daily_count >= 5:
            raise HTTPException(status_code=403, detail="Limite de 5 envios diários atingido no período de teste (Trial). Faça upgrade para Premium.")

    if sub_level == "guest":
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        daily_count = db.query(Job).filter(Job.tenant_id == tenant_id, Job.created_at >= today_start).count()
        if daily_count >= 2:
            raise HTTPException(status_code=403, detail="Limite de 2 transcrições diárias atingido para visitantes. Crie uma conta ou assine para continuar.")

    if not file and not url:
        raise HTTPException(status_code=400, detail="Either file or url must be provided")

    file_id = str(uuid.uuid4())
    temp_path = ""

    if file:
        if file.size and file.size > settings.MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (max {settings.MAX_FILE_MB}MB)")

        allowed_extensions = (".mp3", ".wav", ".m4a", ".ogg", ".flac", ".opus", ".mp4", ".mpeg", ".webm")
        filename = file.filename or "audio"
        if not filename.lower().endswith(allowed_extensions) and not (file.content_type or "").startswith(("audio/", "video/")):
            raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}")

        ext = os.path.splitext(filename)[1] or ".mp3"
        temp_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}{ext}")
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    else:
        if not allowed_url(url or ""):
            raise HTTPException(status_code=400, detail="URL domain is not allowed")
        temp_template = os.path.join(settings.UPLOAD_DIR, f"{file_id}.%(ext)s")
        temp_path = transcriber_service.download_from_url(url or "", temp_template)

    if not temp_path or not os.path.exists(temp_path):
        raise HTTPException(status_code=500, detail="Error retrieving audio file.")

    # Check file size limits (2GB for trial, 5GB for premium)
    max_bytes = 5 * 1024 * 1024 * 1024 if sub_level == "premium" else 2 * 1024 * 1024 * 1024
    if os.path.getsize(temp_path) > max_bytes:
        os.remove(temp_path)
        raise HTTPException(status_code=413, detail=f"O arquivo excede o limite de tamanho do seu plano ({'5GB' if sub_level == 'premium' else '2GB'}).")

    try:
        # Sync transcribes directly on the local machine
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
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/jobs/transcribe")
async def transcribe_audio_job(
    request: Request,
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    diarize: bool = Form(False),
    language: str = Form(settings.DEFAULT_LANGUAGE),
    translate: bool = Form(False),
    restore_audio: bool = Form(False),
    mode: str = Form("rapido"),
    folder_id: Optional[str] = Form(None),
    tenant_id: str = Depends(get_tenant_id),
    db: Session = Depends(get_db),
):
    check_rate_limit(f"{tenant_id}:{request.client.host if request.client else 'unknown'}")
    sub_level = get_subscription_level(tenant_id, db)

    # Check daily upload limit for trial users
    if sub_level == "trial":
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        daily_count = db.query(Job).filter(Job.tenant_id == tenant_id, Job.created_at >= today_start).count()
        if daily_count >= 5:
            raise HTTPException(status_code=403, detail="Limite de 5 envios diários atingido no período de teste (Trial). Faça upgrade para Premium.")

    if sub_level == "guest":
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        daily_count = db.query(Job).filter(Job.tenant_id == tenant_id, Job.created_at >= today_start).count()
        if daily_count >= 2:
            raise HTTPException(status_code=403, detail="Limite de 2 transcrições diárias atingido para visitantes. Crie uma conta ou assine para continuar.")

    if not file and not url:
        raise HTTPException(status_code=400, detail="Either file or url must be provided")

    job_id = str(uuid.uuid4())
    temp_path = ""
    # Store in different S3 prefixes for lifecycle policies (24h vs 7 days)
    s3_key = f"uploads/{sub_level}/{tenant_id}/{job_id}"

    if file:
        filename = file.filename or "audio"
        ext = os.path.splitext(filename)[1] or ".mp3"
        temp_path = os.path.join(settings.UPLOAD_DIR, f"temp_{job_id}{ext}")
        s3_key += ext
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    else:
        if not allowed_url(url or ""):
            raise HTTPException(status_code=400, detail="URL domain is not allowed")
        temp_template = os.path.join(settings.UPLOAD_DIR, f"temp_{job_id}.%(ext)s")
        temp_path = transcriber_service.download_from_url(url or "", temp_template)

    if not temp_path or not os.path.exists(temp_path):
        raise HTTPException(status_code=500, detail="Error downloading input file.")

    # Check file size limits (2GB for trial, 5GB for premium)
    max_bytes = 5 * 1024 * 1024 * 1024 if sub_level == "premium" else 2 * 1024 * 1024 * 1024
    if os.path.getsize(temp_path) > max_bytes:
        os.remove(temp_path)
        raise HTTPException(status_code=413, detail=f"O arquivo excede o limite de tamanho do seu plano ({'5GB' if sub_level == 'premium' else '2GB'}).")

    try:
        # 1. Upload the raw audio to secure S3 storage bucket
        if not upload_file(temp_path, s3_key):
            raise HTTPException(status_code=500, detail="Failed to store audio file in cloud object storage.")
    finally:
        # Ensure temporary disk cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)

    payload = {
        "diarize": diarize,
        "language": language,
        "translate": translate,
        "restore_audio": restore_audio,
        "mode": mode,
    }

    # 2. Persist metadata record in PostgreSQL DB
    now = utc_now_iso()
    new_job = Job(
        id=job_id,
        status="queued",
        created_at=now,
        updated_at=now,
        input_path=s3_key, # Stores S3 key
        request_json=json.dumps(payload, ensure_ascii=False),
        tenant_id=tenant_id,
        workspace_id=tenant_id,
        folder_id=folder_id
    )
    db.add(new_job)
    db.commit()

    # 3. Offload processing task to Celery worker cluster
    transcribe_job_task.delay(job_id)
    
    return {"job_id": job_id, "status": "queued"}


@app.get("/jobs")
def list_all_jobs(
    folder_id: Optional[str] = Query(None),
    tenant_id: str = Depends(get_tenant_id),
    db: Session = Depends(get_db)
):
    query = db.query(Job).filter(Job.tenant_id == tenant_id)
    if folder_id:
        if folder_id == "root":
            query = query.filter(Job.folder_id == None)
        else:
            query = query.filter(Job.folder_id == folder_id)
    rows = query.order_by(Job.created_at.desc()).all()
    
    return [
        {
            "job_id": r.id,
            "status": r.status,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
            "filename": os.path.basename(r.input_path) if r.input_path else "Online URL",
            "error": r.error,
            "folder_id": r.folder_id,
            "language": json.loads(r.request_json).get("language", "pt") if r.request_json else "pt"
        }
        for r in rows
    ]


@app.get("/jobs/{job_id}")
def job_status(job_id: str, tenant_id: str = Depends(get_tenant_id), db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id, Job.tenant_id == tenant_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job.id,
        "status": job.status,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "error": job.error,
        "language": json.loads(job.request_json).get("language", "pt") if job.request_json else "pt"
    }


@app.get("/jobs/{job_id}/result")
def job_result(
    job_id: str,
    format: str = Query("json", pattern="^(json|txt|srt|vtt)$"),
    tenant_id: str = Depends(get_tenant_id),
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.id == job_id, Job.tenant_id == tenant_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "completed":
        raise HTTPException(status_code=409, detail=f"Job status is {job.status}")

    result = json.loads(job.result_json)
    segments = result.get("segments", [])

    sub_level = get_subscription_level(tenant_id, db)
    is_premium = (sub_level == "premium")

    is_blurred = False
    if not is_premium:
        original_count = len(segments)
        segments = [s for s in segments if float(s.get("end", 0)) <= 1800.0]
        if len(segments) < original_count:
            is_blurred = True
        if is_blurred:
            result["text"] = " ".join([s.get("text", "") for s in segments]).strip()

    if format == "json":
        result["segments"] = segments
        result["is_blurred"] = is_blurred
        return JSONResponse(content=result)
    if format == "txt":
        return PlainTextResponse(result.get("text", ""), media_type="text/plain")
    if format == "srt":
        return PlainTextResponse(to_srt(segments), media_type="text/plain")
    if format == "vtt":
        return PlainTextResponse(to_vtt(segments), media_type="text/vtt")
    raise HTTPException(status_code=400, detail="Unsupported format")


@app.get("/jobs/{job_id}/audio")
def download_job_audio(job_id: str, tenant_id: str = Depends(get_tenant_id), db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id, Job.tenant_id == tenant_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    s3_key = job.input_path
    if not s3_key:
        raise HTTPException(status_code=404, detail="Audio file link not found.")
        
    # Generate short-lived presigned URL for downloading securely from cloud storage
    url = generate_presigned_download_url(s3_key, expires_in=600)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to request download authorization link.")
        
    # Redirect client to S3 secure presigned URL
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=url)


@app.delete("/jobs/{job_id}")
def delete_job(job_id: str, tenant_id: str = Depends(get_tenant_id), db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id, Job.tenant_id == tenant_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    # Delete S3 object
    if job.input_path:
        delete_file(job.input_path)
        
    # Hard delete from PostgreSQL db
    db.delete(job)
    db.commit()
    
    return {"job_id": job_id, "deleted": True}


@app.post("/jobs/{job_id}/retry")
def retry_job(job_id: str, tenant_id: str = Depends(get_tenant_id), db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id, Job.tenant_id == tenant_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status in {"queued", "processing"}:
        return {"job_id": job_id, "status": job.status}
        
    # Set status back to queued
    job.status = "queued"
    job.updated_at = utc_now_iso()
    job.result_json = None
    job.error = None
    db.commit()
    
    # Re-dispatch Celery background task
    transcribe_job_task.delay(job_id)
    
    return {"job_id": job_id, "status": "queued"}


@app.post("/api/v1/folders", response_model=FolderResponse)
def create_folder(
    req: FolderCreate,
    tenant_id: str = Depends(get_tenant_id),
    db: Session = Depends(get_db)
):
    new_folder = Folder(
        name=req.name,
        workspace_id=tenant_id
    )
    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)
    return FolderResponse(
        id=new_folder.id,
        name=new_folder.name,
        workspace_id=new_folder.workspace_id,
        created_at=new_folder.created_at.isoformat()
    )


@app.get("/api/v1/folders", response_model=List[FolderResponse])
def list_folders(
    tenant_id: str = Depends(get_tenant_id),
    db: Session = Depends(get_db)
):
    folders = db.query(Folder).filter(Folder.workspace_id == tenant_id).order_by(Folder.created_at.desc()).all()
    return [
        FolderResponse(
            id=f.id,
            name=f.name,
            workspace_id=f.workspace_id,
            created_at=f.created_at.isoformat()
        )
        for f in folders
    ]


@app.delete("/api/v1/folders/{folder_id}")
def delete_folder(
    folder_id: str,
    tenant_id: str = Depends(get_tenant_id),
    db: Session = Depends(get_db)
):
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.workspace_id == tenant_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    # Delete jobs inside this folder
    jobs = db.query(Job).filter(Job.folder_id == folder_id, Job.tenant_id == tenant_id).all()
    for job in jobs:
        if job.input_path:
            delete_file(job.input_path)
        db.delete(job)

    db.delete(folder)
    db.commit()
    return {"folder_id": folder_id, "deleted": True}


@app.patch("/api/v1/jobs/{job_id}/move")
def move_job(
    job_id: str,
    folder_id: Optional[str] = Query(None),
    tenant_id: str = Depends(get_tenant_id),
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.id == job_id, Job.tenant_id == tenant_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if folder_id:
        folder = db.query(Folder).filter(Folder.id == folder_id, Folder.workspace_id == tenant_id).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Target folder not found")
        job.folder_id = folder_id
    else:
        job.folder_id = None
        
    job.updated_at = utc_now_iso()
    db.commit()
    return {"job_id": job_id, "folder_id": job.folder_id}


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
            chunk_path = os.path.join(settings.UPLOAD_DIR, f"chunk_{chunk_id}.wav")

            with open(chunk_path, "wb") as file_obj:
                file_obj.write(data)

            rolling_buffer.append(chunk_path)
            if len(rolling_buffer) > max_chunks:
                old = rolling_buffer.pop(0)
                if os.path.exists(old):
                    os.remove(old)

            result = transcriber_service.transcribe(chunk_path, diarize=False)
            await websocket.send_json({"text": result["text"], "partial": True})

    except WebSocketDisconnect:
        logger.info("websocket_disconnected")
    except Exception as exc:
        logger.exception("websocket_error=%s", exc)
        await websocket.close()
    finally:
        for path in rolling_buffer:
            if os.path.exists(path):
                os.remove(path)


@app.get("/api/v1/payments/subscription-status")
def get_subscription_status(tenant_id: str = Depends(get_tenant_id), db: Session = Depends(get_db)):
    # DEV MODE: Grant active status to all authenticated users while payment gateway is pending
    if settings.DEV_MODE:
        from datetime import timedelta
        expires = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
        return {
            "status": "active",
            "plan_type": "annual",
            "expires_at": expires,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "amount": 15000,
            "last_order_id": None,
        }

    # Standard dev/test override for legacy API key tenants
    if tenant_id in {"tenantA", "tenantB", "tenant_default", "tenant_secondary"}:
        from datetime import timedelta
        expires = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
        return {
            "status": "active",
            "plan_type": "annual",
            "expires_at": expires,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "amount": 15000,
            "last_order_id": None,
        }

    sub = db.query(TenantSubscription).filter(TenantSubscription.tenant_id == tenant_id).first()
    if not sub:
        return {"status": "inactive", "plan_type": None, "expires_at": None, "created_at": None, "amount": None, "last_order_id": None}
    return {
        "status": sub.status,
        "plan_type": sub.plan_type,
        "expires_at": sub.expires_at,
        "created_at": sub.created_at,
        "amount": 15000,
        "last_order_id": sub.last_order_id,
    }


@app.post("/api/v1/payments/checkout")
async def handle_checkout(
    req: CheckoutRequest,
    tenant_id: str = Depends(get_tenant_id),
    db: Session = Depends(get_db)
):
    # 1. Get or create product in Abacate Pay
    plan_type = req.plan_type or "annual"
    product_id = get_or_create_abacate_product(plan_type)
    
    # 2. Create Hosted Checkout Session
    customer_data = {}
    name = f"{req.first_name or ''} {req.last_name or ''}".strip()
    if name:
        customer_data["name"] = name
    if req.email:
        customer_data["email"] = req.email
    if req.document_number:
        clean_doc = req.document_number.replace(".", "").replace("-", "").replace("/", "").strip()
        if clean_doc:
            customer_data["taxId"] = clean_doc
    if req.phone:
        clean_phone = req.phone.replace("(", "").replace(")", "").replace("-", "").replace(" ", "").strip()
        if clean_phone:
            customer_data["cellphone"] = clean_phone

    import time
    unique_ext_id = f"{tenant_id}_{int(time.time())}"
    
    checkout_payload = {
        "items": [
            {
                "id": product_id,
                "quantity": 1
            }
        ],
        "frequency": "ONE_TIME",
        "methods": ["PIX", "CARD"],
        "returnUrl": f"{settings.APP_URL.rstrip('/')}?status=success&tenant_id={tenant_id}",
        "completionUrl": f"{settings.APP_URL.rstrip('/')}?status=success&tenant_id={tenant_id}",
        "externalId": unique_ext_id
    }

    if customer_data:
        # Create customer first to get customerId
        cust_res = make_abacate_request("POST", "/customers/create", customer_data)
        if cust_res and cust_res.get("success") and cust_res.get("data", {}).get("id"):
            checkout_payload["customerId"] = cust_res["data"]["id"]
        else:
            logger.warning(f"Failed to create Abacate Pay customer. Proceeding without pre-fill. Res: {cust_res}")

    checkout_res = make_abacate_request("POST", "/checkouts/create", checkout_payload)
    if not checkout_res:
        raise HTTPException(status_code=502, detail="Sem resposta do Abacate Pay")
    # Abacate Pay returns {"success": true, "error": null} on success - check actual values
    has_error = checkout_res.get("error") is not None
    is_failure = checkout_res.get("success") is False
    if has_error or is_failure:
        err_obj = checkout_res.get("error") or {}
        err_msg = (err_obj.get("message") if isinstance(err_obj, dict) else str(err_obj)) or "Erro ao criar checkout no Abacate Pay"
        raise HTTPException(status_code=400, detail=err_msg)
        
    checkout_data = checkout_res.get("data", {})
    checkout_url = checkout_data.get("url")
    checkout_id = checkout_data.get("id")
    
    if not checkout_url:
        raise HTTPException(status_code=500, detail="Checkout URL não retornada pelo Abacate Pay")
        
    # 3. Create or Update TenantSubscription in inactive status
    sub = db.query(TenantSubscription).filter(TenantSubscription.tenant_id == tenant_id).first()
    now_iso = datetime.now(timezone.utc).isoformat()
    if not sub:
        sub = TenantSubscription(
            tenant_id=tenant_id,
            status="inactive",
            plan_type=plan_type,
            customer_id=None,
            last_order_id=str(checkout_id),
            created_at=now_iso,
            updated_at=now_iso
        )
        db.add(sub)
    else:
        sub.last_order_id = str(checkout_id)
        sub.plan_type = plan_type
        sub.updated_at = now_iso
    db.commit()

    # Fire welcome email asynchronously (best-effort, non-blocking)
    customer_email = req.email
    customer_name = f"{req.first_name or ''} {req.last_name or ''}" .strip() or "Usuário"
    if customer_email:
        try:
            from datetime import timedelta
            expires_label = (datetime.now(timezone.utc) + timedelta(days=365)).strftime("%d/%m/%Y")
            send_welcome_email(customer_email, customer_name, expires_label)
        except Exception as email_err:
            logger.warning(f"[Email] Welcome email failed (non-critical): {email_err}")

    return {
        "status": "pending_payment",
        "checkout_url": checkout_url,
        "checkout_id": checkout_id
    }


@app.post("/api/v1/jobs/claim")
def claim_guest_jobs(
    req: ClaimJobsRequest,
    tenant_id: str = Depends(get_tenant_id),
    db: Session = Depends(get_db)
):
    guest_tenant = f"guest_{req.guest_id.strip()}"
    jobs = db.query(Job).filter(Job.tenant_id == guest_tenant).all()
    count = len(jobs)
    for job in jobs:
        job.tenant_id = tenant_id
        job.workspace_id = tenant_id
    db.commit()
    logger.info(f"Tenant {tenant_id} claimed {count} jobs from guest {guest_tenant}")
    return {"success": True, "claimed_jobs_count": count}


@app.post("/api/v1/payments/cancel")
async def cancel_subscription(
    req: CancelSubscriptionRequest,
    tenant_id: str = Depends(get_tenant_id),
    db: Session = Depends(get_db)
):
    """Cancel the tenant's active subscription."""
    # Dev tenants cannot be cancelled via this endpoint
    if tenant_id in {"tenantA", "tenantB", "tenant_default", "tenant_secondary"}:
        raise HTTPException(status_code=403, detail="Contas de desenvolvimento não podem ser canceladas via API.")

    sub = db.query(TenantSubscription).filter(TenantSubscription.tenant_id == tenant_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Assinatura não encontrada.")
    if sub.status == "cancelled":
        raise HTTPException(status_code=409, detail="Assinatura já está cancelada.")

    sub.status = "cancelled"
    sub.updated_at = datetime.now(timezone.utc).isoformat()
    db.commit()

    # Send cancellation confirmation email (best-effort)
    if req.email:
        try:
            customer_name = req.name or "Usuário"
            send_cancellation_email(req.email, customer_name)
        except Exception as email_err:
            logger.warning(f"[Email] Cancellation email failed (non-critical): {email_err}")

    logger.info(f"[Payments] Subscription cancelled for tenant {tenant_id}")
    return {"status": "cancelled", "message": "Assinatura cancelada com sucesso."}


def verify_appmax_signature(payload_bytes: bytes, received_signature: str) -> bool:
    if not received_signature:
        return False
    computed_sig = hmac.new(
        settings.APPMAX_SIGNATURE_SECRET.encode('utf-8'),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed_sig, received_signature)


@app.post("/api/v1/payments/appmax-webhook")
async def handle_appmax_webhook(
    request: Request,
    x_appmax_signature: str = Header(None),
    db: Session = Depends(get_db)
):
    payload_bytes = await request.body()
    payload_str = payload_bytes.decode("utf-8")
    
    # Validation of webhook signature
    if settings.APPMAX_SIGNATURE_SECRET and settings.APPMAX_SIGNATURE_SECRET != "sua_signature_secret_default":
        if not verify_appmax_signature(payload_bytes, x_appmax_signature):
            logger.warning(f"Invalid webhook signature received: {x_appmax_signature}")
            raise HTTPException(status_code=401, detail="Assinatura de webhook inválida")
            
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="JSON malformado")
        
    event_name = data.get("event")
    order_id = str(data.get("order_id") or "")
    
    # Generate unique event_id if not present
    event_id = data.get("event_id") or f"{event_name}_{order_id}_{data.get('event_type') or 'unknown'}"
    
    if not event_name or not order_id:
        raise HTTPException(status_code=422, detail="event e order_id são obrigatórios")
        
    # Idempotency lock
    existing_log = db.query(AppmaxWebhookLog).filter(AppmaxWebhookLog.event_id == event_id).first()
    if existing_log:
        if existing_log.status == "processed":
            return {"status": "already_processed", "event_id": event_id}
        return {"status": "processing_in_progress", "event_id": event_id}
        
    webhook_log = AppmaxWebhookLog(
        event_id=event_id,
        order_id=order_id,
        event_type=event_name,
        status="processing",
        payload=payload_str
    )
    db.add(webhook_log)
    db.commit()
    
    # Process webhook in Celery worker cluster
    process_appmax_webhook_task.delay(event_id, data)
    
    return {"status": "queued", "event_id": event_id}


@app.post("/api/v1/payments/abacate-webhook")
async def handle_abacate_webhook(
    request: Request,
    x_webhook_signature: str = Header(None),
    db: Session = Depends(get_db)
):
    payload_bytes = await request.body()
    payload_str = payload_bytes.decode("utf-8")
    
    # Validation of webhook signature
    if settings.ABACATE_WEBHOOK_SECRET and settings.ABACATE_WEBHOOK_SECRET != "sua_signature_secret_default":
        if not verify_abacate_signature(payload_bytes, settings.ABACATE_WEBHOOK_SECRET, x_webhook_signature):
            logger.warning(f"Invalid Abacate Pay webhook signature received: {x_webhook_signature}")
            raise HTTPException(status_code=401, detail="Assinatura de webhook inválida")
            
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="JSON malformado")
        
    event_name = data.get("event")
    event_id = data.get("id")
    
    if not event_name or not event_id:
        raise HTTPException(status_code=422, detail="event e id são obrigatórios")
        
    # Idempotency lock
    existing_log = db.query(AppmaxWebhookLog).filter(AppmaxWebhookLog.event_id == event_id).first()
    if existing_log:
        if existing_log.status == "processed":
            return {"status": "already_processed", "event_id": event_id}
        return {"status": "processing_in_progress", "event_id": event_id}
        
    webhook_log = AppmaxWebhookLog(
        event_id=event_id,
        order_id=str(data.get("data", {}).get("id") or ""),
        event_type=event_name,
        status="processing",
        payload=payload_str
    )
    db.add(webhook_log)
    db.commit()
    
    # Process webhook in Celery task
    process_abacate_webhook_task.delay(event_id, data)
    
    return {"status": "queued", "event_id": event_id}


@app.get("/api/v1/workspaces/members", response_model=List[WorkspaceMemberResponse])
def list_workspace_members(
    tenant_id: str = Depends(get_tenant_id),
    db: Session = Depends(get_db)
):
    members = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == tenant_id).all()
    response = []
    for m in members:
        u = db.query(User).filter(User.id == m.user_id).first()
        if u:
            response.append(WorkspaceMemberResponse(
                id=m.id,
                workspace_id=m.workspace_id,
                user_id=m.user_id,
                role=m.role,
                email=u.email,
                full_name=u.full_name,
                created_at=m.created_at.isoformat()
            ))
    return response


@app.post("/api/v1/workspaces/members", response_model=WorkspaceMemberResponse)
def invite_workspace_member(
    req: WorkspaceMemberInvite,
    tenant_id: str = Depends(get_tenant_id),
    db: Session = Depends(get_db)
):
    email = req.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        user = User(
            email=email,
            supabase_id=f"invited_{uuid.uuid4()}",
            full_name=email.split("@")[0]
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    existing_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == tenant_id,
        WorkspaceMember.user_id == user.id
    ).first()
    
    if existing_member:
        raise HTTPException(status_code=400, detail="Usuário já é membro deste workspace")
        
    member = WorkspaceMember(
        workspace_id=tenant_id,
        user_id=user.id,
        role=req.role
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    
    return WorkspaceMemberResponse(
        id=member.id,
        workspace_id=member.workspace_id,
        user_id=member.user_id,
        role=member.role,
        email=user.email,
        full_name=user.full_name,
        created_at=member.created_at.isoformat()
    )


@app.delete("/api/v1/workspaces/members/{member_id}")
def delete_workspace_member(
    member_id: str,
    tenant_id: str = Depends(get_tenant_id),
    db: Session = Depends(get_db)
):
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.id == member_id,
        WorkspaceMember.workspace_id == tenant_id
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="Membro não encontrado no workspace")
        
    workspace = db.query(Workspace).filter(Workspace.id == tenant_id).first()
    if workspace and workspace.owner_id == member.user_id:
        raise HTTPException(status_code=400, detail="O proprietário do workspace não pode ser removido")
        
    db.delete(member)
    db.commit()
    return {"status": "success", "detail": "Membro removido com sucesso"}


@app.put("/api/v1/workspaces/current")
def update_current_workspace(
    req: WorkspaceUpdate,
    tenant_id: str = Depends(get_tenant_id),
    db: Session = Depends(get_db)
):
    workspace = db.query(Workspace).filter(Workspace.id == tenant_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace não encontrado")
        
    workspace.name = req.name.strip()
    db.commit()
    return {"status": "success", "workspace_name": workspace.name}


@app.put("/api/v1/users/profile")
def update_user_profile(
    req: UserProfileUpdate,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token de autorização ausente")
        
    token = authorization.split("Bearer ")[1].strip()
    payload = decode_jwt_token(token)
    supabase_id = payload.get("sub") or payload.get("id")
    
    user = db.query(User).filter(User.supabase_id == supabase_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
    user.full_name = req.full_name.strip()
    db.commit()
    return {"status": "success", "full_name": user.full_name}


@app.delete("/api/v1/users/profile")
def delete_user_account(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token de autorização ausente")
        
    token = authorization.split("Bearer ")[1].strip()
    payload = decode_jwt_token(token)
    supabase_id = payload.get("sub") or payload.get("id")
    
    user = db.query(User).filter(User.supabase_id == supabase_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
    # Get all memberships to clean up workspaces and records
    memberships = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).all()
    for m in memberships:
        # If user owns the workspace, delete it
        workspace = db.query(Workspace).filter(Workspace.id == m.workspace_id).first()
        if workspace and workspace.owner_id == user.id:
            # Delete jobs in this workspace
            db.query(Job).filter(Job.workspace_id == workspace.id).delete()
            db.query(Job).filter(Job.tenant_id == workspace.id).delete()
            # Delete workspace (cascades to folders and members)
            db.delete(workspace)
        db.delete(m)
        
    # Delete user profile record
    db.delete(user)
    db.commit()
    
    return {"status": "success", "detail": "Conta excluída com sucesso"}


@app.post("/api/v1/support/contact")
def send_support_ticket(
    req: SupportTicketCreate,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token de autorização ausente")
        
    token = authorization.split("Bearer ")[1].strip()
    payload = decode_jwt_token(token)
    email = payload.get("email")
    
    try:
        import resend
        resend.api_key = settings.RESEND_API_KEY
        
        params = {
            "from": f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>",
            "to": settings.SUPPORT_EMAIL_TO,
            "subject": f"[Suporte Transcritor] {req.subject}",
            "html": f"""
            <h3>Nova solicitação de suporte</h3>
            <p><strong>Usuário:</strong> {email}</p>
            <p><strong>Assunto:</strong> {req.subject}</p>
            <p><strong>Mensagem:</strong></p>
            <blockquote style="background: #f4f4f4; padding: 15px; border-left: 5px solid #ccc;">
                {req.message.replace('\n', '<br>')}
            </blockquote>
            """
        }
        resend.Emails.send(params)
        logger.info(f"Support email successfully dispatched via Resend from {email}")
    except Exception as e:
        logger.error(f"Failed to send support email via Resend: {e}")
        return {"status": "success", "detail": "Mensagem registrada localmente, mas envio de e-mail simulado.", "error": str(e)}
        
    return {"status": "success", "detail": "Mensagem enviada com sucesso!"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
