"""Watchlist: tickers a user is tracking but doesn't own.

Reuses the existing investment_quotes cache for price + sparkline. Each
entry can optionally carry ``alert_above`` / ``alert_below`` thresholds; the
list endpoint flips an ``alert_triggered`` flag client-side rendering can act on.
"""

from __future__ import annotations

import datetime
import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from modules.auth import require_user
from modules.db import get_conn
from modules.quotes import fetch_quote_with_spark

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])

CACHE_TTL = datetime.timedelta(minutes=15)


class WatchlistIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=20)
    note: Optional[str] = Field(default=None, max_length=200)


class WatchlistUpdate(BaseModel):
    note: Optional[str] = Field(default=None, max_length=200)
    alert_above: Optional[float] = Field(default=None, ge=0)
    alert_below: Optional[float] = Field(default=None, ge=0)


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
        q = fetch_quote_with_spark(ticker)
    except Exception:
        return row  # Network failure: keep showing the stale row.

    conn.execute(
        """
        INSERT INTO investment_quotes
          (ticker, price, currency, name, prev_close, change, change_percent, fetched_at, spark)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (ticker) DO UPDATE SET
          price          = EXCLUDED.price,
          currency       = EXCLUDED.currency,
          name           = EXCLUDED.name,
          prev_close     = EXCLUDED.prev_close,
          change         = EXCLUDED.change,
          change_percent = EXCLUDED.change_percent,
          fetched_at     = EXCLUDED.fetched_at,
          spark          = EXCLUDED.spark
        """,
        (ticker, q["price"], q["currency"], q["name"],
         q["prev_close"], q["change"], q["change_percent"], _utcnow(),
         json.dumps(q["spark"])),
    )
    return conn.execute(
        "SELECT * FROM investment_quotes WHERE ticker = %s", (ticker,)
    ).fetchone()


def _parse_spark(raw) -> list[float]:
    if not raw:
        return []
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
        return [float(x) for x in data]
    except (ValueError, TypeError):
        return []


def _alert_triggered(price: Optional[float], above: Optional[float], below: Optional[float]) -> bool:
    if price is None:
        return False
    if above is not None and price >= above:
        return True
    if below is not None and price <= below:
        return True
    return False


@router.get("")
def list_watchlist(username: str = Depends(require_user)):
    """Watchlist entries with latest cached quote, sparkline, and alert state."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, ticker, note, alert_above, alert_below"
            " FROM watchlist WHERE username = %s ORDER BY ticker",
            (username,),
        ).fetchall()
        result = []
        for r in rows:
            q = _refresh_quote(conn, r["ticker"])
            price = float(q["price"]) if q and q["price"] is not None else None
            above = float(r["alert_above"]) if r["alert_above"] is not None else None
            below = float(r["alert_below"]) if r["alert_below"] is not None else None
            result.append({
                "id": r["id"],
                "ticker": r["ticker"],
                "note": r["note"],
                "name": q["name"] if q else None,
                "price": price,
                "change": float(q["change"]) if q and q["change"] is not None else None,
                "change_percent": float(q["change_percent"]) if q and q["change_percent"] is not None else None,
                "currency": q["currency"] if q else "USD",
                "spark": _parse_spark(q["spark"]) if q else [],
                "alert_above": above,
                "alert_below": below,
                "alert_triggered": _alert_triggered(price, above, below),
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
            raise HTTPException(status_code=409, detail=f"Already on watchlist: {ticker}") from e
        _refresh_quote(conn, ticker)
    return {"id": new_id, "ticker": ticker}


@router.put("/{entry_id}")
def update_ticker(entry_id: str, body: WatchlistUpdate, username: str = Depends(require_user)):
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE watchlist SET note = %s, alert_above = %s, alert_below = %s"
            " WHERE id = %s AND username = %s",
            (body.note, body.alert_above, body.alert_below, entry_id, username),
        )
        rowcount = cur.rowcount
    if rowcount == 0:
        raise HTTPException(status_code=404, detail="Watchlist entry not found")
    return {"ok": True}


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
