const accounts = [
    { name: "KUNKUMAGP Testing", value: "pat_5e757adf550768449c92c663114e4af7ba8c3dd3fd9d62f3faebb55b77ac3786" },
    { name: "KunkumaGP", value: "pat_75687aeb556fbcef179dfe7fa307bd403a28ec334dcbe0a45323c3d92a7c7aae" },
];

const marketArray = [
    { value: "R_10", name: "Volatility 10 Index" },
    // { value: "R_25", name: "Volatility 25 Index" },
    { value: "R_50", name: "Volatility 50 Index" },
    // { value: "R_75", name: "Volatility 75 Index" },
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
let last100Prices = [];
let hasRequestedTickHistory = false;
let pendingContractType = null;
let consecutiveLossCount = 0;
let marketStats = [];
let marketsToAnalyze = [];
let isAnalyzingMarkets = false;
let tradingDirection = null;

const martingaleMultiplier = 2.07112;
let dayTarget = 0;

if (params.get("target")) {
    dayTarget = Number(params.get("target"));
} else if (targetProfitInputElement && targetProfitInputElement.value) {
    dayTarget = Number(targetProfitInputElement.value);
}

let startingAmount = 100;

let sessionTargetPercentage = 1 / startingAmount,
    targetPercentage = 1 / startingAmount,
    amountPercentage = 2 / 100,
    finishTargetPercentagePerDay = 5 / 100,
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
    stopTimer = false,
    isCooldown = false;

let market, apiToken, stake, tickCount, contractType;
let authSuccess = false, automation = false;
let currentPayoutRate = 0.75;

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

market = marketSelectElement.value;

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
        console.log(accountData);

        if (accountData.data && accountData.data.length > 0) {
            activeAccount = accountData.data.find(acc => acc.account_type === ACCOUNT_TYPE);
        }

        

        if (!activeAccount) {
            console.log(`No demo account found. Creating one...`);
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

        console.log(`Using Demo Account ID: ${activeAccount.account_id}`);

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

            if (dayTarget > 0 && updatedAccountBalance >= dayTarget) {
                if (typeof setFlashNotification === "function") setFlashNotification("Day target is done", 0);
                console.log("Day target is done");
            } else {
                analyzeAllMarkets();
            }
        } else {
            if (typeof reload === "function") reload();
        }
    }

    if (wsResponse.msg_type === "history" && wsResponse.history && Array.isArray(wsResponse.history.prices)) {
        if (isAnalyzingMarkets) {
            const analyzedMarket = wsResponse.echo_req && wsResponse.echo_req.ticks_history ? wsResponse.echo_req.ticks_history : market;
            computeMarketStats(analyzedMarket, wsResponse.history.prices);
            analyzeNextMarket();
        } else {
            last100Prices = wsResponse.history.prices.slice(-100);
            logLastDigitPercentages(last100Prices);
        }
    }

    if (wsResponse.msg_type === "tick" && wsResponse.tick && typeof wsResponse.tick.quote !== "undefined") {
        last100Prices.push(wsResponse.tick.quote);
        if (last100Prices.length > 100) {
            last100Prices = last100Prices.slice(-100);
        }
        logLastDigitPercentages(last100Prices);
    }

    if (wsResponse.msg_type === "proposal") {
        if (updatedAccountBalance > 0 && wsResponse.echo_req.amount > updatedAccountBalance) {
            webSocketConnectionStop();
        } else {
            tradeProposal = wsResponse;
            console.log('tradeProposal: ', tradeProposal);
            // Extract actual payout rate from the proposal
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

            if (wsResponse.buy.shortcode.includes("DIGITEVEN")) {
                tradeTypeDisplay = "Even";
            } else if (wsResponse.buy.shortcode.includes("DIGITODD")) {
                tradeTypeDisplay = "Odd";
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

                isTradeOpen = false;
                pendingContractType = null;

                // ── Stop for the day if total losses reach 5% of capital ────────
                const dailyLossLimit = initialAccountBalance * 0.05;
                if (Math.abs(totalLossAmount) >= dailyLossLimit) {
                    if (typeof setFlashNotification === "function") setFlashNotification(`Stopped: Daily loss limit of 5% ($${dailyLossLimit.toFixed(2)}) reached. Stopping for today.`, 0);
                    try { localStorage.setItem('tradingStoppedForDay', '1'); } catch (e) { }
                    isRunning = false;
                    stopPing();
                    try { if (ws) ws.close(); } catch (e) { }
                    try { if (scriptButton) { scriptButton.disabled = true; scriptButton.innerText = 'Stopped (loss limit)'; } } catch (e) { }
                    return;
                }

                if (profit < 0) {
                    consecutiveLossCount += 1;
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
                }

                // ── Wait a random 5-10 minute interval between every trade ─────
                let nextTradeDelay = (typeof getRandomNumber === "function" ? getRandomNumber(300, 600) : 300) * 1000;
                console.log(`[${profit > 0 ? "WIN" : "LOSS"}] Waiting ${nextTradeDelay / 60000} minutes before next trade.`);
                if (typeof setTimer === "function") setTimer(nextTradeDelay);

                isCooldown = true;
                setTimeout(() => { isCooldown = false; runScript(); }, nextTradeDelay);
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
    analizeForEvenOdd();
}

function analizeForEvenOdd() {
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

function getDecimalPlaces(value) {
    const parts = String(value).split(".");
    return parts[1] ? parts[1].length : 0;
}

function getLastDigitByPrecision(value, precision) {
    const fixed = Number(value).toFixed(precision);
    return Number(fixed.charAt(fixed.length - 1));
}

function analyzeAllMarkets() {
    isAnalyzingMarkets = true;
    marketStats = [];
    marketsToAnalyze = marketArray.map((item) => item.value);
    console.log(`[ANALYSIS] Analyzing ${marketsToAnalyze.length} markets for last-digit percentages...`);
    analyzeNextMarket();
}

function analyzeNextMarket() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (marketsToAnalyze.length === 0) {
        finalizeMarketSelection();
        return;
    }

    const marketToAnalyze = marketsToAnalyze.shift();
    console.log(`[ANALYSIS] Fetching ${marketToAnalyze} history...`);
    ws.send(
        JSON.stringify({
            ticks_history: marketToAnalyze,
            style: "ticks",
            count: 100,
            end: "latest",
        })
    );
}

function computeMarketStats(marketName, prices) {
    const precision = prices.reduce((maxPrecision, price) => {
        const currentPrecision = getDecimalPlaces(price);
        return currentPrecision > maxPrecision ? currentPrecision : maxPrecision;
    }, 0);

    const lastDigits = prices.map((price) => getLastDigitByPrecision(price, precision));
    const counts = new Array(10).fill(0);
    lastDigits.forEach((digit) => { counts[digit]++; });
    const percents = counts.map((count) => Number(((count / lastDigits.length) * 100).toFixed(2)));

    let highestDigit = 0, highestPercent = 0;
    percents.forEach((percent, digit) => {
        if (percent > highestPercent) {
            highestPercent = percent;
            highestDigit = digit;
        }
    });

    console.log(`[ANALYSIS] ${marketName} → ${percents.join(" | ")} | Highest: digit ${highestDigit} (${highestPercent}%)`);

    marketStats.push({ market: marketName, percents, highestDigit, highestPercent });
}

function finalizeMarketSelection() {
    isAnalyzingMarkets = false;

    if (marketStats.length === 0) {
        console.error("[ANALYSIS] No market stats collected.");
        return;
    }

    let best = marketStats[0];
    marketStats.forEach((stats) => {
        if (stats.highestPercent > best.highestPercent) {
            best = stats;
        }
    });

    market = best.market;
    marketSelectElement.value = market;

    console.log(`[SELECTED] ${market} — highest digit ${best.highestDigit} (${best.highestPercent}%).`);
    if (typeof setFlashNotification === "function") setFlashNotification(`${market}: digit ${best.highestDigit} (${best.highestPercent}%) selected`, 5);

    runScript();
}

function logLastDigitPercentages(prices) {
    if (!Array.isArray(prices) || prices.length === 0) return;
    if (isCooldown) return;

    const precision = prices.reduce((maxPrecision, price) => {
        const currentPrecision = getDecimalPlaces(price);
        return currentPrecision > maxPrecision ? currentPrecision : maxPrecision;
    }, 0);

    const lastDigits = prices.map((price) => getLastDigitByPrecision(price, precision));

    const counts = new Array(10).fill(0);
    lastDigits.forEach((digit) => { counts[digit]++; });
    const percents = counts.map((count) => Number(((count / lastDigits.length) * 100).toFixed(2)));

    const evenCount = lastDigits.filter((digit) => digit % 2 === 0).length;
    const oddCount = lastDigits.length - evenCount;
    const evenPercentage = Number(((evenCount / lastDigits.length) * 100).toFixed(2));
    const oddPercentage = Number(((oddCount / lastDigits.length) * 100).toFixed(2));

    let maxDigit = 0, maxPercentage = 0;
    percents.forEach((percent, digit) => {
        if (percent > maxPercentage) {
            maxPercentage = percent;
            maxDigit = digit;
        }
    });

    tradingDirection = maxDigit % 2 === 0 ? "even" : "odd";

    const lastTwo = lastDigits.slice(-2);
    console.log(`[${market}] digits: ${percents.join(" | ")} | Even: ${evenPercentage}% | Odd: ${oddPercentage}% | Max: digit ${maxDigit} (${maxPercentage}%) | Last2: [${lastTwo.join(",")}] | Trade: ${tradingDirection}`);

    if (isTradeOpen || pendingContractType) return;
    if (lastTwo.length < 2) return;

    const secondLast = lastTwo[0];
    const last = lastTwo[1];

    if (tradingDirection === "odd" && oddPercentage > 52 && maxPercentage >= 15 && maxDigit % 2 !== 0 && secondLast % 2 === 0 && last % 2 === 0) {
        console.log(`[ENTRY] Odd ${oddPercentage}% > 52% + max digit ${maxPercentage}% >= 15% (digit ${maxDigit} is odd) + two even digits [${lastTwo.join(",")}] → placing ODD trade.`);
        if (typeof placeTheTrade === "function") placeTheTrade("odd");
    } else if (tradingDirection === "even" && evenPercentage > 52 && maxPercentage >= 15 && maxDigit % 2 === 0 && secondLast % 2 !== 0 && last % 2 !== 0) {
        console.log(`[ENTRY] Even ${evenPercentage}% > 52% + max digit ${maxPercentage}% >= 15% (digit ${maxDigit} is even) + two odd digits [${lastTwo.join(",")}] → placing EVEN trade.`);
        if (typeof placeTheTrade === "function") placeTheTrade("even");
    }
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
