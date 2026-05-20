"""Portfolio analytics: volatility, Sharpe, beta, correlation, optimization.

Ported from FinanceEagle's ``stock_analysis.py`` with two adjustments for
this codebase:

1. **Data source.** We reuse ``modules.quotes.fetch_history`` (stdlib urllib,
   no httpx dep) to pull a 1-year window of daily closes per ticker — the
   same Yahoo v8 chart endpoint, just via the helpers we already have.

2. **Holdings input.** Callers pass the user's investment rows as
   ``[{symbol, shares, avg_cost}]``; the assembly + caching happens in the
   ``/api/investments/analysis`` router.

Returned shape matches what FinanceEagle's frontend consumes:
``{per_stock, portfolio, correlation, optimization, recommendations}``.
"""

from __future__ import annotations

import math

import numpy as np

from .quotes import fetch_history

# Standard trading days / year for annualization.
TRADING_DAYS = 252
# Approximate U.S. T-bill rate (annualized) — used in Sharpe-ratio math.
RISK_FREE_RATE = 0.043
# 1-year window of daily closes is enough to be meaningful while keeping
# the API call cheap. Stocks with <20 valid closes are dropped.
MIN_CLOSES = 20
# Monte-Carlo sample size for the optimization step. 10k random portfolios
# is fast (~10ms) and converges close enough to the true optimum for a
# dashboard recommendation.
MC_SAMPLES = 10_000


def _closes(ticker: str) -> list[float]:
    """Return 1-year daily closes for ``ticker``, or an empty list on failure."""
    try:
        history = fetch_history(ticker, range_="1y")
    except Exception:
        return []
    return [float(h["close"]) for h in history if h.get("close") is not None]


def _daily_log_returns(closes: list[float]) -> np.ndarray:
    arr = np.asarray(closes, dtype=float)
    return np.diff(np.log(arr))


def _per_stock_metrics(returns: np.ndarray, price: float) -> dict:
    ann_vol = float(np.std(returns) * math.sqrt(TRADING_DAYS) * 100)
    ann_ret = float(np.mean(returns) * TRADING_DAYS * 100)
    sharpe = ((ann_ret / 100) - RISK_FREE_RATE) / (ann_vol / 100) if ann_vol > 0 else 0.0

    # Max drawdown — worst peak-to-trough on the cumulative return curve.
    cum = np.cumprod(1 + returns)
    peak = np.maximum.accumulate(cum)
    drawdown = (cum - peak) / peak
    max_dd = float(np.min(drawdown) * 100)

    return {
        "price": round(price, 2),
        "annualized_return": round(ann_ret, 2),
        "volatility": round(ann_vol, 2),
        "sharpe_ratio": round(sharpe, 2),
        "max_drawdown": round(max_dd, 2),
    }


def _beta(stock_returns: np.ndarray, bench_returns: np.ndarray) -> float:
    """Cov(stock, market) / Var(market). Defaults to 1.0 when undefined."""
    n = min(len(stock_returns), len(bench_returns))
    if n < MIN_CLOSES:
        return 1.0
    cov = np.cov(stock_returns[-n:], bench_returns[-n:])
    if cov[1, 1] == 0:
        return 1.0
    return float(cov[0, 1] / cov[1, 1])


def _diversification_score(weights: np.ndarray, cov_matrix: np.ndarray) -> int:
    """0-100 score combining Herfindahl concentration with avg pairwise correlation."""
    n = len(weights)
    if n <= 1:
        return 20

    hhi = float(np.sum(weights ** 2))
    concentration = (hhi - 1 / n) / (1 - 1 / n) if n > 1 else 1.0

    vols = np.sqrt(np.diag(cov_matrix))
    if np.all(vols > 0):
        corr = cov_matrix / np.outer(vols, vols)
        mask = ~np.eye(n, dtype=bool)
        avg_corr = float(np.mean(np.abs(corr[mask])))
    else:
        avg_corr = 0.5

    score = 100 * (1 - 0.5 * concentration - 0.5 * avg_corr)
    return max(10, min(100, round(score)))


