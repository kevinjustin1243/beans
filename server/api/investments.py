import datetime
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from modules.auth import require_user
from modules.db import get_conn
from modules.portfolio import analyze_portfolio
from modules.quotes import fetch_history, fetch_quote

router = APIRouter(prefix="/api/investments", tags=["investments"])

CACHE_TTL = datetime.timedelta(minutes=15)


def _utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.UTC)


def _refresh_quote(conn, ticker: str, force: bool = False):
    row = conn.execute(
        "SELECT * FROM investment_quotes WHERE ticker = %s",
        (ticker,),
    ).fetchone()

    if not force and row and row["fetched_at"]:
        fetched = row["fetched_at"]
        if fetched.tzinfo is None:
            fetched = fetched.replace(tzinfo=datetime.UTC)
        if _utcnow() - fetched < CACHE_TTL:
            return row

    try:
        q = fetch_quote(ticker)
    except Exception:
        return row

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
        "SELECT * FROM investment_quotes WHERE ticker = %s",
        (ticker,),
    ).fetchone()


class InvestmentIn(BaseModel):
    ticker: str
    shares: float
    cost_basis: float
    name: Optional[str] = None
    asset_type: Optional[str] = None  # stock | etf | bond | crypto | cash | other
    sector: Optional[str] = None


def _serialize(inv, quote) -> dict:
    price = quote["price"] if quote else None
    shares = inv["shares"]
    cost = inv["cost_basis"] * shares
    value = price * shares if price is not None else None
    gain = (value - cost) if value is not None else None
    gain_pct = (gain / cost * 100) if (gain is not None and cost) else None
    day_change = (quote["change"] * shares) if quote and quote["change"] is not None else None
    fetched_at = quote["fetched_at"] if quote else None

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
        "fetched_at": fetched_at.isoformat() if isinstance(fetched_at, datetime.datetime) else fetched_at,
        "asset_type": inv["asset_type"] if "asset_type" in inv.keys() else None,
        "sector": inv["sector"] if "sector" in inv.keys() else None,
    }


@router.get("")
def list_investments(refresh: bool = Query(False), username: str = Depends(require_user)):
    with get_conn() as conn:
        invs = conn.execute(
            "SELECT * FROM investments WHERE username = %s ORDER BY ticker",
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
            "INSERT INTO investments (id, username, ticker, shares, cost_basis, name, asset_type, sector)"
            " VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (inv_id, username, ticker, body.shares, body.cost_basis, body.name,
             body.asset_type, body.sector),
        )
        _refresh_quote(conn, ticker, force=True)
    return {"id": inv_id}


@router.put("/{inv_id}")
def update_investment(inv_id: str, body: InvestmentIn, username: str = Depends(require_user)):
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE investments SET ticker=%s, shares=%s, cost_basis=%s, name=%s,"
            " asset_type=%s, sector=%s WHERE id=%s AND username=%s",
            (body.ticker.upper().strip(), body.shares, body.cost_basis, body.name,
             body.asset_type, body.sector, inv_id, username),
        )
        rowcount = cur.rowcount
    if rowcount == 0:
        raise HTTPException(status_code=404, detail="Investment not found")
    return {"ok": True}


@router.get("/sector-allocation")
def sector_allocation(username: str = Depends(require_user)):
    """Weighted-by-current-value sector breakdown of the user's holdings.

    Uses ``current_price * shares`` per holding, falling back to
    ``cost_basis * shares`` when no quote is cached. Unlabelled holdings are
    bucketed under "Unspecified" so the chart accounts for every dollar.
    """
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT i.sector, i.asset_type, i.cost_basis, i.shares, q.price"
            " FROM investments i"
            " LEFT JOIN investment_quotes q ON q.ticker = i.ticker"
            " WHERE i.username = %s",
            (username,),
        ).fetchall()

    by_sector: dict[str, float] = {}
    total = 0.0
    for r in rows:
        shares = float(r["shares"])
        price = r["price"]
        value = float(price) * shares if price is not None else float(r["cost_basis"]) * shares
        sector = r["sector"] or "Unspecified"
        by_sector[sector] = by_sector.get(sector, 0.0) + value
        total += value

    items = sorted(
        (
            {
                "sector": s,
                "value": round(v, 2),
                "percent": round(v / total * 100, 2) if total > 0 else 0.0,
            }
            for s, v in by_sector.items()
        ),
        key=lambda x: -x["value"],
    )
    return {"total": round(total, 2), "sectors": items}


@router.delete("/{inv_id}", status_code=204)
def delete_investment(inv_id: str, username: str = Depends(require_user)):
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM investments WHERE id = %s AND username = %s",
            (inv_id, username),
        )


@router.get("/analysis")
def portfolio_analysis(username: str = Depends(require_user)):
    """Full portfolio metrics: Sharpe, beta, correlation, MV-optimized weights.

    Pulls 1 year of daily closes per held ticker from Yahoo via the existing
    quotes helper, computes per-stock and aggregate metrics in
    ``modules.portfolio``, and surfaces a set of rule-based recommendations
    (concentration, correlated holdings, rebalance opportunities, etc.).
    """
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT ticker, shares, cost_basis FROM investments WHERE username = %s",
            (username,),
        ).fetchall()

    holdings = [
        {"symbol": r["ticker"], "shares": float(r["shares"]), "avg_cost": float(r["cost_basis"])}
        for r in rows
    ]
    return analyze_portfolio(holdings)


@router.get("/{ticker}/history")
def history(ticker: str, range: str = Query("1mo"), username: str = Depends(require_user)):
    try:
        hist = fetch_history(ticker.upper(), range)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch history: {e}")
    return {"ticker": ticker.upper(), "range": range, "history": hist}
