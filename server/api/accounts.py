import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from modules.auth import require_user
from modules.config import BEANCOUNT_FILE
from modules.ledger import get_ledger, get_balances, _walk_real_account
from beancount.core import getters, realization

router = APIRouter(prefix="/api/accounts", tags=["accounts"], dependencies=[Depends(require_user)])


@router.get("")
def list_accounts():
    try:
        entries, _, _ = get_ledger()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    accounts = sorted(getters.get_accounts(entries))
    return {"accounts": accounts}


@router.get("/balances")
def account_balances():
    try:
        return get_balances()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{account_name:path}/balance")
def account_balance(account_name: str):
    try:
        entries, _, _ = get_ledger()
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
def opening_balance(body: OpeningBalanceIn):
    try:
        entries, _, _ = get_ledger()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    existing = getters.get_accounts(entries)
    balance_date = body.date + datetime.timedelta(days=1)
    lines: list[str] = []

    if EQUITY_OPENING not in existing:
        lines.append(f"{body.date} open {EQUITY_OPENING}  {body.currency}\n")
    if body.account not in existing:
        lines.append(f"{body.date} open {body.account}  {body.currency}\n")

    lines.append(f"{body.date} pad  {body.account}  {EQUITY_OPENING}\n")
    lines.append(f"{balance_date} balance {body.account}  {body.amount} {body.currency}\n")

    with open(BEANCOUNT_FILE, "a") as f:
        f.write("\n" + "".join(lines))

    return {"ok": True}
