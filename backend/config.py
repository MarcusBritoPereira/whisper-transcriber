from typing import Dict, Optional, Set

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App General
    APP_TITLE: str = "Transcritor API"
    APP_ENV: str = "development"
    DEV_MODE: bool = False
    UPLOAD_DIR: str = "temp_uploads"
    RESULTS_DIR: str = "results"
    MAX_FILE_MB: int = 200
    MAX_URL_DOWNLOAD_MB: int = 2048
    DEFAULT_LANGUAGE: str = "pt"
    APP_URL: str = "http://localhost:3000"
    RUN_SCHEMA_CREATE_ON_STARTUP: bool = True

    # Allowed Origins (CORS)
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3001,http://localhost:3002"

    # Postgres Database Config
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: str = "5432"
    POSTGRES_DB: str = "upscribe"
    DATABASE_URL: Optional[str] = None

    # Redis Queue, Cache & Rate Limit Config
    REDIS_URL: str = "redis://localhost:6381/0"
    RATE_LIMIT_BACKEND: str = "memory"  # memory or redis

    # S3 Object Storage Config (MinIO default local)
    S3_ENDPOINT_URL: Optional[str] = "http://localhost:9000"
    S3_ACCESS_KEY_ID: str = "minioadmin"
    S3_SECRET_ACCESS_KEY: str = "minioadmin"
    S3_BUCKET_NAME: str = "upscribe-storage"
    S3_REGION_NAME: Optional[str] = "us-east-1"

    # Security, TENANTS & Rate Limits
    API_KEYS: str = "sua_chave_1,sua_chave_2"
    API_KEY_TENANTS: str = "sua_chave_1:tenant_default,sua_chave_2:tenant_secondary"
    ENABLE_LEGACY_API_KEYS: bool = True
    RATE_LIMIT_PER_MIN: int = 20
    JOB_RETENTION_DAYS: int = 7

    # JWT Auth Config
    JWT_SECRET: str = "change-me-local-jwt-secret"
    JWT_ALGORITHM: str = "HS256"

    # Download Restrictions
    ALLOWED_DOWNLOAD_DOMAINS: str = "youtube.com,youtu.be,vimeo.com,tiktok.com,instagram.com,twitch.tv,dailymotion.com,facebook.com,fb.watch,kwai.com"

    # Appmax Payment Config
    APPMAX_API_KEY: str = "sua_chave_appmax_default"
    APPMAX_SANDBOX: bool = True
    APPMAX_SIGNATURE_SECRET: str = "sua_signature_secret_default"

    # Abacate Pay Config
    ABACATE_API_KEY: str = ""
    ABACATE_WEBHOOK_SECRET: str = "sua_signature_secret_default"

    # Resend Email Config
    RESEND_API_KEY: str = "sua_resend_api_key"
    EMAIL_FROM_NAME: str = "Transcritor"
    SUPPORT_EMAIL_TO: str = "suporte@example.com"
    EMAIL_FROM_ADDRESS: str = "onboarding@resend.dev"

    # Supabase Auth Config
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() in {"prod", "production"}

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
        return {d.strip().lower() for d in self.ALLOWED_DOWNLOAD_DOMAINS.split(",") if d.strip()}

    @property
    def parsed_allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


settings = Settings()
