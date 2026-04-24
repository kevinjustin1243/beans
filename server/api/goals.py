import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from modules.auth import require_user
from modules.db import get_conn

router = APIRouter(prefix="/api/goals", tags=["goals"])


class GoalIn(BaseModel):
    name: str
    target_amount: float
    currency: str = "USD"
    account: str = ""
    manual_current: float = 0


def _row(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "target_amount": row["target_amount"],
        "currency": row["currency"],
        "account": row["account"],
        "manual_current": row["manual_current"],
    }


@router.get("")
def list_goals(username: str = Depends(require_user)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM goals WHERE user = ? ORDER BY rowid",
            (username,),
        ).fetchall()
    return {"goals": [_row(r) for r in rows]}


@router.post("", status_code=201)
def create_goal(body: GoalIn, username: str = Depends(require_user)):
    goal_id = str(uuid.uuid4())
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO goals (id, user, name, target_amount, currency, account, manual_current)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (goal_id, username, body.name, body.target_amount, body.currency, body.account, body.manual_current),
        )
        conn.commit()
    return {"id": goal_id}


@router.put("/{goal_id}")
def update_goal(goal_id: str, body: GoalIn, username: str = Depends(require_user)):
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE goals SET name=?, target_amount=?, currency=?, account=?, manual_current=?"
            " WHERE id=? AND user=?",
            (body.name, body.target_amount, body.currency, body.account, body.manual_current, goal_id, username),
        )
        conn.commit()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"ok": True}


@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: str, username: str = Depends(require_user)):
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM goals WHERE id = ? AND user = ?",
            (goal_id, username),
        )
        conn.commit()
