const accounts = [
    { name: "KUNKUMAGP Testing", value: "pat_5e757adf550768449c92c663114e4af7ba8c3dd3fd9d62f3faebb55b77ac3786" },
    { name: "KunkumaGP", value: "pat_75687aeb556fbcef179dfe7fa307bd403a28ec334dcbe0a45323c3d92a7c7aae" },
];

const marketArray = [
    // { value: "R_10", name: "Volatility 10 Index" },
    // { value: "R_25", name: "Volatility 25 Index" },
    // { value: "R_50", name: "Volatility 50 Index" },
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
let last50Prices = [];
let hasRequestedTickHistory = false;
let tickPrecision = null;
let precisionWarningShown = false;
let pendingContractType = null;
let ticksWithoutTrade = 0;
let consecutiveLossCount = 0;
const NO_TRADE_TICK_LIMIT = 120;
// Use a fixed, prospective sample so trade eligibility is not decided by repeated early checks.
const VALIDATION_MIN_SAMPLES = 500;
const VALIDATION_MAX_SAMPLES = 500;
const VALIDATION_SIGNAL_SPACING = 50;
const VALIDATION_CONFIDENCE_Z = 2.576;
const VALIDATION_INDEPENDENCE_Z = 2.576;
const validationSamplesByKey = new Map();
const validationStorageErrors = new Set();
let pendingValidationPrediction = null;
let validationTicksUntilNextSignal = 0;

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
    amountPercentage = 2 / 100,
    finishTargetPercentagePerDay = 2 / 100,
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
        const historyPrecision = Number(wsResponse.history.pip_size || wsResponse.pip_size);
        if (Number.isInteger(historyPrecision) && historyPrecision >= 0 && historyPrecision <= 10) {
            tickPrecision = historyPrecision;
        }
        last50Prices = wsResponse.history.prices.slice(-50);
        logEvenOddPercentages(last50Prices, false);
    }

    if (wsResponse.msg_type === "tick" && wsResponse.tick && typeof wsResponse.tick.quote !== "undefined") {
        const receivedPrecision = Number(wsResponse.tick.pip_size);
        if (Number.isInteger(receivedPrecision) && receivedPrecision >= 0 && receivedPrecision <= 10) {
            if (tickPrecision !== null && tickPrecision !== receivedPrecision) {
                last50Prices = [];
                pendingValidationPrediction = null;
                validationTicksUntilNextSignal = 0;
            }
            tickPrecision = receivedPrecision;
            precisionWarningShown = false;
        }
        last50Prices.push(wsResponse.tick.quote);
        if (last50Prices.length > 50) {
            last50Prices = last50Prices.slice(-50);
        }
        logEvenOddPercentages(last50Prices, true);
    }

    if (wsResponse.msg_type === "proposal") {
        if (updatedAccountBalance > 0 && wsResponse.echo_req.amount > updatedAccountBalance) {
            webSocketConnectionStop();
        } else {
            tradeProposal = wsResponse;
            console.log('tradeProposal: ', tradeProposal);
            // Extract actual payout rate from the proposal
            try {
                if (tradeProposal.proposal && Number(tradeProposal.proposal.payout) > 0 && Number(tradeProposal.proposal.ask_price) > 0) {
                    currentPayoutRate = (tradeProposal.proposal.payout - tradeProposal.proposal.ask_price) / tradeProposal.proposal.ask_price;
                    currentPayoutRate = Number(currentPayoutRate.toFixed(4));
                }
            } catch (e) { }
            if (pendingContractType && isTradeOpen === false) {
                const askPrice = Number(tradeProposal.proposal && tradeProposal.proposal.ask_price);
                const payout = Number(tradeProposal.proposal && tradeProposal.proposal.payout);
                const breakEvenProbability = payout > 0 ? askPrice / payout : 1;
                const evidence = getValidationEvidence(market, pendingContractType);

                if (evidence && evidence.isReliable && evidence.lowerBound > breakEvenProbability) {
                    if (typeof makeTheTrade === "function") makeTheTrade(tradeProposal, pendingContractType);
                } else {
                    console.log(
                        `[VALIDATION BLOCK] ${market} ${pendingContractType}: ` +
                        `samples=${evidence ? evidence.sampleCount : 0}, ` +
                        `99.5% lower bound=${evidence ? (evidence.lowerBound * 100).toFixed(2) : "n/a"}%, ` +
                        `break-even=${(breakEvenProbability * 100).toFixed(2)}%.`
                    );
                    pendingContractType = null;
                    tradeProposal = null;
                }
            }
        }
    }

    if (wsResponse.msg_type === "error") {
        console.error("API error:", wsResponse.error);
        if (pendingContractType) {
            pendingContractType = null;
            tradeProposal = null;
        }
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

                try {
                    const sessionTargetAmount = initialAccountBalance * sessionTargetPercentage;
                    if (sessionTargetAmount > 0 && netProfit >= sessionTargetAmount) {
                        if (typeof setFlashNotification === "function") setFlashNotification('Session target reached. Reloading.', 0);
                        if (typeof reload === "function") reload();
                        return;
                    }
                } catch (e) { }

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

                if (netProfit >= targetAmount && profit > 0) {
                    if (typeof reload === "function") reload();
                } else {
                    isCooldown = true;
                    setTimeout(() => { isCooldown = false; runScript(); }, nextTradeDelay);
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
            count: 50,
            end: "latest",
            subscribe: 1,
        })
    );
}

