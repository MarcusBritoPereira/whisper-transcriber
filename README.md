# Whisper Transcriber

Sistema SaaS de transcrição com FastAPI, Faster Whisper, Celery, PostgreSQL, Redis, storage S3 compatível, Supabase Auth e frontend Next.js.

## Recursos implementados

- Transcrição síncrona (`/transcribe`) e assíncrona com jobs (`/jobs/transcribe`).
- Fila distribuída com Celery/Redis para processamento assíncrono.
- Persistência de metadados em PostgreSQL via SQLAlchemy/Alembic.
- Storage S3/MinIO para arquivos de entrada e URLs pré-assinadas de áudio.
- Autenticação JWT via Supabase Auth; API keys legadas podem ser habilitadas apenas para compatibilidade controlada.
- Isolamento multi-tenant por workspace/tenant nas consultas de jobs, pastas e billing.
- Rate limit com backend Redis em produção e fallback em memória para desenvolvimento.
- Proteção SSRF para ingestão por URL com validação de domínio permitido e IPs públicos.
- Exportação de resultado em `json`, `txt`, `srt`, `vtt`.
- Health checks (`/healthz`, `/readyz`).
- Fluxo de checkout/webhooks de pagamento e envio de e-mails transacionais.

## Configuração

Copie o arquivo de exemplo e preencha os valores reais fora do Git:

```bash
cp .env.example .env
```

Variáveis obrigatórias para produção:

- `APP_ENV=production`
- `DEV_MODE=false`
- `APP_URL=https://...`
- `ALLOWED_ORIGINS=https://...`
- `RUN_SCHEMA_CREATE_ON_STARTUP=false`
- `ENABLE_LEGACY_API_KEYS=false`
- `RATE_LIMIT_BACKEND=redis`
- `DATABASE_URL`
- `REDIS_URL`
- `S3_*`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`
- `ABACATE_API_KEY`, `ABACATE_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `SUPPORT_EMAIL_TO`

> Nunca versione segredos reais. Rotacione qualquer chave que tenha sido exposta em histórico Git.

## Backend local

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --port 8000
```

## Worker local

```bash
cd backend
celery -A tasks.celery_app.celery_app worker --loglevel=INFO --concurrency=1
```

## Frontend local

```bash
cd frontend
npm install
npm run dev
```

Variáveis públicas do frontend:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Docker Compose

O compose inclui Postgres, Redis, MinIO, migrations, backend, worker e frontend:

```bash
docker compose up --build
```

Para produção gerenciada, prefira banco, Redis e S3 externos com backups, criptografia, lifecycle policy e observabilidade.

## Fluxo assíncrono

1. `POST /jobs/transcribe`
2. `GET /jobs/{job_id}` até status `completed`
3. `GET /jobs/{job_id}/result?format=srt`

## Checklist de produção

- [ ] `npm --prefix frontend run build` passa no CI.
- [ ] `npm --prefix frontend run lint` passa no CI.
- [ ] `alembic upgrade head` passa em banco limpo e em staging.
- [ ] Segredos reais estão em secret manager/variáveis de ambiente.
- [ ] `DEV_MODE=false` e `ENABLE_LEGACY_API_KEYS=false` em produção.
- [ ] `APP_URL` e `ALLOWED_ORIGINS` usam HTTPS.
- [ ] Rate limit Redis habilitado.
- [ ] Webhooks de pagamento validados com assinatura real.
- [ ] Backups/restore e lifecycle de storage testados.
- [ ] Logs, métricas e alertas configurados.
