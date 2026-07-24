"""
Composite scoring engine — combines individual strategy scores into a
single 0-100 rating per ticker, weighted by category.

Inspired by TradingView's Technical Rating and StockCharts SCTR.

Categories and weights:
  Trend      30%  — ADX, SuperTrend
  Momentum   25%  — RSI, MACD, Stochastic
  Breakout   20%  — Fibonacci, 52W High, Bollinger squeeze
  Volume     15%  — RVOL
  Support    10%  — Pivot Points
"""

CATEGORY_WEIGHTS = {
    "trend": 0.30,
    "momentum": 0.25,
    "breakout": 0.20,
    "volume": 0.15,
    "support": 0.10,
}

STRATEGY_CATEGORIES = {
    "supertrend": "trend",
    "adx": "trend",
    "rsi": "momentum",
    "macd": "momentum",
    "stochastic": "momentum",
    "fibonacci_retracement": "breakout",
    "52w_high": "breakout",
    "bollinger": "breakout",
    "rvol": "volume",
    "pivot_point": "support",
}


def compute_composite(strategy_scores: dict[str, float]) -> dict:
    """
    Given {strategy_name: score_0_100}, compute a weighted composite.

    Returns {
        "composite_score": float (0-100),
        "category_scores": {category: float},
        "rating": str ("Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell"),
        "strategies_used": int,
    }
    """
    category_totals: dict[str, list[float]] = {}
    for strategy, score in strategy_scores.items():
        cat = STRATEGY_CATEGORIES.get(strategy)
        if cat is None:
            continue
        # Normalize 0-100 score to -1..+1 range
        normalized = (score - 50) / 50
        category_totals.setdefault(cat, []).append(normalized)

    category_scores: dict[str, float] = {}
    weighted_sum = 0.0
    total_weight = 0.0

    for cat, weight in CATEGORY_WEIGHTS.items():
        values = category_totals.get(cat, [])
        if not values:
            continue
        avg = sum(values) / len(values)
        category_scores[cat] = round((avg + 1) * 50, 2)  # back to 0-100
        weighted_sum += avg * weight
        total_weight += weight

    if total_weight == 0:
        return {
            "composite_score": 50.0,
            "category_scores": {},
            "rating": "Neutral",
            "strategies_used": 0,
        }

    # Normalize by actual weight used (some categories may have no data)
    composite_normalized = weighted_sum / total_weight
    composite_score = round((composite_normalized + 1) * 50, 2)
    composite_score = max(0, min(100, composite_score))

    # TradingView-style rating buckets
    if composite_normalized > 0.5:
        rating = "Strong Buy"
    elif composite_normalized > 0.1:
        rating = "Buy"
    elif composite_normalized > -0.1:
        rating = "Neutral"
    elif composite_normalized > -0.5:
        rating = "Sell"
    else:
        rating = "Strong Sell"

    return {
        "composite_score": composite_score,
        "category_scores": category_scores,
        "rating": rating,
        "strategies_used": len(strategy_scores),
    }
