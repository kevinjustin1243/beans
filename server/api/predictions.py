"""Prediction / forecasting endpoints.

Endpoints wire beancount-derived inputs (via ``modules.snapshots`` and
``modules.recurring``) plus the existing Postgres tables (goals, investments,
investment_quotes) into the stateless ``modules.predictions`` helpers.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from modules.auth import require_user
from modules.db import get_conn
from modules.predictions import (
    compute_financial_health,
    compute_optimizations,
    forecast_spending_by_category,
    forecast_spending_trend,
    generate_insights,
    project_net_worth,
    project_savings_trend,
)
from modules.recurring import inactive_recurring
from modules.snapshots import monthly_category_totals, monthly_snapshots

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


def _snapshots_or_404(username: str, months: int = 6) -> list[dict]:
    try:
        return monthly_snapshots(username, months=months)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


def _goals(username: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT name, target_amount AS target, manual_current AS current"
            " FROM goals WHERE username = %s",
            (username,),
        ).fetchall()
    return [{"name": r["name"], "target": float(r["target"]), "current": float(r["current"])} for r in rows]


def _portfolio_return(username: str) -> float | None:
    """Return percent gain on the user's investments, or None if there's nothing held."""
    with get_conn() as conn:
        invs = conn.execute(
            "SELECT i.ticker, i.shares, i.cost_basis, q.price"
            " FROM investments i"
            " LEFT JOIN investment_quotes q ON q.ticker = i.ticker"
            " WHERE i.username = %s",
            (username,),
        ).fetchall()
    if not invs:
        return None
    total_cost = 0.0
    total_value = 0.0
    for inv in invs:
        shares = float(inv["shares"])
        total_cost += float(inv["cost_basis"]) * shares
        if inv["price"] is not None:
            total_value += float(inv["price"]) * shares
    if total_cost <= 0:
        return None
    return (total_value - total_cost) / total_cost * 100


@router.get("/spending-categories")
def spending_categories(username: str = Depends(require_user)):
    try:
        rows = monthly_category_totals(username, months=6)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"forecast": forecast_spending_by_category(rows)}


@router.get("/spending-trend")
def spending_trend(username: str = Depends(require_user)):
    snaps = _snapshots_or_404(username)
    rows = [{"month": s["label"], "spending": s["spending"]} for s in snaps]
    return {"trend": forecast_spending_trend(rows)}


@router.get("/net-worth")
def net_worth(username: str = Depends(require_user)):
    snaps = _snapshots_or_404(username)
    rows = [{"month": s["label"], "net_worth": s["net_worth"]} for s in snaps]
    return {"projection": project_net_worth(rows)}


@router.get("/savings-trend")
def savings_trend(username: str = Depends(require_user)):
    snaps = _snapshots_or_404(username)
    rows = [{"month": s["label"], "net_worth": s["net_worth"]} for s in snaps]
    return {"trend": project_savings_trend(rows)}


@router.get("/health-score")
def health_score(username: str = Depends(require_user)):
    snaps = _snapshots_or_404(username, months=2)
    latest = snaps[-1] if snaps else {"income": 0, "spending": 0, "total_liabilities": 0}
    return compute_financial_health(
        latest_snapshot=latest,
        savings_goals=_goals(username),
        num_holding_types=_distinct_holdings(username),
        latest_credit_score=None,  # No credit table yet — suppresses the factor.
    )


def _distinct_holdings(username: str) -> int:
    """Count distinct tickers (a proxy for asset-type diversity until we add
    a ``securities`` table with asset_type/sector). Capped at 5 by the score."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(DISTINCT ticker) AS n FROM investments WHERE username = %s",
            (username,),
        ).fetchone()
    return int(row["n"] or 0)


@router.get("/insights")
def insights(username: str = Depends(require_user)):
    snaps = _snapshots_or_404(username)
    latest = snaps[-1] if snaps else None
    income = float(latest["income"]) if latest else 0
    spending = float(latest["spending"]) if latest else 0
    monthly_savings = income - spending

    cat_rows = monthly_category_totals(username, months=6)
    spending_forecast = forecast_spending_by_category(cat_rows)

    nw_rows = [{"month": s["label"], "net_worth": s["net_worth"]} for s in snaps]
    nw_projection = project_net_worth(nw_rows)

    try:
        inactive = inactive_recurring(username)
    except FileNotFoundError:
        inactive = []

    return {
        "insights": generate_insights(
            spending_forecast=spending_forecast,
            net_worth_projection=nw_projection,
            savings_goals=_goals(username),
            monthly_savings=monthly_savings,
            portfolio_return_pct=_portfolio_return(username),
            inactive_recurring=inactive,
        )
    }


@router.get("/optimizations")
def optimizations(username: str = Depends(require_user)):
    try:
        inactive = inactive_recurring(username)
    except FileNotFoundError:
        inactive = []
    return {"optimizations": compute_optimizations(inactive_recurring=inactive, liabilities=None)}
