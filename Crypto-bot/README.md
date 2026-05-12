# Binance Trading Bot

A sophisticated Python trading bot for Binance that automatically scans the top 20 USDT trading pairs, analyzes them using multiple technical indicators, and executes buy orders when optimal conditions are detected.

## Features

- **Top Pair Scanning**: Automatically identifies and monitors the top 20 USDT trading pairs by volume
- **Multi-Timeframe Analysis**: Analyzes price action on both 15-minute and 1-hour timeframes
- **Advanced Indicators**: 
  - RSI (Relative Strength Index) - Detects overbought/oversold conditions
  - MACD (Moving Average Convergence Divergence) - Identifies momentum and trend changes
  - EMA Crossover - Determines trend direction
- **Signal Strength Scoring**: Calculates a composite score (0-100%) based on all indicators
- **Automated Trading**: Places spot buy orders when conditions align
- **Risk Management**: Configurable stop loss and take profit levels
- **Comprehensive Logging**: Detailed logs of all bot activity and trades

## Installation

1. **Clone or navigate to the Crypto-bot folder**

2. **Install dependencies**:
```bash
pip install -r requirements.txt
```

## Configuration

Edit `config.py` to customize the bot's behavior:

### API Keys
```python
API_KEY = "your_binance_api_key"
API_SECRET = "your_binance_api_secret"
```

### Trading Settings
```python
TOP_PAIRS_COUNT = 20          # Number of pairs to scan
QUOTE_ASSET = "USDT"          # Trading quote asset
ORDER_QUANTITY_PERCENT = 0.5  # % of available balance per order
MAX_ORDERS_PER_RUN = 1        # Max orders per bot execution
```

### Technical Indicators
```python
RSI_PERIOD = 14               # RSI calculation period
RSI_OVERBOUGHT = 70          # Overbought threshold
RSI_OVERSOLD = 30            # Oversold threshold

MACD_FAST = 12               # Fast EMA period
MACD_SLOW = 26               # Slow EMA period
MACD_SIGNAL = 9              # Signal line period

EMA_SHORT = 9                # Short EMA period
EMA_LONG = 21                # Long EMA period
```

### Risk Management
```python
STOP_LOSS_PERCENT = 2        # Stop loss at 2%
TAKE_PROFIT_PERCENT = 5      # Take profit at 5%
```

## Usage

### Run the Bot

Start the trading bot:
```bash
python bot.py
```

The bot will:
1. Connect to Binance API
2. Scan top 20 USDT pairs every 5 minutes
3. Analyze each pair on 15m and 1h timeframes
4. Place buy orders when signal strength ≥ 60%
5. Log all activity to `trading_bot.log`

### Test the Bot

Before running live trading, test all components:
```bash
python test_bot.py
```

This will:
- ✓ Test Binance API connection
- ✓ Fetch and display top USDT pairs
- ✓ Test technical indicators
- ✓ Test full pair analysis
- ✓ Display account balance

## Signal Strength Calculation

The bot calculates a composite signal strength score based on:

1. **RSI Analysis (30%)**: 
   - Looks for RSI between oversold and 50 on both timeframes
   - Indicates reversal or early trend

2. **MACD Analysis (25%)**:
   - Positive histogram on both timeframes
   - Indicates bullish momentum

3. **EMA Crossover (25%)**:
   - Detects when short EMA crosses above long EMA
   - Signals trend change

4. **Trend Alignment (20%)**:
   - Both timeframes showing uptrend
   - Confirms strong trend direction

**Trading Triggers**:
- Signal Strength ≥ 60% = Place buy order
- Lower thresholds can be modified in `analyze_pair()` function

## File Structure

```
Crypto-bot/
├── config.py          # Configuration and settings
├── bot.py             # Main trading bot
├── indicators.py      # Technical analysis functions
├── test_bot.py        # Test suite
├── requirements.txt   # Python dependencies
├── trading_bot.log    # Bot activity log (generated)
└── README.md          # This file
```

## Technical Indicators Explained

### RSI (Relative Strength Index)
- **Range**: 0-100
- **Signal**: 
  - < 30: Oversold (potential buy)
  - > 70: Overbought (potential sell)
  - 30-70: Neutral

### MACD (Moving Average Convergence Divergence)
- **Components**: 
  - MACD Line: 12-period EMA - 26-period EMA
  - Signal Line: 9-period EMA of MACD
  - Histogram: MACD Line - Signal Line
- **Signal**:
  - Positive histogram: Bullish momentum
  - MACD crosses above signal: Buy signal

### EMA Crossover
- **Components**: 
  - Short EMA (9-period)
  - Long EMA (21-period)
- **Signal**:
  - Short EMA > Long EMA: Uptrend
  - Short EMA < Long EMA: Downtrend
  - Crossover points: Trend reversal

## Risk Management

⚠️ **Important Notes**:

1. **Paper Trading First**: Test with small amounts or use testnet
2. **Monitor Logs**: Check `trading_bot.log` regularly
3. **Set Stop Loss**: Modify `STOP_LOSS_PERCENT` in config
4. **Adjust Sensitivity**: Increase signal strength threshold to be more selective
5. **API Rate Limits**: Binance has API rate limits; bot respects these

## Troubleshooting

### "API key error"
- Verify API key and secret in `config.py`
- Ensure API key has proper permissions (Enable Spot Trading, Enable Reading)
- Check API key hasn't been revoked

### "Insufficient balance"
- Ensure you have at least `MIN_ORDER_VALUE` (10 USDT) available
- Check for open orders blocking balance

### "No trading opportunities"
- Market conditions may not match the configured indicators
- Adjust RSI thresholds or signal strength requirement
- Check trading_bot.log for detailed analysis

### "Connection timeout"
- Check internet connection
- Verify Binance API status
- Try reducing `TOP_PAIRS_COUNT` to reduce API calls

## Performance Tips

1. **Reduce API calls**: Increase `CHECK_INTERVAL` 
2. **Lower signal threshold**: More trades but higher risk
3. **Use limit orders**: Modify `place_buy_order()` for limit orders
4. **Monitor volume**: Focus on high-volume pairs

## Logging

All bot activity is logged to `trading_bot.log` including:
- Bot start/stop events
- API connection status
- Pairs scanned and analysis results
- Orders placed
- Errors and warnings

View logs:
```bash
tail -f trading_bot.log
```

## API Binance Documentation

- [Binance API Docs](https://binance-docs.github.io/apidocs/)
- [Python-Binance Library](https://python-binance.readthedocs.io/)

## Disclaimer

This is an automated trading bot using real API connections. Use at your own risk:

- **Past performance** does not guarantee future results
- **Market conditions** can change rapidly
- **Technical analysis** is not always accurate
- **Always use stop losses** to protect your capital
- **Start small** and scale up as you gain confidence
- **Never invest** more than you can afford to lose

## Security

⚠️ **Protect Your API Keys**:
- Never commit `config.py` with real credentials to git
- Use `.gitignore` to prevent accidental commits
- Consider using environment variables for production
- Regenerate API keys if compromised

## License

This project is provided as-is for educational purposes.

## Support

For issues or improvements, check:
1. Log file for error messages
2. Test suite for connectivity
3. Binance API documentation
4. Python-Binance library documentation

---

**Last Updated**: 2026-05-12
**Version**: 1.0
