import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from modules.auth import require_user
from pydantic import BaseModel

from modules.config import BEANCOUNT_FILE
from modules.ledger import get_ledger, serialize_transaction, delete_transaction, replace_transaction
from beancount.core import data

router = APIRouter(prefix="/api/transactions", tags=["transactions"], dependencies=[Depends(require_user)])


class PostingIn(BaseModel):
    account: str
    amount: Optional[str] = None
    currency: Optional[str] = None


class TransactionIn(BaseModel):
    date: datetime.date
    flag: str = "*"
    payee: Optional[str] = None
    narration: str = ""
    tags: list[str] = []
    links: list[str] = []
    postings: list[PostingIn]


@router.get("")
def list_transactions(
    account: Optional[str] = Query(None, description="Filter by account name (substring match)"),
    payee: Optional[str] = Query(None, description="Filter by payee (case-insensitive substring)"),
    narration: Optional[str] = Query(None, description="Filter by narration (case-insensitive substring)"),
    start: Optional[datetime.date] = Query(None, description="Start date (inclusive)"),
    end: Optional[datetime.date] = Query(None, description="End date (inclusive)"),
    flag: Optional[str] = Query(None, description="Filter by flag (* or !)"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    try:
        entries, _, _ = get_ledger()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    txns = [e for e in entries if isinstance(e, data.Transaction)]

    if start:
        txns = [t for t in txns if t.date >= start]
    if end:
        txns = [t for t in txns if t.date <= end]
    if flag:
        txns = [t for t in txns if t.flag == flag]
    if tag:
        txns = [t for t in txns if tag in t.tags]
    if account:
        txns = [t for t in txns if any(account in p.account for p in t.postings)]
    if payee:
        lo = payee.lower()
        txns = [t for t in txns if t.payee and lo in t.payee.lower()]
    if narration:
        lo = narration.lower()
        txns = [t for t in txns if lo in t.narration.lower()]

    total = len(txns)
    page = txns[offset: offset + limit]
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "transactions": [serialize_transaction(t) for t in reversed(page)],
    }


@router.post("", status_code=201)
def create_transaction(body: TransactionIn):
    path = Path(BEANCOUNT_FILE)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Beancount file not found: {BEANCOUNT_FILE}")

    lines = [_format_transaction(body)]
    with open(path, "a") as f:
        f.write("\n" + lines[0] + "\n")

    return {"ok": True, "entry": lines[0]}


@router.put("/{lineno}")
def update_transaction(lineno: int, body: TransactionIn):
    try:
        replace_transaction(lineno, _format_transaction(body))
    except (FileNotFoundError, IndexError) as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"ok": True}


@router.delete("/{lineno}", status_code=204)
def remove_transaction(lineno: int):
    try:
        delete_transaction(lineno)
    except (FileNotFoundError, IndexError) as e:
        raise HTTPException(status_code=404, detail=str(e))


def _format_transaction(t: TransactionIn) -> str:
    tags = (" " + " ".join(f"#{tag}" for tag in t.tags)) if t.tags else ""
    links = (" " + " ".join(f"^{link}" for link in t.links)) if t.links else ""
    payee_part = f'"{t.payee}" ' if t.payee else ""
    header = f'{t.date} {t.flag} {payee_part}"{t.narration}"{tags}{links}'

    posting_lines = []
    for p in t.postings:
        if p.amount is not None and p.currency:
            posting_lines.append(f"  {p.account}  {p.amount} {p.currency}")
        else:
            posting_lines.append(f"  {p.account}")

    return header + "\n" + "\n".join(posting_lines)
