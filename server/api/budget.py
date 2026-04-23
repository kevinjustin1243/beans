from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from modules.auth import require_user
from modules.db import get_conn

router = APIRouter(prefix="/api/budget", tags=["budget"], dependencies=[Depends(require_user)])


@router.get("/targets")
def get_targets():
    with get_conn() as conn:
        rows = conn.execute("SELECT account, amount FROM budget_targets").fetchall()
    return {"targets": {row["account"]: row["amount"] for row in rows}}


class TargetIn(BaseModel):
    amount: float


@router.put("/targets/{account:path}")
def set_target(account: str, body: TargetIn):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO budget_targets (account, amount) VALUES (?, ?)"
            " ON CONFLICT(account) DO UPDATE SET amount = excluded.amount",
            (account, body.amount),
        )
        conn.commit()
    return {"ok": True}


@router.delete("/targets/{account:path}", status_code=204)
def delete_target(account: str):
    with get_conn() as conn:
        conn.execute("DELETE FROM budget_targets WHERE account = ?", (account,))
        conn.commit()
