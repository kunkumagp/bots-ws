// ============================================================
//  DERIV MULTIPLIERS BOT
//  Signal: MACD + Stochastic + RSI confluence (3-of-3 required)
//  Trade type: MULTUP (buy) / MULTDOWN (sell)
// ============================================================

const accounts = [
    { name: "KunkumaGP",          value: "pat_75687aeb556fbcef179dfe7fa307bd403a28ec334dcbe0a45323c3d92a7c7aae" },
    { name: "KUNKUMAGP Real",      value: "Y71P0GIOxz3YYvr" },
    { name: "Kunkuma Trading",     value: "hJfU1x5xpoSTwHe" },
    { name: "W H K G Prasanna 85", value: "iVOpdm24hBhw3JI" },
];

const marketArray = [
    { value: "R_10",  name: "Volatility 10 Index"  },
    { value: "R_25",  name: "Volatility 25 Index"  },
    { value: "R_50",  name: "Volatility 50 Index"  },
    { value: "R_75",  name: "Volatility 75 Index"  },
    { value: "R_100", name: "Volatility 100 Index" },
];

// ── Config ────────────────────────────────────────────────────
const ACCOUNT_TYPE = "demo";
// const ACCOUNT_TYPE = "real";

const APP_ID = "33oWYOQxAL3YJYtTvBRep";

// Multiplier settings
const MULTIPLIER           = 400;   // R_75 accepts: 400, 1000, 2000, 3000, 4000
const STOP_LOSS_PCT        = 30;    // stop-loss  = 30% of stake
const TAKE_PROFIT_PCT      = 60;    // take-profit = 60% of stake

// ── Indicator settings ────────────────────────────────────────
// MACD
const MACD_FAST            = 12;
const MACD_SLOW            = 26;
const MACD_SIGNAL          = 9;

// Stochastic
const STOCH_K_PERIOD       = 14;   // %K lookback
const STOCH_D_PERIOD       = 3;    // %D smoothing
const STOCH_OVERSOLD       = 25;   // below = oversold  (buy zone)
const STOCH_OVERBOUGHT     = 75;   // above = overbought (sell zone)

// RSI
const RSI_PERIOD           = 14;
const RSI_OVERSOLD         = 45;   // below = bullish bias (relaxed for tick data)
const RSI_OVERBOUGHT       = 55;   // above = bearish bias

// Confluence: how many indicators must agree (2 = relaxed, 3 = strict)
const MIN_CONFLUENCE       = 3;

// Warmup: minimum ticks before any signal fires
const WARMUP_TICKS         = MACD_SLOW + MACD_SIGNAL + 5;

// Tick buffer
const TICK_BUFFER_SIZE     = 150;
const NO_TRADE_TICK_LIMIT  = 120;

// ── DOM refs (same IDs as original bot) ──────────────────────
const accountSelectElement    = document.getElementById("account_select");
const marketSelectElement     = document.getElementById("market");
const targetProfitInputElement = document.getElementById("target_profit");
const initialStakeInputElement = document.getElementById("initial_stake");
const authenticateButton      = document.getElementById("authenticateButton");
const scriptButton            = document.getElementById("scriptButton");
const infoOutput              = document.getElementById("info_output");
const params                  = new URLSearchParams(window.location.search);

// ── State ─────────────────────────────────────────────────────
let ws = null;
let isRunning = false, intervalId;
let tickPrices = [];                // rolling price buffer
let hasRequestedTickHistory = false;
let pendingContractType = null;     // "MULTUP" | "MULTDOWN" | null
let ticksWithoutTrade = 0;
let consecutiveLossCount = 0;
let lastContractId = null;
let isTradeOpen = false;
let openTradeDirection = null;      // "MULTUP" | "MULTDOWN"
let openTradeStake = 0;

// Indicator prev-state (for crossover detection)
let prevMacdHist  = null;
let prevStochK    = null;

