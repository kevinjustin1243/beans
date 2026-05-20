from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from modules.auth import require_user
from modules.db import get_conn

router = APIRouter(prefix="/api/budget", tags=["budget"])


@router.get("/targets")
def get_targets(username: str = Depends(require_user)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT account, amount, color FROM budget_targets WHERE username = %s",
            (username,),
        ).fetchall()
    return {
        "targets": {row["account"]: row["amount"] for row in rows},
        "colors": {row["account"]: row["color"] for row in rows if row["color"]},
    }


class TargetIn(BaseModel):
    amount: float
    color: Optional[str] = Field(default=None, max_length=10)


@router.put("/targets/{account:path}")
def set_target(account: str, body: TargetIn, username: str = Depends(require_user)):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO budget_targets (username, account, amount, color) VALUES (%s, %s, %s, %s)"
            " ON CONFLICT (username, account) DO UPDATE SET amount = EXCLUDED.amount, color = EXCLUDED.color",
            (username, account, body.amount, body.color),
        )
    return {"ok": True}


@router.delete("/targets/{account:path}", status_code=204)
def delete_target(account: str, username: str = Depends(require_user)):
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM budget_targets WHERE username = %s AND account = %s",
            (username, account),
        )
