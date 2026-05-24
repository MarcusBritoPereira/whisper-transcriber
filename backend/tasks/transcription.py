import os
import json
import logging
import urllib.request
from tasks.celery_app import celery_app
from database import SessionLocal
from models.jobs import Job
from services.storage import download_file
from services.transcriber import transcriber_service
from config import settings

logger = logging.getLogger(__name__)




def _emit_job_webhook(event_key: str, job: Job, max_attempts: int = 3) -> None:
    req_payload = json.loads(job.request_json) if job.request_json else {}
    webhook_url = req_payload.get("webhook_url")
    if not webhook_url:
        return

    body = {
        "event": event_key,
        "job_id": job.id,
        "tenant_id": job.tenant_id,
        "status": job.status,
        "updated_at": job.updated_at,
        "idempotency_key": f"{event_key}:{job.id}:{job.updated_at}",
    }
    payload = json.dumps(body).encode("utf-8")

    for attempt in range(1, max_attempts + 1):
        try:
            req = urllib.request.Request(webhook_url, data=payload, method="POST")
            req.add_header("Content-Type", "application/json")
            req.add_header("X-Idempotency-Key", body["idempotency_key"])
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status < 300:
                    return
        except Exception as exc:
            logger.warning(f"Webhook attempt {attempt} failed for job {job.id}: {exc}")

def utc_now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


@celery_app.task(name="tasks.transcribe", bind=True, max_retries=3)
def transcribe_job_task(self, job_id: str) -> None:
    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        logger.error(f"Celery task failed: Job {job_id} not found in database.")
        db.close()
        return

    # Update state to processing
    job.status = "processing"
    job.updated_at = utc_now_iso()
    db.commit()

    temp_input_path = os.path.join(settings.UPLOAD_DIR, f"celery_{job_id}")
    
    try:
        logger.info(f"Celery task picked up job {job_id}. Downloading from S3...")
        
        # Download audio from MinIO/S3 using the job's input_path (which is the S3 key)
        s3_key = job.input_path
        if not download_file(s3_key, temp_input_path):
            raise RuntimeError(f"Failed to download input file {s3_key} from object storage.")

        req_payload = json.loads(job.request_json) if job.request_json else {}

        logger.info(f"Running Whisper transcription for job {job_id} in Celery worker...")
        result = transcriber_service.transcribe(
            temp_input_path,
            diarize=req_payload.get("diarize", False),
            translate=req_payload.get("translate", False),
            restore_audio=req_payload.get("restore_audio", False),
            mode=req_payload.get("mode", "rapido"),
            language=req_payload.get("language", settings.DEFAULT_LANGUAGE),
        )

        # Save success results
        job.status = "completed"
        job.result_json = json.dumps(result, ensure_ascii=False)
        job.updated_at = utc_now_iso()
        db.commit()
        _emit_job_webhook("job.completed", job)
        logger.info(f"Celery task successfully completed job {job_id}!")

    except Exception as exc:
        logger.exception(f"Celery task failed for job {job_id}")
        
        # Handle automatic Celery task retries if applicable
        try:
            self.retry(exc=exc, countdown=10)
        except Exception:
            # If retries exceeded, mark job as failed
            job.status = "failed"
            job.error = str(exc)
            job.updated_at = utc_now_iso()
            db.commit()
            _emit_job_webhook("job.failed", job)

    finally:
        # Guarantee cleanup of temporary local files inside the worker container
        if os.path.exists(temp_input_path):
            os.remove(temp_input_path)
        db.close()
