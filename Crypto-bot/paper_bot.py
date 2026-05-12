"""
Binance Paper Trading Bot - Testnet Version
This version trades on Binance testnet with fake USDT (no real money)
Perfect for testing your trading strategy safely!
"""

import time
import logging
from datetime import datetime
from typing import List, Dict
from binance.client import Client
from binance.exceptions import BinanceAPIException
import testnet_config as config
from indicators import analyze_pair


class PaperTradingBot:
    """Paper trading bot using Binance testnet"""
    
    def __init__(self):
        """Initialize the bot with Binance testnet connection"""
        # Connect to testnet
        self.client = Client(
            config.TESTNET_API_KEY,
            config.TESTNET_API_SECRET,
            testnet=True,  # Use Binance testnet endpoints
        )
        # Force the client to use the Binance testnet spot API endpoint
        self.client.API_URL = self.client.API_TESTNET_URL
        self.logger = self._setup_logging()
        self.trades_placed = []
        self.is_testnet = True
        
    def _setup_logging(self) -> logging.Logger:
        """Setup logging configuration"""
        logger = logging.getLogger("PaperTradingBot")
        logger.setLevel(logging.INFO)
        
        # Clear existing handlers
        logger.handlers = []
        
        # File handler
        fh = logging.FileHandler(config.LOG_FILE)
        fh.setLevel(logging.INFO)
        
        # Console handler
        ch = logging.StreamHandler()
        ch.setLevel(logging.INFO)
        
        # Formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        fh.setFormatter(formatter)
        ch.setFormatter(formatter)
        
        logger.addHandler(fh)
        logger.addHandler(ch)
        
        return logger
    
    def get_top_usdt_pairs(self) -> List[str]:
        """
        Get top 20 USDT trading pairs by volume
        
        Returns:
            List of trading pair symbols
        """
        try:
            # Get all trading pairs
            exchange_info = self.client.get_exchange_info()
            
            # Filter USDT pairs
            usdt_pairs = []
            for symbol in exchange_info["symbols"]:
                if (symbol["quoteAsset"] == config.QUOTE_ASSET and 
                    symbol["status"] == "TRADING"):
                    usdt_pairs.append(symbol["symbol"])
            
            self.logger.info(f"Found {len(usdt_pairs)} USDT trading pairs on testnet")
            
            # Get 24h volume for each pair and sort
            pairs_volume = []
            for pair in usdt_pairs[:100]:  # Check first 100 to reduce API calls
                try:
                    stats = self.client.get_ticker(symbol=pair)
                    volume = float(stats.get("quoteVolume", stats.get("quoteAssetVolume", 0)))
                    pairs_volume.append((pair, volume))
                except Exception as e:
                    self.logger.debug(f"Skipped {pair} while fetching ticker: {e}")
                    continue
            
            # Sort by volume and get top 20
            pairs_volume.sort(key=lambda x: x[1], reverse=True)
            top_pairs = [pair[0] for pair in pairs_volume[:config.TOP_PAIRS_COUNT]]
            
            self.logger.info(f"Top {config.TOP_PAIRS_COUNT} pairs: {', '.join(top_pairs[:5])}...")
            return top_pairs
            
        except Exception as e:
            self.logger.error(f"Error getting top USDT pairs: {e}")
            return []
    
    def get_klines(self, symbol: str, interval: str, limit: int = 100) -> List:
        """
        Get klines (candlestick) data from Binance testnet
        
        Args:
            symbol: Trading pair symbol
            interval: Timeframe (e.g., "15m", "1h")
            limit: Number of candles to fetch
        
        Returns:
            List of klines data
        """
        try:
            klines = self.client.get_klines(symbol=symbol, interval=interval, limit=limit)
            return klines
        except Exception as e:
            self.logger.error(f"Error getting klines for {symbol} {interval}: {e}")
            return []
    
    def analyze_trading_opportunities(self, pairs: List[str]) -> List[Dict]:
        """
        Analyze all trading pairs and identify opportunities
        
        Args:
            pairs: List of trading pair symbols
        
        Returns:
            List of opportunities sorted by signal strength
        """
        opportunities = []
        config_dict = self._config_to_dict()
        
        for symbol in pairs:
            try:
                # Fetch klines for both timeframes
                klines_15m = self.get_klines(symbol, "15m", limit=100)
                klines_1h = self.get_klines(symbol, "1h", limit=100)
                
                if not klines_15m or not klines_1h:
                    continue
                
                # Analyze pair
                analysis = analyze_pair(klines_15m, klines_1h, config_dict)
                
                if analysis["valid"] and analysis["signal_strength"] >= 60:
                    analysis["symbol"] = symbol
                    opportunities.append(analysis)
                    
                    self.logger.info(
                        f"{symbol}: Signal Strength = {analysis['signal_strength']}%, "
                        f"RSI (15m/1h) = {analysis['rsi_15m']:.2f}/{analysis['rsi_1h']:.2f}"
                    )
                
                time.sleep(0.1)  # Rate limiting
                
            except Exception as e:
                self.logger.error(f"Error analyzing {symbol}: {e}")
                continue
        
        # Sort by signal strength
        opportunities.sort(key=lambda x: x["signal_strength"], reverse=True)
        
        self.logger.info(f"Found {len(opportunities)} trading opportunities")
        return opportunities
    
    def get_account_balance(self, asset: str = config.QUOTE_ASSET) -> float:
        """
        Get testnet account balance
        
        Args:
            asset: Asset symbol (e.g., "USDT")
        
        Returns:
            Available balance
        """
        try:
            account = self.client.get_account()
            for balance in account["balances"]:
                if balance["asset"] == asset:
                    return float(balance["free"])
            return 0.0
        except Exception as e:
            self.logger.error(f"Error getting account balance: {e}")
            return 0.0
    
    def get_min_order_amount(self, symbol: str) -> float:
        """
        Get minimum order amount for a symbol
        
        Args:
            symbol: Trading pair symbol
        
        Returns:
            Minimum order amount in USDT
        """
        try:
            info = self.client.get_symbol_info(symbol)
            for filter_item in info["filters"]:
                if filter_item["filterType"] == "MIN_NOTIONAL":
                    return float(filter_item["minNotional"])
            return config.MIN_ORDER_VALUE
        except Exception as e:
            self.logger.error(f"Error getting min order amount for {symbol}: {e}")
            return config.MIN_ORDER_VALUE
    
    def place_buy_order(self, symbol: str, amount_usdt: float) -> Dict:
        """
        Place a test buy order (on testnet, so no real money spent)
        
        Args:
            symbol: Trading pair symbol
            amount_usdt: Amount in USDT to spend
        
        Returns:
            Order result dictionary
        """
        try:
            # Get current price
            ticker = self.client.get_symbol_price_ticker(symbol=symbol)
            current_price = float(ticker["price"])
            
            # Calculate quantity
            quantity = round(amount_usdt / current_price, 8)
            
            self.logger.info(
                f"[ORDER] Placing BUY order: {symbol} - {quantity} coins @ {current_price} USDT"
            )
            
            # Place order (on testnet - no real money!)
            order = self.client.order_market_buy(symbol=symbol, quantity=quantity)
            
            self.logger.info(f"[SUCCESS] Order placed successfully: {order['orderId']}")
            self.trades_placed.append({
                "timestamp": datetime.now(),
                "symbol": symbol,
                "order_id": order["orderId"],
                "quantity": quantity,
                "price": current_price,
                "total_value": amount_usdt,
                "is_testnet": True
            })
            
            return order
            
        except BinanceAPIException as e:
            self.logger.error(f"Binance API Error placing order for {symbol}: {e}")
            return None
        except Exception as e:
            self.logger.error(f"Error placing order for {symbol}: {e}")
            return None
    
    def execute_trading_strategy(self):
        """Main paper trading strategy execution"""
        self.logger.info("=" * 70)
        self.logger.info("[RUN] PAPER TRADING BOT RUN (Testnet - No Real Money)")
        self.logger.info(f"[TIME] Started at: {datetime.now()}")
        self.logger.info("=" * 70)
        
        try:
            # Get account balance
            usdt_balance = self.get_account_balance(config.QUOTE_ASSET)
            self.logger.info(f"[BALANCE] Available USDT (testnet): {usdt_balance:.2f}")
            
            if usdt_balance < config.MIN_ORDER_VALUE:
                self.logger.warning(
                    f"[WARNING] Insufficient balance. Need at least {config.MIN_ORDER_VALUE} USDT"
                )
                self.logger.info("[TIP] Get free testnet USDT from https://testnet.binance.vision/")
                return
            
            # Get top USDT pairs
            top_pairs = self.get_top_usdt_pairs()
            if not top_pairs:
                self.logger.error("Could not fetch top pairs")
                return
            
            # Analyze opportunities
            opportunities = self.analyze_trading_opportunities(top_pairs)
            
            if not opportunities:
                self.logger.info("[INFO] No strong trading opportunities found this cycle")
                return
            
            # Execute paper trades (limit to MAX_ORDERS_PER_RUN)
            orders_placed = 0
            for opportunity in opportunities:
                if orders_placed >= config.MAX_ORDERS_PER_RUN:
                    break
                
                symbol = opportunity["symbol"]
                min_order = self.get_min_order_amount(symbol)
                order_amount = (usdt_balance * config.ORDER_QUANTITY_PERCENT / 100) * 100
                
                if order_amount < min_order:
                    self.logger.warning(
                        f"Order amount {order_amount:.2f} USDT is below minimum {min_order:.2f} for {symbol}"
                    )
                    continue
                
                # Place paper order
                result = self.place_buy_order(symbol, order_amount)
                if result:
                    orders_placed += 1
                    time.sleep(1)
                    usdt_balance = self.get_account_balance(config.QUOTE_ASSET)
            
            self.logger.info(f"[SUMMARY] Total paper orders placed: {orders_placed}")
            self.logger.info("=" * 70)
            
        except Exception as e:
            self.logger.error(f"Fatal error in trading strategy: {e}")
    
    def _config_to_dict(self) -> Dict:
        """Convert config module to dictionary"""
        return {
            "RSI_PERIOD": config.RSI_PERIOD,
            "RSI_OVERBOUGHT": config.RSI_OVERBOUGHT,
            "RSI_OVERSOLD": config.RSI_OVERSOLD,
            "MACD_FAST": config.MACD_FAST,
            "MACD_SLOW": config.MACD_SLOW,
            "MACD_SIGNAL": config.MACD_SIGNAL,
            "EMA_SHORT": config.EMA_SHORT,
            "EMA_LONG": config.EMA_LONG
        }
    
    def run(self):
        """Run the paper trading bot continuously"""
        self.logger.info("[START] Paper Trading Bot Started")
        self.logger.info("[TESTNET] Connected to Binance TESTNET (paper trading, no real money)")
        self.logger.info("")
        
        try:
            iteration = 1
            while True:
                self.logger.info(f"\n--- Cycle #{iteration} ---")
                self.execute_trading_strategy()
                self.logger.info(f"[WAIT] Next check in {config.CHECK_INTERVAL} seconds...")
                time.sleep(config.CHECK_INTERVAL)
                iteration += 1
        except KeyboardInterrupt:
            self.logger.info("\n[STOP] Paper trading bot stopped by user")
            self.logger.info(f"[STATS] Total paper trades placed: {len(self.trades_placed)}")
        except Exception as e:
            self.logger.error(f"Fatal error: {e}")


def main():
    """Entry point for paper trading"""
    bot = PaperTradingBot()
    bot.run()


if __name__ == "__main__":
    main()
