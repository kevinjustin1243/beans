import datetime
import decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from modules.auth import require_user
from modules.config import get_user_ledger
from modules.ledger import get_ledger, get_balances
from beancount.core import getters, realization

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("")
def list_accounts(username: str = Depends(require_user)):
    try:
        entries, _, _ = get_ledger(username)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    accounts = sorted(getters.get_accounts(entries))
    return {"accounts": accounts}


@router.get("/balances")
def account_balances(username: str = Depends(require_user)):
    try:
        return get_balances(username)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{account_name:path}/balance")
def account_balance(account_name: str, username: str = Depends(require_user)):
    try:
        entries, _, _ = get_ledger(username)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    real_root = realization.realize(entries)
    node = realization.get(real_root, account_name)
    if node is None:
        raise HTTPException(status_code=404, detail=f"Account not found: {account_name}")

    balance = {
        pos.units.currency: str(pos.units.number)
        for pos in node.balance
    }
    return {"account": account_name, "balance": balance}


class OpeningBalanceIn(BaseModel):
    account: str
    currency: str
    amount: str
    date: datetime.date


EQUITY_OPENING = "Equity:Opening-Balances"


@router.post("/opening-balance", status_code=201)
def opening_balance(body: OpeningBalanceIn, username: str = Depends(require_user)):
    """Open an account and (optionally) seed it with a pad+balance assertion.

    Two refinements over a naive "always write pad+balance":

    - If ``amount`` is zero, skip the pad+balance pair entirely — Beancount
      would otherwise flag the pad as unused (a freshly opened account is
      already at zero, so the pad has nothing to fill).
    - For ``Liabilities:*`` accounts we treat a positive user-entered amount
      as a debt and flip the sign before writing. Beancount represents
      liabilities as negative balances; the UI just asks "how much do you
      owe" without making the user think about ledger sign conventions.
    """
    try:
        entries, _, _ = get_ledger(username)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    try:
        amount = decimal.Decimal(body.amount)
    except (decimal.InvalidOperation, TypeError):
        raise HTTPException(status_code=400, detail=f"Invalid amount: {body.amount!r}")

    existing = getters.get_accounts(entries)
    lines: list[str] = []

    if EQUITY_OPENING not in existing:
        lines.append(f"{body.date} open {EQUITY_OPENING}  {body.currency}\n")
    if body.account not in existing:
        lines.append(f"{body.date} open {body.account}  {body.currency}\n")

    if amount != 0:
        if body.account.startswith("Liabilities:") and amount > 0:
            amount = -amount
        balance_date = body.date + datetime.timedelta(days=1)
        lines.append(f"{body.date} pad  {body.account}  {EQUITY_OPENING}\n")
        lines.append(f"{balance_date} balance {body.account}  {amount} {body.currency}\n")

    if not lines:
        # Account already existed and the caller asked for $0 — nothing to do.
        return {"ok": True, "noop": True}

    ledger_path = get_user_ledger(username)
    with open(ledger_path, "a") as f:
        f.write("\n" + "".join(lines))

    return {"ok": True}
