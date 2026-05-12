"""
Binance Trading Bot - Main Module
Scans top 20 USDT pairs and places buy orders based on technical analysis
"""

import time
import logging
from datetime import datetime
from typing import List, Dict, Tuple
from binance.client import Client
from binance.exceptions import BinanceAPIException
import config
from indicators import analyze_pair


class BinanceBot:
    """Main trading bot class"""
    
    def __init__(self):
        """Initialize the bot with Binance API connection"""
        self.client = Client(config.API_KEY, config.API_SECRET)
        self.logger = self._setup_logging()
        self.trades_placed = []
        
    def _setup_logging(self) -> logging.Logger:
        """Setup logging configuration"""
        logger = logging.getLogger("TradingBot")
        logger.setLevel(logging.INFO)
        
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
            
            self.logger.info(f"Found {len(usdt_pairs)} USDT trading pairs")
            
            # Get 24h volume for all symbols and sort
            pairs_volume = []
            try:
                stats_list = self.client.get_ticker()
                if isinstance(stats_list, dict):
                    stats_list = [stats_list]
                for stats in stats_list:
                    symbol = stats.get("symbol")
                    if not symbol or not symbol.endswith(config.QUOTE_ASSET):
                        continue
                    try:
                        volume = float(stats.get("quoteVolume", 0))
                        pairs_volume.append((symbol, volume))
                    except Exception as e:
                        self.logger.debug(f"Skipped {symbol}: {e}")
                        continue
            except Exception as e:
                self.logger.error(f"Error fetching ticker data: {e}")
                return []
            
            # Sort by volume and get top 20
            pairs_volume.sort(key=lambda x: x[1], reverse=True)
            top_pairs = [pair[0] for pair in pairs_volume[:config.TOP_PAIRS_COUNT]]
            
            self.logger.info(f"Top {config.TOP_PAIRS_COUNT} pairs by volume: {top_pairs[:5]}...")
            return top_pairs
            
        except Exception as e:
            self.logger.error(f"Error getting top USDT pairs: {e}")
            return []
    
    def get_klines(self, symbol: str, interval: str, limit: int = 100) -> List:
        """
        Get klines (candlestick) data from Binance
        
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
        Get account balance for a specific asset
        
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
        Place a market buy order
        
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
            
            self.logger.info(f"Placing BUY order: {symbol} - {quantity} coins @ {current_price} USDT")
            
            # Place order
            order = self.client.order_market_buy(symbol=symbol, quantity=quantity)
            
            self.logger.info(f"Order placed successfully: {order['orderId']}")
            self.trades_placed.append({
                "timestamp": datetime.now(),
                "symbol": symbol,
                "order_id": order["orderId"],
                "quantity": quantity,
                "price": current_price,
                "total_value": amount_usdt
            })
            
            return order
            
        except BinanceAPIException as e:
            self.logger.error(f"Binance API Error placing order for {symbol}: {e}")
            return None
        except Exception as e:
            self.logger.error(f"Error placing order for {symbol}: {e}")
            return None
    
    def execute_trading_strategy(self):
        """Main trading strategy execution"""
        self.logger.info("=" * 60)
        self.logger.info(f"Starting trading bot run at {datetime.now()}")
        self.logger.info("=" * 60)
        
        try:
            # Get account balance
            usdt_balance = self.get_account_balance(config.QUOTE_ASSET)
            self.logger.info(f"Available USDT balance: {usdt_balance:.2f}")
            
            if usdt_balance < config.MIN_ORDER_VALUE:
                self.logger.warning(f"Insufficient balance. Need at least {config.MIN_ORDER_VALUE} USDT")
                return
            
            # Get top USDT pairs
            top_pairs = self.get_top_usdt_pairs()
            if not top_pairs:
                self.logger.error("Could not fetch top pairs")
                return
            
            # Analyze opportunities
            opportunities = self.analyze_trading_opportunities(top_pairs)
            
            if not opportunities:
                self.logger.info("No trading opportunities found")
                return
            
            # Execute trades (limit to MAX_ORDERS_PER_RUN)
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
                
                # Place order
                result = self.place_buy_order(symbol, order_amount)
                if result:
                    orders_placed += 1
                    # Update balance after order
                    time.sleep(1)
                    usdt_balance = self.get_account_balance(config.QUOTE_ASSET)
            
            self.logger.info(f"Total orders placed: {orders_placed}")
            self.logger.info("=" * 60)
            
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
        """Run the bot continuously"""
        self.logger.info("Trading bot started")
        
        try:
            while True:
                self.execute_trading_strategy()
                self.logger.info(f"Waiting {config.CHECK_INTERVAL} seconds for next check...")
                time.sleep(config.CHECK_INTERVAL)
        except KeyboardInterrupt:
            self.logger.info("Bot stopped by user")
        except Exception as e:
            self.logger.error(f"Fatal error: {e}")


def main():
    """Entry point"""
    bot = BinanceBot()
    bot.run()


if __name__ == "__main__":
    main()
