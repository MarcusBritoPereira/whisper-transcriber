import logging
import jwt
import requests
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Header, Request, Depends
from typing import Optional, Dict
from config import settings

logger = logging.getLogger(__name__)

JWT_SECRET = settings.JWT_SECRET
JWT_ALGORITHM = settings.JWT_ALGORITHM
SUPABASE_JWT_SECRET = getattr(settings, "SUPABASE_JWT_SECRET", JWT_SECRET)


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
        # 1. Try local offline validation with JWT Secret first
        payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"verify_aud": False})
        return payload
    except jwt.ExpiredSignatureError as e:
        logger.warning(f"JWT Local Validation - Signature Expired: {e}")
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        logger.info(f"JWT Local Validation - Invalid Token: {e}. Falling back to online verification against Supabase API...")
        
        # 2. Online validation fallback (requests GoTrue user profile directly from Supabase API)
        try:
            url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user"
            headers = {
                "Authorization": f"Bearer {token}",
                "apikey": settings.SUPABASE_ANON_KEY
            }
            # Short timeout of 5 seconds to avoid locking up local threads
            response = requests.get(url, headers=headers, timeout=5)
            
            if response.status_code == 200:
                payload = response.json()
                # Ensure mapping compatibility for sync_supabase_user
                if "id" in payload and "sub" not in payload:
                    payload["sub"] = payload["id"]
                logger.info(f"JWT Online Validation - Successfully validated token via Supabase API for {payload.get('email')}")
                return payload
            else:
                logger.warning(f"JWT Online Validation - Supabase API rejected token with status {response.status_code}: {response.text}")
        except Exception as online_err:
            logger.error(f"JWT Online Validation - Failed to connect to Supabase API: {online_err}")
            
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


from sqlalchemy.orm import Session
from database import get_db
from models.workspace import User, Workspace, WorkspaceMember

def sync_supabase_user(payload: Dict, db: Session) -> str:
    supabase_id = payload.get("sub") or payload.get("id")
    email = payload.get("email")
    if not supabase_id or not email:
        raise HTTPException(status_code=401, detail="JWT missing sub or email claims")

    # Check if user exists
    user = db.query(User).filter(User.supabase_id == supabase_id).first()
    if not user:
        # Create new User
        user = User(
            email=email,
            supabase_id=supabase_id,
            full_name=payload.get("user_metadata", {}).get("full_name") or payload.get("email", "").split("@")[0]
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create default workspace
        workspace = Workspace(name="Meu Workspace", owner_id=user.id)
        db.add(workspace)
        db.commit()
        db.refresh(workspace)

        # Add member to workspace
        member = WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role="admin")
        db.add(member)
        db.commit()
        
        return workspace.id

    # If user exists, find their primary workspace
    member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
    if member:
        return member.workspace_id
        
    raise HTTPException(status_code=403, detail="User does not belong to any workspace")


def get_tenant_id(
    request: Request,
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> str:
    # 1. Try JWT Bearer authentication first (Supabase Auth)
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1].strip()
        payload = decode_jwt_token(token)
        
        # Sync User to DB and get Workspace ID
        tenant_id = sync_supabase_user(payload, db)
        return tenant_id
        
    # 2. Fallback to Legacy X-API-Key for backwards compatibility/local dev
    if x_api_key:
        return validate_api_key(x_api_key)
        
    raise HTTPException(status_code=401, detail="Authentication credentials missing (Bearer JWT or X-API-Key)")
