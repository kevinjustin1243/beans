"""Overview / "home" dashboard endpoints.

Everything here is derived from beancount + the existing Postgres tables;
nothing new is persisted. The frontend Overview page calls these in parallel.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from modules.auth import require_user
from modules.db import get_conn
from modules.recurring import upcoming_bills
from modules.snapshots import (
    monthly_snapshots,
    spending_breakdown_current_month,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary(username: str = Depends(require_user)):
    """Headline numbers: net worth, monthly income, monthly spending, savings rate.

    ``net_worth`` includes a mark-to-market overlay on the current month's
    investments (see ``modules/snapshots.py``). The ``mark_to_market`` field
    breaks that out so the UI can show "$X invested (cost) → $Y (market)".
    """
    try:
        snaps = monthly_snapshots(username, months=2)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if not snaps:
        return {
            "net_worth": 0,
            "monthly_income": 0,
            "monthly_spending": 0,
            "savings_rate": 0,
            "mark_to_market": None,
        }

    latest = snaps[-1]
    income = float(latest["income"] or 0)
    spending = float(latest["spending"] or 0)
    savings_rate = (income - spending) / income if income > 0 else 0.0
    mtm = latest.get("mark_to_market") or None

    return {
        "net_worth": latest["net_worth"],
        "monthly_income": income,
        "monthly_spending": spending,
        "savings_rate": round(savings_rate, 4),
        "currency": latest.get("currency", "USD"),
        "mark_to_market": (
            {
                "adjustment":      mtm["adjustment"],
                "market_value":    mtm["market_value"],
                "ledger_value":    mtm["ledger_value"],
                "unrealized_gain": mtm["unrealized_gain"],
            }
            if mtm and (mtm["adjustment"] or mtm["market_value"])
            else None
        ),
    }


@router.get("/spending-breakdown")
def spending_breakdown(username: str = Depends(require_user)):
    """Current month's spending by top-level category, sorted descending."""
    try:
        return {"breakdown": spending_breakdown_current_month(username)}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/net-worth-trend")
def net_worth_trend(username: str = Depends(require_user)):
    """Net worth at month-end for the last 6 months."""
    try:
        snaps = monthly_snapshots(username, months=6)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {
        "trend": [
            {"month": s["label"], "value": s["net_worth"], "date": s["month"].isoformat()}
            for s in snaps
        ]
    }


@router.get("/budget")
def budget_progress(username: str = Depends(require_user)):
    """Per-category spend vs target for the current month.

    Reads target caps from ``budget_targets`` and joins with the per-category
    spend totals derived from beancount.
    """
    try:
        breakdown = spending_breakdown_current_month(username)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    spent_by_cat = {row["category"]: row["total"] for row in breakdown}

    with get_conn() as conn:
        rows = conn.execute(
            "SELECT account, amount FROM budget_targets WHERE username = %s",
            (username,),
        ).fetchall()

    out = []
    for row in rows:
        # ``account`` is a full beancount path (e.g. Expenses:Food:Groceries) — pull
        # the second segment to match how spending_breakdown buckets things.
        parts = row["account"].split(":")
        category = parts[1] if len(parts) >= 2 else parts[0]
        out.append({
            "category": category,
            "account": row["account"],
            "budget": float(row["amount"]),
            "spent": spent_by_cat.get(category, 0.0),
        })
    return {"categories": out}


@router.get("/upcoming-bills")
def get_upcoming_bills(username: str = Depends(require_user)):
    """Active recurring payments, soonest first. Derived from ledger transactions."""
    try:
        return {"bills": upcoming_bills(username)}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
