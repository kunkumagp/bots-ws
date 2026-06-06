const accounts = [
    { name: "KUNKUMAGP Testing", value: "pat_3264356d90def52f0033ef61272dcf6f26cf9076f839ac8dabcf43446932dfe9" },
    { name: "KunkumaGP", value: "pat_75687aeb556fbcef179dfe7fa307bd403a28ec334dcbe0a45323c3d92a7c7aae" },
];

const marketArray = [
    { value: "R_10", name: "Volatility 10 Index" },
    { value: "R_25", name: "Volatility 25 Index" },
    { value: "R_50", name: "Volatility 50 Index" },
    { value: "R_75", name: "Volatility 75 Index" },
    { value: "R_100", name: "Volatility 100 Index" },
];

// const ACCOUNT_CATEGORY = "options";
// const ACCOUNT_CATEGORY = "cfds";
const ACCOUNT_CATEGORY = "ctrader";

const ACCOUNT_TYPE = "demo";
// const ACCOUNT_TYPE = "real";

const MULTIPLIER_VALUE = 15;

// ─── Configuration & Global Constant Declarations ────────────────────────────
const APP_ID = "33jLZ26mnkXNN8GI4mJBI";
const accountSelectElement   = document.getElementById("account_select");
const marketSelectElement    = document.getElementById("market");
const targetProfitInputElement = document.getElementById("target_profit");
const initialStakeInputElement = document.getElementById("initial_stake");
const authenticateButton     = document.getElementById("authenticateButton");
const scriptButton           = document.getElementById("scriptButton");
const infoOutput             = document.getElementById("info_output");
const params                 = new URLSearchParams(window.location.search);

let ws = null;
let isRunning = false, intervalId;
let last50Prices = [];
let hasRequestedTickHistory = false;
let pendingContractType = null;
let ticksWithoutTrade = 0;
let consecutiveLossCount = 0;
const NO_TRADE_TICK_LIMIT = 120;
let predictedDigit = null;
let isMonitoring = false;

const martingaleMultiplier = 2.07112;
let dayTarget = 0;

if (params.get("target")) {
    dayTarget = Number(params.get("target"));
} else if (targetProfitInputElement && targetProfitInputElement.value) {
    dayTarget = Number(targetProfitInputElement.value);
}

let startingAmount = 100;

let sessionTargetPercentage  = 1 / startingAmount,
    targetPercentage         = 0.4 / startingAmount,
    amountPercentage         = 0.5 / 100,
    finishTargetPercentagePerDay = 3 / 100,
    isTradeOpen              = false,
    netProfit                = 0,
    targetAmount             = 0,
    winTradeCount            = 0,
    lossTradeCount           = 0,
    totalTradeCount          = 0,
    totalProfitAmount        = 0,
    initialAccountBalance    = 0,
    updatedAccountBalance    = 0,
    tradeProposal            = null,
    lastTradeId              = null,
    tradeTypeDisplay         = "",
    totalLossAmount          = 0,
    currentProfitAmount      = 0,
    currentLossAmount        = 0,
    stopTimer                = false;

let market, apiToken, stake, tickCount, contractType;

// Flags expected by external helper scripts
let authSuccess = false;
let automation  = false;

// ─── DOM Population ───────────────────────────────────────────────────────────
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
marketSelectElement.value  = "R_100";
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

market = (typeof getRandomMarket === "function") ? getRandomMarket(marketArray, "") : marketSelectElement.value;

// Keep updatedAccountBalance as a numeric property (guards against string assignments)
Object.defineProperty(window, "updatedAccountBalance", {
    get: function ()  { return window._underlyingBalance || 0; },
    set: function (v) { window._underlyingBalance = typeof v === "string" ? parseFloat(v) : v; },
    configurable: true,
});

