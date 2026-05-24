---
name: appmax-payments
description: Referência de alto nível para integração com o gateway de pagamentos Appmax (Pix, Cartão, Boleto, Checkout Appmax JS e Webhooks robustos)
allowed-tools: Read, Write, Edit
version: 1.0
priority: CRITICAL
---

# Appmax Payments Integration Skill

> **CRITICAL KNOWLEDGE** - Guia definitivo e especificações técnicas de integração com o gateway de pagamentos da **Appmax**. Utilize esta skill para orientar implementações no frontend (React/TypeScript) e backend (Python/FastAPI + Celery).

---

## 🏗️ 1. Fluxo Geral de Negócio e Ciclo de Vida

O processamento de pagamentos na Appmax é dividido em etapas síncronas que garantem a segurança do PCI DSS (evitando que dados confidenciais do cartão passem pelo servidor da aplicação) e a resiliência transacional.

```
[Cliente Checkout] ──(1. Tokenização/IP)──> [Appmax JS CDN]
       │                                          │
 (2. Dados Seguros)                          (Retorna Token)
       │                                          │
       ▼                                          ▼
[Nosso Backend] ──(3. Criar Cliente)─────────> [Appmax API]
[Nosso Backend] ──(4. Criar Pedido)──────────> [Appmax API]
[Nosso Backend] ──(5. Efetuar Pagamento)─────> [Appmax API]
```

---

## 🔑 2. Autenticação e Autorização (Server-to-Server)

A Appmax utiliza o protocolo **OAuth2 (Client Credentials)** para comunicação direta entre servidores (server-to-server). **Não utiliza Refresh Tokens**, pois a comunicação ocorre em ambiente seguro e controlado.

### 2.1. Obter Token do Aplicativo (App Token)
Gera o token de curta duração (expira em 3600s) utilizando as credenciais principais do aplicativo.

* **Sandbox URL:** `https://auth.sandboxappmax.com.br/oauth2/token`
* **Production URL:** `https://auth.appmax.com.br/oauth2/token`
* **Método:** `POST`
* **Content-Type:** `application/x-www-form-urlencoded`

#### Requisição:
```bash
curl --location 'https://auth.appmax.com.br/oauth2/token' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'grant_type=client_credentials' \
--data-urlencode 'client_id=SUA_APP_CLIENT_ID' \
--data-urlencode 'client_secret=SUA_APP_CLIENT_SECRET'
```

#### Resposta (HTTP 200):
```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...",
    "token_type": "Bearer",
    "expires_in": 3600
}
```

### 2.2. Autorizar Instalação (Fluxo Appstore)
Gera um hash único para redirecionar o merchant à autorização de instalação do aplicativo na Appmax.

* **URL:** `POST https://api.appmax.com.br/app/authorize`
* **Headers:** `Authorization: Bearer <APP_ACCESS_TOKEN>`

#### Payload:
```json
{
    "app_id": "SEU_APP_ID",
    "external_key": "IDENTIFICADOR_UNICO_DA_LOJA_PARCEIRA",
    "url_callback": "https://seu-dominio.com/callback/appmax-install"
}
```

#### URL de Redirecionamento do Usuário:
Após obter o `"token": "HASH_RETORNADO"`, redirecione o lojista para:
* **Sandbox:** `https://breakingcode.sandboxappmax.com.br/appstore/integration/HASH_RETORNADO`
* **Produção:** `https://admin.appmax.com.br/appstore/integration/HASH_RETORNADO`

### 2.3. Gerar Credenciais do Merchant
Após o redirect do callback contendo o token validado, gere as chaves transacionais do Merchant.

* **URL:** `POST https://api.appmax.com.br/app/client/generate`
* **Headers:** `Authorization: Bearer <APP_ACCESS_TOKEN>`

#### Payload:
```json
{
    "token": "HASH_DE_INSTALACAO"
}
```

#### Resposta (HTTP 200):
```json
{
    "data": {
        "client": {
            "client_id": "MERCHANT_CLIENT_ID",
            "client_secret": "MERCHANT_CLIENT_SECRET"
        }
    }
}
```

> [!WARNING]
> Use as **Merchant Credentials** (`client_id` e `client_secret`) exclusivas de cada lojista para fazer a chamada final de autenticação OAuth2 e transacionar na API (criar pedidos, clientes, pagamentos).

