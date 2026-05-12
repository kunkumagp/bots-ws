# Paper Trading Guide

## What is Paper Trading?

Paper trading (also called "simulator trading" or "backtesting in real-time") lets you test your bot's strategy WITHOUT using real money. On Binance, this is done using their **Testnet** - a sandbox environment with fake currency.

## Setup Paper Trading

### 1. Understand Testnet vs Production

| Aspect | Testnet (Paper) | Production (Real) |
|--------|-----------------|------------------|
| **API URL** | testnet.binance.vision | api.binance.com |
| **Money** | Fake USDT | Real USDT |
| **Risk** | None - Testing only | Real loss possible |
| **Data** | Same market data | Real market data |
| **Orders** | Simulated | Actually placed |

### 2. Get Testnet Credentials

1. Go to [https://testnet.binance.vision/](https://testnet.binance.vision/)
2. Click "Generate HMAC_SHA256 Key"
3. Copy the **API Key** and **Secret Key**
4. Already included in `testnet_config.py` - you can use the default demo keys

### 3. Get Free Testnet USDT

On testnet, you need fake USDT to test trading:

1. Go to [https://testnet.binance.vision/faucet/btc](https://testnet.binance.vision/faucet/btc)
2. Request free testnet tokens (BTC, ETH, USDT, etc.)
3. Wait a few seconds for them to appear in your testnet account

### 4. Run Paper Trading Bot

```bash
python paper_bot.py
```

The bot will:
- ✓ Connect to Binance TESTNET (not production)
- ✓ Scan top USDT pairs (fake data, but same analysis)
- ✓ Place test orders with fake USDT
- ✓ Log everything to `paper_trading.log`
- ✓ Use zero real money

## Key Features of Paper Bot

1. **Same Strategy**: Uses identical technical analysis as production bot
2. **Real-time Data**: Analyzes real market conditions from testnet
3. **No Risk**: No real money involved - only fake testnet USDT
4. **Full Testing**: Tests all features: order placement, balance checking, logging
5. **Safe Experimentation**: Try different configurations without fear

## What Gets Logged

Every paper trade is logged with:
```
2026-05-12 10:30:45 - PaperTradingBot - INFO - 📝 [PAPER TRADE] Placing BUY order: BTCUSDT - 0.001 coins @ 50000 USDT
2026-05-12 10:30:46 - PaperTradingBot - INFO - ✓ [PAPER TRADE] Order placed successfully: 12345678
```

## Monitor Paper Trading

Watch logs in real-time:
```bash
tail -f paper_trading.log
```

## Testing Checklist

- [ ] Bot connects to testnet ✓
- [ ] Gets top USDT pairs ✓
- [ ] Analyzes indicators on real data ✓
- [ ] Places paper orders ✓
- [ ] Updates balance ✓
- [ ] Logs all activity ✓

## Before Going Live

1. Run paper bot for at least 24 hours
2. Check logs for any errors
3. Review all paper trades placed
4. Verify signal detection is working
5. Make sure order sizing is comfortable
6. Adjust indicators if needed

Then: Switch to production bot with real money ✓

## Troubleshooting Paper Trading

**Q: Bot doesn't connect to testnet**
A: Check testnet_config.py has valid API keys

**Q: No paper orders being placed**
A: Check paper_trading.log for signal strength - may be below 60% threshold

**Q: "Insufficient balance" error**
A: Get more testnet USDT from https://testnet.binance.vision/faucet/

**Q: Orders failing**
A: Testnet may have different trading pairs - check available pairs

## Quick Start for Paper Trading

```bash
# 1. Check if dependencies are installed
pip list | grep python-binance

# 2. Test first
python test_bot.py

# 3. Run paper trading
python paper_bot.py

# 4. Monitor logs
tail -f paper_trading.log

# 5. After 24+ hours, review results
cat paper_trading.log | grep "PAPER TRADE"
```

## Key Differences from Production

**Paper Bot** (`paper_bot.py`):
- Uses testnet credentials
- Connects to testnet API
- Places orders on testnet
- Uses fake USDT only
- Safe for testing

**Production Bot** (`bot.py`):
- Uses real Binance API keys
- Connects to live market
- Places real orders
- Uses real USDT
- ⚠️ Real money at risk

## Switching from Paper to Production

When you're ready for real trading:

1. **Backup your config**:
   ```bash
   cp config.py config_backup.py
   ```

2. **Add real credentials to config.py**:
   ```python
   API_KEY = "your_real_api_key"
   API_SECRET = "your_real_api_secret"
   ```

3. **Reduce order size for testing**:
   ```python
   ORDER_QUANTITY_PERCENT = 0.1  # Start with 10%
   MAX_ORDERS_PER_RUN = 1        # Only 1 per cycle
   ```

4. **Run production bot**:
   ```bash
   python bot.py
   ```

5. **Monitor closely**:
   ```bash
   tail -f trading_bot.log
   ```

## Paper Trading Results

The bot will generate results like:

```
🧪 PAPER TRADING BOT RUN (Testnet - No Real Money)
💰 Available USDT (testnet): 50.00
📝 [PAPER TRADE] Placing BUY order: ETHUSDT - 0.025 coins @ 2000 USDT
✓ [PAPER TRADE] Order placed successfully: 12345678
📊 Total paper orders placed: 1
```

---

**Remember**: Paper trading with fake money builds confidence. The strategy is identical to production, so successful paper trading = ready for live trading! 🎯
