from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel

from modules.auth import (
    COOKIE_NAME,
    TOKEN_EXPIRE_HOURS,
    create_token,
    require_user,
    verify_password,
)
from modules.config import get_users

router = APIRouter(prefix="/api/auth", tags=["auth"])


class Credentials(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: Credentials, response: Response):
    users = get_users()
    user = users.get(body.username)
    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_token(body.username)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=TOKEN_EXPIRE_HOURS * 3600,
        secure=False,  # set True in production behind HTTPS
    )
    return {"ok": True, "username": body.username}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, samesite="lax")
    return {"ok": True}


@router.get("/me")
def me(username: str = Depends(require_user)):
    return {"username": username}
