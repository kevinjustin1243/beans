"""Credit score history: one row per month per user.

Monthly entries are upserted by (username, month) so logging the same month
twice is harmless. The 5th factor of compute_financial_health (Credit Health)
becomes live once the user records at least one score.
"""

from __future__ import annotations

import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from modules.auth import require_user
from modules.db import get_conn

router = APIRouter(prefix="/api/credit", tags=["credit"])


class CreditScoreIn(BaseModel):
    month: datetime.date = Field(description="First day of the month is fine; only year+month are kept.")
    score: int = Field(ge=300, le=850)


def _normalize_month(d: datetime.date) -> datetime.date:
    return d.replace(day=1)


def _row(r) -> dict:
    return {
        "id": r["id"],
        "month": r["month"].isoformat(),
        "score": int(r["score"]),
    }


@router.get("/history")
def list_history(username: str = Depends(require_user)):
    """Full credit-score history for the user, oldest first."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, month, score FROM credit_scores"
            " WHERE username = %s ORDER BY month ASC",
            (username,),
        ).fetchall()
    return {"history": [_row(r) for r in rows]}


@router.get("/latest")
def latest(username: str = Depends(require_user)):
    """Most recent credit score, or null if none recorded."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, month, score FROM credit_scores"
            " WHERE username = %s ORDER BY month DESC LIMIT 1",
            (username,),
        ).fetchone()
    return {"latest": _row(row) if row else None}


@router.post("", status_code=201)
def add_or_replace(body: CreditScoreIn, username: str = Depends(require_user)):
    """Upsert by (username, month). Replays for the same month overwrite."""
    month = _normalize_month(body.month)
    with get_conn() as conn:
        row = conn.execute(
            "INSERT INTO credit_scores (username, month, score) VALUES (%s, %s, %s)"
            " ON CONFLICT (username, month) DO UPDATE SET score = EXCLUDED.score"
            " RETURNING id",
            (username, month, body.score),
        ).fetchone()
    return {"id": int(row["id"])}


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: int, username: str = Depends(require_user)):
    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM credit_scores WHERE id = %s AND username = %s",
            (entry_id, username),
        )
        rowcount = cur.rowcount
    if rowcount == 0:
        raise HTTPException(status_code=404, detail="Entry not found")


def get_latest_score(username: str) -> Optional[int]:
    """Helper consumed by the predictions module (modules/predictions wiring)."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT score FROM credit_scores WHERE username = %s"
            " ORDER BY month DESC LIMIT 1",
            (username,),
        ).fetchone()
    return int(row["score"]) if row else None
