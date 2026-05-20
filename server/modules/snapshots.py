"""Derive monthly income/spending/assets/liabilities/net_worth from a beancount file.

The Postgres schema has no MonthlySnapshot table — instead we compute snapshots
on the fly from the ledger and let the prediction layer consume them. This
keeps the .beancount file as the single source of truth and avoids cache drift.

The output dicts are intentionally shaped like FinanceEagle's MonthlySnapshot
rows so ``modules.predictions`` can consume them unchanged.
"""

from __future__ import annotations

import datetime
from calendar import month_abbr
from collections import defaultdict

from beancount.core import account_types, data, realization

from .ledger import get_ledger


def _account_types(options: dict) -> account_types.AccountTypes:
    return account_types.AccountTypes(
        options.get("name_assets", "Assets"),
        options.get("name_liabilities", "Liabilities"),
        options.get("name_equity", "Equity"),
        options.get("name_income", "Income"),
        options.get("name_expenses", "Expenses"),
    )


def _operating_currency(options: dict) -> str:
    """Return the first listed operating_currency, defaulting to USD."""
    raw = options.get("operating_currency") or []
    if isinstance(raw, str):
        return raw
    if raw:
        return raw[0]
    return "USD"


def _month_first(d: datetime.date) -> datetime.date:
    return d.replace(day=1)


def _add_months(d: datetime.date, n: int) -> datetime.date:
    total = d.year * 12 + (d.month - 1) + n
    return datetime.date(total // 12, total % 12 + 1, 1)


def _month_end(d: datetime.date) -> datetime.date:
    """Last day of the month containing ``d``."""
    nxt = _add_months(_month_first(d), 1)
    return nxt - datetime.timedelta(days=1)


def _short_label(d: datetime.date, ref_year: int) -> str:
    base = month_abbr[d.month]
    if d.year == ref_year:
        return base
    return f"{base} '{d.year % 100:02d}"


def _balance_at(entries, prefix: str, on_date: datetime.date, currency: str) -> float:
    """Total balance of all accounts under ``prefix`` as of ``on_date``."""
    filtered = [e for e in entries if hasattr(e, "date") and e.date <= on_date]
    real_root = realization.realize(filtered)
    node = realization.get(real_root, prefix)
    if node is None:
        return 0.0
    return _sum_currency(node, currency)


def _sum_currency(node, currency: str) -> float:
    total = 0.0
    for pos in node.balance:
        if pos.units.currency == currency:
            total += float(pos.units.number)
    for _, child in node.items():
        total += _sum_currency(child, currency)
    return total


# ── Public API ─────────────────────────────────────────────────────────────────


def monthly_snapshots(username: str, months: int = 6) -> list[dict]:
    """Return up to ``months`` monthly snapshots ending with the current month.

    Each row:
        {
          "month": date,            # first of the month
          "label": "Mar",           # short display label
          "income":            float (positive),
          "spending":          float (positive),
          "total_assets":      float,
          "total_liabilities": float (positive — magnitude of debt),
          "net_worth":         float,
        }
    """
    entries, _errors, options = get_ledger(username)
    acct = _account_types(options)
    currency = _operating_currency(options)

    today = datetime.date.today()
    current_year = today.year
    current_first = _month_first(today)
    start_first = _add_months(current_first, -(months - 1))

    # Bucket Income + Expense transactions by month.
    income_by_month: dict[datetime.date, float] = defaultdict(float)
    spend_by_month: dict[datetime.date, float] = defaultdict(float)
    for e in entries:
        if not isinstance(e, data.Transaction):
            continue
        if e.date < start_first or e.date > _month_end(current_first):
            continue
        m = _month_first(e.date)
        for p in e.postings:
            if p.units is None or p.units.currency != currency:
                continue
            n = float(p.units.number)
            if p.account.startswith(acct.income + ":") or p.account == acct.income:
                # Income postings carry negative numbers (credit to Income account).
                income_by_month[m] += -n
            elif p.account.startswith(acct.expenses + ":") or p.account == acct.expenses:
                spend_by_month[m] += n

    snapshots = []
    for i in range(months):
        m_first = _add_months(start_first, i)
        m_end = _month_end(m_first)
        assets = _balance_at(entries, acct.assets, m_end, currency)
        liabilities_signed = _balance_at(entries, acct.liabilities, m_end, currency)
        # Beancount liabilities are stored as negative numbers — flip to magnitude.
        total_liab = -liabilities_signed
        snapshots.append({
            "month": m_first,
            "label": _short_label(m_first, current_year),
            "income": round(income_by_month.get(m_first, 0.0), 2),
            "spending": round(spend_by_month.get(m_first, 0.0), 2),
            "total_assets": round(assets, 2),
            "total_liabilities": round(total_liab, 2),
            "net_worth": round(assets + liabilities_signed, 2),
            "currency": currency,
        })
    return snapshots


def monthly_category_totals(username: str, months: int = 6) -> list[dict]:
    """Return ``[{"month_index", "category", "total"}]`` for the spending-by-category forecast.

    Category = the **second segment** of the Expenses account (e.g.
    ``Expenses:Food:Groceries`` → ``Food``). Aggregated per month over the
    operating currency.
    """
    entries, _errors, options = get_ledger(username)
    acct = _account_types(options)
    currency = _operating_currency(options)

    today_first = datetime.date.today().replace(day=1)
    start_first = _add_months(today_first, -(months - 1))

    month_keys: list[datetime.date] = [_add_months(start_first, i) for i in range(months)]
    month_idx = {m: i for i, m in enumerate(month_keys)}

    totals: dict[tuple[int, str], float] = defaultdict(float)
    for e in entries:
        if not isinstance(e, data.Transaction):
            continue
        m = _month_first(e.date)
        if m not in month_idx:
            continue
        for p in e.postings:
            if p.units is None or p.units.currency != currency:
                continue
            if not (p.account.startswith(acct.expenses + ":") or p.account == acct.expenses):
                continue
            parts = p.account.split(":")
            category = parts[1] if len(parts) >= 2 else parts[0]
            totals[(month_idx[m], category)] += float(p.units.number)

    return [
        {"month_index": idx, "category": cat, "total": round(amount, 2)}
        for (idx, cat), amount in sorted(totals.items())
    ]


def spending_breakdown_current_month(username: str) -> list[dict]:
    """Top-level category spend for the current month, sorted descending."""
    entries, _errors, options = get_ledger(username)
    acct = _account_types(options)
    currency = _operating_currency(options)

    today = datetime.date.today()
    m_first = _month_first(today)
    m_end = _month_end(m_first)

    totals: dict[str, float] = defaultdict(float)
    for e in entries:
        if not isinstance(e, data.Transaction):
            continue
        if e.date < m_first or e.date > m_end:
            continue
        for p in e.postings:
            if p.units is None or p.units.currency != currency:
                continue
            if not (p.account.startswith(acct.expenses + ":") or p.account == acct.expenses):
                continue
            parts = p.account.split(":")
            category = parts[1] if len(parts) >= 2 else parts[0]
            totals[category] += float(p.units.number)

    return [
        {"category": cat, "total": round(amt, 2), "currency": currency}
        for cat, amt in sorted(totals.items(), key=lambda kv: -kv[1])
        if amt > 0
    ]
