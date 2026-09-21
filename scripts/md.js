const accounts = [
    { name: "KUNKUMAGP Testing", value: "pat_5e757adf550768449c92c663114e4af7ba8c3dd3fd9d62f3faebb55b77ac3786" },
    { name: "KunkumaGP", value: "pat_75687aeb556fbcef179dfe7fa307bd403a28ec334dcbe0a45323c3d92a7c7aae" },
];

const marketArray = [
    { value: "R_10", name: "Volatility 10 Index" },
    { value: "R_50", name: "Volatility 50 Index" },
    { value: "R_100", name: "Volatility 100 Index" },
];

const ACCOUNT_TYPE = "demo";
const APP_ID = "33oWYOQxAL3YJYtTvBRep";

const accountSelectElement = document.getElementById("account_select");
const marketSelectElement = document.getElementById("market");
const targetProfitInputElement = document.getElementById("target_profit");
const initialStakeInputElement = document.getElementById("initial_stake");
const authenticateButton = document.getElementById("authenticateButton");
const scriptButton = document.getElementById("scriptButton");

const WINDOW_SIZE = 100;
const MIN_LOWEST_PERCENT = 6;
const RECHECK_MS = 180000;
let recheckTimer = null;

let ws = null;
let intervalId;
let isRunning = false;
let stopTimer = false;

let marketStats = [];
let marketsToAnalyze = [];
let isAnalyzingMarkets = false;
let priceHistory = {};
let tickSubscriptions = {};

let selectedMarket = null;
let predictionDigit = null;
let selectedLowestPercent = Infinity;

let pendingContractType = null;
let isTradeOpen = false;
let tradeProposal = null;
let lastTradeId = null;
const tradeTypeDisplay = "Differ";

let authSuccess = false;
let market, apiToken, stake;
let targetPercentage = 1 / 100;
let amountPercentage = 1 / 100;
let targetAmount = 0;
let amountPutForTrading = 0;

let initialAccountBalance = 0;
let updatedAccountBalance = 0;
let netProfit = 0;
let winTradeCount = 0;
let lossTradeCount = 0;
let totalTradeCount = 0;
let totalProfitAmount = 0;
let totalLossAmount = 0;
let currentProfitAmount = 0;
let currentLossAmount = 0;

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

market = marketSelectElement.value;

if (targetProfitInputElement) {
    targetProfitInputElement.addEventListener("change", () => {});
}

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
            try { if (targetProfitInputElement) targetProfitInputElement.value = targetAmount; } catch (e) { }

            analyzeAllMarkets();
        } else {
            if (typeof reload === "function") reload();
        }
    }

    if (wsResponse.msg_type === "history" && wsResponse.history && Array.isArray(wsResponse.history.prices)) {
        if (isAnalyzingMarkets) {
            const analyzedMarket = wsResponse.echo_req && wsResponse.echo_req.ticks_history ? wsResponse.echo_req.ticks_history : market;
            computeMarketStats(analyzedMarket, wsResponse.history.prices);
            analyzeNextMarket();
        }
    }

    if (wsResponse.msg_type === "tick" && wsResponse.tick && typeof wsResponse.tick.quote !== "undefined") {
        const tickMarket = wsResponse.tick.symbol;
        if (wsResponse.subscription && wsResponse.subscription.id) {
            tickSubscriptions[tickMarket] = wsResponse.subscription.id;
        }
        handleLiveTick(tickMarket, wsResponse.tick.quote);
    }

    if (wsResponse.msg_type === "proposal") {
        tradeProposal = wsResponse;
        console.log('tradeProposal: ', tradeProposal);
        if (updatedAccountBalance > 0 && wsResponse.echo_req.amount > updatedAccountBalance) {
            webSocketConnectionStop();
        } else if (pendingContractType && isTradeOpen === false) {
            if (typeof makeTheTrade === "function") makeTheTrade(tradeProposal, pendingContractType);
        }
    }

    if (wsResponse.msg_type === "error") {
        console.error("API error:", wsResponse.error);
        if (!isTradeOpen) {
            pendingContractType = null;
        }
    }

    if (wsResponse.msg_type === "buy") {
        if (wsResponse.buy && wsResponse.buy.contract_id !== undefined) {
            lastTradeId = wsResponse.buy.contract_id;
            totalTradeCount = totalTradeCount + 1;
            isTradeOpen = true;

            if (recheckTimer) {
                clearTimeout(recheckTimer);
                recheckTimer = null;
            }

            if (typeof setResultNotification === "function") setResultNotification(lastTradeId, tradeTypeDisplay, selectedMarket, wsResponse.buy.buy_price);
            console.log("Trade Successful:", wsResponse);

            setTimeout(() => {
                if (typeof fetchTradeDetails === "function") fetchTradeDetails(lastTradeId);
            }, 500);
        } else {
            pendingContractType = null;
        }
    }

    if (wsResponse.msg_type === "proposal_open_contract") {
        if (wsResponse.proposal_open_contract.contract_id === lastTradeId) {
            const contract = wsResponse.proposal_open_contract;

            if (contract.is_sold) {
                const profit = parseFloat(contract.profit);

                if (typeof setInfo === "function") setInfo(contract, profit);

                isTradeOpen = false;
                pendingContractType = null;

                console.log(`[RESULT] Trade settled. Profit: ${profit.toFixed(2)}. Placing next trade on next tick...`);
            } else {
                setTimeout(() => {
                    if (typeof setTickCountDown === "function") setTickCountDown(contract.tick_count, contract.tick_stream.length);
                    if (typeof fetchTradeDetails === "function") fetchTradeDetails(lastTradeId);
                }, 1000);
            }
        }
    }
}