def _optimize_weights(
    symbols: list[str],
    return_matrix: np.ndarray,
    cov_matrix: np.ndarray,
    current_weights: np.ndarray,
) -> list[dict]:
    """Monte Carlo over random weight vectors; pick the one with the highest Sharpe."""
    n = len(symbols)
    if n <= 1:
        return [{"symbol": symbols[0], "current_weight": 100.0, "optimal_weight": 100.0}]

    mean_returns = np.mean(return_matrix, axis=1) * TRADING_DAYS
    best_sharpe = -math.inf
    best_w = current_weights.copy()

    rng = np.random.default_rng(42)  # Fixed seed for reproducibility.
    for _ in range(MC_SAMPLES):
        w = rng.random(n)
        w /= w.sum()
        port_ret = float(np.dot(w, mean_returns))
        port_vol = float(np.sqrt(np.dot(w, np.dot(cov_matrix, w))))
        if port_vol > 0:
            sharpe = (port_ret - RISK_FREE_RATE) / port_vol
            if sharpe > best_sharpe:
                best_sharpe = sharpe
                best_w = w

    return [
        {
            "symbol": sym,
            "current_weight": round(float(current_weights[i]) * 100, 1),
            "optimal_weight": round(float(best_w[i]) * 100, 1),
        }
        for i, sym in enumerate(symbols)
    ]


def _recommendations(
    per_stock: list[dict],
    portfolio: dict,
    correlation: list[dict],
    optimization: list[dict],
    weights: np.ndarray,
    symbols: list[str],
) -> list[dict]:
    recs: list[dict] = []

    high_vol = [s for s in per_stock if s["volatility"] > 35]
    if high_vol:
        names = ", ".join(s["symbol"] for s in high_vol)
        recs.append({
            "type": "risk",
            "title": "High volatility holdings",
            "description": (
                f"{names} {'has' if len(high_vol) == 1 else 'have'} annualized "
                "volatility above 35%. Consider trimming or hedging."
            ),
            "priority": "high",
        })

    poor_sharpe = [s for s in per_stock if s["sharpe_ratio"] < 0]
    if poor_sharpe:
        names = ", ".join(s["symbol"] for s in poor_sharpe)
        recs.append({
            "type": "performance",
            "title": "Negative risk-adjusted returns",
            "description": (
                f"{names} {'has' if len(poor_sharpe) == 1 else 'have'} a negative "
                "Sharpe ratio — returns aren't compensating for the risk taken."
            ),
            "priority": "high",
        })

    max_weight = float(np.max(weights)) * 100 if len(weights) else 0.0
    if max_weight > 40 and len(symbols) > 1:
        top_sym = symbols[int(np.argmax(weights))]
        recs.append({
            "type": "diversification",
            "title": "Portfolio concentration",
            "description": (
                f"{top_sym} is {max_weight:.0f}% of your portfolio. "
                "Consider broadening to reduce single-name risk."
            ),
            "priority": "medium",
        })

    high_corr = [c for c in correlation if c["correlation"] > 0.75]
    if high_corr:
        pairs = ", ".join(c["pair"] for c in high_corr[:3])
        recs.append({
            "type": "diversification",
            "title": "Highly correlated holdings",
            "description": (
                f"{pairs} move closely together (correlation > 0.75), "
                "which reduces the benefit of diversification."
            ),
            "priority": "medium",
        })

    if portfolio.get("beta", 1.0) > 1.3:
        beta = portfolio["beta"]
        recs.append({
            "type": "risk",
            "title": "High market sensitivity",
            "description": (
                f"Portfolio beta of {beta:.2f} means it moves about "
                f"{int((beta - 1) * 100)}% more than the market. "
                "Adding low-beta or bond exposure would temper drawdowns."
            ),
            "priority": "medium",
        })

    large_shifts = [o for o in optimization if abs(o["optimal_weight"] - o["current_weight"]) > 10]
    if large_shifts:
        increases = [o for o in large_shifts if o["optimal_weight"] > o["current_weight"]]
        decreases = [o for o in large_shifts if o["optimal_weight"] < o["current_weight"]]
        parts = []
        if increases:
            parts.append("increase " + ", ".join(f"{o['symbol']} to {o['optimal_weight']:.0f}%" for o in increases))
        if decreases:
            parts.append("reduce " + ", ".join(f"{o['symbol']} to {o['optimal_weight']:.0f}%" for o in decreases))
        recs.append({
            "type": "optimization",
            "title": "Rebalance opportunity",
            "description": f"For a better Sharpe, consider: {'; '.join(parts)}.",
            "priority": "low",
        })

    if portfolio.get("sharpe_ratio", 0) > 1.0 and portfolio.get("diversification_score", 0) > 60:
        recs.append({
            "type": "positive",
            "title": "Strong risk-adjusted performance",
            "description": (
                f"Sharpe {portfolio['sharpe_ratio']:.2f} with diversification "
                f"{portfolio['diversification_score']}/100 — well-positioned."
            ),
            "priority": "low",
        })

    return recs