// ─── NEW DERIV AUTH: REST → WebSocket ────────────────────────────────────────

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
        console.log(accountData);

        if (accountData.data && accountData.data.length > 0) {
            activeAccount = accountData.data.find(acc => acc.account_type === ACCOUNT_TYPE);
        }

        if (!activeAccount) {
            if (ACCOUNT_TYPE !== "demo") {
                throw new Error(`No ${ACCOUNT_TYPE} account found.`);
            }
            console.log("No demo account found. Creating one...");
            const createResponse = await fetch(
                "https://api.derivws.com/trading/v1/options/accounts",
                {
                    method: "POST",
                    headers: {
                        "Deriv-App-ID": APP_ID,
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        currency: "USD",
                        group: "row",
                        account_type: "demo",
                    }),
                }
            );

            if (!createResponse.ok) {
                throw new Error(`Failed to create demo account: ${createResponse.statusText}`);
            }

            const createData = await createResponse.json();
            if (Array.isArray(createData.data)) {
                activeAccount = createData.data[0];
            } else {
                activeAccount = createData.data;
            }
            if (typeof setFlashNotification === "function") {
                setFlashNotification(`Demo account created: ${activeAccount.account_id}`, 3);
            }
            console.log("Demo account created:", activeAccount);
        }

        if (!activeAccount) {
            throw new Error("No demo account available.");
        }

        console.log(`Using ${ACCOUNT_TYPE} Account ID: ${activeAccount.account_id}`);

        const otpEndpointUrl = `https://api.derivws.com/trading/v1/options/accounts/${activeAccount.account_id}/otp`;

        const response = await fetch(otpEndpointUrl, {
            method: "POST",
            headers: {
                "Deriv-App-ID":  APP_ID,
                "Authorization": `Bearer ${token}`,
                "Content-Type":  "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`REST Handshake failure: ${response.statusText}`);
        }

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
    if (ws) {
        try { ws.close(); } catch (e) {}
    }

    console.log("Requesting single-use token authorization channel...");
    const authorizedUrl = await fetchAuthenticatedConnectionUrl(apiToken);

    if (!authorizedUrl) {
        console.error("Halting. Cannot secure authenticated WebSocket link.");
        return;
    }

    console.log("Connecting to validated stream pipeline...");
    ws = new WebSocket(authorizedUrl);

    // Intercept send() to remap 'symbol' → 'underlying_symbol' for proposal requests
    const originalSend = ws.send.bind(ws);
    ws.send = function (data) {
        try {
            let parsed = JSON.parse(data);
            if (parsed.proposal && parsed.symbol) {
                parsed.underlying_symbol = parsed.symbol;
                delete parsed.symbol;
                data = JSON.stringify(parsed);
            }
        } catch (e) {}
        originalSend(data);
    };

    ws.onopen = function () {
        console.log("WebSocket connected successfully.");
        startPing();
        // Request balance subscription — replaces the old 'authorize' handshake
        ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
    };

    ws.onclose = function () {
        console.log("Connection closed.");
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

// Auto-connect on page load
initializeTradingSession();

// ─── Keep-Alive Ping ──────────────────────────────────────────────────────────

function startPing() {
    if (intervalId) return;
    intervalId = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ ping: 1 }));
        }
    }, 30000);
}

function stopPing() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

// ─── Message Handler ──────────────────────────────────────────────────────────