function analyzeAllMarkets() {
    forgetAllTickSubscriptions();
    isAnalyzingMarkets = true;
    marketStats = [];
    priceHistory = {};
    marketsToAnalyze = marketArray.map((item) => item.value);
    console.log(`[ANALYSIS] Analyzing ${marketsToAnalyze.length} markets for lowest last-digit percentage...`);
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
            count: WINDOW_SIZE,
            end: "latest",
        })
    );
}

function computeMarketStats(marketName, prices) {
    priceHistory[marketName] = prices.slice(-WINDOW_SIZE);
    const precision = prices.reduce((maxPrecision, price) => {
        const currentPrecision = getDecimalPlaces(price);
        return currentPrecision > maxPrecision ? currentPrecision : maxPrecision;
    }, 0);

    const lastDigits = prices.map((price) => getLastDigitByPrecision(price, precision));
    const counts = new Array(10).fill(0);
    lastDigits.forEach((digit) => { counts[digit]++; });
    const percents = counts.map((count) => Number(((count / lastDigits.length) * 100).toFixed(2)));

    let lowestDigit = 0, lowestPercent = Infinity;
    percents.forEach((percent, digit) => {
        if (percent < lowestPercent) {
            lowestPercent = percent;
            lowestDigit = digit;
        }
    });

    console.log(`[ANALYSIS] ${marketName} → ${percents.join(" | ")} | Lowest: digit ${lowestDigit} (${lowestPercent}%)`);

    const entry = { market: marketName, percents, lowestDigit, lowestPercent };
    marketStats.push(entry);
}

function finalizeMarketSelection() {
    isAnalyzingMarkets = false;

    if (marketStats.length === 0) {
        console.error("[ANALYSIS] No market stats collected.");
        return;
    }

    isRunning = true;
    pickLowestDigit();

    console.log(`[SELECTED] ${selectedMarket} — lowest digit ${predictionDigit}.`);
    if (typeof setFlashNotification === "function") setFlashNotification(`${selectedMarket}: digit ${predictionDigit} selected`, 5);

    subscribeToSelectedMarket();

    if (recheckTimer) clearTimeout(recheckTimer);
    recheckTimer = setTimeout(() => {
        console.log(`[RECHECK] No trade after 3 minutes. Rechecking all markets...`);
        analyzeAllMarkets();
    }, RECHECK_MS);
}

function pickLowestDigit() {
    if (isAnalyzingMarkets || marketStats.length < marketArray.length) return;

    let best = null;
    marketStats.forEach((stats) => {
        stats.percents.forEach((percent, digit) => {
            const candidate = { market: stats.market, digit, lowestPercent: percent };
            if (!best) {
                best = candidate;
                return;
            }
            if (percent < best.lowestPercent) {
                best = candidate;
            } else if (percent === best.lowestPercent) {
                if (candidate.market === selectedMarket && candidate.digit === predictionDigit) {
                    best = candidate;
                }
            }
        });
    });

    if (!best) return;

    const changed = best.market !== selectedMarket || best.digit !== predictionDigit;
    selectedMarket = best.market;
    predictionDigit = best.digit;
    selectedLowestPercent = best.lowestPercent;

    if (changed) {
        console.log(`[UPDATE] Lowest → ${selectedMarket} digit ${predictionDigit} (${best.lowestPercent}%)`);
        if (typeof setFlashNotification === "function") setFlashNotification(`Lowest: ${selectedMarket} digit ${predictionDigit} (${best.lowestPercent}%)`, 5);
    }
}

