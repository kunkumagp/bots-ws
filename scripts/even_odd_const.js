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
let last50Prices = [];
let hasRequestedTickHistory = false;
let pendingContractType = null;
let ticksWithoutTrade = 0;
const NO_TRADE_TICK_LIMIT = 120;
let dayTarget = 0;
const amountPercentage = 1 / 100;

let isTradeOpen = false,
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

            runScript();
        } else {
            if (typeof reload === "function") reload();
        }
    }

    if (wsResponse.msg_type === "history" && wsResponse.history && Array.isArray(wsResponse.history.prices)) {
        console.log("history prices: ",wsResponse.history.prices);

        
        const nextValues = predictNextFiveValues(wsResponse.history.prices);
        console.log("Next 5 values: ",nextValues); // Output: [ 4996.816, 4996.722, 4996.628, 4996.534, 4996.44 ]
        
        last50Prices = wsResponse.history.prices.slice(-50);
        logEvenOddPercentages(last50Prices);
    }

    if (wsResponse.msg_type === "tick" && wsResponse.tick && typeof wsResponse.tick.quote !== "undefined") {
        last50Prices.push(wsResponse.tick.quote);
        if (last50Prices.length > 50) {
            last50Prices = last50Prices.slice(-50);
        }
        logEvenOddPercentages(last50Prices);
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

                // Martingale: if recovering losses, stake = totalLostAmount * 1.3; else 1% of capital
                const storedLost = parseFloat(localStorage.getItem('totalLostAmount')) || 0;
                if (storedLost !== 0) {
                    stake = Number((Math.abs(storedLost) * 1.3).toFixed(2));
                } else {
                    stake = Number((updatedAccountBalance * amountPercentage).toFixed(2));
                }
                try { if (initialStakeInputElement) initialStakeInputElement.value = Number(stake).toFixed(2); } catch (e) { }

                // Switch market randomly after every win
                if (profit > 0) {
                    const prevMarket = market;
                    const nextMarket = (typeof getRandomMarket === "function") ? getRandomMarket(marketArray, prevMarket) : marketArray[0].value;
                    if (nextMarket && nextMarket !== prevMarket) {
                        market = nextMarket;
                        marketSelectElement.value = nextMarket;
                        last50Prices = [];
                        hasRequestedTickHistory = false;
                        pendingContractType = null;
                        contractType = null;
                        console.log(`[MARKET SWITCH] Win trade. ${prevMarket} -> ${nextMarket}`);
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ forget_all: "ticks" }));
                        }
                    }
                }

                // Random 2-5 minute interval between trades
                const intervalMs = (typeof getRandomNumber === "function" ? getRandomNumber(120, 300) : 180) * 1000;
                if (typeof setTimer === "function") setTimer(intervalMs);
                setTimeout(() => {
                    runScript();
                }, intervalMs);
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

function logEvenOddPercentages(prices) {
    if (!Array.isArray(prices) || prices.length === 0) return;

    const precision = prices.reduce((maxPrecision, price) => {
        const currentPrecision = getDecimalPlaces(price);
        return currentPrecision > maxPrecision ? currentPrecision : maxPrecision;
    }, 0);

    const lastDigits = prices.map((price) => getLastDigitByPrecision(price, precision));
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

    contractType = null;
    // Dual-window confirmation: both 50-tick and 10-tick must show same bias
    if (evenPercentage >= 52 && even10Percentage >= 60) {
        contractType = "even";
    } else if (oddPercentage >= 52 && odd10Percentage >= 60) {
        contractType = "odd";
    }

    console.log(
        `[${market}] Even: ${evenPercentage}% (last10: ${even10Percentage}%) | Odd: ${oddPercentage}% (last10: ${odd10Percentage}%) | ContractType: ${contractType} | Last3: [${lastThreeDigits.join(",")}]`
    );

    const evenTriggered = tryEvenEntry(evenPercentage, lastDigits);
    const oddTriggered = tryOddEntry(oddPercentage, lastDigits);
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
    pendingContractType = null;
    contractType = null;

    console.log(`[MARKET SWITCH] No trade in ${NO_TRADE_TICK_LIMIT} ticks. ${previousMarket} -> ${nextMarket}`);

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ forget_all: "ticks" }));
        analizeForEvenOdd();
    }
}

