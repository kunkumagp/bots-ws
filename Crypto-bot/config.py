# Binance API Configuration
API_KEY = "Fp7qQEoWxe986CsjOiLk2lRC2VF27AMHp8nwPg11WPc0aPu5PninVlSkH303Nppw"
API_SECRET = "nxlNVJLF8p3fLtVNoQt7Qk9GjlLS3rlkV3TqtN1bqc6TAhZF1JMWLQANYdNcJ5MP"

# Trading Configuration
TOP_PAIRS_COUNT = 20  # Scan top 20 USDT pairs
QUOTE_ASSET = "USDT"  # Trade against USDT

# Timeframes
TIMEFRAMES = ["15m", "1h"]

# Technical Indicators Configuration
RSI_PERIOD = 14
RSI_OVERBOUGHT = 70
RSI_OVERSOLD = 30

MACD_FAST = 12
MACD_SLOW = 26
MACD_SIGNAL = 9

EMA_SHORT = 9
EMA_LONG = 21

# Order Configuration
ORDER_QUANTITY_PERCENT = 0.5  # Use 50% of available balance
MIN_ORDER_VALUE = 10  # Minimum USDT for order
MAX_ORDERS_PER_RUN = 1  # Max orders to place per bot run

# Risk Management
STOP_LOSS_PERCENT = 2  # Stop loss at 2%
TAKE_PROFIT_PERCENT = 5  # Take profit at 5%

# Bot Configuration
CHECK_INTERVAL = 300  # Check every 5 minutes (300 seconds)
LOG_FILE = "trading_bot.log"
