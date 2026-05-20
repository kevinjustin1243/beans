from fastapi import APIRouter, Depends
from pydantic import BaseModel

from modules.auth import require_user
from modules.db import get_conn

router = APIRouter(prefix="/api/budget", tags=["budget"])


@router.get("/targets")
def get_targets(username: str = Depends(require_user)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT account, amount FROM budget_targets WHERE username = %s",
            (username,),
        ).fetchall()
    return {"targets": {row["account"]: row["amount"] for row in rows}}


class TargetIn(BaseModel):
    amount: float


@router.put("/targets/{account:path}")
def set_target(account: str, body: TargetIn, username: str = Depends(require_user)):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO budget_targets (username, account, amount) VALUES (%s, %s, %s)"
            " ON CONFLICT (username, account) DO UPDATE SET amount = EXCLUDED.amount",
            (username, account, body.amount),
        )
    return {"ok": True}


@router.delete("/targets/{account:path}", status_code=204)
def delete_target(account: str, username: str = Depends(require_user)):
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM budget_targets WHERE username = %s AND account = %s",
            (username, account),
        )
