"""Prediction and forecasting helpers.

Stateless: every function takes data (typically derived from beancount via
``modules.snapshots`` or from Postgres tables) and returns a JSON-serializable
dict / list. No I/O, no DB access.

Ported from the FinanceEagle repo's ``models.py``; uses
``statistics.linear_regression`` (Python 3.10+) instead of scikit-learn so we
don't drag numpy + sklearn into the container.
"""

from __future__ import annotations

import datetime
import statistics
from calendar import month_abbr
from typing import Iterable


# ── Linear-fit helper ──────────────────────────────────────────────────────────


def _fit(xs: Iterable[float], ys: Iterable[float]) -> tuple[float, float]:
    """Return (slope, intercept) for OLS over (xs, ys).

    Falls back to a flat line at the mean if the inputs are degenerate
    (single point, all-equal xs, etc.).
    """
    xs_l = list(xs)
    ys_l = list(ys)
    if len(xs_l) < 2:
        return 0.0, (ys_l[0] if ys_l else 0.0)
    try:
        slope, intercept = statistics.linear_regression(xs_l, ys_l)
    except statistics.StatisticsError:
        return 0.0, statistics.fmean(ys_l)
    return float(slope), float(intercept)


def _predict(slope: float, intercept: float, x: float) -> float:
    return slope * x + intercept


# ── Month-label helpers ────────────────────────────────────────────────────────


def _label_for(month_date: datetime.date, current_year: int) -> str:
    """Short label: 'Mar' if same year, 'Mar '27' otherwise."""
    base = month_abbr[month_date.month]
    if month_date.year == current_year:
        return base
    return f"{base} '{month_date.year % 100:02d}"


