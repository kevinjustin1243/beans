"""Yahoo Finance quote fetching using stdlib only."""
import datetime
import json
import urllib.parse
import urllib.request

YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; beans/0.1)"}


def fetch_quote(ticker: str) -> dict:
    """Return current quote: {ticker, price, currency, name, prev_close, change, change_percent}."""
    url = f"{YAHOO_BASE}/{urllib.parse.quote(ticker)}?range=1d&interval=1d"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.load(resp)

    err = data.get("chart", {}).get("error")
    if err:
        raise ValueError(err.get("description") or str(err))

    results = data["chart"].get("result")
    if not results:
        raise ValueError(f"No data for {ticker}")

    meta = results[0]["meta"]
    price = float(meta["regularMarketPrice"])
    prev = float(meta.get("previousClose") or meta.get("chartPreviousClose") or price)
    change = price - prev
    change_pct = (change / prev * 100) if prev else 0.0

    return {
        "ticker": meta["symbol"],
        "price": price,
        "currency": meta.get("currency", "USD"),
        "name": meta.get("longName") or meta.get("shortName") or meta["symbol"],
        "prev_close": prev,
        "change": change,
        "change_percent": change_pct,
    }


def fetch_history(ticker: str, range_: str = "1mo") -> list[dict]:
    """Return [{date, close}, ...] for the requested range."""
    valid = {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"}
    if range_ not in valid:
        range_ = "1mo"
    interval = "1d" if range_ in {"1mo", "3mo", "6mo", "1y", "ytd"} else "1d" if range_ == "5d" else "1wk"
    if range_ in {"2y", "5y", "10y", "max"}:
        interval = "1wk"

    url = f"{YAHOO_BASE}/{urllib.parse.quote(ticker)}?range={range_}&interval={interval}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.load(resp)

    err = data.get("chart", {}).get("error")
    if err:
        raise ValueError(err.get("description") or str(err))

    results = data["chart"].get("result")
    if not results:
        raise ValueError(f"No data for {ticker}")

    timestamps = results[0].get("timestamp") or []
    closes = results[0].get("indicators", {}).get("quote", [{}])[0].get("close") or []

    history = []
    for ts, close in zip(timestamps, closes):
        if close is None:
            continue
        date = datetime.datetime.utcfromtimestamp(ts).date().isoformat()
        history.append({"date": date, "close": float(close)})
    return history
