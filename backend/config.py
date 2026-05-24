import os
from pydantic_settings import BaseSettings
from typing import Set, Dict, Optional


class Settings(BaseSettings):
    # App General
    APP_TITLE: str = "UPscribe API"
    UPLOAD_DIR: str = "temp_uploads"
    RESULTS_DIR: str = "results"
    MAX_FILE_MB: int = 200
    DEFAULT_LANGUAGE: str = "pt"
    
    # Allowed Origins (CORS)
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3001,http://localhost:3002"
    
    # Postgres Database Config
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: str = "5432"
    POSTGRES_DB: str = "upscribe"
    DATABASE_URL: Optional[str] = None  # Computed dynamically if not provided
    
    # Redis Queue & Cache Config
    REDIS_URL: str = "redis://localhost:6381/0"
    
    # S3 Object Storage Config (MinIO default local)
    S3_ENDPOINT_URL: Optional[str] = "http://localhost:9000"
    S3_ACCESS_KEY_ID: str = "minioadmin"
    S3_SECRET_ACCESS_KEY: str = "minioadmin"
    S3_BUCKET_NAME: str = "upscribe-storage"
    S3_REGION_NAME: Optional[str] = "us-east-1"
    
    # Security, TENANTS & Rate Limits
    API_KEYS: str = ""
    API_KEY_TENANTS: str = ""
    RATE_LIMIT_PER_MIN: int = 20
    JOB_RETENTION_DAYS: int = 7
    
    # JWT Auth Config
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    
    # Translation compliance
    TRANSLATION_PROVIDER: str = "none"  # supported: aws_translate
    AWS_REGION: str = "us-east-1"

    # Upload hardening / quotas
    MAX_AUDIO_DURATION_SECONDS: int = 7200
    TENANT_MAX_FILE_MB: str = ""  # format tenant_id:mb,tenant2:mb
    # Download Restrictions
    ALLOWED_DOWNLOAD_DOMAINS: str = "youtube.com,youtu.be,vimeo.com,tiktok.com,instagram.com,twitch.tv,dailymotion.com,facebook.com,fb.watch,kwai.com"
    
    # Appmax Payment Config
    APPMAX_API_KEY: str = ""
    APPMAX_SANDBOX: bool = True
    APPMAX_SIGNATURE_SECRET: str = ""
    
    # Abacate Pay Config
    ABACATE_API_KEY: str = ""
    ABACATE_WEBHOOK_SECRET: str = ""

    # Resend Email Config
    RESEND_API_KEY: str = ""
    EMAIL_FROM_NAME: str = "UPscribe"
    APP_URL: str = "http://localhost:3000"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    @property
    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def parsed_api_keys(self) -> Set[str]:
        return {k.strip() for k in self.API_KEYS.split(",") if k.strip()}

    @property
    def parsed_api_key_tenants(self) -> Dict[str, str]:
        mapping: Dict[str, str] = {}
        for item in self.API_KEY_TENANTS.split(","):
            item = item.strip()
            if not item or ":" not in item:
                continue
            key, tenant = item.split(":", 1)
            key = key.strip()
            tenant = tenant.strip()
            if key and tenant:
                mapping[key] = tenant
        return mapping

    @property
    def parsed_download_domains(self) -> Set[str]:
        return {d.strip() for d in self.ALLOWED_DOWNLOAD_DOMAINS.split(",") if d.strip()}

    @property
    def parsed_tenant_max_file_mb(self) -> Dict[str, int]:
        mapping: Dict[str, int] = {}
        for item in self.TENANT_MAX_FILE_MB.split(","):
            item = item.strip()
            if not item or ":" not in item:
                continue
            tenant, value = item.split(":", 1)
            tenant = tenant.strip()
            try:
                mapping[tenant] = int(value.strip())
            except ValueError:
                continue
        return mapping


settings = Settings()