def _add_months(d: datetime.date, n: int) -> datetime.date:
    """Return the first of the month n months after d."""
    total = d.year * 12 + (d.month - 1) + n
    return datetime.date(total // 12, total % 12 + 1, 1)


def _next_month_dates(start: datetime.date, count: int, step: int = 1) -> list[datetime.date]:
    return [_add_months(start, (i + 1) * step) for i in range(count)]


# ── Spending forecasts ─────────────────────────────────────────────────────────


def forecast_spending_by_category(monthly_category_totals: list[dict]) -> list[dict]:
    """Predict next month's spending per category via OLS over month index.

    Input rows: ``{"month_index": int, "category": str, "total": float}``.
    Returns: ``[{"category", "current", "predicted"}]`` with non-negative
    predictions. Categories with <2 data points are skipped.
    """
    by_cat: dict[str, list[tuple[int, float]]] = {}
    for row in monthly_category_totals:
        by_cat.setdefault(row["category"], []).append(
            (int(row["month_index"]), float(row["total"]))
        )

    results = []
    for cat, points in by_cat.items():
        if len(points) < 2:
            continue
        points.sort()
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        slope, intercept = _fit(xs, ys)
        next_x = max(xs) + 1
        predicted = max(0.0, _predict(slope, intercept, next_x))
        results.append(
            {
                "category": cat,
                "current": round(ys[-1], 2),
                "predicted": round(predicted, 2),
            }
        )
    return results


def forecast_spending_trend(snapshots: list[dict]) -> list[dict]:
    """Predict total monthly spending 2 months out.

    Input: ``[{"month": label, "spending": float}, ...]``, one row per month
    in chronological order.
    Output: same labels, with each row carrying either an ``actual`` value or
    a ``predicted`` value (the bridge row has both, so the two segments meet).
    """
    if not snapshots:
        return []

    months = [s["month"] for s in snapshots]
    spending = [float(s["spending"]) for s in snapshots]

    xs = list(range(len(spending)))
    slope, intercept = _fit(xs, spending)

    out = [{"month": months[i], "actual": round(spending[i], 2), "predicted": None} for i in range(len(months))]
    out[-1]["predicted"] = out[-1]["actual"]

    today_year = datetime.date.today().year
    today_first = datetime.date.today().replace(day=1)
    for j in range(2):
        future_date = _add_months(today_first, j + 1)
        future_x = len(spending) + j
        predicted = max(0.0, _predict(slope, intercept, future_x))
        out.append({"month": _label_for(future_date, today_year), "actual": None, "predicted": round(predicted, 2)})
    return out


# ── Net worth projection ───────────────────────────────────────────────────────


def project_net_worth(snapshots: list[dict]) -> list[dict]:
    """Project net worth quarterly for 12 months with low/high bands.

    Input: ``[{"month": label, "net_worth": float}, ...]`` (chronological).
    Output: starts with the actual current point, then 4 quarterly projections
    each carrying ``low`` and ``high`` bands.
    """
    if not snapshots:
        return []

    values = [float(s["net_worth"]) for s in snapshots]
    xs = list(range(len(values)))
    slope, _ = _fit(xs, values)

    last = values[-1]
    last_label = snapshots[-1]["month"]
    out = [{"month": last_label, "actual": round(last), "low": round(last), "high": round(last)}]

    today_year = datetime.date.today().year
    today_first = datetime.date.today().replace(day=1)
    for i in range(4):
        months_ahead = (i + 1) * 3
        proj_date = _add_months(today_first, months_ahead)
        uncertainty = 0.02 * (i + 1) * abs(last)
        low = round(last + slope * 0.5 * months_ahead - uncertainty)
        high = round(last + slope * 1.5 * months_ahead + uncertainty)
        out.append({"month": _label_for(proj_date, today_year), "actual": None, "low": low, "high": high})
    return out


# ── Savings trend ──────────────────────────────────────────────────────────────


def project_debt_payoff(liabilities: list[dict]) -> list[dict]:
    """Simulate month-by-month amortization across all liabilities.

    Returns 7 quarterly snapshots (Now + 6 quarters ≈ 18 months). For each
    quarter, every liability is paid down month-by-month using its APR and
    fixed monthly payment, then balances are summed.

    Input: ``[{"name", "balance", "monthly_payment", "rate"}]`` where ``rate``
    is the APR in percent (e.g. 5.25 for 5.25%).
    """
    today_first = datetime.date.today().replace(day=1)
    current_year = today_first.year
    result: list[dict] = []

    for q in range(7):  # 0..6 → Now, +3mo, +6mo, ..., +18mo
        months = q * 3
        total_remaining = 0.0
        for liab in liabilities:
            balance = float(liab.get("balance") or 0)
            monthly_rate = float(liab.get("rate") or 0) / 100 / 12
            payment = float(liab.get("monthly_payment") or 0)
            b = balance
            for _ in range(months):
                if b <= 0:
                    break
                interest = b * monthly_rate
                principal = min(payment - interest, b) if payment > interest else 0
                if principal <= 0:
                    # Negative-amortizing or zero-payment loan — no progress made,
                    # bail to avoid an infinite shrink-stall.
                    break
                b = max(0.0, b - principal)
            total_remaining += b

        label = "Now" if q == 0 else _label_for(_add_months(today_first, months), current_year)
        result.append({"month": label, "balance": round(total_remaining)})

    return result


def project_savings_trend(snapshots: list[dict]) -> list[dict]:
    """Extend a savings history 3 months forward via linear extrapolation."""
    if not snapshots:
        return []

    values = [float(s["net_worth"]) for s in snapshots]
    xs = list(range(len(values)))
    slope, intercept = _fit(xs, values)

    out = [{"month": s["month"], "amount": round(float(s["net_worth"]))} for s in snapshots]

    today_year = datetime.date.today().year
    today_first = datetime.date.today().replace(day=1)
    for j in range(3):
        future_date = _add_months(today_first, j + 1)
        future_x = len(values) + j
        out.append({"month": _label_for(future_date, today_year), "amount": round(_predict(slope, intercept, future_x))})
    return out


# ── Financial health score ─────────────────────────────────────────────────────


def compute_financial_health(
    latest_snapshot: dict,
    savings_goals: list[dict],
    num_holding_types: int,
    latest_credit_score: int | None,
) -> dict:
    """5-factor health score on a 0-100 scale, plus an overall average.

    Pass ``latest_credit_score=None`` to suppress the credit factor entirely
    (no credit table yet → don't show a fake number).
    """
    income = float(latest_snapshot.get("income") or 0)
    spending = float(latest_snapshot.get("spending") or 0)
    total_liab = float(latest_snapshot.get("total_liabilities") or 0)

    savings_rate = (income - spending) / income if income > 0 else 0.0
    savings_score = max(0, min(100, round(savings_rate * 400)))  # 25% savings = 100

    monthly_debt = (total_liab / 360) if total_liab else 0.0
    monthly_debt_ratio = (monthly_debt / income) if income > 0 else 1.0
    dti_score = max(0, min(100, round((1 - monthly_debt_ratio) * 100)))

    emergency_target = spending * 6
    emergency_current = 0.0
    for g in savings_goals:
        if "emergency" in g.get("name", "").lower():
            emergency_current = float(g.get("current") or 0)
            break
    emergency_score = (
        max(0, min(100, round((emergency_current / emergency_target) * 100)))
        if emergency_target > 0
        else 0
    )

    diversity_score = max(0, min(100, round((num_holding_types / 5) * 100)))

    factors = [
        {"name": "Savings Rate", "score": savings_score, "max": 100, "color": "#10b981"},
        {"name": "Debt-to-Income", "score": dti_score, "max": 100, "color": "#6366f1"},
        {"name": "Emergency Fund", "score": emergency_score, "max": 100, "color": "#f59e0b"},
        {"name": "Investment Diversity", "score": diversity_score, "max": 100, "color": "#8b5cf6"},
    ]
    if latest_credit_score is not None:
        credit_score = max(0, min(100, round((latest_credit_score - 300) / 5.5)))
        factors.append({"name": "Credit Health", "score": credit_score, "max": 100, "color": "#06b6d4"})

    overall = round(sum(f["score"] for f in factors) / len(factors)) if factors else 0
    return {"factors": factors, "overall": overall}


# ── Insights ───────────────────────────────────────────────────────────────────


def generate_insights(
    spending_forecast: list[dict],
    net_worth_projection: list[dict],
    savings_goals: list[dict],
    monthly_savings: float,
    portfolio_return_pct: float | None,
    inactive_recurring: list[dict] | None = None,
) -> list[dict]:
    """Rule-based insight cards. Capped at 4."""
    insights: list[dict] = []

    if net_worth_projection and len(net_worth_projection) > 1:
        end_high = net_worth_projection[-1].get("high", 0)
        insights.append({
            "type": "opportunity",
            "title": f"Net worth on track for ${end_high:,}",
            "description": (
                f"Based on your current trajectory, your net worth could reach "
                f"${end_high:,} within 12 months."
            ),
        })

    for cat in spending_forecast:
        current = cat.get("current", 0)
        predicted = cat.get("predicted", 0)
        if current > 0:
            change_pct = ((predicted - current) / current) * 100
            if change_pct > 10:
                insights.append({
                    "type": "warning",
                    "title": f"{cat['category']} spending trending up",
                    "description": (
                        f"Your {cat['category'].lower()} spending is predicted to "
                        f"increase {change_pct:.0f}% to ${predicted:,.0f} next month."
                    ),
                })

    today = datetime.date.today()
    for goal in savings_goals:
        current = float(goal.get("current") or 0)
        target = float(goal.get("target") or 0)
        remaining = target - current
        if remaining > 0 and monthly_savings > 0:
            months_to_goal = remaining / monthly_savings
            if months_to_goal <= 12:
                completion_date = _add_months(today.replace(day=1), round(months_to_goal))
                completion = f"{month_abbr[completion_date.month]} {completion_date.year}"
                insights.append({
                    "type": "opportunity",
                    "title": f"{goal['name']} goal by {completion}",
                    "description": (
                        f"At your current savings rate of ${monthly_savings:,.0f}/mo, "
                        f"you'll reach your ${target:,.0f} target by {completion}."
                    ),
                })

    if portfolio_return_pct is not None and portfolio_return_pct > 12:
        insights.append({
            "type": "positive",
            "title": "Portfolio outperforming benchmark",
            "description": (
                f"Your investments returned {portfolio_return_pct:.1f}%, beating the "
                f"S&P 500 benchmark of ~12%."
            ),
        })

    for rec in (inactive_recurring or [])[:2]:
        annual = float(rec.get("amount") or 0) * 12
        if annual <= 0:
            continue
        insights.append({
            "type": "warning",
            "title": f"Unused recurring payment: {rec['name']}",
            "description": (
                f"${rec['amount']:.0f}/mo to {rec['name']} hasn't billed in "
                f"{rec.get('days_since_last', '?')} days — about ${annual:.0f}/yr."
            ),
        })

    return insights[:4]


# ── Optimizations ──────────────────────────────────────────────────────────────


def compute_optimizations(
    inactive_recurring: list[dict],
    liabilities: list[dict] | None = None,
) -> list[dict]:
    """Suggestion cards. Always shows two generic tips; data-driven beyond that.

    ``inactive_recurring`` comes from ``modules.recurring`` (subscriptions/bills
    that have lapsed). ``liabilities`` is from the (future) Postgres table —
    pass ``None`` or ``[]`` until the liabilities feature lands.
    """
    opts: list[dict] = [
        {
            "type": "income",
            "title": "Switch to high-yield savings",
            "description": "Earn ~$210/yr more with a high-yield savings account at 4.2% APY",
            "savings": "$210/yr",
            "priority": "high",
        },
        {
            "type": "income",
            "title": "Max employer 401k match",
            "description": "Increase contribution by 2% to capture the full $2,500 employer match",
            "savings": "$2,500/yr",
            "priority": "high",
        },
    ]

    for rec in inactive_recurring:
        amount = float(rec.get("amount") or 0)
        if amount <= 0:
            continue
        annual = amount * 12
        opts.append({
            "type": "spending",
            "title": f"Cancel {rec['name']}",
            "description": (
                f"No charge in {rec.get('days_since_last', '?')} days — "
                f"save ${amount:.0f}/mo"
            ),
            "savings": f"${annual:.0f}/yr",
            "priority": "medium",
        })

    for liab in liabilities or []:
        rate = float(liab.get("rate") or 0)
        name = liab.get("name") or ""
        if rate > 5 and "credit" not in name.lower():
            monthly_savings = float(liab.get("monthly_payment") or 0) * 0.12
            opts.append({
                "type": "spending",
                "title": f"Refinance {name.lower()}",
                "description": f"Current rate {rate:.2f}% — could save ~${monthly_savings:.0f}/mo at lower rates",
                "savings": f"${monthly_savings * 12:.0f}/yr",
                "priority": "medium",
            })

    return opts