// Financials
const martingaleMultiplier        = 2.07112;
let dayTarget                     = 0;
let startingAmount                = 250;
let sessionTargetPercentage       = 1 / startingAmount;
let targetPercentage              = 1 / startingAmount;
let amountPercentage              = 0.5 / 100;
let finishTargetPercentagePerDay  = 3 / 100;
let netProfit                     = 0;
let targetAmount                  = 0;
let winTradeCount                 = 0;
let lossTradeCount                = 0;
let totalTradeCount               = 0;
let totalProfitAmount             = 0;
let initialAccountBalance         = 0;
let updatedAccountBalance         = 0;
let tradeProposal                 = null;
let lastTradeId                   = null;
let tradeTypeDisplay              = "";
let totalLossAmount               = 0;
let currentProfitAmount           = 0;
let currentLossAmount             = 0;
let stopTimer                     = false;

let market, apiToken, stake, tickCount, contractType;
let authSuccess = false, automation = false;
let amountPutForTrading           = 0;

if (params.get("target")) {
    dayTarget = Number(params.get("target"));
} else if (targetProfitInputElement && targetProfitInputElement.value) {
    dayTarget = Number(targetProfitInputElement.value);
}

// ── Populate selects ──────────────────────────────────────────
accounts.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.name;
    accountSelectElement.appendChild(option);
});

marketArray.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.name;
    marketSelectElement.appendChild(option);
});

accountSelectElement.value = accounts[0].value;
marketSelectElement.value  = "R_75";  // default: V75 — best for multipliers
apiToken = accountSelectElement.value;

accountSelectElement.addEventListener("change", () => {
    apiToken = accountSelectElement.value;
});

if (targetProfitInputElement) {
    targetProfitInputElement.addEventListener("change", () => {
        const val = Number(targetProfitInputElement.value);
        if (initialAccountBalance > 0 && val > 0) {
            sessionTargetPercentage = val / initialAccountBalance;
            targetAmount = val;
        }
        console.log(`Session target percentage updated: ${sessionTargetPercentage}`);
    });
}

market = (typeof getRandomMarket === "function")
    ? getRandomMarket(marketArray, "")
    : marketSelectElement.value;

Object.defineProperty(window, "updatedAccountBalance", {
    get: function ()  { return window._underlyingBalance || 0; },
    set: function (v) { window._underlyingBalance = typeof v === "string" ? parseFloat(v) : v; },
    configurable: true,
});

// ── Indicator math (pure JS, zero libraries) ─────────────────

