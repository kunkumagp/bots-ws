"""
Backtesting and historical analysis module
Use this to test your bot's strategy on historical data
"""

import pandas as pd
from datetime import datetime, timedelta
from binance.client import Client
import config
from indicators import analyze_pair


class HistoricalAnalyzer:
    """Analyze historical data for backtesting"""
    
    def __init__(self):
        """Initialize with Binance client"""
        self.client = Client(config.API_KEY, config.API_SECRET)
    
    def get_historical_data(self, symbol: str, interval: str, days: int = 30, limit: int = 1000) -> list:
        """
        Get historical klines data
        
        Args:
            symbol: Trading pair symbol
            interval: Timeframe (e.g., "15m", "1h", "4h", "1d")
            days: Number of days back
            limit: Max candles to fetch
        
        Returns:
            List of klines data
        """
        try:
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(days=days)
            
            klines = self.client.get_historical_klines(
                symbol=symbol,
                interval=interval,
                start_str=int(start_time.timestamp() * 1000),
                end_str=int(end_time.timestamp() * 1000),
                limit=limit
            )
            
            return klines
        except Exception as e:
            print(f"Error getting historical data for {symbol}: {e}")
            return []
    
    def backtest_pair(self, symbol: str, days_back: int = 7) -> dict:
        """
        Backtest the trading strategy on a pair
        
        Args:
            symbol: Trading pair symbol
            days_back: Number of days of history to analyze
        
        Returns:
            Backtest results dictionary
        """
        try:
            print(f"\nBacktesting {symbol} - Last {days_back} days")
            print("-" * 50)
            
            # Get historical data
            klines_15m = self.get_historical_data(symbol, "15m", days=days_back)
            klines_1h = self.get_historical_data(symbol, "1h", days=days_back)
            
            if not klines_15m or not klines_1h:
                print(f"Could not fetch historical data for {symbol}")
                return {"valid": False}
            
            # Get config as dict
            config_dict = {
                "RSI_PERIOD": config.RSI_PERIOD,
                "RSI_OVERBOUGHT": config.RSI_OVERBOUGHT,
                "RSI_OVERSOLD": config.RSI_OVERSOLD,
                "MACD_FAST": config.MACD_FAST,
                "MACD_SLOW": config.MACD_SLOW,
                "MACD_SIGNAL": config.MACD_SIGNAL,
                "EMA_SHORT": config.EMA_SHORT,
                "EMA_LONG": config.EMA_LONG
            }
            
            # Analyze
            analysis = analyze_pair(klines_15m, klines_1h, config_dict)
            
            if not analysis["valid"]:
                print(f"Could not analyze {symbol}: {analysis['reason']}")
                return {"valid": False}
            
            # Print results
            print(f"Current Price: ${analysis['price']:.8f}")
            print(f"Signal Strength: {analysis['signal_strength']}%")
            print()
            print("15-Minute Analysis:")
            print(f"  RSI: {analysis['rsi_15m']:.2f}")
            print(f"  MACD Histogram: {analysis['macd_hist_15m']:.8f}")
            print(f"  EMA Short: ${analysis['ema_cross_15m']['ema_short']:.8f}")
            print(f"  EMA Long: ${analysis['ema_cross_15m']['ema_long']:.8f}")
            print(f"  Short > Long: {analysis['ema_cross_15m']['short_above_long']}")
            print()
            print("1-Hour Analysis:")
            print(f"  RSI: {analysis['rsi_1h']:.2f}")
            print(f"  MACD Histogram: {analysis['macd_hist_1h']:.8f}")
            print(f"  EMA Short: ${analysis['ema_cross_1h']['ema_short']:.8f}")
            print(f"  EMA Long: ${analysis['ema_cross_1h']['ema_long']:.8f}")
            print(f"  Short > Long: {analysis['ema_cross_1h']['short_above_long']}")
            print()
            
            if analysis['signal_strength'] >= 60:
                print("✓ BUY SIGNAL - This would trigger an order")
            else:
                print("✗ NO SIGNAL - Waiting for better conditions")
            
            print("-" * 50)
            
            return analysis
        
        except Exception as e:
            print(f"Error backtesting {symbol}: {e}")
            return {"valid": False}
    
    def backtest_top_pairs(self, days_back: int = 7, limit: int = 10) -> list:
        """
        Backtest the top USDT pairs
        
        Args:
            days_back: Number of days to analyze
            limit: Number of top pairs to test
        
        Returns:
            List of analysis results
        """
        try:
            print("="*60)
            print(f"BACKTEST ANALYSIS - Top {limit} USDT Pairs")
            print(f"Historical Period: Last {days_back} days")
            print("="*60)
            
            # Get top pairs
            exchange_info = self.client.get_exchange_info()
            usdt_pairs = []
            
            for symbol in exchange_info["symbols"]:
                if (symbol["quoteAsset"] == config.QUOTE_ASSET and 
                    symbol["status"] == "TRADING"):
                    usdt_pairs.append(symbol["symbol"])
            
            # Get top by volume
            pairs_volume = []
            for pair in usdt_pairs[:50]:
                try:
                    stats = self.client.get_ticker(symbol=pair)
                    volume = float(stats["quoteAssetVolume"])
                    pairs_volume.append((pair, volume))
                except:
                    pass
            
            pairs_volume.sort(key=lambda x: x[1], reverse=True)
            top_pairs = [pair[0] for pair in pairs_volume[:limit]]
            
            # Backtest each pair
            results = []
            for symbol in top_pairs:
                analysis = self.backtest_pair(symbol, days_back=days_back)
                if analysis.get("valid"):
                    results.append(analysis)
            
            # Summary
            print("\n" + "="*60)
            print("BACKTEST SUMMARY")
            print("="*60)
            
            buy_signals = sum(1 for r in results if r.get("signal_strength", 0) >= 60)
            print(f"Total pairs analyzed: {len(results)}")
            print(f"Strong buy signals (≥60%): {buy_signals}")
            
            if buy_signals > 0:
                strong_signals = [r for r in results if r.get("signal_strength", 0) >= 60]
                strong_signals.sort(key=lambda x: x.get("signal_strength", 0), reverse=True)
                print("\nTop Buy Signals:")
                for i, signal in enumerate(strong_signals[:5], 1):
                    print(f"  {i}. {signal['symbol']}: {signal['signal_strength']}%")
            
            print("="*60)
            
            return results
        
        except Exception as e:
            print(f"Error in backtest: {e}")
            return []
    
    def compare_timeframes(self, symbol: str = "BTCUSDT") -> dict:
        """
        Compare different timeframes for a symbol
        
        Args:
            symbol: Trading pair symbol
        
        Returns:
            Comparison results
        """
        try:
            print(f"\nComparing timeframes for {symbol}")
            print("-" * 50)
            
            config_dict = {
                "RSI_PERIOD": config.RSI_PERIOD,
                "RSI_OVERBOUGHT": config.RSI_OVERBOUGHT,
                "RSI_OVERSOLD": config.RSI_OVERSOLD,
                "MACD_FAST": config.MACD_FAST,
                "MACD_SLOW": config.MACD_SLOW,
                "MACD_SIGNAL": config.MACD_SIGNAL,
                "EMA_SHORT": config.EMA_SHORT,
                "EMA_LONG": config.EMA_LONG
            }
            
            timeframes = ["5m", "15m", "1h", "4h"]
            results = {}
            
            for tf in timeframes:
                try:
                    klines = self.client.get_klines(symbol=symbol, interval=tf, limit=100)
                    df = self._klines_to_dataframe(klines)
                    
                    from indicators import calculate_rsi, calculate_macd
                    rsi = calculate_rsi(df["close"], config.RSI_PERIOD).iloc[-1]
                    macd, signal, hist = calculate_macd(df["close"], config.MACD_FAST, config.MACD_SLOW, config.MACD_SIGNAL)
                    
                    results[tf] = {
                        "price": df["close"].iloc[-1],
                        "rsi": rsi,
                        "macd_hist": hist.iloc[-1]
                    }
                    
                    print(f"{tf:5s} - Price: ${df['close'].iloc[-1]:10.2f} | RSI: {rsi:6.2f} | MACD: {hist.iloc[-1]:10.8f}")
                except Exception as e:
                    print(f"{tf:5s} - Error: {e}")
            
            print("-" * 50)
            return results
        
        except Exception as e:
            print(f"Error comparing timeframes: {e}")
            return {}
    
    def _klines_to_dataframe(self, klines: list) -> pd.DataFrame:
        """Convert klines to DataFrame"""
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


def main():
    """Run backtesting analysis"""
    analyzer = HistoricalAnalyzer()
    
    # Backtest top pairs
    analyzer.backtest_top_pairs(days_back=7, limit=10)
    
    # Optionally compare timeframes
    print("\n")
    analyzer.compare_timeframes("BTCUSDT")


if __name__ == "__main__":
    main()
