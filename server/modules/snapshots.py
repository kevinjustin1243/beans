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

from .db import get_conn
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


# ── Mark-to-market overlay for investments ────────────────────────────────────
#
# The Beancount ledger records investment positions at cost basis (the cash
# you transferred into the position). The Investments page tracks the same
# positions in Postgres with a live market price cache. To make the Overview's
# "Net worth" reflect today's actual wealth, we apply a one-off adjustment to
# the *current month's* snapshot:
#
#     adjustment_per_holding = (shares * current_price) - ledger_balance
#
# When the user records buys in beancount with a per-ticker asset account
# (e.g. ``Assets:Investments:VOO``), ``ledger_balance`` equals the cost basis
# and the adjustment is just the unrealized gain/loss. When the holding only
# exists in the Postgres table (no beancount account), ``ledger_balance`` is
# zero and the full market value is added. Either way we don't double-count.
#
# Past months keep ledger-only numbers because the quote cache only has the
# latest price; pretending current prices applied historically would be lying.


def _ledger_account_for_ticker(entries, ticker: str, asset_prefix: str) -> str | None:
    """Find the asset account that tracks ``ticker``, by suffix or ``ticker:`` meta."""
    target = ticker.upper()
    for e in entries:
        if not isinstance(e, data.Open):
            continue
        if e.account != asset_prefix and not e.account.startswith(asset_prefix + ":"):
            continue
        tail = e.account.rsplit(":", 1)[-1].upper()
        if tail == target:
            return e.account
        meta_ticker = (e.meta or {}).get("ticker")
        if isinstance(meta_ticker, str) and meta_ticker.upper() == target:
            return e.account
    return None


def _account_balance(real_root, account: str, currency: str) -> float:
    """Sum of the operating currency inside ``account`` (including children)."""
    node = realization.get(real_root, account)
    return _sum_currency(node, currency) if node else 0.0


def mark_to_market_overlay(username: str, entries, asset_prefix: str, currency: str) -> dict:
    """Return current-month investment mark-to-market summary.

    Result shape::

        {
          "adjustment":         float,   # total $ to add to assets / net worth
          "market_value":       float,   # market value of all holdings combined
          "ledger_value":       float,   # cost-basis sum recorded in the ledger
          "unrealized_gain":    float,   # market_value - ledger_value for matched lots
          "holdings": [
            {"ticker", "shares", "market_value", "ledger_balance",
             "account": str|None, "adjustment": float},
            ...
          ],
        }
    """
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT i.ticker, i.shares, i.cost_basis, q.price"
            " FROM investments i"
            " LEFT JOIN investment_quotes q ON q.ticker = i.ticker"
            " WHERE i.username = %s",
            (username,),
        ).fetchall()

    if not rows:
        return {"adjustment": 0.0, "market_value": 0.0, "ledger_value": 0.0,
                "unrealized_gain": 0.0, "holdings": []}

    real_root = realization.realize(entries)
    total_adj = 0.0
    total_market = 0.0
    total_ledger = 0.0
    holdings: list[dict] = []

    for row in rows:
        ticker = row["ticker"]
        shares = float(row["shares"])
        price = float(row["price"]) if row["price"] is not None else None
        if price is None:
            # No quote available — fall back to cost basis so the holding still
            # contributes something (mirrors the Investments-page fallback).
            price = float(row["cost_basis"])
        market_value = shares * price

        account = _ledger_account_for_ticker(entries, ticker, asset_prefix)
        ledger_balance = _account_balance(real_root, account, currency) if account else 0.0

        adjustment = market_value - ledger_balance
        total_adj += adjustment
        total_market += market_value
        total_ledger += ledger_balance
        holdings.append({
            "ticker": ticker,
            "shares": shares,
            "market_value": round(market_value, 2),
            "ledger_balance": round(ledger_balance, 2),
            "account": account,
            "adjustment": round(adjustment, 2),
        })

    return {
        "adjustment": round(total_adj, 2),
        "market_value": round(total_market, 2),
        "ledger_value": round(total_ledger, 2),
        "unrealized_gain": round(total_market - total_ledger, 2),
        "holdings": holdings,
    }


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

    # Compute the mark-to-market overlay once; it's only applied to the
    # current month (past months retain their ledger-only / cost-basis view).
    overlay = mark_to_market_overlay(username, entries, acct.assets, currency)

    snapshots = []
    for i in range(months):
        m_first = _add_months(start_first, i)
        m_end = _month_end(m_first)
        assets = _balance_at(entries, acct.assets, m_end, currency)
        liabilities_signed = _balance_at(entries, acct.liabilities, m_end, currency)
        # Beancount liabilities are stored as negative numbers — flip to magnitude.
        total_liab = -liabilities_signed

        is_current = m_first == current_first
        if is_current and overlay["adjustment"]:
            assets += overlay["adjustment"]

        snapshots.append({
            "month": m_first,
            "label": _short_label(m_first, current_year),
            "income": round(income_by_month.get(m_first, 0.0), 2),
            "spending": round(spend_by_month.get(m_first, 0.0), 2),
            "total_assets": round(assets, 2),
            "total_liabilities": round(total_liab, 2),
            "net_worth": round(assets + liabilities_signed, 2),
            "currency": currency,
            "mark_to_market": overlay if is_current else None,
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