### 2.4. Health Check de Instalação
A Appmax enviará um POST para a sua **URL de validação** registrada para concluir o vínculo:
```json
{
  "app_id": "APP_ID",
  "client_id": "MERCHANT_CLIENT_ID",
  "client_secret": "MERCHANT_CLIENT_SECRET",
  "external_key": "EXTERNAL_KEY"
}
```
**Resposta Esperada (HTTP 200):**
```json
{
  "external_id": "SEU_UUID_DE_VINCULO_INTERNO"
}
```

---

## 🌐 3. Appmax JS (Frontend Integration)

O uso do script `appmax.js` é **MANDATÓRIO** para captura de IP (anti-fraude) e tokenização segura de dados de cartão de crédito.

### 3.1. Carregamento do Script CDN
Insira o script em sua página de checkout:
```html
<script src="https://scripts.appmax.com.br/appmax.min.js"></script>
```

### 3.2. Coleta de IP Automatizada (Atributos HTML)
Adicione o atributo `data-appmax-customer` na tag `<form>` de dados pessoais para injetar ou coletar o IP de maneira transparente:
```html
<form id="customer-form" data-appmax-customer>
  <!-- Campos do Cliente -->
</form>
```

### 3.3. Inicialização e Captura Programática (SPA / React)
Para aplicações modernas (React/Next.js/Vue), inicialize o script e capture o IP no callback:

```typescript
declare global {
  interface Window {
    AppmaxScripts: {
      init: (success: (data: any) => void, error: (err: any) => void) => void;
    }
  }
}

export function initializeAppmaxSecurity(
  onIpCaptured: (ip: string) => void,
  onError: (err: any) => void
) {
  const script = document.createElement('script');
  script.src = 'https://scripts.appmax.com.br/appmax.min.js';
  script.async = true;
  script.onload = () => {
    if (window.AppmaxScripts) {
      window.AppmaxScripts.init(
        (data) => onIpCaptured(data.ip || '127.0.0.1'),
        (err) => onError(err)
      );
    }
  };
  document.head.appendChild(script);
}
```

### 3.4. Tokenização de Cartão com Atributos
Garante conformidade com o PCI DSS substituindo os dados do cartão por um token seguro.
A tag `<form>` de pagamento deve conter `data-appmax-checkout`, e cada input deve conter `appmax-form-element`.

```html
<form id="payment-form" method="POST" data-appmax-checkout>
  <input type="text" appmax-form-element="number" placeholder="Número do Cartão" required />
  <input type="text" appmax-form-element="holder_name" placeholder="Nome do Titular" required />
  <input type="text" appmax-form-element="expiration_month" placeholder="MM" required />
  <input type="text" appmax-form-element="expiration_year" placeholder="AA" required />
  <input type="text" appmax-form-element="cvv" placeholder="CVV" required />
  
  <button type="submit">Efetuar Pagamento</button>
</form>
```

---

## 🛒 4. Integração das Transações da API (Backend Python)

> [!IMPORTANT]
> Todos os valores financeiros na API Appmax são expressos em **centavos** e como números inteiros (ex: R$ 123,00 = `12300`).

### 4.1. Criar/Atualizar Cliente (`POST /v1/customers`)
* **Endpoint:** `POST https://api.appmax.com.br/v1/customers`
* **Propósito:** Cria o cliente e retorna o `customer_id` essencial para criar pedidos.

#### Payload:
```json
{
  "first_name": "Marcus",
  "last_name": "Pereira",
  "email": "marcus.pereira@email.com",
  "phone": "51983655100",
  "document_number": "25226493029",
  "address": {
    "postcode": "91520270",
    "street": "Avenida Ipiranga",
    "number": "6681",
    "complement": "Prédio 32",
    "district": "Partenon",
    "city": "Porto Alegre",
    "state": "RS"
  },
  "ip": "177.45.18.23" 
}
```

#### Resposta Sucesso (HTTP 201):
```json
{
  "data": {
    "customer": {
      "id": 407
    }
  }
}
```

### 4.2. Criar Pedido (`POST /v1/orders`)
* **Endpoint:** `POST https://api.appmax.com.br/v1/orders`
* **Propósito:** Registra uma intenção de compra vinculada a um cliente.

#### Payload:
```json
{
  "customer_id": 407,
  "products_value": 15000,
  "discount_value": 0,
  "shipping_value": 0,
  "products": [
    {
      "sku": "sub_premium_annual",
      "name": "Assinatura Anual Whisper Transcriber",
      "quantity": 1,
      "unit_value": 15000,
      "type": "digital"
    }
  ]
}
```

#### Resposta Sucesso (HTTP 201):
```json
{
  "data": {
    "order": {
      "id": 12345,
      "status": "pendente"
    }
  }
}
```

