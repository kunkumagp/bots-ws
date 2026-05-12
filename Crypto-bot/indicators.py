"""
Technical indicators module for trading bot
Implements RSI, MACD, and EMA calculations
"""

import pandas as pd
import numpy as np
from typing import Tuple, Dict


def calculate_rsi(data: pd.Series, period: int = 14) -> pd.Series:
    """
    Calculate Relative Strength Index (RSI)
    
    Args:
        data: Series of closing prices
        period: RSI period (default: 14)
    
    Returns:
        Series with RSI values
    """
    delta = data.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    
    return rsi


def calculate_macd(data: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> Tuple[pd.Series, pd.Series, pd.Series]:
    """
    Calculate MACD (Moving Average Convergence Divergence)
    
    Args:
        data: Series of closing prices
        fast: Fast EMA period (default: 12)
        slow: Slow EMA period (default: 26)
        signal: Signal line period (default: 9)
    
    Returns:
        Tuple of (MACD line, Signal line, Histogram)
    """
    ema_fast = data.ewm(span=fast).mean()
    ema_slow = data.ewm(span=slow).mean()
    
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal).mean()
    histogram = macd_line - signal_line
    
    return macd_line, signal_line, histogram


def calculate_ema(data: pd.Series, period: int) -> pd.Series:
    """
    Calculate Exponential Moving Average (EMA)
    
    Args:
        data: Series of closing prices
        period: EMA period
    
    Returns:
        Series with EMA values
    """
    return data.ewm(span=period).mean()


def get_ema_crossover(data: pd.Series, short_period: int = 9, long_period: int = 21) -> Dict[str, any]:
    """
    Detect EMA crossover signals
    
    Args:
        data: Series of closing prices
        short_period: Short EMA period
        long_period: Long EMA period
    
    Returns:
        Dictionary with crossover information
    """
    ema_short = calculate_ema(data, short_period)
    ema_long = calculate_ema(data, long_period)
    
    # Current values
    current_short = ema_short.iloc[-1]
    current_long = ema_long.iloc[-1]
    prev_short = ema_short.iloc[-2]
    prev_long = ema_long.iloc[-2]
    
    # Detect crossover
    bullish_crossover = (prev_short <= prev_long) and (current_short > current_long)
    bearish_crossover = (prev_short >= prev_long) and (current_short < current_long)
    
    return {
        "ema_short": current_short,
        "ema_long": current_long,
        "bullish_crossover": bullish_crossover,
        "bearish_crossover": bearish_crossover,
        "short_above_long": current_short > current_long
    }


def analyze_pair(klines_15m: list, klines_1h: list, config: Dict) -> Dict[str, any]:
    """
    Comprehensive analysis of a trading pair
    
    Args:
        klines_15m: 15-minute klines data
        klines_1h: 1-hour klines data
        config: Configuration dictionary
    
    Returns:
        Dictionary with analysis results
    """
    
    # Convert klines to DataFrame
    df_15m = _klines_to_dataframe(klines_15m)
    df_1h = _klines_to_dataframe(klines_1h)
    
    if len(df_15m) < config["MACD_SLOW"] or len(df_1h) < config["MACD_SLOW"]:
        return {"valid": False, "reason": "Insufficient data"}
    
    # 15-minute analysis
    rsi_15m = calculate_rsi(df_15m["close"], config["RSI_PERIOD"])
    macd_15m, signal_15m, hist_15m = calculate_macd(
        df_15m["close"], config["MACD_FAST"], config["MACD_SLOW"], config["MACD_SIGNAL"]
    )
    ema_cross_15m = get_ema_crossover(df_15m["close"], config["EMA_SHORT"], config["EMA_LONG"])
    
    # 1-hour analysis
    rsi_1h = calculate_rsi(df_1h["close"], config["RSI_PERIOD"])
    macd_1h, signal_1h, hist_1h = calculate_macd(
        df_1h["close"], config["MACD_FAST"], config["MACD_SLOW"], config["MACD_SIGNAL"]
    )
    ema_cross_1h = get_ema_crossover(df_1h["close"], config["EMA_SHORT"], config["EMA_LONG"])
    
    # Calculate signal strength (0-100)
    signal_strength = _calculate_signal_strength(
        rsi_15m.iloc[-1],
        rsi_1h.iloc[-1],
        hist_15m.iloc[-1],
        hist_1h.iloc[-1],
        ema_cross_15m,
        ema_cross_1h,
        config
    )
    
    return {
        "valid": True,
        "signal_strength": signal_strength,
        "rsi_15m": rsi_15m.iloc[-1],
        "rsi_1h": rsi_1h.iloc[-1],
        "macd_hist_15m": hist_15m.iloc[-1],
        "macd_hist_1h": hist_1h.iloc[-1],
        "ema_cross_15m": ema_cross_15m,
        "ema_cross_1h": ema_cross_1h,
        "price": df_15m["close"].iloc[-1],
        "df_15m": df_15m,
        "df_1h": df_1h
    }


def _klines_to_dataframe(klines: list) -> pd.DataFrame:
    """Convert Binance klines to DataFrame"""
    df = pd.DataFrame(klines, columns=[
        "open_time", "open", "high", "low", "close", "volume",
        "close_time", "quote_asset_volume", "trades", "buy_base", "buy_quote", "ignore"
    ])
    
    df["close"] = df["close"].astype(float)
    df["open"] = df["open"].astype(float)
    df["high"] = df["high"].astype(float)
    df["low"] = df["low"].astype(float)
    df["volume"] = df["volume"].astype(float)
    
    return df


def _calculate_signal_strength(rsi_15m: float, rsi_1h: float, macd_hist_15m: float, 
                               macd_hist_1h: float, ema_cross_15m: Dict, ema_cross_1h: Dict, 
                               config: Dict) -> float:
    """
    Calculate overall signal strength score (0-100)
    
    Args:
        rsi_15m: RSI value for 15m
        rsi_1h: RSI value for 1h
        macd_hist_15m: MACD histogram for 15m
        macd_hist_1h: MACD histogram for 1h
        ema_cross_15m: EMA crossover data for 15m
        ema_cross_1h: EMA crossover data for 1h
        config: Configuration dictionary
    
    Returns:
        Signal strength score (0-100)
    """
    score = 0
    max_score = 0
    
    # RSI analysis (30 points)
    max_score += 30
    if config["RSI_OVERSOLD"] < rsi_15m < 50:
        score += 15
    if config["RSI_OVERSOLD"] < rsi_1h < 50:
        score += 15
    
    # MACD analysis (25 points)
    max_score += 25
    if macd_hist_15m > 0:
        score += 12
    if macd_hist_1h > 0:
        score += 13
    
    # EMA crossover analysis (25 points)
    max_score += 25
    if ema_cross_15m["bullish_crossover"]:
        score += 12
    if ema_cross_1h["bullish_crossover"]:
        score += 13
    
    # Trend alignment (20 points)
    max_score += 20
    if ema_cross_15m["short_above_long"] and ema_cross_1h["short_above_long"]:
        score += 20
    elif ema_cross_15m["short_above_long"] or ema_cross_1h["short_above_long"]:
        score += 10
    
    # Calculate percentage score
    signal_strength = (score / max_score) * 100 if max_score > 0 else 0
    
    return round(signal_strength, 2)
