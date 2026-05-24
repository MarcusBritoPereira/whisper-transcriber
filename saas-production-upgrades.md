# Plan: SaaS Production Upgrades - Whisper Transcriber

## Overview
This document outlines the architectural roadmap to transform the **UPscribe (Whisper Transcriber)** MVP into a robust, secure, highly scalable, and multi-tenant production-ready SaaS application. We will transition from local services (SQLite, memory queues, local filesystem) to distributed, enterprise-grade cloud native resources.

## Project Type
**BACKEND / FULLSTACK WEB**
- Primary Agent: `backend-specialist` (API, background queue, business logic)
- Supporting Agents: `database-architect` (PostgreSQL, Alembic), `security-auditor` (JWT, SSRF, encryption), `devops-engineer` (Redis, S3, Docker, CI/CD).

---

## Success Criteria
1. **Zero Downtime Scalability**: APIs and workers are completely stateless and can scale horizontally independently.
2. **Complete Tenant Isolation**: Cryptographically verified JWT-based isolation ensuring zero data cross-contamination.
3. **Data Durability**: Files persisted in durable cloud object storage with explicit lifecycle retention rules.
4. **Failure Resiliency**: Queued transcription jobs survive app restarts and are backed by dead-letter queues (DLQ) and automatic retries.
5. **Security Hardening**: Complete protection against SSRF, DNS-rebinding, and untrusted local binary uploads.

---

## Tech Stack
- **Database**: PostgreSQL (instead of SQLite) + SQLAlchemy ORM.
- **Migration Framework**: Alembic.
- **Distributed Queue**: Redis + Celery (instead of in-memory Thread Queue).
- **Object Storage**: AWS S3 (or S3-compatible MinIO) via `boto3`.
- **Authentication**: JWT (JSON Web Tokens) via `PyJWT` or `python-jose` with asymmetric HS256/RS256 signing.
- **Translation Provider**: AWS Translate API or Google Cloud Translation API (instead of deep-translator scraping).
- **Observability**: Prometheus + Grafana metrics, OpenTelemetry-compatible tracing, structured logging with correlation IDs.

---

## Target File Structure
```plaintext
whisper-transcriber/
├── backend/
│   ├── main.py                    # FastAPI Stateless entry point
│   ├── alembic/                   # Database migrations folder
│   │   └── versions/
│   ├── config.py                  # Pydantic BaseSettings config
│   ├── database.py                # PostgreSQL connection pooling
│   ├── models/
│   │   ├── base.py
│   │   └── jobs.py                # SQLAlchemy DB Models
│   ├── tasks/
│   │   ├── __init__.py
│   │   ├── celery_app.py          # Celery configuration
│   │   └── transcription.py       # Distributed worker task logic
│   ├── services/
│   │   ├── storage.py             # S3 object storage helper (boto3)
│   │   ├── auth.py                # JWT verification & tenant extraction
│   │   └── translation.py         # Enterprise translation wrapper
│   ├── test_tenant_isolation.py   # Test suite
│   ├── requirements.txt
│   └── alembic.ini
```

---

## Task Breakdown

### Phase 0: Foundation (Database & Authentication)
#### Task 0.1: Migrate Database to PostgreSQL
- **Agent**: `database-architect`
- **Skill**: `database-design`
- **Priority**: P0
- **Dependencies**: None
- **INPUT**: Current SQLite `db_conn` and table structure.
- **OUTPUT**: PostgreSQL connection pooling setup in `backend/database.py` and SQLAlchemy schemas in `backend/models/`.
- **VERIFY**: Start a PostgreSQL instance in Docker, connect successfully, and run queries with correct indexes.

#### Task 0.2: Implement Alembic Migrations
- **Agent**: `database-architect`
- **Skill**: `database-design`
- **Priority**: P0
- **Dependencies**: Task 0.1
- **INPUT**: SQLAlchemy models.
- **OUTPUT**: Alembic configuration in `alembic.ini` and initial migration script.
- **VERIFY**: Run `alembic upgrade head` and verify table creation in Postgres.

