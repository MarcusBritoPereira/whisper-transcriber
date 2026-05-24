import jwt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Header, Request, Depends
from typing import Optional, Dict
from config import settings

JWT_SECRET = settings.JWT_SECRET
JWT_ALGORITHM = settings.JWT_ALGORITHM


def create_access_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=60)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_jwt_token(token: str) -> Dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authorization token")


def validate_api_key(x_api_key: Optional[str]) -> str:
    api_keys = settings.parsed_api_keys
    if not api_keys:
        raise HTTPException(status_code=503, detail="Server misconfigured: API_KEYS is required")
    if not x_api_key or x_api_key not in api_keys:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    api_key_tenants = settings.parsed_api_key_tenants
    if api_key_tenants and x_api_key not in api_key_tenants:
        raise HTTPException(status_code=401, detail="API key tenant mapping missing")
        
    return api_key_tenants.get(x_api_key, x_api_key[-8:])


def get_tenant_id(
    request: Request,
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None)
) -> str:
    # 1. Try JWT Bearer authentication first
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1].strip()
        payload = decode_jwt_token(token)
        tenant_id = payload.get("tenant_id")
        if not tenant_id:
            raise HTTPException(status_code=401, detail="JWT missing tenant_id claim")
        return tenant_id
        
    # 2. Fallback to Legacy X-API-Key for backwards compatibility/local dev
    if x_api_key:
        return validate_api_key(x_api_key)
        
    raise HTTPException(status_code=401, detail="Authentication credentials missing (Bearer JWT or X-API-Key)")
