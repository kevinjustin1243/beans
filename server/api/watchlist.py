"""Watchlist: tickers a user is tracking but doesn't own.

Reuses the existing investment_quotes cache (populated by modules.quotes), so
no new external integration. /prices returns one row per watchlist entry with
the latest cached quote, refreshing any stale entries (>15 min) in-line.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from modules.auth import require_user
from modules.db import get_conn
from modules.quotes import fetch_quote

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])

CACHE_TTL = datetime.timedelta(minutes=15)


class WatchlistIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=20)
    note: Optional[str] = Field(default=None, max_length=200)


def _utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.UTC)


def _refresh_quote(conn, ticker: str) -> Optional[dict]:
    """Same cache strategy as investments.py — share one quote per ticker."""
    row = conn.execute(
        "SELECT * FROM investment_quotes WHERE ticker = %s", (ticker,)
    ).fetchone()

    if row and row["fetched_at"]:
        fetched = row["fetched_at"]
        if fetched.tzinfo is None:
            fetched = fetched.replace(tzinfo=datetime.UTC)
        if _utcnow() - fetched < CACHE_TTL:
            return row

    try:
        q = fetch_quote(ticker)
    except Exception:
        return row  # Network failure: keep showing the stale row.

    conn.execute(
        """
        INSERT INTO investment_quotes
          (ticker, price, currency, name, prev_close, change, change_percent, fetched_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (ticker) DO UPDATE SET
          price          = EXCLUDED.price,
          currency       = EXCLUDED.currency,
          name           = EXCLUDED.name,
          prev_close     = EXCLUDED.prev_close,
          change         = EXCLUDED.change,
          change_percent = EXCLUDED.change_percent,
          fetched_at     = EXCLUDED.fetched_at
        """,
        (ticker, q["price"], q["currency"], q["name"],
         q["prev_close"], q["change"], q["change_percent"], _utcnow()),
    )
    return conn.execute(
        "SELECT * FROM investment_quotes WHERE ticker = %s", (ticker,)
    ).fetchone()


@router.get("")
def list_watchlist(username: str = Depends(require_user)):
    """Watchlist entries with latest cached quote attached."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, ticker, note FROM watchlist WHERE username = %s ORDER BY ticker",
            (username,),
        ).fetchall()
        result = []
        for r in rows:
            q = _refresh_quote(conn, r["ticker"])
            result.append({
                "id": r["id"],
                "ticker": r["ticker"],
                "note": r["note"],
                "name": q["name"] if q else None,
                "price": float(q["price"]) if q and q["price"] is not None else None,
                "change": float(q["change"]) if q and q["change"] is not None else None,
                "change_percent": float(q["change_percent"]) if q and q["change_percent"] is not None else None,
                "currency": q["currency"] if q else "USD",
            })
    return {"watchlist": result}


@router.post("", status_code=201)
def add_ticker(body: WatchlistIn, username: str = Depends(require_user)):
    ticker = body.ticker.upper().strip()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker required")
    new_id = str(uuid.uuid4())
    with get_conn() as conn:
        try:
            conn.execute(
                "INSERT INTO watchlist (id, username, ticker, note) VALUES (%s, %s, %s, %s)",
                (new_id, username, ticker, body.note),
            )
        except Exception as e:
            # Likely UNIQUE (username, ticker). Surface a clean 409 instead of 500.
            raise HTTPException(status_code=409, detail=f"Already on watchlist: {ticker}") from e
        _refresh_quote(conn, ticker)
    return {"id": new_id, "ticker": ticker}


@router.delete("/{entry_id}", status_code=204)
def remove_ticker(entry_id: str, username: str = Depends(require_user)):
    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM watchlist WHERE id = %s AND username = %s",
            (entry_id, username),
        )
        rowcount = cur.rowcount
    if rowcount == 0:
        raise HTTPException(status_code=404, detail="Watchlist entry not found")