function getTrailingOddCount(lastDigits) {
    let trailingOddCount = 0;
    for (let i = lastDigits.length - 1; i >= 0; i--) {
        if (lastDigits[i] % 2 !== 0) {
            trailingOddCount++;
        } else {
            break;
        }
    }
    return trailingOddCount;
}

function tryEvenEntry(evenPercentage, lastDigits) {
    if (pendingContractType) return false;
    if (contractType !== "even") return false;
    if (!Array.isArray(lastDigits) || lastDigits.length === 0) return false;

    const trailingOddCount = getTrailingOddCount(lastDigits);
    let shouldPlaceTrade = false;

    if (evenPercentage < 52) return false;

    if (evenPercentage >= 52 && evenPercentage <= 60 && trailingOddCount >= 3) {
        shouldPlaceTrade = true;
    } else if (evenPercentage > 60 && trailingOddCount >= 2) {
        shouldPlaceTrade = true;
    }

    if (shouldPlaceTrade) {
        if (typeof placeTheTrade === "function") {
            pendingContractType = "even";
            placeTheTrade(contractType);
            return true;
        } else {
            console.warn("placeTheTrade function is not available.");
        }
    }

    return false;
}

function getTrailingEvenCount(lastDigits) {
    let trailingEvenCount = 0;
    for (let i = lastDigits.length - 1; i >= 0; i--) {
        if (lastDigits[i] % 2 === 0) {
            trailingEvenCount++;
        } else {
            break;
        }
    }
    return trailingEvenCount;
}

function tryOddEntry(oddPercentage, lastDigits) {
    if (pendingContractType) return false;
    if (contractType !== "odd") return false;
    if (!Array.isArray(lastDigits) || lastDigits.length === 0) return false;

    const trailingEvenCount = getTrailingEvenCount(lastDigits);
    let shouldPlaceTrade = false;

    if (oddPercentage < 52) return false;

    if (oddPercentage >= 52 && oddPercentage <= 60 && trailingEvenCount >= 2) {
        shouldPlaceTrade = true;
    } else if (oddPercentage > 60 && trailingEvenCount >= 1) {
        shouldPlaceTrade = true;
    }

    if (shouldPlaceTrade) {
        if (typeof placeTheTrade === "function") {
            pendingContractType = "odd";
            placeTheTrade(contractType);
            return true;
        } else {
            console.warn("placeTheTrade function is not available.");
        }
    }

    return false;
}

function webSocketConnectionStop() {
    console.log("[BOT HALTED] Stake exceeds balance. Stopping.");
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


function predictNextFiveValues(data) {
    const lookback = 5; // Number of recent points to analyze
    const forecastSteps = 5; // Number of future points to predict
    
    if (data.length < lookback) {
        throw new Error(`Array must have at least ${lookback} elements.`);
    }

    // 1. Extract the last 'lookback' data points
    const recentData = data.slice(-lookback);
    
    // 2. Setup X (indices/time) and Y (values) arrays
    // For simplicity, we align the X indices to start from 0 to lookback-1
    const xValues = Array.from({ length: lookback }, (_, i) => i);
    const yValues = recentData;

    // 3. Calculate Means of X and Y
    const xMean = xValues.reduce((a, b) => a + b, 0) / lookback;
    const yMean = yValues.reduce((a, b) => a + b, 0) / lookback;

    // 4. Calculate the Slope (m) and Intercept (c) -> y = mx + c
    let num = 0;
    let den = 0;
    for (let i = 0; i < lookback; i++) {
        num += (xValues[i] - xMean) * (yValues[i] - yMean);
        den += Math.pow(xValues[i] - xMean, 2);
    }
    
    const slope = num / den;
    const intercept = yMean - (slope * xMean);

    // 5. Predict the next 5 values
    const predictions = [];
    for (let i = 0; i < forecastSteps; i++) {
        // The next points continue from the lookback index onwards
        const nextX = lookback + i;
        const nextY = (slope * nextX) + intercept;
        
        // Round to 3 decimal places to match your data formatting
        predictions.push(Number(nextY.toFixed(3)));
    }

    return predictions;
}

// Output: [ 4996.816, 4996.722, 4996.628, 4996.534, 4996.44 ]