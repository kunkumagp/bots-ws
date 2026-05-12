# Quick Start Guide

## Setup (First Time Only)

1. **Install dependencies**:
```bash
pip install -r requirements.txt
```

2. **Verify your API keys are in config.py**:
```python
API_KEY = "your_key"
API_SECRET = "your_secret"
```

## Running the Bot

### Option 1: Test First (Recommended)
```bash
python test_bot.py
```
This verifies everything works before trading.

### Option 2: Backtest Historical Data
```bash
python backtest.py
```
Analyze historical performance on top pairs.

### Option 3: Run Live Trading Bot
```bash
python bot.py
```
The bot will:
- Run every 5 minutes (configurable in config.py)
- Scan top 20 USDT pairs
- Analyze on 15m and 1h timeframes
- Place orders when signal ≥ 60%
- Log everything to trading_bot.log

## Key Files

| File | Purpose |
|------|---------|
| `config.py` | Settings and API keys |
| `bot.py` | Main trading bot |
| `indicators.py` | Technical analysis |
| `test_bot.py` | Test suite |
| `backtest.py` | Historical analysis |
| `trading_bot.log` | Bot activity log |

## Customization

### Adjust Trading Sensitivity
Edit `config.py`:
```python
# More selective (fewer trades)
ORDER_QUANTITY_PERCENT = 0.3  # Use 30% per order
MAX_ORDERS_PER_RUN = 1        # Only 1 order per cycle

# More aggressive (more trades)
ORDER_QUANTITY_PERCENT = 1.0  # Use 100% per order
MAX_ORDERS_PER_RUN = 3        # Up to 3 orders per cycle
```

### Adjust Check Interval
```python
CHECK_INTERVAL = 300  # Default: 5 minutes
# Try 600 for 10 minutes, 1800 for 30 minutes
```

### Tweak Indicators
```python
RSI_PERIOD = 14        # More sensitive with lower values
MACD_FAST = 12         # Faster signals with lower values
EMA_SHORT = 9          # Quicker trends with lower values
```

## Monitoring

### Watch logs in real-time:
```bash
tail -f trading_bot.log
```

### Check last 50 trades:
```bash
tail -50 trading_bot.log | grep "Order placed"
```

## Safety Tips

1. **Start Small**: Test with small order amounts first
2. **Monitor Closely**: Watch the logs for first few hours
3. **Set Max Orders**: `MAX_ORDERS_PER_RUN = 1` to limit trades per cycle
4. **Use Stop Loss**: Configure `STOP_LOSS_PERCENT` in config
5. **Backup Config**: Save your configuration before changes

## Troubleshooting

### Bot stops immediately
Check `trading_bot.log` for errors. Common issues:
- API key/secret incorrect
- No internet connection
- Binance API is down

### No orders placed
- Check your USDT balance
- Signal strength might be too low (check `signal_strength` in logs)
- Try adjusting RSI or MACD thresholds

### "API rate limit exceeded"
- Reduce `TOP_PAIRS_COUNT` in config
- Increase `CHECK_INTERVAL`
- The bot respects rate limits, will retry

## Quick Debug

```bash
# Test connection only
python -c "from bot import BinanceBot; b = BinanceBot(); print('✓ Connected')"

# Get top pairs
python -c "from bot import BinanceBot; b = BinanceBot(); pairs = b.get_top_usdt_pairs(); print(pairs[:5])"

# Check balance
python -c "from bot import BinanceBot; b = BinanceBot(); print(f'USDT Balance: {b.get_account_balance()}')"
```

## Performance Optimization

1. **Reduce pairs to scan**:
   ```python
   TOP_PAIRS_COUNT = 10  # Instead of 20
   ```

2. **Increase check interval**:
   ```python
   CHECK_INTERVAL = 600  # 10 minutes instead of 5
   ```

3. **Only trade major pairs**:
   Edit bot.py `get_top_usdt_pairs()` to filter only BTC, ETH, BNB pairs

## Support Resources

- [Binance API Docs](https://binance-docs.github.io/apidocs/)
- [Python-Binance Docs](https://python-binance.readthedocs.io/)
- Check `trading_bot.log` for detailed error messages

---

**Ready to trade?** Run `python bot.py` and watch the logs! 🚀