/** Simple moving average of last N values */
function sma(arr, period) {
    if (arr.length < period) return null;
    const slice = arr.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

/** Full EMA array over entire prices array */
function emaArray(prices, period) {
    if (prices.length < period) return [];
    const k = 2 / (period + 1);
    const result = [];
    // seed with SMA
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    result.push(ema);
    for (let i = period; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
        result.push(ema);
    }
    return result;
}

/**
 * MACD — returns { macdLine, signalLine, histogram } for the latest tick.
 * macdLine  = EMA(fast) - EMA(slow)
 * signalLine = EMA(macdLine values, signalPeriod)
 * histogram  = macdLine - signalLine
 */
function calcMACD(prices) {
    const minLen = MACD_SLOW + MACD_SIGNAL;
    if (prices.length < minLen) return null;

    const fastEMA = emaArray(prices, MACD_FAST);
    const slowEMA = emaArray(prices, MACD_SLOW);

    // Align: fastEMA is longer — trim front so both start at same tick
    const offset = fastEMA.length - slowEMA.length;
    const macdLine = slowEMA.map((s, i) => fastEMA[i + offset] - s);

    if (macdLine.length < MACD_SIGNAL) return null;

    const signalEMA = emaArray(macdLine, MACD_SIGNAL);
    const macdNow   = macdLine[macdLine.length - 1];
    const sigNow    = signalEMA[signalEMA.length - 1];

    return {
        macdLine:   macdNow,
        signalLine: sigNow,
        histogram:  macdNow - sigNow,
    };
}

/**
 * Stochastic Oscillator — returns { k, d }
 * %K = (close - lowestLow) / (highestHigh - lowestLow) * 100
 * %D = SMA(%K, dPeriod)
 * On tick data close = high = low, so we use a rolling window.
 */
function calcStochastic(prices) {
    const minLen = STOCH_K_PERIOD + STOCH_D_PERIOD;
    if (prices.length < minLen) return null;

    // Build %K series for the last (STOCH_K_PERIOD + STOCH_D_PERIOD) bars
    const kValues = [];
    const startIdx = prices.length - STOCH_K_PERIOD - STOCH_D_PERIOD;
    for (let i = startIdx; i < prices.length - STOCH_K_PERIOD + 1; i++) {
        const window = prices.slice(i, i + STOCH_K_PERIOD);
        const high   = Math.max(...window);
        const low    = Math.min(...window);
        const close  = window[window.length - 1];
        const range  = high - low;
        kValues.push(range === 0 ? 50 : ((close - low) / range) * 100);
    }

    if (kValues.length < STOCH_D_PERIOD) return null;

    const k = kValues[kValues.length - 1];
    const d = kValues.slice(-STOCH_D_PERIOD).reduce((a, b) => a + b, 0) / STOCH_D_PERIOD;

    return { k, d };
}

/**
 * RSI (Wilder's smoothed method)
 * Returns RSI value 0–100.
 */
function calcRSI(prices) {
    const minLen = RSI_PERIOD + 1;
    if (prices.length < minLen) return null;

    const slice = prices.slice(-(RSI_PERIOD + 1));
    let gains = 0, losses = 0;

    for (let i = 1; i < slice.length; i++) {
        const diff = slice[i] - slice[i - 1];
        if (diff > 0) gains  += diff;
        else          losses -= diff;
    }

    const avgGain = gains  / RSI_PERIOD;
    const avgLoss = losses / RSI_PERIOD;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

// ── Signal engine (3-indicator confluence) ────────────────────

/**
 * Returns "MULTUP", "MULTDOWN", or null.
 * A direction is only returned when MIN_CONFLUENCE indicators agree.
 * @returns {"MULTUP"|"MULTDOWN"|null}
 */
function getMultiplierSignal() {
    if (tickPrices.length < WARMUP_TICKS) return null;

    // ── MACD ─────────────────────────────────────────────────
    const macd = calcMACD(tickPrices);
    if (!macd) return null;

    // Signal: histogram crossed above zero (bullish) or below zero (bearish)
    let macdBull = false, macdBear = false;
    if (prevMacdHist !== null) {
        if (prevMacdHist <= 0 && macd.histogram > 0) macdBull = true;
        if (prevMacdHist >= 0 && macd.histogram < 0) macdBear = true;
    }
    // Also count if histogram is clearly positive/negative (momentum confirmation)
    if (macd.histogram > 0) macdBull = true;
    if (macd.histogram < 0) macdBear = true;
    prevMacdHist = macd.histogram;

    // ── Stochastic ───────────────────────────────────────────
    const stoch = calcStochastic(tickPrices);
    if (!stoch) return null;

    let stochBull = false, stochBear = false;
    // Crossover from oversold = bullish; from overbought = bearish
    if (prevStochK !== null) {
        if (prevStochK < STOCH_OVERSOLD  && stoch.k > stoch.d) stochBull = true;
        if (prevStochK > STOCH_OVERBOUGHT && stoch.k < stoch.d) stochBear = true;
    }
    // Zone confirmation
    if (stoch.k < STOCH_OVERSOLD)   stochBull = true;
    if (stoch.k > STOCH_OVERBOUGHT) stochBear = true;
    prevStochK = stoch.k;

    // ── RSI ───────────────────────────────────────────────────
    const rsi = calcRSI(tickPrices);
    if (rsi === null) return null;

    const rsiBull = rsi < RSI_OVERSOLD;
    const rsiBear = rsi > RSI_OVERBOUGHT;

    // ── Confluence score ──────────────────────────────────────
    const bullScore = [macdBull, stochBull, rsiBull].filter(Boolean).length;
    const bearScore = [macdBear, stochBear, rsiBear].filter(Boolean).length;

    let signal = null;
    if (bullScore >= MIN_CONFLUENCE) signal = "MULTUP";
    else if (bearScore >= MIN_CONFLUENCE) signal = "MULTDOWN";

    console.log(
        `[SIGNAL] MACD hist: ${macd.histogram.toFixed(5)} | Stoch K: ${stoch.k.toFixed(1)} D: ${stoch.d.toFixed(1)} | RSI: ${rsi.toFixed(1)}` +
        ` | Bull: ${bullScore}/3 Bear: ${bearScore}/3 => ${signal || "WAIT"}`
    );

    return signal;
}

// ── Tick analysis entry point (replaces logEvenOddPercentages) ─

function analyzeForMultiplier(prices) {
    if (!Array.isArray(prices) || prices.length === 0) return;

    const signal = getMultiplierSignal();

    if (signal) {
        if (!isTradeOpen && !pendingContractType) {
            triggerMultiplierTrade(signal);
            ticksWithoutTrade = 0;
            return;
        }
    }

    if (isTradeOpen || pendingContractType) return;

    ticksWithoutTrade += 1;

    if (ticksWithoutTrade >= NO_TRADE_TICK_LIMIT && lossTradeCount === 0) {
        changeMarketAfterNoTrade();
    }
}

// ── Trade trigger ─────────────────────────────────────────────

/**
 * Gate check then place a multiplier trade.
 * @param {"MULTUP"|"MULTDOWN"} direction
 */
function triggerMultiplierTrade(direction) {
    // Progressive loss gate — same thresholds as original bot
    if (consecutiveLossCount >= 3) {
        console.log("[GATE] 3+ consecutive losses — trade blocked.");
        return;
    }

    pendingContractType = direction;
    tradeTypeDisplay    = direction === "MULTUP" ? "Buy (MULTUP)" : "Sell (MULTDOWN)";
    placeMultiplierTrade(direction);
}

/**
 * Send the buy request directly (no proposal step needed for multipliers).
 * @param {"MULTUP"|"MULTDOWN"} direction
 */
function placeMultiplierTrade(direction) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.error("[TRADE] WebSocket not open.");
        pendingContractType = null;
        return;
    }

    // Derive stake
    amountPutForTrading = stake;

    // Balance guard
    if (updatedAccountBalance > 0 && stake > updatedAccountBalance) {
        webSocketConnectionStop();
        return;
    }

    const stopLossAmount   = Number((stake * STOP_LOSS_PCT   / 100).toFixed(2));
    const takeProfitAmount = Number((stake * TAKE_PROFIT_PCT / 100).toFixed(2));

    const buyRequest = {
        buy:   1,
        price: stake,
        parameters: {
            contract_type:     direction,   // "MULTUP" or "MULTDOWN"
            underlying_symbol: market,
            basis:             "stake",
            amount:            stake,
            currency:          "USD",
            multiplier:        MULTIPLIER,
            limit_order: {
                stop_loss:   stopLossAmount,
                take_profit: takeProfitAmount,
            },
        },
    };

    console.log(
        `[TRADE] Placing ${direction} | Stake: $${stake} | x${MULTIPLIER} | SL: $${stopLossAmount} | TP: $${takeProfitAmount}`
    );
    ws.send(JSON.stringify(buyRequest));
}

