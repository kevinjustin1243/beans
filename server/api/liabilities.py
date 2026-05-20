"""Liabilities: long-lived debts with rate + monthly payment metadata.

Beancount can record the *balance* of a liability account, but not the
servicing terms (APR, fixed monthly payment, original balance for progress
bars). This table holds the servicing metadata; Beancount remains the truth
for the current outstanding amount when you want it consistent with the ledger.

The /debt-payoff endpoint feeds the chart on the Liabilities page using the
amortization helper in modules.predictions.
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from modules.auth import require_user
from modules.db import get_conn
from modules.predictions import project_debt_payoff

router = APIRouter(prefix="/api/liabilities", tags=["liabilities"])


class LiabilityIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    balance: float = Field(ge=0)
    original_balance: float = Field(ge=0)
    monthly_payment: float = Field(ge=0)
    rate: float = Field(ge=0, le=100, description="Annual percentage rate, e.g. 5.25 for 5.25%")
    icon: Optional[str] = Field(default=None, max_length=10)


def _row(r) -> dict:
    return {
        "id": r["id"],
        "name": r["name"],
        "balance": float(r["balance"]),
        "original_balance": float(r["original_balance"]),
        "monthly_payment": float(r["monthly_payment"]),
        "rate": float(r["rate"]),
        "icon": r["icon"],
    }


@router.get("")
def list_liabilities(username: str = Depends(require_user)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, name, balance, original_balance, monthly_payment, rate, icon"
            " FROM liabilities WHERE username = %s ORDER BY balance DESC",
            (username,),
        ).fetchall()
    return {"liabilities": [_row(r) for r in rows]}


@router.post("", status_code=201)
def create_liability(body: LiabilityIn, username: str = Depends(require_user)):
    new_id = str(uuid.uuid4())
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO liabilities"
            " (id, username, name, balance, original_balance, monthly_payment, rate, icon)"
            " VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (new_id, username, body.name, body.balance, body.original_balance,
             body.monthly_payment, body.rate, body.icon),
        )
    return {"id": new_id}


@router.put("/{liability_id}")
def update_liability(liability_id: str, body: LiabilityIn, username: str = Depends(require_user)):
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE liabilities SET name=%s, balance=%s, original_balance=%s,"
            " monthly_payment=%s, rate=%s, icon=%s WHERE id=%s AND username=%s",
            (body.name, body.balance, body.original_balance, body.monthly_payment,
             body.rate, body.icon, liability_id, username),
        )
        rowcount = cur.rowcount
    if rowcount == 0:
        raise HTTPException(status_code=404, detail="Liability not found")
    return {"ok": True}


@router.delete("/{liability_id}", status_code=204)
def delete_liability(liability_id: str, username: str = Depends(require_user)):
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM liabilities WHERE id = %s AND username = %s",
            (liability_id, username),
        )


@router.get("/debt-payoff")
def debt_payoff(username: str = Depends(require_user)):
    """Quarterly debt-payoff projection (18 months out) using amortization."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT name, balance, monthly_payment, rate"
            " FROM liabilities WHERE username = %s",
            (username,),
        ).fetchall()

    liab_dicts = [
        {
            "name": r["name"],
            "balance": float(r["balance"]),
            "monthly_payment": float(r["monthly_payment"]),
            "rate": float(r["rate"]),
        }
        for r in rows
    ]
    return {"payoff": project_debt_payoff(liab_dicts)}
