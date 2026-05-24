# Plano de Implementação (Execução em andamento)

## Objetivo
Levar o Whisper Transcriber de MVP para SaaS pronto para produção, com foco em segurança, confiabilidade e escalabilidade.

## Fase 1 (P0) — já iniciada neste commit

### 1) Hardening de autenticação no frontend
- Remover chave de API hardcoded no cliente.
- Exigir configuração explícita via variável de ambiente (`NEXT_PUBLIC_API_KEY`) e falhar com mensagem clara quando ausente.

### 2) Hardening de configuração no backend
- Remover defaults inseguros para segredos sensíveis.
- Validar no startup que segredos obrigatórios de produção foram definidos.
- Bloquear uso de valores placeholder em `API_KEYS` e mapeamentos inválidos.

### 3) Atualização de documentação operacional
- Atualizar README para refletir arquitetura atual (PostgreSQL, Redis, MinIO, Celery).
- Documentar variáveis obrigatórias e comandos de execução.

## Próximas fases planejadas

### Fase 2 (P0/P1) — iniciada neste commit
- [x] Rate limiting distribuído com Redis por tenant+IP, com fallback seguro para memória.
- [x] SSRF avançado com resolução DNS e bloqueio de IPs privados/loopback/link-local/reserved.
- [x] Cotas de upload por tenant, validação de codec e duração via ffprobe.

### Fase 3 (P1) — parcialmente iniciada
- [x] Correlation ID em todas as respostas HTTP.
- [x] Endpoint básico de métricas operacionais (`/metrics`).
- [x] Webhooks de status de jobs com retry e idempotency key.

### Fase 4 (P1/P2) — iniciada
- [ ] Governança de dados (retenção por tenant, exclusão e trilha auditável).
- [x] CI com testes/lint/type-check/security pipeline (baseline).

## Critérios de aceite da Fase 1
- Não existe API key hardcoded no frontend.
- Backend não inicia com segredos placeholder em configuração de runtime.
- README descreve corretamente stack e modo de execução.