// ── Market switch (same logic as original) ────────────────────

function changeMarketAfterNoTrade() {
    if (lossTradeCount !== 0) return;

    const previousMarket = market;
    const nextMarket = (typeof getRandomMarket === "function")
        ? getRandomMarket(marketArray, previousMarket)
        : marketArray[0].value;

    if (!nextMarket || nextMarket === previousMarket) {
        ticksWithoutTrade = 0;
        return;
    }

    market = nextMarket;
    marketSelectElement.value = nextMarket;
    ticksWithoutTrade = 0;
    tickPrices = [];
    hasRequestedTickHistory = false;
    pendingContractType = null;
    fastEMAPrev = null;
    slowEMAPrev = null;

    console.log(`[MARKET SWITCH] No trade in ${NO_TRADE_TICK_LIMIT} ticks. ${previousMarket} -> ${nextMarket}`);

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ forget_all: "ticks" }));
        subscribeToTicks();
    }
}

// ── Auth + connection (identical to original) ─────────────────

async function fetchAuthenticatedConnectionUrl(token) {
    try {
        const accountDetailsResponse = await fetch(
            "https://api.derivws.com/trading/v1/options/accounts",
            {
                method: "GET",
                headers: {
                    "Deriv-App-ID":  APP_ID,
                    "Authorization": `Bearer ${token}`,
                },
            }
        );

        if (!accountDetailsResponse.ok) {
            throw new Error(`Failed to fetch account list: ${accountDetailsResponse.statusText}`);
        }

        const accountData = await accountDetailsResponse.json();
        let activeAccount = null;

        if (accountData.data && accountData.data.length > 0) {
            activeAccount = accountData.data.find(acc => acc.account_type === ACCOUNT_TYPE);
        }

        if (!activeAccount) {
            console.log("No account found. Creating one...");
            const createResponse = await fetch(
                "https://api.derivws.com/trading/v1/options/accounts",
                {
                    method: "POST",
                    headers: {
                        "Deriv-App-ID":  APP_ID,
                        "Authorization": `Bearer ${token}`,
                        "Content-Type":  "application/json",
                    },
                    body: JSON.stringify({ currency: "USD", group: "row", account_type: "demo" }),
                }
            );

            if (!createResponse.ok) throw new Error(`Failed to create account: ${createResponse.statusText}`);
            const createData = await createResponse.json();
            activeAccount = Array.isArray(createData.data) ? createData.data[0] : createData.data;

            if (typeof setFlashNotification === "function") {
                setFlashNotification(`Demo account created: ${activeAccount.account_id}`, 3);
            }
        }

        if (!activeAccount) throw new Error("No account available.");

        const otpUrl = `https://api.derivws.com/trading/v1/options/accounts/${activeAccount.account_id}/otp`;
        const response = await fetch(otpUrl, {
            method: "POST",
            headers: {
                "Deriv-App-ID":  APP_ID,
                "Authorization": `Bearer ${token}`,
                "Content-Type":  "application/json",
            },
        });

        if (!response.ok) throw new Error(`REST Handshake failure: ${response.statusText}`);
        const payload = await response.json();
        return payload.data.url;

    } catch (error) {
        console.error("OTP fetch failed:", error);
        if (typeof setFlashNotification === "function") {
            setFlashNotification("Authentication routing failed. Check App ID registration.", 0);
        }
        return null;
    }
}

