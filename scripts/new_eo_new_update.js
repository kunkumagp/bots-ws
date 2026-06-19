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

const ACCOUNT_TYPE = "demo";
// const ACCOUNT_TYPE = "real";

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
let tickCount             = 50;

let ws = null;
let isRunning = false, intervalId;
let lastPrices = [];
let lastDigitsArray = [];
let hasRequestedTickHistory = false;
let pendingContractType = null;
let ticksWithoutTrade = 0;
let consecutiveLossCount = 0;
const NO_TRADE_TICK_LIMIT = 120;

const martingaleMultiplier = 2.07112;
const PREDICTION_CONFIDENCE_THRESHOLD = 0.65;
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

let market, apiToken, stake, contractType;
let lastPrediction = null;

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
                    const PAYOUT_RATE  = 0.80; // Deriv digit even/odd ~80%
                    stake = Number((Math.abs(storedLost) / PAYOUT_RATE).toFixed(2));
                    try { if (initialStakeInputElement) initialStakeInputElement.value = stake; } catch (e) {}
                    // Safety cap: stake must not exceed available balance
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

        
        lastPrices = wsResponse.history.prices.slice(-tickCount);
        lastDigitsArray = getLastDigits(lastPrices);
        // console.log("lastPrices: ", lastPrices);
        // console.log("lastDigitsArray: ", lastDigitsArray);

        logEvenOddPercentages(lastDigitsArray);
    }

    // ── LIVE TICK ─────────────────────────────────────────────────────────────
    if (wsResponse.msg_type === "tick" && wsResponse.tick && typeof wsResponse.tick.quote !== "undefined") {
        lastDigitsArray = tickValuePushToArray(wsResponse.tick.quote);
        // console.log("lastDigitsArray: ", lastDigitsArray);
        logEvenOddPercentages(lastDigitsArray);
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

            if (wsResponse.buy.shortcode.includes("DIGITEVEN")) {
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
                {
                    const payoutRate = 1 / 2.07112;
                    let pendingRecovery = parseFloat(localStorage.getItem("pendingRecovery") || "0");
                    if (result === "Loss") {
                        pendingRecovery += Math.abs(profit);
                    } else {
                        pendingRecovery -= profit;
                        if (pendingRecovery < 0) pendingRecovery = 0;
                    }
                    localStorage.setItem("pendingRecovery", String(pendingRecovery));
                    const recoveryStake = pendingRecovery / (3 * payoutRate);
                    stake = Number((recoveryStake > amountPutForTrading ? recoveryStake : amountPutForTrading).toFixed(2));
                }
                pendingContractType = null;

                if (profit < 0) {
                    consecutiveLossCount += 1;

                    if (consecutiveLossCount >= 4) {
                        try { ws.send(JSON.stringify({ forget_all: "ticks" })); } catch (e) {}
                        hasRequestedTickHistory = false;
                        lastPrices = [];

                        if (typeof setFlashNotification === "function") {
                            setFlashNotification("4 losses in a row. Stopping for today.", 0);
                        }
                        try { localStorage.setItem("tradingStoppedForDay", "1"); } catch (e) {}
                        isRunning = false;
                        stopPing();
                        try { if (ws) ws.close(); } catch (e) {}
                        if (scriptButton) { scriptButton.disabled = true; scriptButton.innerText = "Stopped for day"; }
                        return;
                    }

                    try { ws.send(JSON.stringify({ forget_all: "ticks" })); } catch (e) {}
                    hasRequestedTickHistory = false;
                    lastPrices = [];

                    const multiplier = Math.min(consecutiveLossCount, 10);
                    const cooldownMs = getRandomNumber(30, 60) * multiplier * 1000;

                    if (typeof setFlashNotification === "function") {
                        setFlashNotification(`Loss #${consecutiveLossCount}. Retrying in ${Math.round(cooldownMs / 1000)}s...`, 0);
                    }
                    if (typeof setTimer === "function") setTimer(cooldownMs);
                    setTimeout(() => { runScript(); }, cooldownMs);
                } else {
                    consecutiveLossCount = 0;
                    if (typeof reload === "function") reload();
                }
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
    analizeForEvenOdd();
}

function analizeForEvenOdd() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (hasRequestedTickHistory) return;

    hasRequestedTickHistory = true;
    ws.send(
        JSON.stringify({
            ticks_history: market,
            style:         "ticks",
            count:         tickCount,
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
    lastPrices                = [];
    hasRequestedTickHistory     = false;
    pendingContractType         = null;
    contractType                = null;

    console.log(`[MARKET SWITCH] No trade in ${NO_TRADE_TICK_LIMIT} ticks. ${previousMarket} -> ${nextMarket}`);

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ forget_all: "ticks" }));
        analizeForEvenOdd();
    }
}

// ─── Even/Odd Analysis ────────────────────────────────────────────────────────

function getDecimalPlaces(value) {
    const parts = String(value).split(".");
    return parts[1] ? parts[1].length : 0;
}

function getLastDigitByPrecision(value, precision) {
    const fixed = Number(value).toFixed(precision);
    return Number(fixed.charAt(fixed.length - 1));
}

