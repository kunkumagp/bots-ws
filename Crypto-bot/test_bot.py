"""
Test and debug module for trading bot
Use this to test individual components
"""

import pandas as pd
from binance.client import Client
import config
from indicators import analyze_pair, calculate_rsi, calculate_macd, get_ema_crossover


class BotTester:
    """Testing utility for the trading bot"""
    
    def __init__(self):
        """Initialize tester with Binance client"""
        self.client = Client(config.API_KEY, config.API_SECRET)
    
    def test_connection(self) -> bool:
        """Test Binance API connection"""
        try:
            account = self.client.get_account()
            print("✓ Binance API connection successful")
            print(f"  Account: {account['accountNumber']}")
            return True
        except Exception as e:
            print(f"✗ Binance API connection failed: {e}")
            return False
    
    def test_get_pairs(self, limit: int = 5) -> bool:
        """Test fetching top USDT pairs"""
        try:
            exchange_info = self.client.get_exchange_info()
            usdt_pairs = []
            
            for symbol in exchange_info["symbols"]:
                if (symbol["quoteAsset"] == config.QUOTE_ASSET and 
                    symbol["status"] == "TRADING"):
                    usdt_pairs.append(symbol["symbol"])
            
            print(f"✓ Found {len(usdt_pairs)} USDT pairs")
            
            # Get top by volume
            pairs_volume = []
            for pair in usdt_pairs[:20]:
                try:
                    stats = self.client.get_ticker(symbol=pair)
                    volume = float(stats["quoteAssetVolume"])
                    pairs_volume.append((pair, volume))
                except:
                    pass
            
            pairs_volume.sort(key=lambda x: x[1], reverse=True)
            top_pairs = pairs_volume[:limit]
            
            print(f"✓ Top {limit} USDT pairs by volume:")
            for pair, volume in top_pairs:
                print(f"  {pair}: ${volume:,.0f}")
            
            return True
        except Exception as e:
            print(f"✗ Error fetching pairs: {e}")
            return False
    
    def test_indicators(self, symbol: str = "BTCUSDT") -> bool:
        """Test technical indicators on a symbol"""
        try:
            print(f"\nTesting indicators on {symbol}...")
            
            # Fetch klines
            klines_15m = self.client.get_klines(symbol=symbol, interval="15m", limit=100)
            klines_1h = self.client.get_klines(symbol=symbol, interval="1h", limit=100)
            
            # Convert to DataFrame
            df_15m = self._klines_to_dataframe(klines_15m)
            df_1h = self._klines_to_dataframe(klines_1h)
            
            # Calculate indicators
            rsi_15m = calculate_rsi(df_15m["close"], config.RSI_PERIOD)
            rsi_1h = calculate_rsi(df_1h["close"], config.RSI_PERIOD)
            
            macd_15m, signal_15m, hist_15m = calculate_macd(
                df_15m["close"], config.MACD_FAST, config.MACD_SLOW, config.MACD_SIGNAL
            )
            macd_1h, signal_1h, hist_1h = calculate_macd(
                df_1h["close"], config.MACD_FAST, config.MACD_SLOW, config.MACD_SIGNAL
            )
            
            ema_15m = get_ema_crossover(df_15m["close"], config.EMA_SHORT, config.EMA_LONG)
            ema_1h = get_ema_crossover(df_1h["close"], config.EMA_SHORT, config.EMA_LONG)
            
            # Print results
            print(f"✓ Indicators calculated successfully")
            print(f"\n15-Minute Timeframe:")
            print(f"  Price: ${df_15m['close'].iloc[-1]:.2f}")
            print(f"  RSI: {rsi_15m.iloc[-1]:.2f}")
            print(f"  MACD Histogram: {hist_15m.iloc[-1]:.6f}")
            print(f"  EMA {config.EMA_SHORT}/{config.EMA_LONG}: {ema_15m['ema_short']:.2f}/{ema_15m['ema_long']:.2f}")
            print(f"  Bullish Crossover: {ema_15m['bullish_crossover']}")
            
            print(f"\n1-Hour Timeframe:")
            print(f"  Price: ${df_1h['close'].iloc[-1]:.2f}")
            print(f"  RSI: {rsi_1h.iloc[-1]:.2f}")
            print(f"  MACD Histogram: {hist_1h.iloc[-1]:.6f}")
            print(f"  EMA {config.EMA_SHORT}/{config.EMA_LONG}: {ema_1h['ema_short']:.2f}/{ema_1h['ema_long']:.2f}")
            print(f"  Bullish Crossover: {ema_1h['bullish_crossover']}")
            
            return True
        except Exception as e:
            print(f"✗ Error testing indicators: {e}")
            return False
    
    def test_full_analysis(self, symbol: str = "BTCUSDT") -> bool:
        """Test full pair analysis"""
        try:
            print(f"\nTesting full analysis on {symbol}...")
            
            # Fetch klines
            klines_15m = self.client.get_klines(symbol=symbol, interval="15m", limit=100)
            klines_1h = self.client.get_klines(symbol=symbol, interval="1h", limit=100)
            
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
            
            if analysis["valid"]:
                print(f"✓ Analysis successful")
                print(f"  Signal Strength: {analysis['signal_strength']}%")
                print(f"  Price: ${analysis['price']:.2f}")
                print(f"  RSI (15m/1h): {analysis['rsi_15m']:.2f}/{analysis['rsi_1h']:.2f}")
                print(f"  MACD Hist (15m/1h): {analysis['macd_hist_15m']:.6f}/{analysis['macd_hist_1h']:.6f}")
                
                if analysis['signal_strength'] >= 60:
                    print(f"  → Strong signal detected!")
                else:
                    print(f"  → Weak signal")
            else:
                print(f"✗ Analysis invalid: {analysis['reason']}")
                return False
            
            return True
        except Exception as e:
            print(f"✗ Error in full analysis: {e}")
            return False
    
    def test_balance(self) -> bool:
        """Test getting account balance"""
        try:
            account = self.client.get_account()
            print(f"\n✓ Account Balances:")
            
            has_balance = False
            for balance in account["balances"]:
                free = float(balance["free"])
                if free > 0:
                    print(f"  {balance['asset']}: {free:.8f}")
                    has_balance = True
            
            if not has_balance:
                print("  No balances found")
            
            return True
        except Exception as e:
            print(f"✗ Error getting balance: {e}")
            return False
    
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


def run_all_tests():
    """Run all tests"""
    tester = BotTester()
    
    print("\n" + "="*60)
    print("TRADING BOT TEST SUITE")
    print("="*60)
    
    tests = [
        ("API Connection", tester.test_connection),
        ("Fetch Top Pairs", tester.test_get_pairs),
        ("Account Balance", tester.test_balance),
        ("Technical Indicators", tester.test_indicators),
        ("Full Analysis", tester.test_full_analysis),
    ]
    
    passed = 0
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"✗ {test_name} failed with exception: {e}")
    
    print("\n" + "="*60)
    print(f"Tests Passed: {passed}/{len(tests)}")
    print("="*60 + "\n")


if __name__ == "__main__":
    run_all_tests()