async function initializeTradingSession() {
    if (ws) { try { ws.close(); } catch (e) {} }

    console.log("Requesting single-use token authorization channel...");
    const authorizedUrl = await fetchAuthenticatedConnectionUrl(apiToken);

    if (!authorizedUrl) {
        console.error("Halting. Cannot secure authenticated WebSocket link.");
        return;
    }

    console.log("Connecting to validated stream pipeline...");
    ws = new WebSocket(authorizedUrl);

    ws.onopen = function () {
        console.log("Connection open");
        startPing();
        ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
    };

    ws.onclose = function () {
        console.log("Connection closed");
        stopPing();
        setTimeout(() => {
            if (typeof reload === "function") reload();
        }, 30000);
    };

    ws.onerror = function (err) {
        console.error("WebSocket error:", err);
    };

    ws.onmessage = handleServerMessage;
}

if (authenticateButton) {
    authenticateButton.addEventListener("click", initializeTradingSession);
}

initializeTradingSession();

// ── Ping ──────────────────────────────────────────────────────

function startPing() {
    if (intervalId) return;
    intervalId = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ ping: 1 }));
        }
    }, 30000);
}

function stopPing() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

// ── Main message handler ──────────────────────────────────────

function handleServerMessage(event) {
    const wsResponse = JSON.parse(event.data);
    if (!wsResponse) return;

    // ── Balance / initial auth ────────────────────────────────
    if (wsResponse.msg_type === "balance" && initialAccountBalance === 0) {
        console.log("Authorization successful.\n-----------------------------\n\n");
        if (typeof setFlashNotification === "function") setFlashNotification("Authorization successful", 0);

        if (wsResponse.balance && typeof wsResponse.balance.balance !== "undefined") {
            initialAccountBalance  = parseFloat(wsResponse.balance.balance);
            updatedAccountBalance  = initialAccountBalance;
            if (typeof setAccountInfo === "function") setAccountInfo("initialAccountBalance", `$ ${initialAccountBalance}`);
            authSuccess = true;

            if (authenticateButton) {
                authenticateButton.innerHTML  = "Authenticated. Ready to trade.";
                authenticateButton.disabled   = true;
            }

            if (typeof resetParams === "function") resetParams();

            // Stake defaults to amountPercentage of balance
            stake = Number((initialAccountBalance * amountPercentage).toFixed(2));
            if (stake < 1) stake = 1.00; // Deriv minimum for multipliers
            amountPutForTrading = stake;
            try { if (initialStakeInputElement) initialStakeInputElement.value = Number(stake).toFixed(2); } catch (e) {}

            // Day target (3% of balance, persisted per day)
            try {
                const today      = new Date().toISOString().slice(0, 10);
                const storedDate = localStorage.getItem("date");
                let storedDayTarget = localStorage.getItem("dayTarget");

                if (!storedDate || !storedDayTarget || storedDate !== today) {
                    const computedTarget = Number((initialAccountBalance + (finishTargetPercentagePerDay * initialAccountBalance)).toFixed(2));
                    localStorage.setItem("date",      today);
                    localStorage.setItem("dayTarget", String(computedTarget));
                    dayTarget = computedTarget;
                } else {
                    dayTarget = Number(storedDayTarget);
                }

                if (typeof setAccountInfo === "function") setAccountInfo("targetAmount", `$ ${dayTarget}`);

                try {
                    targetAmount = Number((initialAccountBalance * sessionTargetPercentage).toFixed(2));
                    if (targetProfitInputElement) targetProfitInputElement.value = targetAmount;
                } catch (e) {}

                if (initialAccountBalance >= dayTarget) {
                    if (typeof setFlashNotification === "function") setFlashNotification("Day target already reached. Stopping for today.", 0);
                    try { localStorage.setItem("tradingStoppedForDay", "1"); } catch (e) {}
                    isRunning = false;
                    stopPing();
                    try { if (ws) ws.close(); } catch (e) {}
                    if (scriptButton) { scriptButton.disabled = true; scriptButton.innerText = "Stopped for day"; }
                    return;
                }
            } catch (e) { console.error("Error initializing day target:", e); }

            // Check persistent consecutive loss streak
            try {
                const savedStreak = parseInt(localStorage.getItem("consecutiveLossStreak")) || 0;
                const streakDate  = localStorage.getItem("consecutiveLossDate");
                const today       = new Date().toISOString().slice(0, 10);

                if (savedStreak >= 3 && streakDate === today) {
                    if (typeof setFlashNotification === "function") setFlashNotification("Stopped: consecutive loss limit reached today. Manual restart required.", 0);
                    try { localStorage.setItem("tradingStoppedForDay", "1"); } catch (e) {}
                    isRunning = false;
                    stopPing();
                    try { if (ws) ws.close(); } catch (e) {}
                    if (scriptButton) { scriptButton.disabled = true; scriptButton.innerText = "Stopped (3 losses)"; }
                    return;
                } else if (streakDate !== today) {
                    localStorage.removeItem("consecutiveLossStreak");
                    localStorage.removeItem("consecutiveLossDate");
                }
            } catch (e) {}

            if (dayTarget > 0 && updatedAccountBalance >= dayTarget) {
                if (typeof setFlashNotification === "function") setFlashNotification("Day target is done", 0);
            } else {
                runScript();
            }
        } else {
            if (typeof reload === "function") reload();
        }
    }

    // ── Ongoing balance updates ───────────────────────────────
    if (wsResponse.msg_type === "balance" && initialAccountBalance !== 0) {
        if (wsResponse.balance && typeof wsResponse.balance.balance !== "undefined") {
            updatedAccountBalance = parseFloat(wsResponse.balance.balance);
            netProfit = updatedAccountBalance - initialAccountBalance;
            if (typeof setAccountInfo === "function") {
                setAccountInfo("currentBalance",  `$ ${updatedAccountBalance.toFixed(2)}`);
                setAccountInfo("netProfit",        `$ ${netProfit.toFixed(2)}`);
            }
        }
    }

    // ── Tick history (seed buffer) ────────────────────────────
    if (wsResponse.msg_type === "history" && wsResponse.history && Array.isArray(wsResponse.history.prices)) {
        tickPrices = wsResponse.history.prices.slice(-TICK_BUFFER_SIZE);
        analyzeForMultiplier(tickPrices);
    }

    // ── Live tick ─────────────────────────────────────────────
    if (wsResponse.msg_type === "tick" && wsResponse.tick && typeof wsResponse.tick.quote !== "undefined") {
        tickPrices.push(wsResponse.tick.quote);
        if (tickPrices.length > TICK_BUFFER_SIZE) tickPrices = tickPrices.slice(-TICK_BUFFER_SIZE);
        analyzeForMultiplier(tickPrices);
    }

    // ── Buy response ──────────────────────────────────────────
    if (wsResponse.msg_type === "buy") {
        if (!wsResponse.buy || !wsResponse.buy.contract_id) {
            console.error("[BUY] Failed:", wsResponse.error || wsResponse);
            pendingContractType = null;
        } else {
            lastTradeId      = wsResponse.buy.contract_id;
            lastContractId   = lastTradeId;
            openTradeDirection = pendingContractType;
            openTradeStake     = stake;
            totalTradeCount   += 1;
            isTradeOpen        = true;
            automation         = true;

            tradeTypeDisplay = openTradeDirection === "MULTUP" ? "Buy" : "Sell";

            if (typeof setResultNotification === "function") {
                setResultNotification(lastTradeId, tradeTypeDisplay, market, wsResponse.buy.buy_price);
            }
            console.log("[BUY] Trade open:", wsResponse.buy);

            // Subscribe to contract updates so we catch SL/TP closes
            ws.send(JSON.stringify({
                proposal_open_contract: 1,
                contract_id: lastTradeId,
                subscribe: 1,
            }));
        }
    }

    // ── Contract update (SL / TP / manual close) ──────────────
    if (wsResponse.msg_type === "proposal_open_contract") {
        const contract = wsResponse.proposal_open_contract;
        if (!contract || contract.contract_id !== lastTradeId) return;

        if (contract.is_sold) {
            const profit = parseFloat(contract.profit);
            const result = profit >= 0 ? "Win" : "Loss";

            console.log(`[RESULT] ${result} | Profit: $${profit.toFixed(2)} | Direction: ${openTradeDirection}`);

            if (typeof setInfo === "function") setInfo(contract, profit);

            // Session target check
            try {
                const sessionTargetAmount = initialAccountBalance * sessionTargetPercentage;
                if (sessionTargetAmount > 0 && netProfit >= sessionTargetAmount) {
                    if (typeof setFlashNotification === "function") setFlashNotification("Session target reached. Reloading.", 0);
                    if (typeof reload === "function") reload();
                    return;
                }
            } catch (e) {}

            isTradeOpen        = false;
            openTradeDirection = null;
            pendingContractType = null;

            // Stake management (flat staking — no martingale on multipliers)
            // Win: keep same base stake. Loss: keep same base stake.
            // Multipliers have built-in SL so we don't need to recover via stake size.
            stake = amountPutForTrading;
            try { if (initialStakeInputElement) initialStakeInputElement.value = Number(stake).toFixed(2); } catch (e) {}

            // Loss streak tracking
            if (profit < 0) {
                lossTradeCount    += 1;
                consecutiveLossCount += 1;

                try {
                    localStorage.setItem("consecutiveLossStreak", consecutiveLossCount);
                    localStorage.setItem("consecutiveLossDate", new Date().toISOString().slice(0, 10));
                } catch (e) {}

                if (consecutiveLossCount >= 3) {
                    if (typeof setFlashNotification === "function") setFlashNotification("Stopped: 3 consecutive losses. Manual restart required.", 0);
                    try { localStorage.setItem("tradingStoppedForDay", "1"); } catch (e) {}
                    isRunning = false;
                    stopPing();
                    try { if (ws) ws.close(); } catch (e) {}
                    try { if (scriptButton) { scriptButton.disabled = true; scriptButton.innerText = "Stopped (3 losses)"; } } catch (e) {}
                    return;
                }
            } else {
                winTradeCount       += 1;
                consecutiveLossCount  = 0;
                try {
                    localStorage.removeItem("consecutiveLossStreak");
                    localStorage.removeItem("consecutiveLossDate");
                } catch (e) {}
            }

            // Day target check
            if (dayTarget > 0 && updatedAccountBalance >= dayTarget) {
                if (typeof setFlashNotification === "function") setFlashNotification("Day target reached! Stopping for today.", 0);
                try { localStorage.setItem("tradingStoppedForDay", "1"); } catch (e) {}
                isRunning = false;
                stopPing();
                try { if (ws) ws.close(); } catch (e) {}
                if (scriptButton) { scriptButton.disabled = true; scriptButton.innerText = "Stopped — day target done"; }
                return;
            }

            // Cooldown before next trade
            let cooldown = 0;
            if (consecutiveLossCount === 0) {
                cooldown = (typeof getRandomNumber === "function" ? getRandomNumber(1, 5)   : 2)  * 1000;
            } else if (consecutiveLossCount === 1) {
                cooldown = (typeof getRandomNumber === "function" ? getRandomNumber(15, 30)  : 20) * 1000;
            } else if (consecutiveLossCount === 2) {
                cooldown = (typeof getRandomNumber === "function" ? getRandomNumber(30, 60)  : 45) * 1000;
            }

            if (netProfit >= targetAmount) {
                if (typeof reload === "function") reload();
            } else {
                if (cooldown > 0 && typeof setTimer === "function") setTimer(cooldown);
                setTimeout(() => { runScript(); }, cooldown);
            }
        } else {
            // Contract still open — log current P&L
            const currentPnl = parseFloat(contract.bid_price || 0) - openTradeStake;
            console.log(`[OPEN] Contract ${lastTradeId} | Current P&L: $${currentPnl.toFixed(2)}`);

            setTimeout(() => {
                if (typeof fetchTradeDetails === "function") fetchTradeDetails(lastTradeId);
            }, 1000);
        }
    }

    // ── Error ─────────────────────────────────────────────────
    if (wsResponse.msg_type === "error") {
        console.error("[API ERROR]", wsResponse.error);
        if (wsResponse.error && wsResponse.error.code === "ContractBuyValidationError") {
            pendingContractType = null;
            isTradeOpen = false;
        }
    }
}