### 4.3. Execução de Pagamentos

#### A) Pix (`POST /v1/payments/pix`)
Gera chave Pix do tipo copia e cola (EMV) e QR Code.
```json
{
  "order_id": 12345,
  "payment_data": {
    "pix": {
      "document_number": "25226493029"
    }
  }
}
```
**Resposta (HTTP 200):** Retorna `pix_code` (EMV) e `pix_image` (Base64 do QR Code) com os dados de expiração.

#### B) Boleto Bancário (`POST /v1/payments/boleto`)
Gera o boleto bancário para impressão offline.
```json
{
  "order_id": 12345,
  "payment_data": {
    "boleto": {
      "document_number": "25226493029"
    }
  }
}
```
**Resposta (HTTP 201):** Retorna `pdf_url` e `digitable_line` (Linha digitável). 
> [!CAUTION]
> Conforme as regras da Appmax, a `pdf_url` do boleto **NÃO PODE ser exibida dentro de um Iframe**. O checkout deve redirecionar o usuário ou abrir uma nova aba/janela (`target="_blank"`).

#### C) Cartão de Crédito (`POST /v1/payments/credit-card`)
Processa o pagamento utilizando o token obtido via Appmax JS.
```json
{
  "order_id": 12345,
  "customer_id": 407,
  "payment_data": {
    "credit_card": {
      "token": "422146c7523a46119d6073ea56193913",
      "holder_name": "Marcus Pereira",
      "holder_document_number": "25226493029",
      "installments": 1,
      "soft_descriptor": "WHISPERAPP"
    }
  }
}
```
* **Modalidade PP (Simples por Parcela):** Juros simples por parcela. Padrão utilizado na maioria dos merchants.
* **Modalidade AM (Financiamento):** Juros sobre saldo devedor mensal.

---

## ⚡ 5. Arquitetura Elite de Webhooks (Python FastAPI + Celery)

> [!IMPORTANT]
> A Appmax exige que sua URL de webhook responda de forma extremamente rápida. Por isso, a arquitetura correta exige o **recebimento assíncrono imediato**, enfileirando o processamento pesado no Celery e controlando a **idempotência** para mitigar duplicidades causadas por retentativas automáticas da Appmax.

### 5.1. Esquema de Banco de Dados de Idempotência (SQLAlchemy)
```python
from sqlalchemy import Column, String, DateTime, Text
from database import Base
from datetime import datetime, timezone

class AppmaxWebhookLog(Base):
    __tablename__ = "appmax_webhook_logs"

    # Combinação de event_id ou um hash único do payload
    event_id = Column(String(100), primary_key=True, index=True)
    order_id = Column(String(50), index=True, nullable=False)
    event_type = Column(String(50), nullable=False)
    status = Column(String(20), default="processing") # processing, processed, failed
    payload = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
```

### 5.2. Endpoint FastAPI (Recepção Rápida e Validação)
```python
import hashlib
import hmac
from fastapi import APIRouter, Request, Header, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db
from models.appmax_logs import AppmaxWebhookLog
from tasks.payments import process_webhook_payload_task

router = APIRouter(prefix="/api/v1/payments")

# Defina a chave secreta enviada pela Appmax nas configurações da loja
APPMAX_SIGNATURE_SECRET = "sua_signature_secret_configurada_appmax"

def verify_appmax_signature(payload_bytes: bytes, received_signature: str) -> bool:
    if not received_signature:
        return False
    computed_sig = hmac.new(
        APPMAX_SIGNATURE_SECRET.encode('utf-8'),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed_sig, received_signature)

@router.post("/appmax-webhook")
async def handle_appmax_webhook(
    request: Request,
    x_appmax_signature: str = Header(None),
    db: Session = Depends(get_db)
):
    payload_bytes = await request.body()
    payload_str = payload_bytes.decode("utf-8")
    
    # 1. Validação de Segurança de Assinatura
    if not verify_appmax_signature(payload_bytes, x_appmax_signature):
        raise HTTPException(status_code=401, detail="Assinatura inválida")
        
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="JSON malformado")
        
    event_id = data.get("event_id") or f"{data.get('event')}_{data.get('order_id')}_{data.get('event_type')}"
    order_id = str(data.get("order_id"))
    event_name = data.get("event")
    
    if not event_id or not order_id:
        raise HTTPException(status_code=422, detail="Dados obrigatórios ausentes")
        
    # 2. Controle de Idempotência (Evita duplicidade)
    existing_log = db.query(AppmaxWebhookLog).filter(AppmaxWebhookLog.event_id == event_id).first()
    if existing_log:
        if existing_log.status == "processed":
            return {"status": "already_processed", "event_id": event_id}
        return {"status": "processing_in_progress", "event_id": event_id}
        
    # Registrar intenção de processamento
    webhook_log = AppmaxWebhookLog(
        event_id=event_id,
        order_id=order_id,
        event_type=event_name,
        status="processing",
        payload=payload_str
    )
    db.add(webhook_log)
    db.commit()
    
    # 3. Offload Imediato para Celery (Execução assíncrona)
    process_webhook_payload_task.delay(event_id, data)
    
    return {"status": "received", "event_id": event_id}
```

