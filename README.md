# Whisper Transcriber

Sistema de transcrição com FastAPI + Whisper + frontend Next.js.

## Recursos implementados

- Transcrição síncrona (`/transcribe`) e assíncrona com jobs (`/jobs/transcribe`).
- Persistência de jobs em SQLite (`transcriptions.db`).
- Exportação de resultado em `json`, `txt`, `srt`, `vtt`.
- Health checks (`/healthz`, `/readyz`).
- Autenticação por API Key (`X-API-Key`) obrigatória.
- Isolamento multi-tenant por chave de API nos endpoints de jobs.
- Rate limiting por tenant+IP em memória.
- Exclusão de job por tenant (`DELETE /jobs/{job_id}`).
- Reprocessamento de job por tenant (`POST /jobs/{job_id}/retry`).
- CORS configurável por variável de ambiente.
- Whitelist de domínios para ingestão por URL.

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Variáveis de ambiente

- `API_KEYS`: chaves separadas por vírgula (obrigatório).
- `API_KEY_TENANTS`: mapeamento `api_key:tenant_id` separado por vírgula (opcional, mas se definido deve conter todas as chaves de `API_KEYS`).
- `ALLOWED_ORIGINS`: origins separadas por vírgula.
- `ALLOWED_DOWNLOAD_DOMAINS`: domínios permitidos para ingestão via URL.
- `RATE_LIMIT_PER_MIN`: limite por minuto por `tenant+IP`.
- `JOB_RETENTION_DAYS`: retenção de jobs/áudios locais (purga automática no startup, default `7`).
- `MAX_FILE_MB`: limite de upload.
- `UPLOAD_DIR`, `RESULTS_DIR`, `DB_PATH`.
- `HF_TOKEN`: habilita diarização com pyannote.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Variável:

- `NEXT_PUBLIC_API_BASE_URL` (default: `http://localhost:8000`)

## Fluxo assíncrono

1. `POST /jobs/transcribe`
2. `GET /jobs/{job_id}` até status `completed`
3. `GET /jobs/{job_id}/result?format=srt`