function handleServerMessage(event) {
    const wsResponse = JSON.parse(event.data);
    if (!wsResponse) return;

    // ── BALANCE (replaces old 'authorize' callback) ──────────────────────────
    // Only initialise once (initialAccountBalance === 0 guard)
    if (wsResponse.msg_type === "balance" && initialAccountBalance === 0) {
        console.log("Authorization verified via balance callback.\n-----------------------------\n\n");
        if (typeof setFlashNotification === "function") setFlashNotification("Authorization successful", 0);

        if (wsResponse.balance && typeof wsResponse.balance.balance !== "undefined") {
            initialAccountBalance  = parseFloat(wsResponse.balance.balance);
            updatedAccountBalance  = initialAccountBalance;

            if (typeof setAccountInfo === "function") setAccountInfo("initialAccountBalance", `$ ${initialAccountBalance}`);

            // Set flags expected by external helper scripts
            authSuccess = true;
            if (authenticateButton) {
                authenticateButton.innerHTML = "Authenticated. Ready to trade.";
                authenticateButton.disabled  = true;
            }
            if (typeof resetParams === "function") resetParams();

            // ── Recover persisted loss into stake ────────────────────────────
            try {
                const storedLost = parseFloat(localStorage.getItem("totalLostAmount")) || 0;
                if (storedLost !== 0) {
                    stake = Number((Math.abs(storedLost) * MULTIPLIER_VALUE).toFixed(2));
                    // stake = Number((Math.abs(storedLost) * 1).toFixed(2));
                    try { if (initialStakeInputElement) initialStakeInputElement.value = stake; } catch (e) {}
                    if (stake > initialAccountBalance) {
                        stake = Number(initialAccountBalance.toFixed(2));
                        try { if (initialStakeInputElement) initialStakeInputElement.value = stake; } catch (e) {}
                        if (typeof setFlashNotification === "function") {
                            setFlashNotification(`Stake capped to balance: ${stake}`, 5);
                        }
                    } else {
                        if (typeof setFlashNotification === "function") {
                            setFlashNotification(`Recovered pending loss ${storedLost.toFixed(2)} — stake adjusted to ${stake}`, 5);
                        }
                    }
                } else {
                    stake = Number((initialAccountBalance * 0.01).toFixed(2));
                    if (stake < 0.35) stake = 0.35;
                    try { if (initialStakeInputElement) initialStakeInputElement.value = stake; } catch (e) {}
                }
            } catch (e) {}

            // ── Day-target initialisation / persistence ──────────────────────
            try {
                const today           = new Date().toISOString().slice(0, 10);
                const storedDate      = localStorage.getItem("date");
                const storedDayTarget = localStorage.getItem("dayTarget");

                if (!storedDate || !storedDayTarget || storedDate !== today) {
                    const computedTarget = Number(
                        (initialAccountBalance + finishTargetPercentagePerDay * initialAccountBalance).toFixed(2)
                    );
                    localStorage.setItem("date",      today);
                    localStorage.setItem("dayTarget", String(computedTarget));
                    dayTarget = computedTarget;
                } else {
                    dayTarget = Number(storedDayTarget);
                }

                if (typeof setAccountInfo === "function") setAccountInfo("targetAmount", `$ ${dayTarget}`);

                // Show session target in the input field
                try {
                    targetAmount = Number((initialAccountBalance * sessionTargetPercentage).toFixed(2));
                    if (targetProfitInputElement) targetProfitInputElement.value = targetAmount;
                } catch (e) {}

                // If today's target is already met, halt immediately
                if (initialAccountBalance >= dayTarget) {
                    if (typeof setFlashNotification === "function") {
                        setFlashNotification("Day target already reached. Stopping for today.", 0);
                    }
                    try { localStorage.setItem("tradingStoppedForDay", "1"); } catch (e) {}
                    isRunning = false;
                    stopPing();
                    try { if (ws) ws.close(); } catch (e) {}
                    if (scriptButton) { scriptButton.disabled = true; scriptButton.innerText = "Stopped for day"; }
                    return;
                }
            } catch (e) {
                console.error("Error initialising day target:", e);
            }

            // ── Start the bot ────────────────────────────────────────────────
            if (dayTarget > 0 && updatedAccountBalance >= dayTarget) {
                if (typeof setFlashNotification === "function") setFlashNotification("Day target is done", 0);
                console.log("Day target is done");
            } else {
                runScript();
            }
        } else {
            // Balance payload missing — reload and retry
            if (typeof reload === "function") reload();
        }
    }

    // ── TICK HISTORY ─────────────────────────────────────────────────────────
    if (wsResponse.msg_type === "history" && wsResponse.history && Array.isArray(wsResponse.history.prices)) {
        last50Prices = wsResponse.history.prices.slice(-50);
        analyzeLastDigits(last50Prices);
    }

    // ── LIVE TICK ─────────────────────────────────────────────────────────────
    if (wsResponse.msg_type === "tick" && wsResponse.tick && typeof wsResponse.tick.quote !== "undefined") {
        last50Prices.push(wsResponse.tick.quote);
        if (last50Prices.length > 50) last50Prices = last50Prices.slice(-50);

        if (predictedDigit !== null && isMonitoring && !isTradeOpen && !pendingContractType) {
            ticksWithoutTrade++;
            checkTickForTrade(wsResponse.tick.quote);

            if (ticksWithoutTrade >= NO_TRADE_TICK_LIMIT) {
                isMonitoring = false;
                predictedDigit = null;
                ticksWithoutTrade = 0;
                hasRequestedTickHistory = false;
                requestTickHistory();
            }
        }
    }

    // ── PROPOSAL ─────────────────────────────────────────────────────────────
    if (wsResponse.msg_type === "proposal") {
        if (updatedAccountBalance > 0 && wsResponse.echo_req.amount > updatedAccountBalance) {
            webSocketConnectionStop();
        } else {
            tradeProposal = wsResponse;
            console.log("tradeProposal:", tradeProposal);
            if (pendingContractType && isTradeOpen === false) {
                if (typeof makeTheTrade === "function") makeTheTrade(tradeProposal, pendingContractType);
            }
        }
    }

    // ── API ERROR ─────────────────────────────────────────────────────────────
    if (wsResponse.msg_type === "error") {
        console.error("API error:", wsResponse.error);
    }

    // ── BUY CONFIRMATION ──────────────────────────────────────────────────────
    if (wsResponse.msg_type === "buy") {
        if (wsResponse.buy == undefined || wsResponse.buy.contract_id == undefined) {
            // buy failed — no action; external scripts may handle retries
        } else {
            lastTradeId     = wsResponse.buy.contract_id;
            totalTradeCount = totalTradeCount + 1;
            isTradeOpen     = true;
            automation      = true; // flag for external helper scripts

            if (wsResponse.buy.shortcode.includes("DIGITDIFF")) {
                tradeTypeDisplay = `Differ ${predictedDigit}`;
            } else if (wsResponse.buy.shortcode.includes("DIGITEVEN")) {
                tradeTypeDisplay = "Even";
            } else if (wsResponse.buy.shortcode.includes("DIGITODD")) {
                tradeTypeDisplay = "Odd";
            }

            if (typeof setResultNotification === "function") {
                setResultNotification(lastTradeId, tradeTypeDisplay, market, wsResponse.buy.buy_price);
            }
            console.log("Trade Successful:", wsResponse);

            setTimeout(() => {
                if (typeof fetchTradeDetails === "function") fetchTradeDetails(lastTradeId);
            }, 500);
        }
    }

    // ── CONTRACT RESULT ───────────────────────────────────────────────────────
    if (wsResponse.msg_type === "proposal_open_contract") {
        if (wsResponse.proposal_open_contract.contract_id === lastTradeId) {
            const contract = wsResponse.proposal_open_contract;

            if (contract.is_sold) {
                const profit = parseFloat(contract.profit);
                const result = profit > 0 ? "Win" : "Loss";

                if (typeof setInfo === "function") setInfo(contract, profit);

                // ── Session target check (from old code) ─────────────────────
                try {
                    const sessionTargetAmount = initialAccountBalance * sessionTargetPercentage;
                    if (sessionTargetAmount > 0 && netProfit >= sessionTargetAmount) {
                        if (typeof setFlashNotification === "function") {
                            setFlashNotification("Session target reached. Reloading.", 0);
                        }
                        if (typeof reload === "function") reload();
                        return;
                    }
                } catch (e) {}

                isTradeOpen = false;
                pendingContractType = null;

                if (profit >= 0) {
                    try { localStorage.removeItem('totalLostAmount'); } catch (e) {}
                }

                predictedDigit = null;
                isMonitoring = false;
                hasRequestedTickHistory = false;
                if (typeof reload === "function") reload();
            } else {
                // Contract still open — poll again in 1 s
                setTimeout(() => {
                    if (typeof setTickCountDown === "function") {
                        setTickCountDown(contract.tick_count, contract.tick_stream.length);
                    }
                    if (typeof fetchTradeDetails === "function") fetchTradeDetails(lastTradeId);
                }, 1000);
            }
        }
    }
}

