from sqlalchemy import Column, String, Text, Index
from database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, index=True)
    status = Column(String, nullable=False, index=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    input_path = Column(String, nullable=True)
    request_json = Column(Text, nullable=True)
    result_json = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    tenant_id = Column(String, nullable=True, index=True)

    __table_args__ = (
        Index("idx_jobs_tenant_created_at", "tenant_id", "created_at"),
    )
