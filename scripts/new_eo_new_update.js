const accounts = [
    { name: "KunkumaGP", value: "pat_75687aeb556fbcef179dfe7fa307bd403a28ec334dcbe0a45323c3d92a7c7aae" }
];

const marketArray = [
    { value: "R_10", name: "Volatility 10 Index" },
    { value: "R_25", name: "Volatility 25 Index" },
    { value: "R_50", name: "Volatility 50 Index" },
    { value: "R_75", name: "Volatility 75 Index" },
    { value: "R_100", name: "Volatility 100 Index" },
];

// Configuration & Global Constant Declarations
const APP_ID = "33jLZ26mnkXNN8GI4mJBI"; 
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

// Build DOM Selections
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

market = (typeof getRandomMarket === "function") ? getRandomMarket(marketArray, '') : marketSelectElement.value;

Object.defineProperty(window, 'updatedAccountBalance', {
    get: function() { 
        return window._underlyingBalance || 0; 
    },
    set: function(val) { 
        window._underlyingBalance = typeof val === 'string' ? parseFloat(val) : val; 
    },
    configurable: true
});

// --- MODERNIZED DERIV AUTHENTICATION FLOW (REST TO WEBSOCKET) ---

async function fetchAuthenticatedConnectionUrl(token) {
    try {
        const accountDetailsResponse = await fetch(`https://api.derivws.com/trading/v1/options/accounts`, {
            method: 'GET',
            headers: {
                'Deriv-App-ID': APP_ID,
                'Authorization': `Bearer ${token}`
            }
        });

        if (!accountDetailsResponse.ok) {
            throw new Error(`Failed to fetch account list details: ${accountDetailsResponse.statusText}`);
        }

        const accountData = await accountDetailsResponse.json();
        
        if (!accountData.data || accountData.data.length === 0) {
            throw new Error("No active options trading accounts found for this token.");
        }
        const activeAccountId = accountData.data[0].account_id; 
        console.log(`Targeting dynamic Account ID: ${activeAccountId}`);

        const otpEndpointUrl = `https://api.derivws.com/trading/v1/options/accounts/${activeAccountId}/otp`;

        const response = await fetch(otpEndpointUrl, {
            method: 'POST',
            headers: {
                'Deriv-App-ID': APP_ID,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`REST Handshake failure: ${response.statusText}`);
        }

        const payload = await response.json();
        return payload.data.url; 
    } catch (error) {
        console.error("Failed executing OTP fetch generation step:", error);
        if (typeof setFlashNotification === "function") {
            setFlashNotification("Authentication routing failed. Check App ID registration.", 0);
        }
        return null;
    }
}

async function initializeTradingSession() {
    if (ws) {
        try { ws.close(); } catch(e){}
    }

    console.log("Requesting single-use token authorization channel...");
    const authorizedUrl = await fetchAuthenticatedConnectionUrl(apiToken);

    if (!authorizedUrl) {
        console.error("Halting script execution. Cannot secure authenticated link.");
        return;
    }

    console.log("Connecting securely to validated stream pipeline...");
    ws = new WebSocket(authorizedUrl);

    const originalSend = ws.send;
    ws.send = function (data) {
        try {
            let parsedData = JSON.parse(data);
            if (parsedData.proposal && parsedData.symbol) {
                parsedData.underlying_symbol = parsedData.symbol;
                delete parsedData.symbol;
                data = JSON.stringify(parsedData);
            }
        } catch (e) {}
        originalSend.apply(this, [data]);
    };

    ws.onopen = function () {
        console.log("WebSocket engine linked up successfully.");
        startPing();
        ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
    };

    ws.onclose = function () {
        console.log("Connection terminated.");
        stopPing();
        setTimeout(() => {
            if (typeof reload === "function") reload();
        }, 30000);
    };

    ws.onerror = function (err) {
        console.error("Active connection error caught: ", err);
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

/**
 * Segregated Messaging Core Engine
 */
function handleServerMessage(event) {
    const wsResponse = JSON.parse(event.data);
    if (!wsResponse) return;

    if (wsResponse.msg_type === "balance" && initialAccountBalance === 0) {
        console.log("Authorization tracking verification succeeded via Balance callback.\n-----------------------------\n\n");
        if (typeof setFlashNotification === "function") setFlashNotification("Authorization verified successfully", 0);

        if (wsResponse.balance && typeof wsResponse.balance.balance !== "undefined") {
            initialAccountBalance = parseFloat(wsResponse.balance.balance);
            updatedAccountBalance = initialAccountBalance;
            if (typeof setAccountInfo === "function") setAccountInfo("initialAccountBalance", `$ ${initialAccountBalance}`);
            
            if (authenticateButton) {
                authenticateButton.innerHTML = "Authenticated. Live Engine Active.";
                authenticateButton.disabled = true;
            }
            if (typeof resetParams === "function") resetParams();

            try {
                const storedLost = parseFloat(localStorage.getItem('totalLostAmount')) || 0;
                if (storedLost !== 0) {
                    const PAYOUT_RATE = 0.95; // Deriv even/odd payout is ~95%
                    const recoveryStake = Math.abs(storedLost) / PAYOUT_RATE;
                    stake = Number(recoveryStake.toFixed(2));
                    if (initialStakeInputElement) initialStakeInputElement.value = stake;
                    if (typeof setFlashNotification === "function") setFlashNotification(`Recovered loss context: ${storedLost.toFixed(2)} — Adjusted stake: ${stake}`, 5);
                }
            } catch (e) {}

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
                    if (targetProfitInputElement) targetProfitInputElement.value = targetAmount;
                } catch (e) {}

                if (initialAccountBalance >= dayTarget) {
                    stopBotExecution("Day target already reached. Stopping execution for today.");
                    return;
                }
            } catch (e) {
                console.error('Error initializing targets:', e);
            }

            runScript();
        }
    }

    if (wsResponse.msg_type === "history" && wsResponse.history && Array.isArray(wsResponse.history.prices)) {
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
            if (typeof webSocketConnectionStop === "function") webSocketConnectionStop();
        } else {
            tradeProposal = wsResponse;
            console.log('Active trade proposal generated: ', tradeProposal);

            if (pendingContractType && isTradeOpen === false) {
                if (typeof makeTheTrade === "function") makeTheTrade(tradeProposal, pendingContractType);
            }
        }
    }

    if (wsResponse.msg_type === "error") {
        console.error("Deriv Processing Engine Error:", wsResponse.error);
    }

    if (wsResponse.msg_type === "buy") {
        if (wsResponse.buy == undefined || wsResponse.buy.contract_id == undefined) {
            // Execution fallbacks
        } else {
            lastTradeId = wsResponse.buy.contract_id;
            totalTradeCount += 1;
            isTradeOpen = true;

            if (wsResponse.buy.shortcode.includes("DIGITEVEN")) {
                tradeTypeDisplay = "Even";
            } else if (wsResponse.buy.shortcode.includes("DIGITODD")) {
                tradeTypeDisplay = "Odd";
            }

            if (typeof setResultNotification === "function") {
                setResultNotification(lastTradeId, tradeTypeDisplay, market, wsResponse.buy.buy_price);
            }
            console.log("Trade Order Executed Successfully:", wsResponse);

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

                netProfit = Number((netProfit + profit).toFixed(2));
                totalProfitAmount = Number((parseFloat(totalProfitAmount || 0) + profit).toFixed(2));
                updatedAccountBalance = Number((updatedAccountBalance + profit).toFixed(2));

                if (typeof setInfo === "function") setInfo(contract, profit);

                // Check Day Target Completion Boundary
                if (dayTarget > 0 && updatedAccountBalance >= dayTarget) {
                    stopBotExecution("Day target profit completed successfully! Stopping for today.");
                    return;
                }

                isTradeOpen = false;
                if (typeof stakeChange === "function") stakeChange(result);
                pendingContractType = null;

                if (profit < 0) {
                    consecutiveLossCount += 1;
                    
                    // --- MODERNIZED 3 LOSS STREAM RELOAD ENGINE ---
                    if (consecutiveLossCount >= 3) {
                        // Generate a random delay between 3 and 5 minutes (in seconds)
                        const minMinutes = 3;
                        const maxMinutes = 5;
                        const randomSeconds = Math.floor(Math.random() * ((maxMinutes - minMinutes) * 60 + 1)) + (minMinutes * 60);
                        
                        startLossStreakCountdown(randomSeconds);
                        return; 
                    }
                } else {
                    consecutiveLossCount = 0;
                }

                let setTimeInterval = 0;
                if (netProfit >= targetAmount) {
                    if (typeof reload === "function") reload();
                } else {
                    if (typeof setTimer === "function") setTimer(setTimeInterval);
                    setTimeout(() => { runScript(); }, setTimeInterval);
                }
            } else {
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

/**
 * Custom Loss Cooldown Dynamic Counter Utility
 * Freezes loops, displays a countdown from 3 to 5 minutes, and triggers a full page refresh.
 */
function startLossStreakCountdown(durationSeconds) {
    isRunning = false;
    stopPing();
    
    if (ws) {
        try {
            ws.onclose = null; // Unbind hook to prevent connection reset loops
            ws.close();
        } catch(e) {}
        ws = null;
    }

    let remainingTime = durationSeconds;

    const countdownTimerId = setInterval(() => {
        const minutesLeft = Math.floor(remainingTime / 60);
        const secondsLeft = remainingTime % 60;
        
        // Format layout string to display clean pad counts (e.g., 04:09 remaining)
        const formatSeconds = secondsLeft < 10 ? '0' + secondsLeft : secondsLeft;
        const displayString = `3 Losses: Reloading in ${minutesLeft}:${formatSeconds}`;
        
        console.log(`[LOSS COOLDOWN] ${displayString}`);
        
        // Push notification update strings straight to your HTML Elements
        if (scriptButton) {
            scriptButton.disabled = true;
            scriptButton.innerText = displayString;
        }
        
        if (typeof setFlashNotification === "function") {
            setFlashNotification(displayString, 0);
        }

        remainingTime -= 1;

        if (remainingTime < 0) {
            clearInterval(countdownTimerId);
            console.log("[COOLDOWN FINISHED] Triggering scheduled application page reload...");
            window.location.reload(); // Hard refresh browser page
        }
    }, 1000);
}

/**
 * Universal Shutdown System
 */
function stopBotExecution(logMessage) {
    console.log(`[BOT HALTED] ${logMessage}`);
    isRunning = false;
    isTradeOpen = false;
    pendingContractType = null;
    
    try { localStorage.setItem('tradingStoppedForDay', '1'); } catch (e) {}
    
    stopPing();
    
    if (ws) {
        try {
            ws.onclose = null; 
            ws.close();
        } catch (e) {}
        ws = null;
    }

    if (scriptButton) {
        scriptButton.disabled = true;
        scriptButton.innerText = "Target Reached (Stopped)";
    }

    if (typeof setFlashNotification === "function") {
        setFlashNotification(logMessage, 0);
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
    if (evenPercentage >= 54) {
        contractType = "even";
    } else if (oddPercentage >= 54) {
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
    const nextMarket = (typeof getRandomMarket === "function") ? getRandomMarket(marketArray, previousMarket) : market;

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

    console.log(`[MARKET SWITCH] Inactivity cooldown met. ${previousMarket} -> ${nextMarket}`);

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

    if (evenPercentage < 54) return false;
    const trailingOddCount = getTrailingOddCount(lastDigits);
    let shouldPlaceTrade = false;

    if (consecutiveLossCount >= 3 && evenPercentage <= 60) return false;

    if (evenPercentage >= 54 && evenPercentage <= 60 && trailingOddCount >= 3) {
        shouldPlaceTrade = true;
    } else if (evenPercentage >= 60 && trailingOddCount >= 2) {
        shouldPlaceTrade = true;
    }

    if (shouldPlaceTrade) {
        if (typeof placeTheTrade === "function") {
            pendingContractType = "even"; 
            placeTheTrade(contractType);
            return true;
        }
    }
    return false;
}

function tryOddEntry(oddPercentage, lastDigits) {
    if (pendingContractType) return false;
    if (contractType !== "odd") return false;
    if (!Array.isArray(lastDigits) || lastDigits.length === 0) return false;

    if (oddPercentage < 54) return false;
    const trailingEvenCount = getTrailingEvenCount(lastDigits);
    let shouldPlaceTrade = false;

    if (consecutiveLossCount >= 3 && oddPercentage <= 60) return false;

    if (oddPercentage >= 54 && oddPercentage <= 60 && trailingEvenCount >= 3) {
        shouldPlaceTrade = true;
    } else if (oddPercentage >= 60 && trailingEvenCount >= 2) {
        shouldPlaceTrade = true;
    }

    if (shouldPlaceTrade) {
        if (typeof placeTheTrade === "function") {
            pendingContractType = "odd"; 
            placeTheTrade(contractType);
            return true;
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

function webSocketConnectionStop() {
    stopBotExecution("Bot Terminated: Stake request exceeds available balance.");
}

function webSocketConnectionStart() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log("[BRIDGE] Connection is already live and pre-authenticated. Skipping reset to place trade.");
        if (typeof authSuccess !== 'undefined') {
            authSuccess = true; 
        }
        return; 
    }

    console.log("[BRIDGE] Socket was closed. Re-routing to modern session setup...");
    if (typeof initializeTradingSession === "function") {
        initializeTradingSession();
    } else {
        console.error("Critical error: initializeTradingSession function could not be resolved.");
    }
}