#### Task 0.3: Secure JWT OAuth2 Authentication & RBAC
- **Agent**: `security-auditor`
- **Skill**: `vulnerability-scanner`
- **Priority**: P0
- **Dependencies**: None
- **INPUT**: Current header validation logic in `backend/main.py`.
- **OUTPUT**: New JWT-based authentication utility in `backend/services/auth.py` verifying signatures, checking expiration, and mapping client credentials to `tenant_id` and role permissions.
- **VERIFY**: Test API calls with expired, invalid, and valid signed JWT tokens, confirming access is properly blocked or scoped.

---

### Phase 1: Core Infrastructure & Processing
#### Task 1.1: Distributed Task Queue with Redis & Celery
- **Agent**: `backend-specialist`
- **Skill**: `python-patterns`
- **Priority**: P0
- **Dependencies**: Task 0.3
- **INPUT**: Local in-memory thread worker.
- **OUTPUT**: Celery application in `backend/tasks/celery_app.py` and tasks in `backend/tasks/transcription.py`.
- **VERIFY**: Run Celery worker command, queue a job via API, and confirm task execution is offloaded to the worker.

#### Task 1.2: External Object Storage (S3) Integration
- **Agent**: `devops-engineer`
- **Skill**: `deployment-procedures`
- **Priority**: P1
- **Dependencies**: Task 1.1
- **INPUT**: File storage in local filesystem.
- **OUTPUT**: S3 client service in `backend/services/storage.py` returning presigned upload/download URLs.
- **VERIFY**: Upload file to S3 bucket via presigned URL, confirm upload, and perform secure transcription download using presigned link.

---

### Phase 2: Security Hardening & Observability
#### Task 2.1: SSRF Protection & Content Verification
- **Agent**: `security-auditor`
- **Skill**: `vulnerability-scanner`
- **Priority**: P0
- **Dependencies**: Task 1.2
- **INPUT**: URL download logic in `main.py`.
- **OUTPUT**: Deep binary MIME check and DNS lookup validation (blocking local private IP ranges like 10.x.x.x, 192.168.x.x) during import downloads.
- **VERIFY**: Try importing an audio file pointing to localhost/internal ports and confirm the system blocks it.

#### Task 2.2: Correlation IDs & OpenTelemetry
- **Agent**: `devops-engineer`
- **Skill**: `performance-profiling`
- **Priority**: P1
- **Dependencies**: None
- **INPUT**: Basic logger config.
- **OUTPUT**: Request interceptor middleware injecting `x-correlation-id` header in log messages.
- **VERIFY**: Check logs for API calls and verify they match across logs from API requests down to worker tasks.

---

### Phase 3: Governance, Billing & Integration Polish
#### Task 3.1: Plan-Based Rate Limiting & Quotas
- **Agent**: `backend-specialist`
- **Skill**: `api-patterns`
- **Priority**: P1
- **Dependencies**: Task 0.3, Task 1.1
- **INPUT**: Memory-based IP rate limit.
- **OUTPUT**: Redis-backed rate limiting middleware mapping quota limits based on tenant plan levels.
- **VERIFY**: Assert rate limits block requests after exceeding quotas when utilizing different tenant JWT keys.

#### Task 3.2: Customer Webhooks on Job Status Changes
- **Agent**: `backend-specialist`
- **Skill**: `api-patterns`
- **Priority**: P2
- **Dependencies**: Task 1.1
- **INPUT**: Polling job status endpoints.
- **OUTPUT**: Outgoing HTTP webhook system dispatching `job.completed` and `job.failed` payloads to a registered tenant URL.
- **VERIFY**: Test webhook listener receives payload when transcription is completed.

#### Task 3.3: Enterprise-Grade Translation Integration
- **Agent**: `backend-specialist`
- **Skill**: `python-patterns`
- **Priority**: P0
- **Dependencies**: None
- **INPUT**: Scraping deep-translator translation endpoint.
- **OUTPUT**: Official AWS Translate or Google Cloud Translation client configuration in `backend/services/translation.py`.
- **VERIFY**: Trigger `/translate_text` endpoint and verify translation quality and strict SLA responses.

---

## Phase X: Final Verification Checklist
- [ ] Run `python .agent/scripts/verify_all.py . --url http://localhost:3000` to verify code health, security scans, and E2E status.
- [ ] Build and verify correct production image generation: `docker compose build`.
- [ ] Assert LGPD compliance: ensure files older than the retention threshold are cleanly purged from S3 buckets via lifecycle rules.

## ✅ PHASE X COMPLETE
- Status: 📅 *Awaiting planning phase approval*
