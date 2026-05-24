# Whisper Transcriber

Sistema SaaS de transcrição com **FastAPI + Faster-Whisper + Next.js**, com processamento assíncrono e isolamento por tenant.

## Stack atual

- **API**: FastAPI
- **Worker**: Celery
- **Fila/Backend de tarefas**: Redis
- **Banco**: PostgreSQL (SQLAlchemy)
- **Armazenamento de áudio**: S3/MinIO
- **Frontend**: Next.js
- **Tradução**: AWS Translate (provedor enterprise)

## Recursos implementados

- Transcrição síncrona (`/transcribe`) e assíncrona (`/jobs/transcribe`).
- Persistência de jobs com `tenant_id`.
- Exportação de resultado em `json`, `txt`, `srt`, `vtt`.
- Health/readiness checks (`/healthz`, `/readyz`).
- Autenticação por JWT Bearer ou `X-API-Key` (compatibilidade legada).
- Isolamento multi-tenant em endpoints de jobs.
- Limpeza automática de jobs antigos no startup.
- Upload para object storage e download por URL pré-assinada.

## Infra local (Docker)

```bash
docker compose up -d db redis minio
```

Serviços locais:
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6381`
- MinIO API: `localhost:9000`
- MinIO Console: `localhost:9001`

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Worker Celery

```bash
cd backend
celery -A tasks.celery_app.celery_app worker --loglevel=info
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

## Variáveis obrigatórias

### Backend

- `API_KEYS` (lista CSV de chaves válidas)
- `API_KEY_TENANTS` (mapeamento `api_key:tenant_id` para todas as chaves)
- `JWT_SECRET` (mínimo 32 caracteres)
- `DATABASE_URL` (ou `POSTGRES_*`)
- `REDIS_URL`
- `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `TRANSLATION_PROVIDER=aws_translate`, `AWS_REGION`
- `MAX_AUDIO_DURATION_SECONDS`, `TENANT_MAX_FILE_MB`

### Frontend

- `NEXT_PUBLIC_API_BASE_URL` (ex.: `http://localhost:8000`)
- `NEXT_PUBLIC_API_KEY` (obrigatória para chamadas autenticadas do cliente)

## Fluxo assíncrono

1. `POST /jobs/transcribe`
2. `GET /jobs/{job_id}` até `completed`
3. `GET /jobs/{job_id}/result?format=srt`
