const accounts = [
    { name: "KunkumaGP", value: "lkUxtOopvUhCpIX" },
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

const accountSelectElement = document.getElementById("account_select");
const marketSelectElement = document.getElementById("market");
const targetProfitInputElement = document.getElementById("target_profit");
const initialStakeInputElement = document.getElementById("initial_stake");
const authenticateButton = document.getElementById("authenticateButton");
const scriptButton = document.getElementById("scriptButton");
const infoOutput = document.getElementById("info_output");
const params = new URLSearchParams(window.location.search);

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

let sessionTargetPercentage = 1/startingAmount,
    targetPercentage = 1/startingAmount,
    // amountPercentage = 0.35/startingAmount,
    amountPercentage = 0.5/100,
    finishTargetPercentagePerDay = 3/100,
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
    stopTimer = false
    ;

let market,
    apiToken,
    stake,
    tickCount,
    contractType
    ;


let ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");


accounts.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value; // Set the value
    option.textContent = item.name; // Set the display text
    accountSelectElement.appendChild(option); // Append to the <select>
});

marketArray.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value; // Set the value
    option.textContent = item.name; // Set the display text
    marketSelectElement.appendChild(option); // Append to the <select>
});

accountSelectElement.value = "Y71P0GIOxz3YYvr";
marketSelectElement.value = "R_100";
apiToken = accountSelectElement.value;


accountSelectElement.addEventListener("change", () => {
    apiToken = accountSelectElement.value;
});

if (targetProfitInputElement) {
    // Show session target amount (computed after authorize). Change updates sessionTargetPercentage when possible.
    targetProfitInputElement.addEventListener("change", () => {
        const val = Number(targetProfitInputElement.value);
        if (initialAccountBalance > 0 && val > 0) {
            // Interpret the input as an absolute session target amount and convert to percentage
            sessionTargetPercentage = val / initialAccountBalance;
            targetAmount = val;
        }
        console.log(`Session target percentage updated: ${sessionTargetPercentage}`);
    });
}

// market = marketSelectElement.value;
market = getRandomMarket(marketArray, '');




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

ws.onopen = function () {
    console.log("Connection open");
    getAuthentication();
    startPing();
};

ws.onclose = function () {
    console.log("Connection closed");
    console.log("-----------------------------\n");
    stopPing();

    setTimeout(() => {
        reload();
    }, 30000);
};

ws.onerror = function (err) {
    console.error("WebSocket error:", err);
};


