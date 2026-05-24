from sqlalchemy import Column, String, Text
from database import Base
from datetime import datetime, timezone


class TenantSubscription(Base):
    __tablename__ = "tenant_subscriptions"

    tenant_id = Column(String, primary_key=True, index=True)
    status = Column(String, nullable=False, default="inactive")  # active, inactive
    plan_type = Column(String, nullable=True)  # e.g., "annual"
    customer_id = Column(String, nullable=True, index=True)
    last_order_id = Column(String, nullable=True, index=True)
    expires_at = Column(String, nullable=True)  # ISO datetime string
    created_at = Column(String, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat())
    updated_at = Column(String, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat())


class AppmaxWebhookLog(Base):
    __tablename__ = "appmax_webhook_logs"

    event_id = Column(String, primary_key=True, index=True)
    order_id = Column(String, nullable=False, index=True)
    event_type = Column(String, nullable=False)
    status = Column(String, nullable=False, default="processing")  # processing, processed, failed
    payload = Column(Text, nullable=True)
    created_at = Column(String, nullable=False, default=lambda: datetime.now(timezone.utc).isoformat())