// ── Tick subscription ─────────────────────────────────────────

function subscribeToTicks() {
    if (hasRequestedTickHistory) return;
    hasRequestedTickHistory = true;
    ws.send(JSON.stringify({
        ticks_history: market,
        style:         "ticks",
        count:         TICK_BUFFER_SIZE,
        end:           "latest",
        subscribe:     1,
    }));
}

// ── Bot lifecycle ─────────────────────────────────────────────

function runScript() {
    isRunning = true;
    subscribeToTicks();
}

function webSocketConnectionStop() {
    console.log("[BOT HALTED] Stake exceeds balance. Stopping.");
    isRunning           = false;
    isTradeOpen         = false;
    pendingContractType = null;
    try { localStorage.setItem("tradingStoppedForDay", "1"); } catch (e) {}
    stopPing();
    if (ws) {
        try { ws.onclose = null; ws.close(); } catch (e) {}
        ws = null;
    }
    if (scriptButton) { scriptButton.disabled = true; scriptButton.innerText = "Stopped (balance too low)"; }
    if (typeof setFlashNotification === "function") {
        setFlashNotification("Bot Terminated: Stake request exceeds available balance.", 0);
    }
}

function webSocketConnectionStart() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log("[BRIDGE] Connection already live. Skipping reset.");
        authSuccess = true;
        return;
    }
    console.log("[BRIDGE] Socket closed. Re-connecting...");
    initializeTradingSession();
}