### 5.3. Processamento em Background (Celery Task)
```python
from celery_app import celery_app
from database import SessionLocal
from models.appmax_logs import AppmaxWebhookLog

@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def process_webhook_payload_task(self, event_id: str, payload: dict):
    db = SessionLocal()
    try:
        # Recuperar log de processamento
        log = db.query(AppmaxWebhookLog).filter(AppmaxWebhookLog.event_id == event_id).first()
        if not log:
            return
            
        event_name = payload.get("event")
        order_id = payload.get("order_id")
        
        # Mapeamento de regras de negócios
        if event_name in ["order_approved", "order_paid", "pix_paid"]:
            # Ação: Ativar assinatura ou liberar recursos para o tenant associado
            pass
        elif event_name in ["order_refund"]:
            # Ação: Revogar acesso do tenant
            pass
        elif event_name in ["order_chargeback_in_treatment"]:
            # Ação: Suspender preventivamente o tenant e notificar suporte
            pass
            
        # Sucesso
        log.status = "processed"
        db.commit()
    except Exception as exc:
        db.rollback()
        # Tratamento resiliente de falhas com retry do Celery
        raise self.retry(exc=exc)
    finally:
        db.close()
```

---

## 🏷️ 6. Mapeamento de Eventos e Ações do Sistema

| Evento Appmax (`event`) | Entidade (`event_type`) | Status Transação | Ação Recomendada no Sistema (whisper-transcriber) |
| :--- | :--- | :--- | :--- |
| `customer_created` | `customer` | - | Opcional: Atualizar CRM/Sync do Lead |
| `order_billet_created` | `order` | Pendente | Informar link do boleto na tela e enviar e-mail de instrução |
| `order_pix_created` | `order` | Pendente | Exibir tela com QR Code, Pix copia e cola e timer regressivo |
| `order_approved` | `order` | Aprovado | **Ativar o plano do Tenant** no banco de dados e notificar o usuário |
| `order_paid` | `order` | Aprovado | **Garantir ativação** (redundância com `order_approved`) |
| `order_paid_by_pix` | `order` | Aprovado | **Ativar o plano do Tenant** imediatamente |
| `order_refund` | `order` | Estornado | **Revogar/Desativar plano do Tenant** e expirar chaves de API dele |
| `order_chargeback_in_treatment` | `order` | Chargeback | **Suspender temporariamente** o Tenant e enviar alerta ao financeiro |
| `order_billet_overdue` | `order` | Vencido | Marcar transação como expirada e notificar usuário para recomprar |
| `order_pix_expired` | `order` | Vencido | Limpar reserva de vaga/plano e reabrir checkout |

---

## 🛡️ 7. Medidas de Resiliência Críticas (Zero Falhas)

1. **Evite Iframe no Boleto:** Se você tentar colocar a URL do boleto gerado pela Appmax em um `<iframe>`, o navegador poderá bloquear o download ou a exibição devido a políticas de segurança de conteúdo. Abra em aba separada.
2. **Idempotência no Banco de Dados:** A Appmax efetuará retentativas caso seu servidor falhe em retornar `HTTP 200` em até 2 segundos. Sem controle de idempotência (passo 5.2), você corre o risco de ativar a assinatura de um cliente mais de uma vez ou duplicar transações internas.
3. **Cuidado com Limite de Caracteres no Telefone:** A API da Appmax exige que o telefone do cliente no payload de criação contenha apenas números (incluindo DDD) com tamanho máximo de **11 caracteres**. Valide no frontend e limpe caracteres especiais (`.`, `-`, ` `, `(`, `)`) antes de enviar ao backend.
4. **Modo Sandbox vs Produção:** Nunca envie requisições de teste em Sandbox para a URL `https://api.appmax.com.br`. Utilize sempre o prefixo de sandbox: `https://api.sandboxappmax.com.br` e `https://auth.sandboxappmax.com.br`.