function predictNextDigit(digits) {
    if (!Array.isArray(digits) || digits.length < 3) return null;

    const transitionCounts = {};
    for (let i = 0; i < digits.length - 2; i++) {
        const key = digits[i] + "," + digits[i + 1];
        const next = digits[i + 2];
        if (!transitionCounts[key]) transitionCounts[key] = {};
        transitionCounts[key][next] = (transitionCounts[key][next] || 0) + 1;
    }

    const lastKey = digits[digits.length - 2] + "," + digits[digits.length - 1];
    const followers = transitionCounts[lastKey];

    if (!followers) {
        const key1 = digits[digits.length - 1];
        let fallback = {};
        for (let i = 0; i < digits.length - 1; i++) {
            if (digits[i] === key1) {
                const next = digits[i + 1];
                fallback[next] = (fallback[next] || 0) + 1;
            }
        }
        if (Object.keys(fallback).length === 0) return null;
        let total = 0, evenProb = 0;
        for (const [digit, count] of Object.entries(fallback)) {
            total += count;
            if (Number(digit) % 2 === 0) evenProb += count;
        }
        return {
            mostLikely: Number(Object.entries(fallback).sort((a, b) => b[1] - a[1])[0][0]),
            evenProbability: evenProb / total,
            oddProbability: 1 - evenProb / total,
            order: 1,
        };
    }

    let total = 0, evenProb = 0;
    for (const [digit, count] of Object.entries(followers)) {
        total += count;
        if (Number(digit) % 2 === 0) evenProb += count;
    }

    return {
        mostLikely: Number(Object.entries(followers).sort((a, b) => b[1] - a[1])[0][0]),
        evenProbability: evenProb / total,
        oddProbability: 1 - evenProb / total,
        order: 2,
    };
}

function logEvenOddPercentages(digits) {
    if (!Array.isArray(digits) || digits.length === 0) return;

    const newDigit = digits[digits.length - 1];
    let accuracyStr = "";
    if (lastPrediction) {
        const evenPredicted = lastPrediction.evenProbability > lastPrediction.oddProbability;
        const actualEven = newDigit % 2 === 0;
        accuracyStr = evenPredicted === actualEven ? " ✅" : " ❌";
    }

    const evenCount        = digits.filter((d) => d % 2 === 0).length;
    const oddCount         = digits.length - evenCount;
    const evenPercentage   = Number(((evenCount / digits.length) * 100).toFixed(2));
    const oddPercentage    = Number(((oddCount  / digits.length) * 100).toFixed(2));
    const lastThreeDigits  = digits.slice(-3);

    const last10Digits     = digits.slice(-10);
    const evenCount10      = last10Digits.filter((d) => d % 2 === 0).length;
    const oddCount10       = last10Digits.length - evenCount10;
    const even10Percentage = Number(((evenCount10 / last10Digits.length) * 100).toFixed(2));
    const odd10Percentage  = Number(((oddCount10  / last10Digits.length) * 100).toFixed(2));

    contractType = null;
    if      (evenPercentage >= 54) contractType = "even";
    else if (oddPercentage  >= 54) contractType = "odd";

    const prediction = predictNextDigit(digits);
    lastPrediction = prediction;
    let predStr = "";
    if (prediction) {
        predStr = ` | Next: ${prediction.mostLikely} (E:${(prediction.evenProbability*100).toFixed(0)}% O:${(prediction.oddProbability*100).toFixed(0)}%)`;
    }
    console.log(
        `[${market}] Even: ${evenPercentage}% | ` +
        `Odd: ${oddPercentage}% | ` +
        `ContractType: ${contractType}`
    );

    // console.log(
    //     `[${market}] Even: ${evenPercentage}% (last10: ${even10Percentage}%) | ` +
    //     `Odd: ${oddPercentage}% (last10: ${odd10Percentage}%) | ` +
    //     `ContractType: ${contractType} | Last3: [${lastThreeDigits.join(",")}]${predStr}${accuracyStr}`
    // );

    const evenTriggered  = tryEvenEntry(evenPercentage, digits);
    const oddTriggered   = tryOddEntry(oddPercentage, digits);
    const tradeTriggered = evenTriggered || oddTriggered;

    if (tradeTriggered) {
        ticksWithoutTrade = 0;
        return;
    }

    if (isTradeOpen || pendingContractType) return;

    ticksWithoutTrade += 1;
    if (ticksWithoutTrade >= NO_TRADE_TICK_LIMIT && lossTradeCount === 0) {
        changeMarketAfterNoTrade();
    }
}

// ─── Trade Entry Logic ────────────────────────────────────────────────────────

function getTrailingOddCount(lastDigits) {
    let count = 0;
    for (let i = lastDigits.length - 1; i >= 0; i--) {
        if (lastDigits[i] % 2 !== 0) count++;
        else break;
    }
    return count;
}

function getTrailingEvenCount(lastDigits) {
    let count = 0;
    for (let i = lastDigits.length - 1; i >= 0; i--) {
        if (lastDigits[i] % 2 === 0) count++;
        else break;
    }
    return count;
}

function tryEvenEntry(evenPercentage, lastDigits) {
    if (pendingContractType) return false;
    if (contractType !== "even") return false;
    if (evenPercentage < 54) return false;

    if (typeof placeTheTrade === "function") {
        pendingContractType = "even";
        placeTheTrade(contractType);
        return true;
    }
    return false;
}

function tryOddEntry(oddPercentage, lastDigits) {
    if (pendingContractType) return false;
    if (contractType !== "odd") return false;
    if (oddPercentage < 54) return false;

    if (typeof placeTheTrade === "function") {
        pendingContractType = "odd";
        placeTheTrade(contractType);
        return true;
    }
    return false;
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

function getLastDigits(arr) {
  // Step 1 & 2: Remove decimal, find max length, pad with zeros
  const stripped = arr.map(n => n.toString().replace('.', ''));
  const maxLen = Math.max(...stripped.map(s => s.length));
  const padded = stripped.map(s => s.padEnd(maxLen, '0'));
  
  // Step 3: Get last digit of each
  return padded.map(s => Number(s[s.length - 1]));
}

function tickValuePushToArray(newValue) {
  lastPrices.push(newValue);
  lastPrices.splice(0, lastPrices.length - tickCount);
  return getLastDigits(lastPrices);
}