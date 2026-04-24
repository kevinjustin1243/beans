import datetime

from beancount.core import account_types, realization

from .ledger import get_ledger, _walk_real_account


def _account_type_prefix(options: dict) -> account_types.AccountTypes:
    return account_types.AccountTypes(
        options.get("name_assets", "Assets"),
        options.get("name_liabilities", "Liabilities"),
        options.get("name_equity", "Equity"),
        options.get("name_income", "Income"),
        options.get("name_expenses", "Expenses"),
    )


def _section(real_root, prefix: str) -> dict:
    node = realization.get(real_root, prefix)
    return _walk_real_account(node) if node else {"account": prefix, "balance": {}, "children": {}}


def _filter_by_date(entries, start=None, end=None):
    return [
        e for e in entries
        if hasattr(e, "date") and (start is None or e.date >= start) and (end is None or e.date <= end)
    ]


def trial_balance(username: str) -> list[dict]:
    entries, _, _ = get_ledger(username)
    real_root = realization.realize(entries)
    rows: list[dict] = []
    _flatten_real(real_root, rows)
    return rows


def _flatten_real(real_account, rows: list, depth: int = 0) -> None:
    balance = {pos.units.currency: str(pos.units.number) for pos in real_account.balance}
    if real_account.account or depth == 0:
        rows.append({"account": real_account.account or "(root)", "balance": balance, "depth": depth})
    for _, child in sorted(real_account.items()):
        _flatten_real(child, rows, depth + 1)


def balance_sheet(username: str, date: datetime.date | None = None) -> dict:
    entries, _, options = get_ledger(username)
    acct_types = _account_type_prefix(options)

    if date is None:
        date = datetime.date.today()

    filtered = _filter_by_date(entries, end=date)
    real_root = realization.realize(filtered)

    return {
        "date": str(date),
        "assets": _section(real_root, acct_types.assets),
        "liabilities": _section(real_root, acct_types.liabilities),
        "equity": _section(real_root, acct_types.equity),
    }


def income_statement(
    username: str,
    start: datetime.date | None = None,
    end: datetime.date | None = None,
) -> dict:
    entries, _, options = get_ledger(username)
    acct_types = _account_type_prefix(options)

    if end is None:
        end = datetime.date.today()
    if start is None:
        start = datetime.date(end.year, 1, 1)

    filtered = _filter_by_date(entries, start=start, end=end)
    real_root = realization.realize(filtered)

    return {
        "period": {"start": str(start), "end": str(end)},
        "income": _section(real_root, acct_types.income),
        "expenses": _section(real_root, acct_types.expenses),
    }