def _empty_result() -> dict:
    return {"per_stock": [], "portfolio": {}, "correlation": [], "optimization": [], "recommendations": []}


def analyze_portfolio(holdings: list[dict]) -> dict:
    """Run the full analysis pipeline on ``[{symbol, shares, avg_cost}]``."""
    symbols = [h["symbol"] for h in holdings if h.get("symbol")]
    if not symbols:
        return _empty_result()

    # Pull closes per symbol; drop anything without enough data.
    stock_closes = {sym: _closes(sym) for sym in symbols}
    valid_symbols = [s for s in symbols if len(stock_closes[s]) > MIN_CLOSES]
    if not valid_symbols:
        return _empty_result()

    stock_returns = {s: _daily_log_returns(stock_closes[s]) for s in valid_symbols}

    bench_closes = _closes("SPY")
    bench_returns = _daily_log_returns(bench_closes) if len(bench_closes) > MIN_CLOSES else None

    holdings_by_sym = {h["symbol"]: h for h in holdings}

    per_stock: list[dict] = []
    for sym in valid_symbols:
        closes = stock_closes[sym]
        returns = stock_returns[sym]
        h = holdings_by_sym.get(sym, {})
        shares = float(h.get("shares") or 0)
        price = closes[-1]
        metrics = _per_stock_metrics(returns, price)

        beta = _beta(returns, bench_returns) if bench_returns is not None else 1.0
        spark = [round(c, 2) for c in closes[-8:]]

        per_stock.append({
            "symbol": sym,
            "shares": shares,
            "market_value": round(shares * price, 2),
            "beta": round(beta, 2),
            "spark": spark,
            **metrics,
        })

    # Weight by market value for portfolio-level metrics.
    total_value = sum(s["market_value"] for s in per_stock)
    weights = np.array([
        (s["market_value"] / total_value) if total_value > 0 else (1.0 / len(per_stock))
        for s in per_stock
    ])

    # Align return series to the shortest common tail.
    min_len = min(len(stock_returns[s]) for s in valid_symbols)
    return_matrix = np.array([stock_returns[s][-min_len:] for s in valid_symbols])
    cov_matrix = np.cov(return_matrix) * TRADING_DAYS if len(valid_symbols) > 1 else np.array([[float(np.var(return_matrix)) * TRADING_DAYS]])

    port_return = float(np.dot(weights, [s["annualized_return"] for s in per_stock]))
    if len(valid_symbols) > 1:
        port_vol = float(np.sqrt(np.dot(weights, np.dot(cov_matrix, weights))) * 100)
    else:
        port_vol = per_stock[0]["volatility"]
    port_sharpe = (port_return / 100 - RISK_FREE_RATE) / (port_vol / 100) if port_vol > 0 else 0.0
    port_beta = float(np.dot(weights, [s["beta"] for s in per_stock]))

    portfolio = {
        "total_value": round(total_value, 2),
        "annualized_return": round(port_return, 2),
        "volatility": round(port_vol, 2),
        "sharpe_ratio": round(port_sharpe, 2),
        "beta": round(port_beta, 2),
        "diversification_score": _diversification_score(weights, cov_matrix),
    }

    # Pairwise correlations (upper triangle only).
    correlation: list[dict] = []
    if len(valid_symbols) > 1:
        corr = np.corrcoef(return_matrix)
        for i, s1 in enumerate(valid_symbols):
            for j, s2 in enumerate(valid_symbols):
                if j > i:
                    correlation.append({"pair": f"{s1}/{s2}", "correlation": round(float(corr[i, j]), 3)})

    optimization = _optimize_weights(valid_symbols, return_matrix, cov_matrix, weights)
    recommendations = _recommendations(per_stock, portfolio, correlation, optimization, weights, valid_symbols)

    return {
        "per_stock": per_stock,
        "portfolio": portfolio,
        "correlation": correlation,
        "optimization": optimization,
        "recommendations": recommendations,
    }