// ─── Bot Core ─────────────────────────────────────────────────────────────────

function runScript() {
    isRunning = true;
    requestTickHistory();
}

function requestTickHistory() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (hasRequestedTickHistory) return;

    hasRequestedTickHistory = true;
    ws.send(
        JSON.stringify({
            ticks_history: market,
            style:         "ticks",
            count:         50,
            end:           "latest",
            subscribe:     1,
        })
    );
}

// ─── Market Switch on Inactivity ──────────────────────────────────────────────

function changeMarketAfterNoTrade() {
    if (lossTradeCount !== 0) return;

    const previousMarket = market;
    const nextMarket = (typeof getRandomMarket === "function")
        ? getRandomMarket(marketArray, previousMarket)
        : market;

    if (!nextMarket || nextMarket === previousMarket) {
        ticksWithoutTrade = 0;
        return;
    }

    market = nextMarket;
    marketSelectElement.value   = nextMarket;
    ticksWithoutTrade           = 0;
    last50Prices                = [];
    hasRequestedTickHistory     = false;
    pendingContractType         = null;
    contractType                = null;

    console.log(`[MARKET SWITCH] No trade in ${NO_TRADE_TICK_LIMIT} ticks. ${previousMarket} -> ${nextMarket}`);

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ forget_all: "ticks" }));
        requestTickHistory();
    }
}

