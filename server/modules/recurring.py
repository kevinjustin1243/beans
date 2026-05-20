"""Recurring-payment detection from beancount transactions.

Instead of a dedicated ``subscriptions`` table, we infer recurring payments
from the ledger: group transactions by payee (case-folded) + the **expense
category** they hit, look for at least 3 occurrences with a near-monthly
cadence, then emit them as if they were rows in a subscription table.

Used by:
- the "upcoming bills" widget on the dashboard (active recurring with the
  next due date projected as ``last_date + median_interval``)
- the "cancel unused subscriptions" optimization (inactive recurring where
  the most recent charge is older than ``inactive_after_days``)
"""

from __future__ import annotations

import datetime
import statistics
from collections import defaultdict
from typing import Optional

from beancount.core import account_types, data

from .ledger import get_ledger


_MONTHLY_DAYS = (25, 35)   # Treat 25-35 day cadence as "monthly"
_WEEKLY_DAYS = (6, 8)


def _category(account: str) -> str:
    parts = account.split(":")
    return parts[1] if len(parts) >= 2 else parts[0]


def detect_recurring(
    username: str,
    lookback_days: int = 365,
    min_occurrences: int = 3,
    inactive_after_days: int = 90,
) -> list[dict]:
    """Scan the ledger and return one row per detected recurring payment.

    Each row::

        {
          "name":              str,           # display name (payee or first word of narration)
          "amount":            float,         # median magnitude per charge
          "currency":          str,
          "category":          str,           # second segment of the expense account
          "cadence":           "monthly" | "weekly" | "irregular",
          "interval_days":     int,           # median days between charges
          "count":             int,           # number of observed charges in lookback
          "last_date":         "YYYY-MM-DD",
          "days_since_last":   int,
          "next_due_date":     "YYYY-MM-DD",  # last_date + interval_days
          "active":            bool,          # last charge within 1.5x interval
        }
    """
    entries, _errors, options = get_ledger(username)
    acct = account_types.AccountTypes(
        options.get("name_assets", "Assets"),
        options.get("name_liabilities", "Liabilities"),
        options.get("name_equity", "Equity"),
        options.get("name_income", "Income"),
        options.get("name_expenses", "Expenses"),
    )

    today = datetime.date.today()
    cutoff = today - datetime.timedelta(days=lookback_days)

    # Group by (key, expense_category) where key is payee (lowercased) or narration's first word.
    groups: dict[tuple[str, str], list[tuple[datetime.date, float, str, str]]] = defaultdict(list)
    for e in entries:
        if not isinstance(e, data.Transaction):
            continue
        if e.date < cutoff:
            continue

        expense_postings = [
            p for p in e.postings
            if p.units is not None
            and (p.account.startswith(acct.expenses + ":") or p.account == acct.expenses)
        ]
        if not expense_postings:
            continue
        # If the transaction touches multiple expense lines we attribute the
        # charge to the first one — recurring services usually only hit one.
        ep = expense_postings[0]

        key_name = (e.payee or "").strip()
        if not key_name:
            key_name = (e.narration or "").strip().split(" ", 1)[0]
        if not key_name:
            continue
        key = key_name.lower()
        category = _category(ep.account)
        groups[(key, category)].append(
            (e.date, float(ep.units.number), ep.units.currency, key_name)
        )

    results = []
    for (_key, category), occurrences in groups.items():
        if len(occurrences) < min_occurrences:
            continue

        occurrences.sort(key=lambda t: t[0])
        dates = [o[0] for o in occurrences]
        amounts = [o[1] for o in occurrences]
        currency = occurrences[-1][2]
        display_name = occurrences[-1][3]

        intervals = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
        median_iv = int(statistics.median(intervals)) if intervals else 0

        cadence = _classify_cadence(median_iv)
        if cadence == "irregular":
            # Skip irregular spend to avoid noisy false positives — only true
            # recurring bills (monthly/weekly) belong in the bills widget.
            continue

        last = dates[-1]
        days_since = (today - last).days
        active = days_since <= max(int(median_iv * 1.5), 14)
        if days_since > inactive_after_days and not active:
            # Still emit as "inactive" so cancel-unused can pick it up.
            active = False

        median_amount = round(statistics.median(amounts), 2)
        next_due = last + datetime.timedelta(days=median_iv) if median_iv else last

        results.append({
            "name": display_name,
            "amount": median_amount,
            "currency": currency,
            "category": category,
            "cadence": cadence,
            "interval_days": median_iv,
            "count": len(occurrences),
            "last_date": last.isoformat(),
            "days_since_last": days_since,
            "next_due_date": next_due.isoformat(),
            "active": active,
        })

    results.sort(key=lambda r: (not r["active"], r["next_due_date"]))
    return results


def _classify_cadence(days: int) -> str:
    if _MONTHLY_DAYS[0] <= days <= _MONTHLY_DAYS[1]:
        return "monthly"
    if _WEEKLY_DAYS[0] <= days <= _WEEKLY_DAYS[1]:
        return "weekly"
    return "irregular"


def upcoming_bills(username: str, limit: int = 5) -> list[dict]:
    """Active recurring payments sorted by next due date, oldest first.

    Returns rows shaped for the dashboard upcoming-bills widget.
    """
    today = datetime.date.today()
    rows = [r for r in detect_recurring(username) if r["active"]]
    rows.sort(key=lambda r: r["next_due_date"])
    bills = []
    for r in rows[:limit]:
        due = datetime.date.fromisoformat(r["next_due_date"])
        days_until = (due - today).days
        bills.append({
            "name": r["name"],
            "amount": r["amount"],
            "currency": r["currency"],
            "category": r["category"],
            "due_date": r["next_due_date"],
            "days_until": days_until,
        })
    return bills


def inactive_recurring(username: str, threshold_days: int = 90) -> list[dict]:
    """Recurring payments whose last charge is older than ``threshold_days``.

    Candidates for the "cancel unused subscription" optimization.
    """
    return [
        r for r in detect_recurring(username)
        if (not r["active"]) and r["days_since_last"] >= threshold_days
    ]
