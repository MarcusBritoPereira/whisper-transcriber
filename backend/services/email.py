"""
Email service for UPscribe — powered by Resend.
Handles welcome emails, subscription confirmations, and cancellation notices.
"""

import logging
import resend
from config import settings

logger = logging.getLogger(__name__)


def _configure_resend() -> bool:
    """Configure Resend global api_key. Returns True if configured."""
    api_key = getattr(settings, "RESEND_API_KEY", None)
    if not api_key or api_key == "sua_resend_api_key":
        logger.warning("[Email] RESEND_API_KEY not configured — skipping email send.")
        return False
    resend.api_key = api_key
    return True


def _welcome_html(customer_name: str, expires_at: str) -> str:
    """Returns the premium welcome email HTML template."""
    first_name = customer_name.split()[0] if customer_name else "Usuário"
    return f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo ao UPscribe Premium</title>
</head>
<body style="margin:0;padding:0;background:#F0F4FF;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4FF;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(99,102,241,0.10);">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#4F46E5 0%,#6366F1 100%);padding:36px 40px 28px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <span style="font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-1px;">⚡ UPscribe</span>
              </div>
              <p style="margin:8px 0 0;color:#C7D2FE;font-size:13px;font-weight:500;">Transcrição com IA de última geração</p>
            </td>
          </tr>

          <!-- HERO -->
          <tr>
            <td style="padding:40px 40px 24px;text-align:center;">
              <div style="width:72px;height:72px;background:#ECFDF5;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
                <span style="font-size:36px;">✅</span>
              </div>
              <h1 style="margin:0 0 8px;font-size:26px;font-weight:900;color:#111827;letter-spacing:-0.5px;">
                Bem-vindo ao Premium, {first_name}!
              </h1>
              <p style="margin:0;font-size:15px;color:#6B7280;line-height:1.6;">
                Sua assinatura anual está <strong style="color:#059669;">ativa e funcionando</strong>.<br/>
                Você desbloqueou acesso ilimitado à IA de transcrição mais precisa do mundo.
              </p>
            </td>
          </tr>

          <!-- SUBSCRIPTION BOX -->
          <tr>
            <td style="padding:0 40px 32px;">
              <div style="background:#F8FAFF;border:1.5px solid #E0E7FF;border-radius:14px;padding:24px;">
                <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#4F46E5;text-transform:uppercase;letter-spacing:0.8px;">Resumo da Assinatura</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;">
                      <span style="font-size:13px;color:#6B7280;font-weight:600;">Plano</span>
                    </td>
                    <td align="right" style="padding:8px 0;border-bottom:1px solid #E5E7EB;">
                      <span style="font-size:13px;color:#4F46E5;font-weight:700;">Premium Anual</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;">
                      <span style="font-size:13px;color:#6B7280;font-weight:600;">Valor</span>
                    </td>
                    <td align="right" style="padding:8px 0;border-bottom:1px solid #E5E7EB;">
                      <span style="font-size:13px;color:#111827;font-weight:600;">R$ 150,00 / ano</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;">
                      <span style="font-size:13px;color:#6B7280;font-weight:600;">Status</span>
                    </td>
                    <td align="right" style="padding:8px 0;border-bottom:1px solid #E5E7EB;">
                      <span style="font-size:12px;color:#059669;font-weight:700;background:#D1FAE5;padding:3px 10px;border-radius:20px;">● Ativo</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;">
                      <span style="font-size:13px;color:#6B7280;font-weight:600;">Válido até</span>
                    </td>
                    <td align="right" style="padding:8px 0;">
                      <span style="font-size:13px;color:#111827;font-weight:700;">{expires_at}</span>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- FEATURES -->
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#374151;">O que você desbloqueou:</p>
              <table width="100%" cellpadding="0" cellspacing="4">
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#374151;">✅ &nbsp; Transcrições ilimitadas sem restrição de minutos</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#374151;">✅ &nbsp; Reconhecimento de falantes (Speaker Diarization)</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#374151;">✅ &nbsp; Tradução simultânea e restauração de áudio</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#374151;">✅ &nbsp; Suporte premium e maior velocidade de fila</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 40px 40px;text-align:center;">
              <a href="http://localhost:3000"
                 style="display:inline-block;background:linear-gradient(135deg,#4F46E5,#6366F1);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:12px;letter-spacing:0.2px;box-shadow:0 4px 14px rgba(99,102,241,0.35);">
                Começar a Transcrever →
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#F9FAFB;padding:20px 40px;text-align:center;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:11px;color:#9CA3AF;line-height:1.6;">
                Você recebeu este e-mail porque assinou o UPscribe Premium.<br/>
                Em caso de dúvidas, entre em contato conosco. &nbsp;|&nbsp; <a href="#" style="color:#6366F1;text-decoration:none;">Cancelar assinatura</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def _cancellation_html(customer_name: str) -> str:
    """Returns the cancellation confirmation email HTML."""
    first_name = customer_name.split()[0] if customer_name else "Usuário"
    return f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.07);">
          <tr>
            <td style="background:linear-gradient(135deg,#4F46E5,#6366F1);padding:28px 40px;text-align:center;">
              <span style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-1px;">⚡ UPscribe</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;text-align:center;">
              <span style="font-size:48px;">😢</span>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:900;color:#111827;">Cancelamento confirmado</h1>
              <p style="margin:0;font-size:14px;color:#6B7280;line-height:1.6;">
                Olá {first_name}, sua assinatura foi cancelada com sucesso.<br/>
                Você pode continuar usando o Premium até o fim do período pago.
              </p>
              <div style="margin:28px 0;background:#FEF3C7;border-radius:12px;padding:16px;">
                <p style="margin:0;font-size:13px;color:#92400E;font-weight:600;">
                  💡 Mudou de ideia? Você pode reativar sua assinatura a qualquer momento.
                </p>
              </div>
              <a href="http://localhost:3000"
                 style="display:inline-block;background:#4F46E5;color:#fff;font-size:13px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;">
                Voltar ao UPscribe
              </a>
            </td>
          </tr>
          <tr>
            <td style="background:#F9FAFB;padding:16px 40px;text-align:center;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:11px;color:#9CA3AF;">© 2025 UPscribe. Todos os direitos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def send_welcome_email(to_email: str, customer_name: str, expires_at: str) -> bool:
    """
    Send premium welcome email after successful payment.
    Returns True if sent successfully, False otherwise.
    """
    if not _configure_resend():
        return False

    try:
        params: resend.Emails.SendParams = {
            "from": "UPscribe <onboarding@resend.dev>",
            "to": [to_email],
            "subject": "🎉 Bem-vindo ao UPscribe Premium!",
            "html": _welcome_html(customer_name, expires_at),
        }
        email = resend.Emails.send(params)
        logger.info(f"[Email] Welcome email sent to {to_email} — id: {getattr(email, 'id', '?')}")
        return True
    except Exception as e:
        logger.error(f"[Email] Failed to send welcome email to {to_email}: {e}")
        return False


def send_cancellation_email(to_email: str, customer_name: str) -> bool:
    """
    Send cancellation confirmation email.
    Returns True if sent successfully, False otherwise.
    """
    if not _configure_resend():
        return False

    try:
        params: resend.Emails.SendParams = {
            "from": "UPscribe <onboarding@resend.dev>",
            "to": [to_email],
            "subject": "Cancelamento de assinatura confirmado — UPscribe",
            "html": _cancellation_html(customer_name),
        }
        email = resend.Emails.send(params)
        logger.info(f"[Email] Cancellation email sent to {to_email} — id: {getattr(email, 'id', '?')}")
        return True
    except Exception as e:
        logger.error(f"[Email] Failed to send cancellation email to {to_email}: {e}")
        return False