function getLastDigitByPrecision(value, precision) {
    const numericPrice = Number(value);
    if (!Number.isFinite(numericPrice) || !Number.isInteger(precision) || precision < 0 || precision > 10) {
        return null;
    }

    const fixedPrice = numericPrice.toFixed(precision);
    return Number(fixedPrice.charAt(fixedPrice.length - 1));
}

function getValidationSamples(symbol, type) {
    const key = `new_eo_2_deriv_validation_v1:${symbol}:${type}`;
    if (validationStorageErrors.has(key)) return null;
    if (validationSamplesByKey.has(key)) return validationSamplesByKey.get(key);

    try {
        const storedSamples = localStorage.getItem(key);
        const samples = storedSamples === null ? [] : JSON.parse(storedSamples);
        if (
            !Array.isArray(samples) ||
            samples.length > VALIDATION_MAX_SAMPLES ||
            samples.some((sample) => typeof sample !== "boolean")
        ) {
            throw new Error(`Invalid saved validation data for ${symbol} ${type}.`);
        }

        validationSamplesByKey.set(key, samples);
        return samples;
    } catch (error) {
        validationStorageErrors.add(key);
        console.error(`[VALIDATION STORAGE] Cannot load ${symbol} ${type} results; trading is disabled.`, error);
        return null;
    }
}

function getValidationDiagnostics(samples) {
    const sampleCount = samples.length;
    const wins = samples.filter(Boolean).length;
    const losses = sampleCount - wins;
    const winRate = sampleCount > 0 ? wins / sampleCount : 0;
    const z = VALIDATION_CONFIDENCE_Z;
    const zSquared = z * z;
    const denominator = sampleCount > 0 ? 1 + zSquared / sampleCount : 1;
    const lowerBound = sampleCount > 0
        ? (winRate + zSquared / (2 * sampleCount) -
            z * Math.sqrt((winRate * (1 - winRate) + zSquared / (4 * sampleCount)) / sampleCount)) /
            denominator
        : 0;

    if (sampleCount < 2 || wins === 0 || losses === 0) {
        return { sampleCount, wins, winRate, lowerBound, runsZ: Infinity, lagOneCorrelation: Infinity, isIndependent: false };
    }

    let runs = 1;
    let lagProduct = 0;
    for (let i = 1; i < sampleCount; i++) {
        if (samples[i] !== samples[i - 1]) runs++;
        lagProduct += (Number(samples[i - 1]) - winRate) * (Number(samples[i]) - winRate);
    }

    const expectedRuns = (2 * wins * losses) / sampleCount + 1;
    const runVariance =
        (2 * wins * losses * (2 * wins * losses - sampleCount)) /
        (sampleCount * sampleCount * (sampleCount - 1));
    const runsZ = runVariance > 0 ? (runs - expectedRuns) / Math.sqrt(runVariance) : Infinity;
    const lagOneCorrelation =
        lagProduct / ((sampleCount - 1) * winRate * (1 - winRate));
    const correlationLimit = 1.96 / Math.sqrt(sampleCount - 1);
    const isIndependent =
        Number.isFinite(runsZ) &&
        Math.abs(runsZ) <= VALIDATION_INDEPENDENCE_Z &&
        Number.isFinite(lagOneCorrelation) &&
        Math.abs(lagOneCorrelation) <= correlationLimit;

    return { sampleCount, wins, winRate, lowerBound, runsZ, lagOneCorrelation, isIndependent };
}

function getValidationEvidence(symbol, type) {
    const samples = getValidationSamples(symbol, type);
    if (!samples) return null;

    const diagnostics = getValidationDiagnostics(samples);
    return {
        ...diagnostics,
        isReliable: diagnostics.sampleCount >= VALIDATION_MIN_SAMPLES && diagnostics.isIndependent,
    };
}

function recordValidationResult(symbol, type, won) {
    const samples = getValidationSamples(symbol, type);
    if (!samples || samples.length >= VALIDATION_MAX_SAMPLES) return;

    samples.push(won);
    if (samples.length > VALIDATION_MAX_SAMPLES) samples.shift();

    const key = `new_eo_2_deriv_validation_v1:${symbol}:${type}`;
    try {
        localStorage.setItem(key, JSON.stringify(samples));
    } catch (error) {
        validationStorageErrors.add(key);
        console.error(`[VALIDATION STORAGE] Cannot save ${symbol} ${type} results; trading is disabled.`, error);
    }

    const evidence = getValidationEvidence(symbol, type);
    console.log(
        `[VALIDATION RESULT] ${symbol} ${type}: ${won ? "hit" : "miss"}; ` +
        `samples=${evidence ? evidence.sampleCount : 0}, ` +
        `win rate=${evidence ? (evidence.winRate * 100).toFixed(2) : "n/a"}%, ` +
        `99.5% lower bound=${evidence ? (evidence.lowerBound * 100).toFixed(2) : "n/a"}%, ` +
        `independent=${evidence ? evidence.isIndependent : false}.`
    );
}

