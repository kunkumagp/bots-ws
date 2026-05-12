# Paper Trading Bot - Setup Instructions

## Current Status
✓ Bot is running on Binance TESTNET
✓ All dependencies installed
✓ Connected to testnet successfully

## Next Steps to Get Trading

### Step 1: Get Testnet API Keys (2 minutes)

1. Go to [https://testnet.binance.vision/](https://testnet.binance.vision/)
2. Click **"Generate HMAC_SHA256 Key"**
3. Copy the two keys shown:
   - **API Key** (looks like: `vmPUZE6mv9SD5VNHk4HlWFsOa6...`)
   - **Secret Key** (looks like: `NhqPtmdSJYdKjVHyU5n0u4Kep3t5KfE...`)

### Step 2: Update Configuration

Edit `testnet_config.py` and paste your keys:

```python
TESTNET_API_KEY = "PASTE_YOUR_API_KEY_HERE"
TESTNET_API_SECRET = "PASTE_YOUR_SECRET_KEY_HERE"
```

### Step 3: Get Free Testnet USDT (2 minutes)

1. Go to [https://testnet.binance.vision/faucet/usdt](https://testnet.binance.vision/faucet/usdt)
2. Click **"Give me USDT"** button
3. Wait a few seconds - free testnet USDT will appear in your account
4. You can request more USDT as needed from the faucet

### Step 4: Verify Setup

Check your testnet account:
1. Go to [https://testnet.binance.vision/](https://testnet.binance.vision/)
2. Click **"My Assets"** 
3. You should see USDT balance
4. Note: Testnet balances reset periodically

### Step 5: Restart the Bot

Stop the current bot (Ctrl+C in terminal) and restart:

```bash
python paper_bot.py
```

## What Will Happen

The bot will:
```
[CYCLE 1]
✓ Connect to testnet
✓ Check your testnet USDT balance
✓ Scan top 20 USDT pairs
✓ Analyze indicators (RSI, MACD, EMA)
✓ Find best opportunities
✓ Place test buy orders (no real money!)
✓ Log everything to paper_trading.log

[EVERY 5 MINUTES]
✓ Repeat the cycle
```

## Monitoring Paper Trades

Check the log file in real-time:

```bash
# Windows PowerShell
tail -f paper_trading.log

# Or directly view
type paper_trading.log
```

You'll see logs like:
```
[ORDER] Placing BUY order: ETHUSDT - 0.025 coins @ 2000 USDT
[SUCCESS] Order placed successfully: 12345678
[SUMMARY] Total paper orders placed: 1
```

## Key Points

- **No Real Money**: All trades use fake testnet USDT
- **Real Data**: Analyzes real Binance market prices
- **Real Strategy**: Uses same indicators as production bot
- **Full Testing**: Test everything without risk
- **24/7 Testing**: Run as long as you want

## Troubleshooting

### "API-key format invalid"
- Make sure you copied the keys correctly from testnet.binance.vision
- No spaces before or after the keys
- Restart the bot after updating config

### "Insufficient balance" 
- Go to [https://testnet.binance.vision/faucet/usdt](https://testnet.binance.vision/faucet/usdt)
- Request more free testnet USDT
- Wait 30 seconds and restart bot

### No trades being placed
- Check signal strength in logs (may need ≥60%)
- Try for 30 minutes - may take time for good signals
- Check paper_trading.log for details

### Bot runs but no output
- Output goes to `paper_trading.log`
- Run: `tail -f paper_trading.log`

## Ready for Production?

After running paper trading for 24+ hours:

1. Switch to real trading with `python bot.py`
2. **IMPORTANT**: Start with small order sizes
3. **IMPORTANT**: Monitor logs closely
4. **IMPORTANT**: Never invest more than you can afford to lose

---

**Questions?**
- Check `paper_trading.log` for detailed error messages
- Read [PAPER_TRADING_GUIDE.md](PAPER_TRADING_GUIDE.md)
- Visit [Binance Testnet Docs](https://testnet.binance.vision/)

**Current Status**: Bot running on testnet - waiting for configuration ⏳
