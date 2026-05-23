import importlib
import os
import sys
import tempfile
import types
import unittest

from fastapi.testclient import TestClient


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
        self.db_path = os.path.join(self.tmpdir.name, "test.db")

        os.environ["DB_PATH"] = self.db_path
        os.environ["UPLOAD_DIR"] = self.tmpdir.name
        os.environ["RESULTS_DIR"] = self.tmpdir.name
        os.environ["API_KEYS"] = "keyA,keyB"
        os.environ["API_KEY_TENANTS"] = "keyA:tenantA,keyB:tenantB"

        fake_services = types.ModuleType("services")
        fake_transcriber_module = types.ModuleType("services.transcriber")
        fake_transcriber_module.transcriber_service = _FakeTranscriberService()
        sys.modules["services"] = fake_services
        sys.modules["services.transcriber"] = fake_transcriber_module

        if "backend.main" in sys.modules:
            del sys.modules["backend.main"]
        self.main = importlib.import_module("backend.main")
        self.main.init_db()
        self.client = TestClient(self.main.app)

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_job_visibility_is_tenant_scoped(self):
        self.main.insert_job("job-a", "/tmp/a.wav", {"mode": "rapido"}, "tenantA")
        self.main.insert_job("job-b", "/tmp/b.wav", {"mode": "rapido"}, "tenantB")

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
        self.main.insert_job("job-a", "/tmp/a.wav", {"mode": "rapido"}, "tenantA")

        resp = self.client.get("/jobs/job-a", headers={"X-API-Key": "keyB"})
        self.assertEqual(resp.status_code, 404)

    def test_delete_is_tenant_scoped(self):
        self.main.insert_job("job-a", "/tmp/a.wav", {"mode": "rapido"}, "tenantA")
        self.main.insert_job("job-b", "/tmp/b.wav", {"mode": "rapido"}, "tenantB")

        resp = self.client.delete("/jobs/job-a", headers={"X-API-Key": "keyB"})
        self.assertEqual(resp.status_code, 404)

        resp_ok = self.client.delete("/jobs/job-a", headers={"X-API-Key": "keyA"})
        self.assertEqual(resp_ok.status_code, 200)


if __name__ == "__main__":
    unittest.main()