function subscribeToSelectedMarket() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    forgetAllTickSubscriptions();
    tickSubscriptions[selectedMarket] = null;
    ws.send(JSON.stringify({ ticks: selectedMarket, subscribe: 1 }));
}

function forgetAllTickSubscriptions() {
    Object.values(tickSubscriptions).forEach((id) => {
        if (id && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ forget: id }));
        }
    });
    tickSubscriptions = {};
}

function handleLiveTick(tickMarket, quote) {
    if (tickMarket !== selectedMarket || predictionDigit === null) return;

    if (!priceHistory[tickMarket]) priceHistory[tickMarket] = [];
    priceHistory[tickMarket].push(quote);
    if (priceHistory[tickMarket].length > WINDOW_SIZE) {
        priceHistory[tickMarket] = priceHistory[tickMarket].slice(-WINDOW_SIZE);
    }

    if (!isAnalyzingMarkets && marketStats.length >= marketArray.length) {
        updateMarketStats(tickMarket);
    }

    console.log(`[TICK] ${tickMarket} current last digit: ${getLastDigit(quote)} | selected: ${selectedMarket} digit ${predictionDigit} (${selectedLowestPercent}%)`);

    if (isTradeOpen || pendingContractType) return;
    if (selectedLowestPercent >= MIN_LOWEST_PERCENT) return;

    placeDifferTrade();
}

function updateMarketStats(tickMarket) {
    const prices = priceHistory[tickMarket];
    if (!prices || prices.length === 0) return;

    const precision = prices.reduce((maxPrecision, price) => {
        const currentPrecision = getDecimalPlaces(price);
        return currentPrecision > maxPrecision ? currentPrecision : maxPrecision;
    }, 0);

    const lastDigits = prices.map((price) => getLastDigitByPrecision(price, precision));
    const counts = new Array(10).fill(0);
    lastDigits.forEach((digit) => { counts[digit]++; });
    const percents = counts.map((count) => Number(((count / lastDigits.length) * 100).toFixed(2)));

    let lowestDigit = 0, lowestPercent = Infinity;
    percents.forEach((percent, digit) => {
        if (percent < lowestPercent) {
            lowestPercent = percent;
            lowestDigit = digit;
        }
    });

    const idx = marketStats.findIndex((s) => s.market === tickMarket);
    const entry = { market: tickMarket, percents, lowestDigit, lowestPercent };
    if (idx >= 0) marketStats[idx] = entry; else marketStats.push(entry);
}

function placeDifferTrade() {
    if (isTradeOpen || pendingContractType) return;
    if (selectedMarket === null || predictionDigit === null) return;

    pendingContractType = "DIGITDIFF";

    stake = Number(stake);
    stake < 0.35 ? (stake = 0.35) : (stake = stake);

    const tradeRequest = {
        proposal: 1,
        amount: stake.toFixed(2),
        basis: "stake",
        contract_type: "DIGITDIFF",
        currency: "USD",
        duration: 1,
        duration_unit: "t",
        underlying_symbol: selectedMarket,
        barrier: String(predictionDigit),
    };

    console.log("Sending DIFFER trade request:", tradeRequest);
    ws.send(JSON.stringify(tradeRequest));
}

function getDecimalPlaces(value) {
    const parts = String(value).split(".");
    return parts[1] ? parts[1].length : 0;
}

function getLastDigitByPrecision(value, precision) {
    const fixed = Number(value).toFixed(precision);
    return Number(fixed.charAt(fixed.length - 1));
}

function getLastDigit(value) {
    const precision = getDecimalPlaces(value);
    return getLastDigitByPrecision(value, precision);
}

