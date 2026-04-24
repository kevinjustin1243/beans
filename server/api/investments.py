import datetime
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from modules.auth import require_user
from modules.db import get_conn
from modules.quotes import fetch_history, fetch_quote

router = APIRouter(prefix="/api/investments", tags=["investments"])

CACHE_TTL = datetime.timedelta(minutes=15)


class InvestmentIn(BaseModel):
    ticker: str
    shares: float
    cost_basis: float
    name: Optional[str] = None


def _refresh_quote(conn, ticker: str, force: bool = False):
    row = conn.execute("SELECT * FROM investment_quotes WHERE ticker = ?", (ticker,)).fetchone()

    if not force and row and row["fetched_at"]:
        try:
            fetched = datetime.datetime.fromisoformat(row["fetched_at"])
            if datetime.datetime.utcnow() - fetched < CACHE_TTL:
                return row
        except ValueError:
            pass

    try:
        q = fetch_quote(ticker)
    except Exception:
        return row

    now = datetime.datetime.utcnow().isoformat()
    conn.execute(
        """
        INSERT INTO investment_quotes
          (ticker, price, currency, name, prev_close, change, change_percent, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(ticker) DO UPDATE SET
          price          = excluded.price,
          currency       = excluded.currency,
          name           = excluded.name,
          prev_close     = excluded.prev_close,
          change         = excluded.change,
          change_percent = excluded.change_percent,
          fetched_at     = excluded.fetched_at
        """,
        (ticker, q["price"], q["currency"], q["name"],
         q["prev_close"], q["change"], q["change_percent"], now),
    )
    conn.commit()
    return conn.execute("SELECT * FROM investment_quotes WHERE ticker = ?", (ticker,)).fetchone()


def _serialize(inv, quote) -> dict:
    price = quote["price"] if quote else None
    shares = inv["shares"]
    cost = inv["cost_basis"] * shares
    value = price * shares if price is not None else None
    gain = (value - cost) if value is not None else None
    gain_pct = (gain / cost * 100) if (gain is not None and cost) else None
    day_change = (quote["change"] * shares) if quote and quote["change"] is not None else None

    return {
        "id": inv["id"],
        "ticker": inv["ticker"],
        "name": (quote["name"] if quote and quote["name"] else inv["name"]) or inv["ticker"],
        "shares": shares,
        "cost_basis": inv["cost_basis"],
        "total_cost": cost,
        "current_price": price,
        "current_value": value,
        "gain": gain,
        "gain_percent": gain_pct,
        "day_change": day_change,
        "day_change_percent": quote["change_percent"] if quote else None,
        "currency": quote["currency"] if quote else "USD",
        "fetched_at": quote["fetched_at"] if quote else None,
    }


@router.get("")
def list_investments(refresh: bool = Query(False), username: str = Depends(require_user)):
    with get_conn() as conn:
        invs = conn.execute(
            "SELECT * FROM investments WHERE user = ? ORDER BY ticker",
            (username,),
        ).fetchall()
        results = [_serialize(inv, _refresh_quote(conn, inv["ticker"], force=refresh)) for inv in invs]
    return {"investments": results}


@router.post("", status_code=201)
def add_investment(body: InvestmentIn, username: str = Depends(require_user)):
    inv_id = str(uuid.uuid4())
    ticker = body.ticker.upper().strip()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker required")
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO investments (id, user, ticker, shares, cost_basis, name)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (inv_id, username, ticker, body.shares, body.cost_basis, body.name),
        )
        conn.commit()
        _refresh_quote(conn, ticker, force=True)
    return {"id": inv_id}


@router.put("/{inv_id}")
def update_investment(inv_id: str, body: InvestmentIn, username: str = Depends(require_user)):
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE investments SET ticker=?, shares=?, cost_basis=?, name=?"
            " WHERE id=? AND user=?",
            (body.ticker.upper().strip(), body.shares, body.cost_basis, body.name, inv_id, username),
        )
        conn.commit()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Investment not found")
    return {"ok": True}


@router.delete("/{inv_id}", status_code=204)
def delete_investment(inv_id: str, username: str = Depends(require_user)):
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM investments WHERE id = ? AND user = ?",
            (inv_id, username),
        )
        conn.commit()


@router.get("/{ticker}/history")
def history(ticker: str, range: str = Query("1mo"), username: str = Depends(require_user)):
    try:
        hist = fetch_history(ticker.upper(), range)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch history: {e}")
    return {"ticker": ticker.upper(), "range": range, "history": hist}
