import importlib
import os
import sys
import tempfile
import unittest
from unittest.mock import MagicMock

# Configure environment BEFORE imports
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://mock"
os.environ["API_KEYS"] = "keyA,keyB,keyC"
os.environ["API_KEY_TENANTS"] = "keyA:tenantA,keyB:tenantB,keyC:tenantC"

# Ensure backend folder is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
import services.storage
import services.transcriber


class _FakeTranscriberService:
    def transcribe(self, *_args, **_kwargs):
        return {
            "text": "ok",
            "language": "pt",
            "segments": [{"start": 0, "end": 1, "speaker": None, "text": "ok"}],
            "diarized": False,
        }

    def download_from_url(self, *_args, **_kwargs):
        raise RuntimeError("not used in tests")


class TenantIsolationTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()

        # Safely override services functions for isolated testing
        services.storage.upload_file = MagicMock(return_value="mock_key")
        services.storage.download_file = MagicMock(return_value=True)
        services.storage.ensure_bucket_exists = MagicMock()
        services.storage.generate_presigned_download_url = MagicMock(return_value="http://mock-download")
        services.storage.delete_file = MagicMock(return_value=True)
        services.transcriber.transcriber_service = _FakeTranscriberService()

        # Clean import of backend modules
        for mod in ["backend.main", "main", "database", "config", "models.jobs", "models.payment"]:
            if mod in sys.modules:
                del sys.modules[mod]
            
        self.main = importlib.import_module("main")
        self.database = importlib.import_module("database")
        self.models_jobs = importlib.import_module("models.jobs")
        self.models_payment = importlib.import_module("models.payment")
        
        # Provision isolated in-memory SQLite tables
        self.database.Base.metadata.create_all(bind=self.database.engine)
        self.client = TestClient(self.main.app)

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_job_visibility_is_tenant_scoped(self):
        db = self.database.SessionLocal()
        now = "2026-05-24T00:00:00Z"
        db.add(self.models_jobs.Job(id="job-a", status="queued", created_at=now, updated_at=now, input_path="a", tenant_id="tenantA"))
        db.add(self.models_jobs.Job(id="job-b", status="queued", created_at=now, updated_at=now, input_path="b", tenant_id="tenantB"))
        db.commit()
        db.close()

        resp_a = self.client.get("/jobs", headers={"X-API-Key": "keyA"})
        self.assertEqual(resp_a.status_code, 200)
        ids_a = [job["job_id"] for job in resp_a.json()]
        self.assertIn("job-a", ids_a)
        self.assertNotIn("job-b", ids_a)

        resp_b = self.client.get("/jobs", headers={"X-API-Key": "keyB"})
        self.assertEqual(resp_b.status_code, 200)
        ids_b = [job["job_id"] for job in resp_b.json()]
        self.assertIn("job-b", ids_b)
        self.assertNotIn("job-a", ids_b)

    def test_cross_tenant_job_access_is_blocked(self):
        db = self.database.SessionLocal()
        now = "2026-05-24T00:00:00Z"
        db.add(self.models_jobs.Job(id="job-a", status="queued", created_at=now, updated_at=now, input_path="a", tenant_id="tenantA"))
        db.commit()
        db.close()

        resp = self.client.get("/jobs/job-a", headers={"X-API-Key": "keyB"})
        self.assertEqual(resp.status_code, 404)

    def test_delete_is_tenant_scoped(self):
        db = self.database.SessionLocal()
        now = "2026-05-24T00:00:00Z"
        db.add(self.models_jobs.Job(id="job-a", status="queued", created_at=now, updated_at=now, input_path="a", tenant_id="tenantA"))
        db.add(self.models_jobs.Job(id="job-b", status="queued", created_at=now, updated_at=now, input_path="b", tenant_id="tenantB"))
        db.commit()
        db.close()

        resp = self.client.delete("/jobs/job-a", headers={"X-API-Key": "keyB"})
        self.assertEqual(resp.status_code, 404)

        resp_ok = self.client.delete("/jobs/job-a", headers={"X-API-Key": "keyA"})
        self.assertEqual(resp_ok.status_code, 200)

    def test_retry_is_tenant_scoped(self):
        db = self.database.SessionLocal()
        now = "2026-05-24T00:00:00Z"
        db.add(self.models_jobs.Job(id="job-a", status="failed", created_at=now, updated_at=now, input_path="a", tenant_id="tenantA"))
        db.commit()
        db.close()

        resp_forbidden = self.client.post("/jobs/job-a/retry", headers={"X-API-Key": "keyB"})
        self.assertEqual(resp_forbidden.status_code, 404)

        # Mock Celery delay dispatch to prevent actual execution during tests
        from unittest.mock import patch
        with patch("tasks.transcription.transcribe_job_task.delay") as mock_delay:
            resp_ok = self.client.post("/jobs/job-a/retry", headers={"X-API-Key": "keyA"})
            self.assertEqual(resp_ok.status_code, 200)
            self.assertEqual(resp_ok.json()["status"], "queued")
            mock_delay.assert_called_once_with("job-a")

    def test_payment_subscription_status_endpoints(self):
        # 1. Dev override tenants should be active by default in test/dev
        resp_a = self.client.get("/api/v1/payments/subscription-status", headers={"X-API-Key": "keyA"})
        self.assertEqual(resp_a.status_code, 200)
        self.assertEqual(resp_a.json()["status"], "active")

        # 2. Arbitrary custom tenant (tenantC mapped from keyC) should be inactive by default
        resp_custom = self.client.get("/api/v1/payments/subscription-status", headers={"X-API-Key": "keyC"})
        self.assertEqual(resp_custom.status_code, 200)
        self.assertEqual(resp_custom.json()["status"], "inactive")

    def test_transcription_blocked_without_active_subscription(self):
        # Transcribe request from an inactive tenant (tenantC mapped from keyC) should return 402
        resp = self.client.post(
            "/jobs/transcribe", 
            data={"url": "http://youtube.com/watch?v=123", "mode": "rapido"},
            headers={"X-API-Key": "keyC"}
        )
        self.assertEqual(resp.status_code, 402)
        self.assertIn("Assinatura requerida", resp.json()["detail"])


if __name__ == "__main__":
    unittest.main()
