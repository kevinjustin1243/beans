import datetime
from typing import Optional

from fastapi import Cookie, HTTPException, status
from jose import JWTError, jwt
import bcrypt

from .config import get_secret_key, get_users

ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24
COOKIE_NAME = "beans_session"

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Compare a plaintext password with a stored bcrypt hash.

    bcrypt.checkpw raises ValueError on malformed stored hashes (e.g. a
    placeholder string in config.yaml). Treat any such failure as a failed
    auth — returning False — so the login endpoint sees a clean 401
    rather than bubbling up a 500.
    """
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except (ValueError, TypeError):
        return False


def create_token(username: str) -> str:
    expire = datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": username, "exp": expire}, get_secret_key(), algorithm=ALGORITHM)


def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, get_secret_key(), algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        if not username:
            raise ValueError
        return username
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")


def require_user(beans_session: Optional[str] = Cookie(default=None)) -> str:
    if not beans_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    username = decode_token(beans_session)
    if username not in get_users():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return username
