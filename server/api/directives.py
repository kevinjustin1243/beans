import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from modules.auth import require_user
from modules.config import BEANCOUNT_FILE
from modules.ledger import get_ledger, delete_transaction

router = APIRouter(prefix="/api/directives", tags=["directives"], dependencies=[Depends(require_user)])

DIRECTIVE_TYPES = ("open", "close", "balance", "note", "price", "event", "pad", "commodity")


def _serialize_open(e) -> dict:
    return {
        "type": "open",
        "date": str(e.date),
        "account": e.account,
        "currencies": list(e.currencies or []),
        "booking": str(e.booking) if e.booking else None,
        "lineno": e.meta.get("lineno"),
    }


def _serialize_close(e) -> dict:
    return {
        "type": "close",
        "date": str(e.date),
        "account": e.account,
        "lineno": e.meta.get("lineno"),
    }


def _serialize_balance(e) -> dict:
    return {
        "type": "balance",
        "date": str(e.date),
        "account": e.account,
        "amount": str(e.amount.number),
        "currency": e.amount.currency,
        "lineno": e.meta.get("lineno"),
    }


def _serialize_note(e) -> dict:
    return {
        "type": "note",
        "date": str(e.date),
        "account": e.account,
        "comment": e.comment,
        "lineno": e.meta.get("lineno"),
    }


def _serialize_price(e) -> dict:
    return {
        "type": "price",
        "date": str(e.date),
        "currency": e.currency,
        "amount": str(e.amount.number),
        "amount_currency": e.amount.currency,
        "lineno": e.meta.get("lineno"),
    }


def _serialize_event(e) -> dict:
    return {
        "type": "event",
        "date": str(e.date),
        "event_type": e.type,
        "description": e.description,
        "lineno": e.meta.get("lineno"),
    }


def _serialize_pad(e) -> dict:
    return {
        "type": "pad",
        "date": str(e.date),
        "account": e.account,
        "source_account": e.source_account,
        "lineno": e.meta.get("lineno"),
    }


def _serialize_commodity(e) -> dict:
    return {
        "type": "commodity",
        "date": str(e.date),
        "currency": e.currency,
        "lineno": e.meta.get("lineno"),
    }


@router.get("")
def list_directives(type: Optional[str] = Query(None, description="Filter by directive type")):
    from beancount.core import data as bc

    if type and type not in DIRECTIVE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown type. Valid: {', '.join(DIRECTIVE_TYPES)}")

    try:
        entries, _, _ = get_ledger()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    type_map = {
        "open":      (bc.Open,      _serialize_open),
        "close":     (bc.Close,     _serialize_close),
        "balance":   (bc.Balance,   _serialize_balance),
        "note":      (bc.Note,      _serialize_note),
        "price":     (bc.Price,     _serialize_price),
        "event":     (bc.Event,     _serialize_event),
        "pad":       (bc.Pad,       _serialize_pad),
        "commodity": (bc.Commodity, _serialize_commodity),
    }

    result = []
    for type_name, (cls, serializer) in type_map.items():
        if type and type != type_name:
            continue
        for e in entries:
            if isinstance(e, cls):
                result.append(serializer(e))

    result.sort(key=lambda x: (x["date"], x.get("lineno") or 0))
    return {"directives": result}


def _append(text: str) -> None:
    path = Path(BEANCOUNT_FILE)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Beancount file not found: {BEANCOUNT_FILE}")
    with open(path, "a") as f:
        f.write("\n" + text + "\n")


class OpenIn(BaseModel):
    date: datetime.date
    account: str
    currencies: list[str] = []
    booking: Optional[str] = None


class CloseIn(BaseModel):
    date: datetime.date
    account: str


class BalanceIn(BaseModel):
    date: datetime.date
    account: str
    amount: str
    currency: str
    tolerance: Optional[str] = None


class NoteIn(BaseModel):
    date: datetime.date
    account: str
    comment: str


class PriceIn(BaseModel):
    date: datetime.date
    currency: str
    amount: str
    amount_currency: str


class EventIn(BaseModel):
    date: datetime.date
    event_type: str
    description: str


class PadIn(BaseModel):
    date: datetime.date
    account: str
    source_account: str


class CommodityIn(BaseModel):
    date: datetime.date
    currency: str


@router.post("/open", status_code=201)
def create_open(body: OpenIn):
    currencies = f"  {' '.join(body.currencies)}" if body.currencies else ""
    booking = f' "{body.booking}"' if body.booking else ""
    _append(f"{body.date} open {body.account}{currencies}{booking}")
    return {"ok": True}


@router.post("/close", status_code=201)
def create_close(body: CloseIn):
    _append(f"{body.date} close {body.account}")
    return {"ok": True}


@router.post("/balance", status_code=201)
def create_balance(body: BalanceIn):
    tolerance = f" ~ {body.tolerance}" if body.tolerance else ""
    _append(f"{body.date} balance {body.account}  {body.amount} {body.currency}{tolerance}")
    return {"ok": True}


@router.post("/note", status_code=201)
def create_note(body: NoteIn):
    _append(f'{body.date} note {body.account} "{body.comment}"')
    return {"ok": True}


@router.post("/price", status_code=201)
def create_price(body: PriceIn):
    _append(f"{body.date} price {body.currency}  {body.amount} {body.amount_currency}")
    return {"ok": True}


@router.post("/event", status_code=201)
def create_event(body: EventIn):
    _append(f'{body.date} event "{body.event_type}" "{body.description}"')
    return {"ok": True}


@router.post("/pad", status_code=201)
def create_pad(body: PadIn):
    _append(f"{body.date} pad {body.account}  {body.source_account}")
    return {"ok": True}


@router.post("/commodity", status_code=201)
def create_commodity(body: CommodityIn):
    _append(f"{body.date} commodity {body.currency}")
    return {"ok": True}


@router.delete("/{lineno}", status_code=204)
def delete_directive(lineno: int):
    try:
        delete_transaction(lineno)
    except (FileNotFoundError, IndexError) as e:
        raise HTTPException(status_code=404, detail=str(e))
