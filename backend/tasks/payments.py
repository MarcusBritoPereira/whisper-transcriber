import json
from celery import shared_task
from database import SessionLocal
from models.payment import TenantSubscription, AppmaxWebhookLog
from datetime import datetime, timezone, timedelta
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def process_appmax_webhook_task(self, event_id: str, payload_data: dict):
    logger.info(f"Starting Celery task to process Appmax webhook event: {event_id}")
    db = SessionLocal()
    try:
        # Retrieve webhook log
        webhook_log = db.query(AppmaxWebhookLog).filter(AppmaxWebhookLog.event_id == event_id).first()
        if not webhook_log:
            logger.error(f"Webhook log not found for event_id: {event_id}")
            return "log_not_found"

        event_name = payload_data.get("event")
        order_id = str(payload_data.get("order_id"))
        
        # Safely extract customer ID from payload
        cust_payload = payload_data.get("customer") or {}
        customer_id = str(payload_data.get("customer_id") or cust_payload.get("id") or "")

        # Find the tenant subscription by last_order_id or customer_id
        subscription = None
        if order_id:
            subscription = db.query(TenantSubscription).filter(TenantSubscription.last_order_id == order_id).first()
        if not subscription and customer_id:
            subscription = db.query(TenantSubscription).filter(TenantSubscription.customer_id == customer_id).first()

        if not subscription:
            logger.warning(f"No tenant subscription found for order_id: {order_id} or customer_id: {customer_id}")
            webhook_log.status = "processed"
            db.commit()
            return "no_tenant_found"

        now_iso = datetime.now(timezone.utc).isoformat()

        # Handle events and map to plan status
        if event_name in ["order_approved", "order_paid", "order_paid_by_pix"]:
            subscription.status = "active"
            subscription.expires_at = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
            subscription.updated_at = now_iso
            logger.info(f"Activating subscription for tenant: {subscription.tenant_id} (Expires: {subscription.expires_at})")
            
        elif event_name in ["order_refund", "order_billet_overdue", "order_pix_expired"]:
            subscription.status = "inactive"
            subscription.updated_at = now_iso
            logger.info(f"Deactivating subscription for tenant: {subscription.tenant_id} due to event: {event_name}")

        elif event_name in ["order_chargeback_in_treatment"]:
            subscription.status = "inactive"
            subscription.updated_at = now_iso
            logger.info(f"Suspending subscription for tenant: {subscription.tenant_id} due to chargeback: {event_name}")

        # Update log status
        webhook_log.status = "processed"
        db.commit()
        return "success"

    except Exception as exc:
        db.rollback()
        logger.exception(f"Error processing webhook event: {event_id}")
        try:
            webhook_log = db.query(AppmaxWebhookLog).filter(AppmaxWebhookLog.event_id == event_id).first()
            if webhook_log:
                webhook_log.status = "failed"
                db.commit()
        except Exception:
            pass
        raise self.retry(exc=exc)
    finally:
        db.close()


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def process_abacate_webhook_task(self, event_id: str, payload_data: dict):
    logger.info(f"Starting Celery task to process Abacate Pay webhook event: {event_id}")
    db = SessionLocal()
    try:
        # Retrieve webhook log
        webhook_log = db.query(AppmaxWebhookLog).filter(AppmaxWebhookLog.event_id == event_id).first()
        if not webhook_log:
            logger.error(f"Webhook log not found for event_id: {event_id}")
            return "log_not_found"

        event_name = payload_data.get("event")
        billing_data = payload_data.get("data") or {}
        tenant_id = billing_data.get("externalId")

        if not tenant_id:
            logger.warning(f"No externalId (tenant_id) found in Abacate Pay payload data: {billing_data}")
            webhook_log.status = "processed"
            db.commit()
            return "no_tenant_found"

        subscription = db.query(TenantSubscription).filter(TenantSubscription.tenant_id == tenant_id).first()
        now_iso = datetime.now(timezone.utc).isoformat()

        if not subscription:
            # Create sub dynamically if it doesn't exist
            subscription = TenantSubscription(
                tenant_id=tenant_id,
                status="inactive",
                plan_type="annual",
                customer_id=str(billing_data.get("customerId") or ""),
                last_order_id=str(billing_data.get("id") or ""),
                created_at=now_iso,
                updated_at=now_iso
            )
            db.add(subscription)
            db.flush()

        # Handle Abacate Pay Webhook Events
        if event_name in ["checkout.completed", "subscription.completed", "subscription.renewed"]:
            subscription.status = "active"
            subscription.expires_at = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
            subscription.customer_id = str(billing_data.get("customerId") or "")
            subscription.last_order_id = str(billing_data.get("id") or "")
            subscription.updated_at = now_iso
            logger.info(f"Activating subscription for tenant: {subscription.tenant_id} via Abacate Pay (Expires: {subscription.expires_at})")

        elif event_name in ["checkout.refunded", "transparent.refunded", "subscription.cancelled"]:
            subscription.status = "inactive"
            subscription.updated_at = now_iso
            logger.info(f"Deactivating subscription for tenant: {subscription.tenant_id} due to event: {event_name}")

        elif event_name in ["checkout.disputed", "transparent.disputed"]:
            subscription.status = "inactive"
            subscription.updated_at = now_iso
            logger.info(f"Suspending subscription for tenant: {subscription.tenant_id} due to dispute: {event_name}")

        # Update log status
        webhook_log.status = "processed"
        db.commit()
        return "success"

    except Exception as exc:
        db.rollback()
        logger.exception(f"Error processing Abacate Pay webhook event: {event_id}")
        try:
            webhook_log = db.query(AppmaxWebhookLog).filter(AppmaxWebhookLog.event_id == event_id).first()
            if webhook_log:
                webhook_log.status = "failed"
                db.commit()
        except Exception:
            pass
        raise self.retry(exc=exc)
    finally:
        db.close()