function getCandidateContractType(lastDigits) {
    if (!Array.isArray(lastDigits) || lastDigits.length < 50) return null;

    const evenCount = lastDigits.filter((digit) => digit % 2 === 0).length;
    const evenPercentage = (evenCount / lastDigits.length) * 100;
    const oddPercentage = 100 - evenPercentage;
    let trailingOppositeCount = 0;
    const candidateType = evenPercentage >= 52 ? "even" : oddPercentage >= 52 ? "odd" : null;
    if (!candidateType) return null;

    const oppositeParity = candidateType === "even" ? 1 : 0;
    for (let i = lastDigits.length - 1; i >= 0; i--) {
        if (lastDigits[i] % 2 === oppositeParity) {
            trailingOppositeCount++;
        } else {
            break;
        }
    }

    const selectedPercentage = candidateType === "even" ? evenPercentage : oddPercentage;
    if (selectedPercentage <= 60 && trailingOppositeCount >= 3) return candidateType;
    if (selectedPercentage >= 60 && trailingOppositeCount >= 2) return candidateType;
    return null;
}

function logEvenOddPercentages(prices, isLiveTick) {
    if (!Array.isArray(prices) || prices.length === 0) return;
    if (tickPrecision === null) {
        if (!precisionWarningShown) {
            console.warn(`[${market}] Waiting for tick pip_size; no digit analysis or trades will run.`);
            precisionWarningShown = true;
        }
        return;
    }

    const lastDigits = prices
        .map((price) => getLastDigitByPrecision(price, tickPrecision))
        .filter((digit) => digit !== null);
    if (lastDigits.length === 0) return;
    const evenCount = lastDigits.filter((digit) => digit % 2 === 0).length;
    const oddCount = lastDigits.length - evenCount;
    const evenPercentage = Number(((evenCount / lastDigits.length) * 100).toFixed(2));
    const oddPercentage = Number(((oddCount / lastDigits.length) * 100).toFixed(2));
    const lastThreeDigits = lastDigits.slice(-3);
    const last10Digits = lastDigits.slice(-10);
    const evenCount10 = last10Digits.filter((d) => d % 2 === 0).length;
    const oddCount10 = last10Digits.length - evenCount10;
    const even10Percentage = Number(((evenCount10 / last10Digits.length) * 100).toFixed(2));
    const odd10Percentage = Number(((oddCount10 / last10Digits.length) * 100).toFixed(2));

    // console.log(
    //     `[${market}] Even: ${evenPercentage}% (last10: ${even10Percentage}%) | ` +
    //     `Odd: ${oddPercentage}% (last10: ${odd10Percentage}%) | ` +
    //     `Last3: [${lastThreeDigits.join(",")}]`
    // );

    if (!isLiveTick) return;

    const currentDigit = lastDigits[lastDigits.length - 1];
    if (pendingValidationPrediction) {
        if (pendingValidationPrediction.symbol === market) {
            const won = pendingValidationPrediction.type === (currentDigit % 2 === 0 ? "even" : "odd");
            recordValidationResult(pendingValidationPrediction.symbol, pendingValidationPrediction.type, won);
        }
        pendingValidationPrediction = null;
    }

    if (validationTicksUntilNextSignal > 0) validationTicksUntilNextSignal--;
    const candidateType = getCandidateContractType(lastDigits);
    contractType = candidateType;

    if (candidateType && validationTicksUntilNextSignal === 0) {
        validationTicksUntilNextSignal = VALIDATION_SIGNAL_SPACING;
        const samples = getValidationSamples(market, candidateType);
        const evidence = getValidationEvidence(market, candidateType);
        if (samples && samples.length < VALIDATION_MAX_SAMPLES) {
            pendingValidationPrediction = { symbol: market, type: candidateType };
        }

        const hasPreliminaryEdge = evidence && evidence.isReliable && evidence.lowerBound > 0.5;
        if (
            hasPreliminaryEdge &&
            !isCooldown &&
            !isTradeOpen &&
            !pendingContractType &&
            typeof placeTheTrade === "function"
        ) {
            pendingContractType = candidateType;
            placeTheTrade(candidateType);
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
    last50Prices = [];
    hasRequestedTickHistory = false;
    tickPrecision = null;
    precisionWarningShown = false;
    pendingContractType = null;
    contractType = null;
    pendingValidationPrediction = null;
    validationTicksUntilNextSignal = 0;

    console.log(`[MARKET SWITCH] No trade in ${NO_TRADE_TICK_LIMIT} ticks. ${previousMarket} -> ${nextMarket}`);

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ forget_all: "ticks" }));
        analizeForEvenOdd();
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
