const accounts = [
    { name: "KunkumaGP", value: "pat_75687aeb556fbcef179dfe7fa307bd403a28ec334dcbe0a45323c3d92a7c7aae" },
    { name: "KUNKUMAGP Real", value: "Y71P0GIOxz3YYvr" },
    { name: "Kunkuma Trading", value: "hJfU1x5xpoSTwHe" },
    { name: "W H K G Prasanna 85", value: "iVOpdm24hBhw3JI" },
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

const APP_ID = "33oWYOQxAL3YJYtTvBRep";
const accountSelectElement = document.getElementById("account_select");
const marketSelectElement = document.getElementById("market");
const targetProfitInputElement = document.getElementById("target_profit");
const initialStakeInputElement = document.getElementById("initial_stake");
const authenticateButton = document.getElementById("authenticateButton");
const scriptButton = document.getElementById("scriptButton");
const infoOutput = document.getElementById("info_output");
const params = new URLSearchParams(window.location.search);

let ws = null;
let isRunning = false, intervalId;
let lastPrices = [];
let hasRequestedTickHistory = false;
let pendingContractType = null;
let ticksWithoutTrade = 0;
let consecutiveLossCount = 0;
const NO_TRADE_TICK_LIMIT = 120;

const martingaleMultiplier = 2.07112;
let dayTarget = 0;

if (params.get("target")) {
    dayTarget = Number(params.get("target"));
} else if (targetProfitInputElement && targetProfitInputElement.value) {
    dayTarget = Number(targetProfitInputElement.value);
}

let startingAmount = 250;

let sessionTargetPercentage = 1 / startingAmount,
    targetPercentage = 1 / startingAmount,
    amountPercentage = 0.5 / 100,
    finishTargetPercentagePerDay = 3 / 100,
    isTradeOpen = false,
    netProfit = 0,
    targetAmount = 0,
    winTradeCount = 0,
    lossTradeCount = 0,
    totalTradeCount = 0,
    totalProfitAmount = 0,
    initialAccountBalance = 0,
    updatedAccountBalance = 0,
    tradeProposal = null,
    lastTradeId = null,
    tradeTypeDisplay = "",
    totalLossAmount = 0,
    currentProfitAmount = 0,
    currentLossAmount = 0,
    stopTimer = false;

let market, apiToken, stake, tickCount, contractType;
let authSuccess = false, automation = false;
let currentPayoutRate = 0.80;
let multiplierDuration = 60;
let multiplierValue = 50;

const multiplierSelectElement = document.getElementById("multiplier_select");
if (multiplierSelectElement) {
    multiplierSelectElement.addEventListener("change", () => {
        multiplierValue = Number(multiplierSelectElement.value);
    });
}

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
marketSelectElement.value = "R_100";
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

Object.defineProperty(window, "updatedAccountBalance", {
    get: function () { return window._underlyingBalance || 0; },
    set: function (v) { window._underlyingBalance = typeof v === "string" ? parseFloat(v) : v; },
    configurable: true,
});

async function fetchAuthenticatedConnectionUrl(token) {
    try {
        const accountDetailsResponse = await fetch(
            "https://api.derivws.com/trading/v1/options/accounts",
            {
                method: "GET",
                headers: {
                    "Deriv-App-ID": APP_ID,
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
            if (ACCOUNT_TYPE === "demo") {
                activeAccount = accountData.data.find(acc => acc.account_type === "demo");
            } else {
                activeAccount = accountData.data.find(acc => acc.account_type === "real");
            }
        }

        if (!activeAccount) {
            console.log(`No ${ACCOUNT_TYPE} account found. Creating one...`);
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
                        account_type: ACCOUNT_TYPE,
                    }),
                }
            );

            if (!createResponse.ok) {
                throw new Error(`Failed to create ${ACCOUNT_TYPE} account: ${createResponse.statusText}`);
            }

            const createData = await createResponse.json();
            if (Array.isArray(createData.data)) {
                activeAccount = createData.data[0];
            } else {
                activeAccount = createData.data;
            }
            if (typeof setFlashNotification === "function") {
                setFlashNotification(`${ACCOUNT_TYPE} account created: ${activeAccount.account_id}`, 3);
            }
            console.log(`${ACCOUNT_TYPE} account created:`, activeAccount);
        }

        if (!activeAccount) {
            throw new Error(`No ${ACCOUNT_TYPE} account available.`);
        }

        console.log(`Using ${ACCOUNT_TYPE} Account ID: ${activeAccount.account_id}`);

        const otpEndpointUrl = `https://api.derivws.com/trading/v1/options/accounts/${activeAccount.account_id}/otp`;

        const response = await fetch(otpEndpointUrl, {
            method: "POST",
            headers: {
                "Deriv-App-ID": APP_ID,
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
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
        try { ws.close(); } catch (e) { }
    }

    console.log("Requesting single-use token authorization channel...");
    const authorizedUrl = await fetchAuthenticatedConnectionUrl(apiToken);

    if (!authorizedUrl) {
        console.error("Halting. Cannot secure authenticated WebSocket link.");
        return;
    }

    console.log("Connecting to validated stream pipeline...");
    ws = new WebSocket(authorizedUrl);

    const originalSend = ws.send.bind(ws);
    ws.send = function (data) {
        try {
            let parsed = JSON.parse(data);
            if (parsed.proposal && parsed.symbol) {
                parsed.underlying_symbol = parsed.symbol;
                delete parsed.symbol;
                data = JSON.stringify(parsed);
            }
        } catch (e) { }
        originalSend(data);
    };

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

function handleServerMessage(event) {
    const wsResponse = JSON.parse(event.data);
    if (!wsResponse) return;

    if (wsResponse.msg_type === "balance" && initialAccountBalance === 0) {
        console.log("Authorization successful.\n-----------------------------\n\n");
        if (typeof setFlashNotification === "function") setFlashNotification("Authorization successful", 0);

        if (wsResponse.balance && typeof wsResponse.balance.balance !== "undefined") {
            initialAccountBalance = parseFloat(wsResponse.balance.balance);
            updatedAccountBalance = initialAccountBalance;
            if (typeof setAccountInfo === "function") setAccountInfo("initialAccountBalance", `$ ${initialAccountBalance}`);
            authSuccess = true;
            if (authenticateButton) {
                authenticateButton.innerHTML = "Authenticated. Ready to trade.";
                authenticateButton.disabled = true;
            }
            if (typeof resetParams === "function") resetParams();
            try { if (initialStakeInputElement) initialStakeInputElement.value = Number(stake).toFixed(2); } catch (e) { }

            try {
                const storedLost = parseFloat(localStorage.getItem('totalLostAmount')) || 0;
                if (storedLost !== 0) {
                    const calcStake = Number((Math.abs(storedLost) / currentPayoutRate).toFixed(2));
                    stake = calcStake;
                    try { if (initialStakeInputElement) initialStakeInputElement.value = stake; } catch (e) { }
                    if (typeof setFlashNotification === "function") setFlashNotification(`Recovered pending loss ${storedLost.toFixed(2)} — adjusting stake to ${stake}`, 5);
                }
            } catch (e) { }

            try {
                if (typeof stake === 'number' && initialAccountBalance > 0 && stake > initialAccountBalance) {
                    stake = Number(initialAccountBalance.toFixed(2));
                    try { if (initialStakeInputElement) initialStakeInputElement.value = stake; } catch (e) { }
                    if (typeof setFlashNotification === "function") setFlashNotification(`Stake adjusted to initial account balance: ${stake}`, 5);
                }
            } catch (e) { }

            try {
                const today = new Date().toISOString().slice(0, 10);
                const storedDate = localStorage.getItem('date');
                let storedDayTarget = localStorage.getItem('dayTarget');

                if (!storedDate || !storedDayTarget || storedDate !== today) {
                    const computedTarget = Number((initialAccountBalance + (finishTargetPercentagePerDay * initialAccountBalance)).toFixed(2));
                    localStorage.setItem('date', today);
                    localStorage.setItem('dayTarget', String(computedTarget));
                    dayTarget = computedTarget;
                } else {
                    dayTarget = Number(storedDayTarget);
                }

                if (typeof setAccountInfo === "function") setAccountInfo("targetAmount", `$ ${dayTarget}`);

                try {
                    targetAmount = Number((initialAccountBalance * sessionTargetPercentage).toFixed(2));
                    if (targetProfitInputElement) {
                        targetProfitInputElement.value = targetAmount;
                    }
                } catch (e) { }

                if (initialAccountBalance >= dayTarget) {
                    if (typeof setFlashNotification === "function") setFlashNotification('Day target already reached. Stopping for today.', 0);
                    try { localStorage.setItem('tradingStoppedForDay', '1'); } catch (e) { }
                    isRunning = false;
                    stopPing();
                    try { if (ws) ws.close(); } catch (e) { }
                    if (scriptButton) { scriptButton.disabled = true; scriptButton.innerText = 'Stopped for day'; }
                    return;
                }
            } catch (e) {
                console.error('Error initializing day target:', e);
            }

            try {
                const savedStreak = parseInt(localStorage.getItem('consecutiveLossStreak')) || 0;
                const streakDate = localStorage.getItem('consecutiveLossDate');
                const today = new Date().toISOString().slice(0, 10);

                if (savedStreak >= 3 && streakDate === today) {
                    if (typeof setFlashNotification === "function") setFlashNotification('Stopped: consecutive loss limit reached today. Manual restart required.', 0);
                    try { localStorage.setItem('tradingStoppedForDay', '1'); } catch (e) { }
                    isRunning = false;
                    stopPing();
                    try { if (ws) ws.close(); } catch (e) { }
                    if (scriptButton) { scriptButton.disabled = true; scriptButton.innerText = 'Stopped (3 losses)'; }
                    return;
                } else if (streakDate !== today) {
                    localStorage.removeItem('consecutiveLossStreak');
                    localStorage.removeItem('consecutiveLossDate');
                }
            } catch (e) { }

            if (dayTarget > 0 && updatedAccountBalance >= dayTarget) {
                if (typeof setFlashNotification === "function") setFlashNotification("Day target is done", 0);
                console.log("Day target is done");
            } else {
                runScript();
            }
        } else {
            if (typeof reload === "function") reload();
        }
    }

    if (wsResponse.msg_type === "history" && wsResponse.history && Array.isArray(wsResponse.history.prices)) {
        lastPrices = wsResponse.history.prices.slice(-100);
        analyzePriceTrend(lastPrices);
    }

    if (wsResponse.msg_type === "tick" && wsResponse.tick && typeof wsResponse.tick.quote !== "undefined") {
        lastPrices.push(wsResponse.tick.quote);
        if (lastPrices.length > 100) {
            lastPrices = lastPrices.slice(-100);
        }
        analyzePriceTrend(lastPrices);
    }

    if (wsResponse.msg_type === "proposal") {
        if (updatedAccountBalance > 0 && wsResponse.echo_req.amount > updatedAccountBalance) {
            webSocketConnectionStop();
        } else {
            tradeProposal = wsResponse;
            console.log('tradeProposal: ', tradeProposal);
            try {
                if (tradeProposal.proposal && tradeProposal.proposal.payout && tradeProposal.proposal.ask_price && tradeProposal.proposal.ask_price > 0) {
                    currentPayoutRate = (tradeProposal.proposal.payout - tradeProposal.proposal.ask_price) / tradeProposal.proposal.ask_price;
                    currentPayoutRate = Number(currentPayoutRate.toFixed(4));
                }
            } catch (e) { }
            if (pendingContractType && isTradeOpen === false) {
                if (typeof makeTheTrade === "function") makeTheTrade(tradeProposal, pendingContractType);
            }
        }
    }

    if (wsResponse.msg_type === "error") {
        console.error("API error:", wsResponse.error);
    }

    if (wsResponse.msg_type === "buy") {
        if (wsResponse.buy == undefined || wsResponse.buy.contract_id == undefined) {
            // buy placeholder
        } else {
            lastTradeId = wsResponse.buy.contract_id;
            totalTradeCount = totalTradeCount + 1;
            isTradeOpen = true;
            automation = true;

            if (wsResponse.buy.shortcode) {
                if (wsResponse.buy.shortcode.includes("MULTIPLIER_UP")) {
                    tradeTypeDisplay = "MULTIPLIER_UP";
                } else if (wsResponse.buy.shortcode.includes("MULTIPLIER_DOWN")) {
                    tradeTypeDisplay = "MULTIPLIER_DOWN";
                } else {
                    tradeTypeDisplay = wsResponse.buy.contract_type || "Multiplier";
                }
            } else {
                tradeTypeDisplay = "Multiplier";
            }

            if (typeof setResultNotification === "function") setResultNotification(lastTradeId, tradeTypeDisplay, market, wsResponse.buy.buy_price);
            console.log("Trade Successful:", wsResponse);

            setTimeout(() => {
                if (typeof fetchTradeDetails === "function") fetchTradeDetails(lastTradeId);
            }, 500);
        }
    }

    if (wsResponse.msg_type === "proposal_open_contract") {
        if (wsResponse.proposal_open_contract.contract_id === lastTradeId) {
            const contract = wsResponse.proposal_open_contract;

            if (contract.is_sold) {
                const profit = parseFloat(contract.profit);
                const result = profit > 0 ? "Win" : "Loss";

                if (typeof setInfo === "function") setInfo(contract, profit);

                try {
                    const sessionTargetAmount = initialAccountBalance * sessionTargetPercentage;
                    if (sessionTargetAmount > 0 && netProfit >= sessionTargetAmount) {
                        if (typeof setFlashNotification === "function") setFlashNotification('Session target reached. Reloading.', 0);
                        if (typeof reload === "function") reload();
                        return;
                    }
                } catch (e) { }

                isTradeOpen = false;
                if (result === "Loss") {
                    const storedLost = parseFloat(localStorage.getItem('totalLostAmount')) || 0;
                    if (storedLost !== 0) {
                        stake = Number((Math.abs(storedLost) / currentPayoutRate).toFixed(2));
                    }
                } else if (result === "Win") {
                    stake = amountPutForTrading;
                }
                try { if (initialStakeInputElement) initialStakeInputElement.value = Number(stake).toFixed(2); } catch (e) { }
                pendingContractType = null;

                if (profit < 0) {
                    consecutiveLossCount += 1;
                    try {
                        localStorage.setItem('consecutiveLossStreak', consecutiveLossCount);
                        localStorage.setItem('consecutiveLossDate', new Date().toISOString().slice(0, 10));
                    } catch (e) { }

                    if (consecutiveLossCount >= 3) {
                        if (typeof setFlashNotification === "function") setFlashNotification('Stopped: 3 consecutive losses reached. Manual restart required.', 0);
                        try { localStorage.setItem('tradingStoppedForDay', '1'); } catch (e) { }
                        isRunning = false;
                        stopPing();
                        try { if (ws) ws.close(); } catch (e) { }
                        try { if (scriptButton) { scriptButton.disabled = true; scriptButton.innerText = 'Stopped (3 losses)'; } } catch (e) { }
                        return;
                    }
                } else {
                    consecutiveLossCount = 0;
                    try {
                        localStorage.removeItem('consecutiveLossStreak');
                        localStorage.removeItem('consecutiveLossDate');
                    } catch (e) { }
                }

                let setTimeInterval = 0;

                if (consecutiveLossCount === 0) {
                    setTimeInterval = (typeof getRandomNumber === "function" ? getRandomNumber(5, 15) : 10) * 1000;
                } else if (consecutiveLossCount === 1) {
                    setTimeInterval = (typeof getRandomNumber === "function" ? getRandomNumber(15, 30) : 20) * 1000;
                } else if (consecutiveLossCount === 2) {
                    setTimeInterval = (typeof getRandomNumber === "function" ? getRandomNumber(30, 60) : 45) * 1000;
                }

                if (netProfit >= targetAmount) {
                    if (typeof reload === "function") reload();
                } else {
                    if (setTimeInterval > 0 && typeof setTimer === "function") setTimer(setTimeInterval);
                    setTimeout(() => {
                        runScript();
                    }, setTimeInterval);
                }
            } else {
                setTimeout(() => {
                    if (typeof setTickCountDown === "function") setTickCountDown(contract.tick_count, contract.tick_stream.length);
                    if (typeof fetchTradeDetails === "function") fetchTradeDetails(lastTradeId);
                }, 1000);
            }
        }
    }
}

function runScript() {
    isRunning = true;
    subscribeToTicks();
}

function subscribeToTicks() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (hasRequestedTickHistory) return;

    hasRequestedTickHistory = true;
    ws.send(
        JSON.stringify({
            ticks_history: market,
            style: "ticks",
            count: 100,
            end: "latest",
            subscribe: 1,
        })
    );
}

function changeMarketAfterNoTrade() {
    if (lossTradeCount !== 0) return;

    const previousMarket = market;
    const nextMarket = (typeof getRandomMarket === "function") ? getRandomMarket(marketArray, previousMarket) : marketArray[0].value;

    if (!nextMarket || nextMarket === previousMarket) {
        ticksWithoutTrade = 0;
        return;
    }

    market = nextMarket;
    marketSelectElement.value = nextMarket;
    ticksWithoutTrade = 0;
    lastPrices = [];
    hasRequestedTickHistory = false;
    pendingContractType = null;
    contractType = null;

    console.log(`[MARKET SWITCH] No trade in ${NO_TRADE_TICK_LIMIT} ticks. ${previousMarket} -> ${nextMarket}`);

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ forget_all: "ticks" }));
        subscribeToTicks();
    }
}