function webSocketConnectionStop() {
    console.log("[BOT HALTED] Stopping.");
    isRunning = false;
    isTradeOpen = false;
    pendingContractType = null;
    stopPing();
    if (ws) {
        try { ws.onclose = null; ws.close(); } catch (e) { }
        ws = null;
    }
    if (scriptButton) {
        scriptButton.disabled = true;
        scriptButton.innerText = "Stopped";
    }
    if (typeof setFlashNotification === "function") {
        setFlashNotification("Bot Terminated.", 0);
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

function setInfo(contract, lastTradeProfit) {
    updatedAccountBalance = updatedAccountBalance + lastTradeProfit;

    currentProfitAmount = currentProfitAmount + lastTradeProfit;
    currentLossAmount = currentLossAmount + lastTradeProfit;
    if (currentLossAmount >= 0) { currentLossAmount = 0; }

    netProfit = updatedAccountBalance - initialAccountBalance;

    if (targetAmount > 0 && netProfit >= targetAmount) {
        console.log(`Target reached. Net profit: ${netProfit.toFixed(2)} / Target: ${targetAmount}`);
        if (typeof setFlashNotification === "function") setFlashNotification("Target reached. Reloading page...", 0);
        setTimeout(() => {
            if (typeof reload === "function") reload();
        }, 1000);
        return;
    }

    if (lastTradeProfit > 0) {
        winTradeCount = winTradeCount + 1;
        totalProfitAmount = totalProfitAmount + lastTradeProfit;
    } else if (lastTradeProfit < 0) {
        lossTradeCount = lossTradeCount + 1;
        totalLossAmount = totalLossAmount + lastTradeProfit;
    }

    if (typeof setResultNotification === "function") {
        setResultNotification(lastTradeId, tradeTypeDisplay, selectedMarket, contract.buy_price, lastTradeProfit);
    }

    if (typeof setAccountInfo === "function") {
        setAccountInfo("totalTradeCount", `${totalTradeCount}`);
        setAccountInfo("winCount", `${winTradeCount}`);
        setAccountInfo("lossCount", `${lossTradeCount}`);

        let updatedAccountBalanceDisplay = null;
        if (updatedAccountBalance > initialAccountBalance) {
            updatedAccountBalanceDisplay = `<span class="green">$ ${updatedAccountBalance.toFixed(2)}</span>`;
        } else if (updatedAccountBalance < initialAccountBalance) {
            updatedAccountBalanceDisplay = `<span class="red">$ ${updatedAccountBalance.toFixed(2)}</span>`;
        }
        setAccountInfo("updatedAccountBalance", `${updatedAccountBalanceDisplay}`);

        let netProfitDisplay = null;
        if (netProfit > 0) {
            netProfitDisplay = `<span class="green">$ ${netProfit.toFixed(2)}</span>`;
        } else if (netProfit < 0) {
            netProfitDisplay = `<span class="red">$ ${netProfit.toFixed(2)}</span>`;
        }
        setAccountInfo("net_profit", `${netProfitDisplay}`);

        let totalProfitAmountDisplay = null;
        if (totalProfitAmount < 0) {
            totalProfitAmountDisplay = `<span class="red">$ ${totalProfitAmount.toFixed(2)}</span>`;
        } else if (totalProfitAmount > 0) {
            totalProfitAmountDisplay = `<span class="green">$ ${totalProfitAmount.toFixed(2)}</span>`;
        } else {
            totalProfitAmountDisplay = `$ ${totalProfitAmount.toFixed(2)}`;
        }
        setAccountInfo("totalProfit", `${totalProfitAmountDisplay}`);

        let totalLossAmountDisplay = null;
        if (totalLossAmount < 0) {
            totalLossAmountDisplay = `<span class="red">$ ${totalLossAmount.toFixed(2)}</span>`;
        } else if (totalLossAmount > 0) {
            totalLossAmountDisplay = `<span class="green">$ ${totalLossAmount.toFixed(2)}</span>`;
        } else {
            totalLossAmountDisplay = `$ ${totalLossAmount.toFixed(2)}`;
        }
        setAccountInfo("totalLoss", `${totalLossAmountDisplay}`);

        let currentProfitAmountDisplay = null;
        if (currentProfitAmount < 0) {
            currentProfitAmountDisplay = `<span class="red">$ ${currentProfitAmount.toFixed(2)}</span>`;
        } else if (currentProfitAmount > 0) {
            currentProfitAmountDisplay = `<span class="green">$ ${currentProfitAmount.toFixed(2)}</span>`;
        } else {
            currentProfitAmountDisplay = `$ ${currentProfitAmount.toFixed(2)}`;
        }
        setAccountInfo("currentProfitAmount", `${currentProfitAmountDisplay}`);

        let currentLossAmountDisplay = null;
        if (currentLossAmount < 0) {
            currentLossAmountDisplay = `<span class="red">$ ${currentLossAmount.toFixed(2)}</span>`;
        } else if (currentLossAmount > 0) {
            currentLossAmountDisplay = `<span class="green">$ ${currentLossAmount.toFixed(2)}</span>`;
        } else {
            currentLossAmountDisplay = `$ ${currentLossAmount.toFixed(2)}`;
        }
        setAccountInfo("currentLossAmount", `${currentLossAmountDisplay}`);
    }
}