// ─── Digit Prediction Analysis ────────────────────────────────────────────────

function getMajorityDecimalCount(prices) {
    const counts = {};
    prices.forEach(price => {
        const parts = String(price).split(".");
        const decimals = parts[1] ? parts[1].length : 0;
        counts[decimals] = (counts[decimals] || 0) + 1;
    });
    let maxCount = 0, majorityDecimals = 0;
    for (const [decimals, count] of Object.entries(counts)) {
        if (count > maxCount) {
            maxCount = count;
            majorityDecimals = Number(decimals);
        }
    }
    return majorityDecimals;
}

function normalizePrice(price, decimalCount) {
    return Number(price).toFixed(decimalCount);
}

function getLastDigit(normalizedPrice) {
    return Number(normalizedPrice.charAt(normalizedPrice.length - 1));
}

function analyzeLastDigits(prices) {
    if (!Array.isArray(prices) || prices.length === 0) return;

    const decimalCount = getMajorityDecimalCount(prices);
    const normalizedPrices = prices.map(p => normalizePrice(p, decimalCount));
    const lastDigits = normalizedPrices.map(p => getLastDigit(p));

    const digitCounts = Array(10).fill(0);
    lastDigits.forEach(d => digitCounts[d]++);

    const total = lastDigits.length;
    const percentages = digitCounts.map(count => Number(((count / total) * 100).toFixed(2)));

    let output = `[${market}] Digit percentages: `;
    for (let i = 0; i < 10; i++) {
        output += `${i}=${percentages[i]}% `;
    }
    console.log(output);

    let minPercentage = 100, lowestDigit = 0;
    for (let i = 0; i < 10; i++) {
        if (percentages[i] < minPercentage) {
            minPercentage = percentages[i];
            lowestDigit = i;
        }
    }

    const tiedDigits = percentages.filter(p => p === minPercentage).length;
    if (tiedDigits > 1) {
        console.log(`[TIE] Multiple digits (${tiedDigits}) at ${minPercentage}%. Reloading for different market.`);
        if (typeof reload === "function") reload();
        return;
    }

    predictedDigit = lowestDigit;
    isMonitoring = true;
    ticksWithoutTrade = 0;

    if (typeof setFlashNotification === "function") {
        setFlashNotification(`Lowest digit: ${predictedDigit} (${percentages[lowestDigit]}%). Waiting for match...`, 0);
    }
    console.log(`[PREDICTION] Waiting for tick with last digit ${predictedDigit} (${percentages[lowestDigit]}%)`);
}

// ─── Tick Monitoring & Trade Entry ───────────────────────────────────────────

function checkTickForTrade(quote) {
    const decimalCount = getMajorityDecimalCount(last50Prices);
    const normalized = normalizePrice(quote, decimalCount);
    const lastDigit = getLastDigit(normalized);

    if (lastDigit === predictedDigit) {
        console.log(`[TICK MATCH] Last digit ${lastDigit} matches prediction. Placing DIGITDIFF trade with stake $${stake}.`);

        isMonitoring = false;
        placeDifferTrade(predictedDigit);
    }
}

function placeDifferTrade(digit) {
    if (isTradeOpen || pendingContractType) return;

    pendingContractType = "differ";

    const tradeRequest = {
        proposal: 1,
        amount: stake.toFixed(2),
        basis: "stake",
        contract_type: "DIGITDIFF",
        currency: "USD",
        duration: 1,
        duration_unit: "t",
        barrier: digit,
        underlying_symbol: market,
    };

    console.log("Sending DIGITDIFF trade request:", tradeRequest);
    ws.send(JSON.stringify(tradeRequest));
}

// ─── Connection Control (called by external helper scripts) ───────────────────

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
    if (scriptButton) {
        scriptButton.disabled  = true;
        scriptButton.innerText = "Stopped (balance too low)";
    }
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