ws.onmessage = function (event) {

    // if(isWithinTimeRange()){
    wsResponse = JSON.parse(event.data);

    if (wsResponse != null) {


        if (wsResponse.msg_type === "authorize") {
            console.log("Authorization successful.\n-----------------------------\n\n");
            setFlashNotification("Authorization successful", 0);

             if (wsResponse.authorize && typeof wsResponse.authorize.balance !== "undefined") {

                 initialAccountBalance = wsResponse.authorize.balance;
                 updatedAccountBalance = initialAccountBalance;
                 setAccountInfo("initialAccountBalance", `$ ${initialAccountBalance}`);
                 authSuccess = true;
                 authenticateButton.innerHTML = "Authenticated. Ready to trade.";
                 authenticateButton.disabled = true;
                 resetParams();

                // If there is a persisted totalLostAmount from prior runs, use it to adjust initial stake
                try {
                    const storedLost = parseFloat(localStorage.getItem('totalLostAmount')) || 0;
                    if (storedLost !== 0) {
                        // storedLost is negative (e.g. -1.45). Compute stake as positive value: (abs(totalLostAmount) / 90) * 100
                        const calcStake = Number(((Math.abs(storedLost) / 90) * 100).toFixed(2));
                        stake = calcStake;
                        // reflect in UI if available
                        try { if (initialStakeInputElement) initialStakeInputElement.value = stake; } catch (e) {}
                        setFlashNotification(`Recovered pending loss ${storedLost.toFixed(2)} — adjusting stake to ${stake}`, 5);
                    }
                } catch (e) {}
                // Ensure stake does not exceed initial account balance
                try {
                    if (typeof stake === 'number' && initialAccountBalance > 0 && stake > initialAccountBalance) {
                        stake = Number(initialAccountBalance.toFixed(2));
                        try { if (initialStakeInputElement) initialStakeInputElement.value = stake; } catch (e) {}
                        setFlashNotification(`Stake adjusted to initial account balance: ${stake}`, 5);
                    }
                } catch (e) {}
     
                 // Day target initialization/persistence
                 try {
                     const today = new Date().toISOString().slice(0,10); // YYYY-MM-DD
                     const storedDate = localStorage.getItem('date');
                     let storedDayTarget = localStorage.getItem('dayTarget');
     
                     if (!storedDate || !storedDayTarget || storedDate !== today) {
                         // compute dayTarget = initial + (finishTargetPercentagePerDay * initial)
                         const computedTarget = Number((initialAccountBalance + (finishTargetPercentagePerDay * initialAccountBalance)).toFixed(2));
                         localStorage.setItem('date', today);
                         localStorage.setItem('dayTarget', String(computedTarget));
                         dayTarget = computedTarget;
                     } else {
                         dayTarget = Number(storedDayTarget);
                     }
     
                     // reflect UI value
                        setAccountInfo("targetAmount", `$ ${dayTarget}`);

                        // compute session target amount (1% default of initial balance) and show in target input
                        try {
                            targetAmount = Number((initialAccountBalance * sessionTargetPercentage).toFixed(2));
                            if (targetProfitInputElement) {
                                targetProfitInputElement.value = targetAmount;
                            }
                        } catch (e) {}
     
                     // if starting balance already meets or exceeds dayTarget, stop trading for day
                     if (initialAccountBalance >= dayTarget) {
                         setFlashNotification('Day target already reached. Stopping for today.', 0);
                         try { localStorage.setItem('tradingStoppedForDay', '1'); } catch (e) {}
                         isRunning = false;
                         stopPing();
                         try { if (ws) ws.close(); } catch (e) {}
                         if (scriptButton) { scriptButton.disabled = true; scriptButton.innerText = 'Stopped for day'; }
                         return;
                     }
                 } catch (e) {
                     console.error('Error initializing day target:', e);
                 }
                 // scriptButton.innerHTML = "Bot started....";
                 // placeTrade();
     
                 if (dayTarget > 0 && updatedAccountBalance >= dayTarget) {
                     setFlashNotification("Day target is done", 0);
                     console.log("Day target is done");
                 } else {
                     runScript();
                     // placeTheTrade("even");
                 }
             } else {
                reload();
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
            if (
                updatedAccountBalance > 0 &&
                wsResponse.echo_req.amount > updatedAccountBalance
            ) {
                webSocketConnectionStop();
            } else {
                tradeProposal = wsResponse;

                console.log('tradeProposal: ', tradeProposal);

                if (pendingContractType && isTradeOpen === false) {
                    makeTheTrade(tradeProposal, pendingContractType);
                }
            }
        }

        if (wsResponse.msg_type === "error") {
            console.error("API error:", wsResponse.error);
        }



        if (wsResponse.msg_type === "buy") {
            if (
                wsResponse.buy == undefined ||
                wsResponse.buy.contract_id == undefined
            ) {
                // placeTrade();
            } else {
                lastTradeId = wsResponse.buy.contract_id;
                totalTradeCount = totalTradeCount + 1;
                isTradeOpen = true;

                if (wsResponse.buy.shortcode.includes("DIGITEVEN")) {
                    tradeTypeDisplay = "Even";
                } else if (wsResponse.buy.shortcode.includes("DIGITODD")) {
                    tradeTypeDisplay = "Odd";
                }

                setResultNotification(
                    lastTradeId,
                    tradeTypeDisplay,
                    market,
                    wsResponse.buy.buy_price
                );

                // setAccountInfo('percentage10', `$ ${targetProfit.toFixed(2)}`)
                console.log("Trade Successful:", wsResponse);
                // scrollToBottom();

                automation = true;

                setTimeout(() => {
                    fetchTradeDetails(lastTradeId);
                }, 500);
            }
        }

        if (wsResponse.msg_type === "proposal_open_contract") {
            if (wsResponse.proposal_open_contract.contract_id === lastTradeId) {
                const contract = wsResponse.proposal_open_contract;

                if (contract.is_sold) {
                    const profit = contract.profit;
                    const result = profit > 0 ? "Win" : "Loss";

                    setInfo(contract, profit);

                    // If session target reached (netProfit >= session target amount), reload immediately
                    try {
                        const sessionTargetAmount = initialAccountBalance * sessionTargetPercentage;
                        if (sessionTargetAmount > 0 && netProfit >= sessionTargetAmount) {
                            setFlashNotification('Session target reached. Reloading.', 0);
                            reload();
                            return;
                        }
                    } catch (e) {}

                    isTradeOpen = false;
                    stakeChange(result);
                    pendingContractType = null;

                    if (profit < 0) {
                        consecutiveLossCount += 1;
                        // If reached 3 consecutive losses, stop the bot and preserve totalLostAmount
                        if (consecutiveLossCount >= 3) {
                            setFlashNotification('Stopped: 3 consecutive losses reached. Manual restart required.', 0);
                            try { localStorage.setItem('tradingStoppedForDay', '1'); } catch (e) {}
                            isRunning = false;
                            stopPing();
                            try { if (ws) ws.close(); } catch (e) {}
                            try { if (scriptButton) { scriptButton.disabled = true; scriptButton.innerText = 'Stopped (3 losses)'; } } catch (e) {}
                            return;
                        }
                    } else {
                        consecutiveLossCount = 0;
                    }

                    let setTimeInterval = 0;


                    if (consecutiveLossCount >= 3) {
                        setTimeInterval = getRandomNumber(30, 180) * 1000;;
                        console.log(`[LOSS STREAK] ${consecutiveLossCount} losses in a row. Waiting 30 seconds.`);
                        setTimer(setTimeInterval);
                        setTimeout(() => {
                            runScript();
                        }, setTimeInterval);
                    } else {
                        if(netProfit >= targetAmount){
                            reload();
                        }else {
                            setTimer(setTimeInterval);
                            setTimeout(() => {
                                runScript();
                            }, setTimeInterval);
                        }
                    }
                } else {
                    setTimeout(() => {
                        setTickCountDown(
                            contract.tick_count,
                            contract.tick_stream.length
                        );
                        fetchTradeDetails(lastTradeId);
                    }, 1000);
                }

            }
        }


    }
}

function runScript() {
    isRunning = true;
    // placeTrade();
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

    // Secondary (last-10) percentages
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
    const nextMarket = getRandomMarket(marketArray, previousMarket);

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

    // Require primary percentage >=54 to proceed
    if (evenPercentage < 54) return false;

    const trailingOddCount = getTrailingOddCount(lastDigits);

    let shouldPlaceTrade = false;

    // After 3 consecutive losses, only enter when the majority percentage is strictly greater than 60
    if (consecutiveLossCount >= 3) {
        if (evenPercentage <= 60) return false;
    }

    if (evenPercentage >= 54 && evenPercentage <= 60 && trailingOddCount >= 3) {
        shouldPlaceTrade = true;
    } else if (evenPercentage >= 60 && trailingOddCount >= 2) {
        shouldPlaceTrade = true;
    }

    if (shouldPlaceTrade) {
        if (typeof placeTheTrade === "function") {
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

    // Require primary percentage >=54 to proceed
    if (oddPercentage < 54) return false;

    const trailingEvenCount = getTrailingEvenCount(lastDigits);

    let shouldPlaceTrade = false;

    // After 3 consecutive losses, only enter when the majority percentage is strictly greater than 60
    if (consecutiveLossCount >= 3) {
        if (oddPercentage <= 60) return false;
    }

    if (oddPercentage >= 54 && oddPercentage <= 60 && trailingEvenCount >= 3) {
        shouldPlaceTrade = true;
    } else if (oddPercentage >= 60 && trailingEvenCount >= 2) {
        shouldPlaceTrade = true;
    }

    if (shouldPlaceTrade) {
        if (typeof placeTheTrade === "function") {
            placeTheTrade(contractType);
            return true;
        } else {
            console.warn("placeTheTrade function is not available.");
        }
    }

    return false;
}