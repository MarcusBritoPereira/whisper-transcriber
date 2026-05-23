# Análise de prontidão para produção (SaaS) — Whisper Transcriber

## Resumo executivo

O sistema já possui uma boa base para MVP (API assíncrona com jobs, persistência, health checks, CORS e API key opcional). Para produção SaaS, os maiores gaps estão em **segurança**, **isolamento multi-tenant**, **escala de processamento**, **observabilidade**, **governança de dados** e **confiabilidade operacional**.

---

## Prioridade P0 (bloqueadores para ir a produção)

1. **Autenticação/autorização forte e obrigatória**
   - Hoje `API_KEYS` é opcional. Em SaaS, autenticação deve ser obrigatória.
   - Trocar API key estática por identidade por tenant (JWT/OAuth2) + RBAC básico.
   - Reforçar autorização em todas as rotas de jobs/resultados/download para impedir acesso cruzado.

2. **Isolamento multi-tenant no banco e storage**
   - Tabela `jobs` não demonstra `tenant_id`/`user_id`.
   - Incluir colunas de ownership, índices e filtros obrigatórios em todas as queries.
   - Armazenar arquivos/resultados em namespace por tenant (bucket/prefixo por cliente).

3. **Fila de processamento robusta (substituir queue em memória/thread local)**
   - O worker atual depende de thread local e `queue.Queue`, o que não escala horizontalmente.
   - Migrar para fila externa (Redis + RQ/Celery, SQS, RabbitMQ).
   - Suportar retries, dead-letter queue, timeouts de job e idempotência.

4. **Remover tradução via provedor não empresarial por padrão**
   - `deep_translator` com GoogleTranslator pode gerar risco de compliance/termos de uso.
   - Usar serviço oficial com SLA, DPA e trilha de auditoria.

5. **Hardening de upload/ingestão**
   - Validar MIME real (não só extensão/content_type), duração máxima e tipo de codec.
   - Limitar downloads por URL com proteção SSRF reforçada (DNS rebinding, ranges IP privados).
   - Varredura antivírus e quarentena para arquivos suspeitos.

6. **Segredos e configuração segura**
   - Eliminar segredos em variáveis sem cofre: usar secret manager (AWS/GCP/Azure/Vault).
   - Rotação de chaves, versionamento e política de expiração.

---

## Prioridade P1 (alta)

1. **Banco de dados de produção**
   - Migrar de SQLite para PostgreSQL.
   - Implementar migrações (Alembic), pool de conexões e backups automáticos.

2. **Armazenamento de arquivos externo**
   - Trocar disco local por object storage (S3/GCS/Azure Blob).
   - URLs pré-assinadas para download/upload, com expiração curta.

3. **Observabilidade completa**
   - Logs estruturados com correlation-id/request-id/job-id.
   - Métricas: tempo de transcrição, taxa de erro, fila, throughput, uso GPU/CPU, custo por minuto.
   - Tracing distribuído (OpenTelemetry) e alertas operacionais.

4. **Limites e cotas por plano**
   - Rate limit atual por IP em memória é insuficiente.
   - Implementar limite por tenant/plano (requests/min, minutos/mês, concorrência).

5. **Controle de custo e capacidade**
   - Autoscaling por profundidade da fila.
   - Estratégia de modelos por SLA (tiny/base/medium) e tier de preço.
   - Prevenção de abuse (arquivos longos repetidos, spam de jobs).

6. **Contratos de API e versionamento**
   - Versionar (`/v1`) e publicar OpenAPI estável.
   - Política de depreciação e compatibilidade retroativa.

---

## Prioridade P2 (médio)

1. **UX de jobs e notificações**
   - Webhook por status de job (queued/processing/completed/failed).
   - Cancelamento de job e retry manual pelo cliente.

2. **Confiabilidade de startup/recovery**
   - Reprocessamento de jobs “processing” após restart já existe, mas falta lock distribuído.
   - Evitar dupla execução em ambiente com múltiplas réplicas.

3. **Qualidade de código e testes**
   - Adicionar suíte de testes unitários/integrados/e2e (backend + frontend).
   - CI com lint, type-check, testes e scan de segurança.

4. **Governança de dados (LGPD/GDPR)**
   - Política de retenção configurável por tenant.
   - Direito ao esquecimento (delete hard + purge em backups dentro da política).
   - Criptografia em repouso e em trânsito (TLS obrigatório).

5. **Feature flags e rollout seguro**
   - Flags para diarização/tradução/modelos.
   - Canary deploy e rollback rápido.

---

## Riscos técnicos observados no estado atual

- Dependência de runtime local para filas e arquivos (alto risco em escala).
- Persistência de áudio local sem política de expurgo automática.
- Autenticação não obrigatória por padrão.
- Modelo carregado e trocado dinamicamente pode gerar latência imprevisível.
- Possíveis gargalos de concorrência (GIL/thread + operações pesadas de CPU/GPU).

---

## Arquitetura-alvo recomendada (SaaS)

- **API stateless** (FastAPI) atrás de LB/API Gateway.
- **Fila externa** + workers separados (CPU e GPU pools).
- **PostgreSQL** para metadados/jobs/tenant/billing.
- **Object Storage** para input/output com lifecycle policy.
- **Auth central** (JWT/OAuth2) + RBAC e tenant isolation.
- **Observabilidade** (logs+metrics+traces) + alerting.
- **CI/CD** com testes, SAST/DAST/dependency scanning.

---

## Checklist de go-live (resumido)

- [ ] Auth obrigatória e autorização por tenant em 100% das rotas.
- [ ] Migração SQLite → PostgreSQL + Alembic.
- [ ] Fila distribuída com retry/DLQ/idempotência.
- [ ] Storage externo com criptografia e lifecycle.
- [ ] Rate limit/cotas por plano e proteção anti-abuso.
- [ ] Dashboards + alertas (SLO de latência/erro/disponibilidade).
- [ ] Política LGPD/GDPR implementada e documentada.
- [ ] Backup/restore testado e playbooks de incidente.

---

## Plano de execução sugerido (4–8 semanas)

1. **Semana 1–2:** Segurança e tenancy (Auth/RBAC/tenant_id + filtros obrigatórios).
2. **Semana 2–4:** Infra core (Postgres, object storage, fila distribuída).
3. **Semana 4–6:** Observabilidade, cotas, billing hooks, webhooks.
4. **Semana 6–8:** Hardening final, testes de carga, DR drills, go-live gradual.