function calculateSMA(prices, period) {
    if (prices.length < period) return 0;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function analyzePriceTrend(prices) {
    if (!Array.isArray(prices) || prices.length < 30) return;

    const shortPeriod = 10;
    const longPeriod = 30;

    if (prices.length < longPeriod) return;

    const shortSMA = calculateSMA(prices, shortPeriod);
    const longSMA = calculateSMA(prices, longPeriod);
    const smaDiff = ((shortSMA - longSMA) / longSMA) * 100;

    const lastN = 10;
    const recent = prices.slice(-lastN);
    let upCount = 0, downCount = 0;
    for (let i = 1; i < recent.length; i++) {
        if (recent[i] > recent[i - 1]) upCount++;
        else if (recent[i] < recent[i - 1]) downCount++;
    }
    const momentumRatio = upCount / Math.max(1, upCount + downCount);

    let detectedDirection = null;
    let strength = 0;

    if (smaDiff > 0.05 && momentumRatio > 0.55) {
        detectedDirection = "up";
        strength = Math.min(Math.abs(smaDiff) * 20, 100);
    } else if (smaDiff < -0.05 && momentumRatio < 0.45) {
        detectedDirection = "down";
        strength = Math.min(Math.abs(smaDiff) * 20, 100);
    }

    console.log(
        `[${market}] Trend: ${detectedDirection || 'neutral'} | SMA diff: ${smaDiff.toFixed(4)}% | Momentum: ${(momentumRatio * 100).toFixed(1)}% | Strength: ${strength.toFixed(1)}`
    );

    if (isTradeOpen || pendingContractType) {
        ticksWithoutTrade = 0;
        return;
    }

    if (detectedDirection) {
        const tradePlaced = tryMultiplierEntry(detectedDirection, strength);
        if (tradePlaced) {
            ticksWithoutTrade = 0;
            return;
        }
    }

    ticksWithoutTrade += 1;
    if (ticksWithoutTrade >= NO_TRADE_TICK_LIMIT && lossTradeCount === 0) {
        changeMarketAfterNoTrade();
    }
}

function tryMultiplierEntry(direction, strength) {
    if (pendingContractType) return false;
    if (isTradeOpen) return false;

    let minStrength;
    if (consecutiveLossCount === 0) minStrength = 20;
    else if (consecutiveLossCount === 1) minStrength = 35;
    else if (consecutiveLossCount === 2) minStrength = 50;
    else return false;

    if (strength < minStrength) return false;

    console.log(`[ENTRY] ${direction.toUpperCase()} | Strength: ${strength.toFixed(1)} >= ${minStrength} | Multiplier: ${multiplierValue}x | Duration: ${multiplierDuration}t`);

    if (typeof placeMultiplierTrade === "function") {
        pendingContractType = direction === "up" ? "MULTIPLIER_UP" : "MULTIPLIER_DOWN";
        placeMultiplierTrade(direction);
        return true;
    }

    return false;
}

function placeMultiplierTrade(direction) {
    if (isTradeOpen) return;

    const contractType = direction === "up" ? "MULTIPLIER_UP" : "MULTIPLIER_DOWN";
    stake = Number(stake);
    stake < 0.35 ? (stake = 0.35) : (stake = stake);

    const tradeRequest = {
        proposal: 1,
        amount: stake.toFixed(2),
        basis: "stake",
        contract_type: contractType,
        currency: "USD",
        multiplier: multiplierValue,
        duration: multiplierDuration,
        duration_unit: "t",
        underlying_symbol: market,
    };

    console.log("Sending Multiplier trade request:", tradeRequest);
    ws.send(JSON.stringify(tradeRequest));
}

function webSocketConnectionStop() {
    console.log("[BOT HALTED] Stake exceeds balance. Stopping.");
    isRunning = false;
    isTradeOpen = false;
    pendingContractType = null;
    try { localStorage.setItem("tradingStoppedForDay", "1"); } catch (e) { }
    stopPing();
    if (ws) {
        try { ws.onclose = null; ws.close(); } catch (e) { }
        ws = null;
    }
    if (scriptButton) {
        scriptButton.disabled = true;
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
