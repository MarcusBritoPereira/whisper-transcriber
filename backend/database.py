from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from config import settings
from typing import Generator

SQLALCHEMY_DATABASE_URL = settings.get_database_url

# Conditional connection pool settings based on dialect
connect_args = {}
pool_kwargs = {}

if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
    pool_kwargs = {
        "pool_size": 10,
        "max_overflow": 20,
        "pool_pre_ping": True,
        "pool_recycle": 1800,
    }
elif SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    # SQLite-specific thread safety configuration
    connect_args = {"check_same_thread": False}
    if "memory" in SQLALCHEMY_DATABASE_URL:
        from sqlalchemy.pool import StaticPool
        pool_kwargs = {"poolclass": StaticPool}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args=connect_args,
    **pool_kwargs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
