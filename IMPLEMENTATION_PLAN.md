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
- [ ] Cotas de upload por tenant e validação de MIME real.

### Fase 3 (P1)
- Observabilidade: request-id, logs estruturados, métricas de job e fila.
- Webhooks de status de jobs para clientes SaaS.

### Fase 4 (P1/P2)
- Governança de dados (retenção por tenant, exclusão e trilha auditável).
- CI quality gates (lint, type-check, testes, segurança de dependências).

## Critérios de aceite da Fase 1
- Não existe API key hardcoded no frontend.
- Backend não inicia com segredos placeholder em configuração de runtime.
- README descreve corretamente stack e modo de execução.
