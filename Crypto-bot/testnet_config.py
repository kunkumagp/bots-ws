# Testnet Configuration for Paper Trading
# These credentials are for Binance Testnet (paper trading, no real money)
# Get testnet credentials from: https://testnet.binance.vision/

# TESTNET API KEYS (Use these for paper trading)
TESTNET_API_KEY = "Fp7qQEoWxe986CsjOiLk2lRC2VF27AMHp8nwPg11WPc0aPu5PninVlSkH303Nppw"
TESTNET_API_SECRET = "nxlNVJLF8p3fLtVNoQt7Qk9GjlLS3rlkV3TqtN1bqc6TAhZF1JMWLQANYdNcJ5MP"

# These will override the production settings when using testnet
USE_TESTNET = True
TESTNET_BASE_URL = "https://testnet.binance.vision/api"
TESTNET_STREAM_URL = "wss://stream.testnet.binance.vision:9443"

# Trading Configuration (Same as production)
TOP_PAIRS_COUNT = 20
QUOTE_ASSET = "USDT"
TIMEFRAMES = ["15m", "1h"]

# Technical Indicators Configuration (Same as production)
RSI_PERIOD = 14
RSI_OVERBOUGHT = 70
RSI_OVERSOLD = 30

MACD_FAST = 12
MACD_SLOW = 26
MACD_SIGNAL = 9

EMA_SHORT = 9
EMA_LONG = 21

# Order Configuration (Paper trading)
ORDER_QUANTITY_PERCENT = 0.5
MIN_ORDER_VALUE = 10
MAX_ORDERS_PER_RUN = 1

# Risk Management
STOP_LOSS_PERCENT = 2
TAKE_PROFIT_PERCENT = 5

# Bot Configuration
CHECK_INTERVAL = 300
LOG_FILE = "paper_trading.log"
