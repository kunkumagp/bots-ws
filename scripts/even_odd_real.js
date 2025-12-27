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
    { value: "R_100", name: "Volatility 100 Index" }
];

const marketArray2 = [
    { value: "R_10", name: "Volatility 10 Index" },
    { value: "R_25", name: "Volatility 25 Index" },
    { value: "R_50", name: "Volatility 50 Index" },
    { value: "R_75", name: "Volatility 75 Index" },
    { value: "R_100", name: "Volatility 100 Index" },
    { value: "1HZ10V", name: "Volatility 10 ( 1s ) Index" },
    { value: "1HZ15V", name: "Volatility 15 ( 1s ) Index" },
    { value: "1HZ25V", name: "Volatility 25 ( 1s ) Index" },
    { value: "1HZ30V", name: "Volatility 30 ( 1s ) Index" },
    { value: "1HZ50V", name: "Volatility 50 ( 1s ) Index" },
    { value: "1HZ75V", name: "Volatility 75 ( 1s ) Index" },
    { value: "1HZ90V", name: "Volatility 90 ( 1s ) Index" },
    { value: "1HZ100V", name: "Volatility 100 ( 1s ) Index" },
];

const accountSelectElement = document.getElementById("account_select");
const marketSelectElement = document.getElementById("market");
const targetProfitInputElement = document.getElementById("target_profit");
const initialStakeInputElement = document.getElementById("initial_stake");
const authenticateButton = document.getElementById("authenticateButton");
const scriptButton = document.getElementById("scriptButton");
const infoOutput = document.getElementById("info_output");

const martingaleMultiplier = 2.07112;

// Anti-detection randomization flags
let tradeDelayVariation = true; // Enable random delays before trades
let humanizeStakes = true; // Add small random variations to stakes
let randomizeTickDuration = true; // Vary tick durations
let varyConfidenceThreshold = true; // Change confidence threshold randomly
let probabilisticBehavior = true; // Add probabilistic decisions

let isRunning = false, intervalId;
let pingIntervalId;
let targetPercentage = 0.3;
let amountPercentage = 0.35;
let historyTickCount = 1000;
// let leavingAmount = 400;
let leavingAmount = 0;

let initialAccountBalance = 0;
let updatedAccountBalance = 0;

let targetAmount = 0;
let amountPutForTrading = 0;

let currentProfitAmount = 0;
let currentLossAmount = 0;
let netProfit = 0;

let stake = 0;
let onTradeCount = 0;

let totalProfitAmount = 0;
let totalLossAmount = 0;

let totalTradeCount = 0;
let winTradeCount = 0;
let lossTradeCount = 0;

let lostCountInRow = parseInt(localStorage.getItem('lostCountInRow') || '0');

// Pattern detection variables for first 3 trades (persisted in localStorage)
let firstThreeTradesLossCount = parseInt(localStorage.getItem('firstThreeTradesLossCount') || '0'); 
let currentSessionTradeCount = parseInt(localStorage.getItem('currentSessionTradeCount') || '0'); 
let currentSessionLossCount = parseInt(localStorage.getItem('currentSessionLossCount') || '0'); 
let flipTradeStateFlag = (localStorage.getItem('flipTradeStateFlag') === 'true');

// Daily target tracking
let dailyTargetData = JSON.parse(localStorage.getItem('dailyTargetData') || 'null');
let targetCapital = 0;
let targetCompleted = false; 

// 🎯 TWO-SESSION TRADING SYSTEM
const SESSION_1_PROFIT_PERCENTAGE = 10; // First session: 10% profit
const SESSION_2_PROFIT_PERCENTAGE = 10; // Second session: 10% profit
const TOTAL_DAILY_PROFIT_PERCENTAGE = 20; // Total: 20% daily
const SESSION_BREAK_MIN_MINUTES = 30; // Minimum break between sessions
const SESSION_BREAK_MAX_MINUTES = 60; // Maximum break between sessions

// 🕐 TRADING HOURS (Avoid 12 PM - 2 PM)
const TRADING_HOURS = {
    morning: { start: 7, end: 12 },    // 7 AM - 12 PM
    afternoon: { start: 14, end: 19 }  // 2 PM - 7 PM
};

let sessionData = JSON.parse(localStorage.getItem('sessionData') || 'null');
let currentSession = 1; // 1 or 2
let sessionBreakEndTime = null; 

let lastTradeId = null;
let tradeTypeDisplay = null;
let tradeType = "even";
let apiToken = null;
let authSuccess = false;
let isTradeOpen = false;
let automation = false;
let tradeProposal = null;

let stopTimer = false;
let ws;

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

accountSelectElement.value = "lkUxtOopvUhCpIX";
marketSelectElement.value = "R_100";
apiToken = accountSelectElement.value;


accountSelectElement.addEventListener("change", () => {
    apiToken = accountSelectElement.value;
});

// market = marketSelectElement.value;
market = getRandomMarket(marketArray, '');

startWebSocket();


// ====== Start Ping ====== //
function startPing(ws) {
    // Send a ping every 30 seconds
    pingIntervalId = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ ping: 1 }));
        }
    }, 10000);
}

// ====== Stop Ping ====== //
function stopPing() {
    if (pingIntervalId) {
        clearInterval(pingIntervalId);
        pingIntervalId = null;
    }
}



function startWebSocket(){
    ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");

    ws.onopen = function () {
        console.log("Connection open");
        getAuthentication();
        startPing(ws);
    };

    ws.onclose = function () {
        console.log("Connection closed");
        console.log("-----------------------------\n");

        setTimeout(() => {
            startWebSocket();
        }, 1000);
    };

    ws.onerror = function (err) {
        console.error("WebSocket error:", err);
    };

    ws.onmessage = function (event) {

        let wsResponse = JSON.parse(event.data);

        console.log('wsResponse : ',wsResponse);

        // Always process pong and authorize messages
        if (wsResponse.msg_type === "pong" || wsResponse.msg_type === "authorize") {
            if (wsResponse != null) {
                if (wsResponse.msg_type === "authorize") {
                    console.log("Authorization successful.\n-----------------------------\n\n");
                    setFlashNotification("Authorization successful", 0);
                    if(wsResponse.authorize !== undefined){
                        initialAccountBalance = (Number(wsResponse.authorize.balance)-leavingAmount);   
                        updatedAccountBalance = initialAccountBalance;
                        initialAccountBalance = initialAccountBalance.toFixed(2);   
                        setAccountInfo("initialAccountBalance", `$ ${initialAccountBalance}`);
                        authSuccess = true;
                        authenticateButton.innerHTML = "Authenticated. Ready to trade.";
                        authenticateButton.disabled = true;
                        resetParams();
                        // scriptButton.innerHTML = "Bot started....";
                        // placeTrade();
                        // runScript();   
                        requestTicksHistory(market);

                    } else {
                        reload();                   
                    }
                    
                }
            }
            return; // Exit early after processing auth/pong
        }

        // Only process trading messages during allowed time range
        if (wsResponse != null) {
        // if (isWithinTimeRange() && wsResponse != null) {
            if (wsResponse.msg_type === 'history') {
                const priceList = wsResponse.history.prices;
                const lastDigits = priceList.map(p => Number(String(p).slice(-1)));

                // console.log('Price List: ', priceList);
                // console.log('Last 500 ticks last digits: ', lastDigits);

                const newProbabilities = predictNextParity(lastDigits);
                const number = parseFloat(newProbabilities.confidence.replace('%', '')) / 100;
                console.log('Predicted Probabilities: ', newProbabilities);
                
                // Vary confidence threshold randomly between 0.65-0.75 (instead of fixed 0.7)
                let confidenceThreshold = 0.7;
                if (varyConfidenceThreshold) {
                    confidenceThreshold = 0.65 + (Math.random() * 0.1); // 0.65 to 0.75
                    console.log('Dynamic confidence threshold:', confidenceThreshold.toFixed(3));
                }
                
                // 5% chance to randomly skip a trade opportunity (human-like behavior)
                const shouldSkipTrade = probabilisticBehavior && Math.random() < 0.05;

                if(newProbabilities.prediction == "even" && number > confidenceThreshold && !shouldSkipTrade){
                    tradeType = 'even';
                    
                    // Add random delay before executing (0-3 seconds) to simulate human thinking
                    const humanDelay = tradeDelayVariation ? getRandomNumber(0, 3000) : 0;
                    setTimeout(() => {
                        runScript();
                    }, humanDelay);
                    
                } else if(newProbabilities.prediction == "odd" && number > confidenceThreshold && !shouldSkipTrade){
                    tradeType = 'odd';
                    
                    // Add random delay before executing (0-3 seconds) to simulate human thinking
                    const humanDelay = tradeDelayVariation ? getRandomNumber(0, 3000) : 0;
                    setTimeout(() => {
                        runScript();
                    }, humanDelay);
                    
                } else {
                    if(shouldSkipTrade) {
                        console.log('Trade opportunity skipped (random behavior)');
                    }
                    // Add random variation to retry delay (1-5 seconds instead of fixed 1)
                    const retryDelay = getRandomNumber(1000, 5000);
                    setTimeout(() => {
                        requestTicksHistory(market);
                    }, retryDelay);
                }

            }


            if (wsResponse.msg_type === "proposal") {
                    if (
                        updatedAccountBalance > 0 &&
                        wsResponse.echo_req.amount > updatedAccountBalance
                    ) {
                        webSocketConnectionStop();
                    } else {
                        tradeProposal = wsResponse;
                        makeTheTrade();
                    }
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
                            stakeChange(result);
                            isTradeOpen = false;

                            // Track first 3 trades pattern
                            currentSessionTradeCount++;
                            localStorage.setItem('currentSessionTradeCount', currentSessionTradeCount.toString());
                            
                            if(profit < 0){
                                lostCountInRow = lostCountInRow + 1;
                                localStorage.setItem('lostCountInRow', lostCountInRow.toString());
                                currentSessionLossCount++;
                                localStorage.setItem('currentSessionLossCount', currentSessionLossCount.toString());
                                
                                // Store total loss amount in localStorage
                                let storedLoss = parseFloat(localStorage.getItem('totalLossInRow') || '0');
                                storedLoss += Math.abs(profit);
                                localStorage.setItem('totalLossInRow', storedLoss.toString());
                                console.log('Total loss in row stored:', storedLoss);
                                console.log('Lost count in row:', lostCountInRow);
                            } else {
                                // Win trade - subtract profit from stored loss incrementally
                                let storedLoss = parseFloat(localStorage.getItem('totalLossInRow') || '0');
                                
                                if (storedLoss > 0) {
                                    // Calculate remaining loss after this win
                                    const remainingLoss = storedLoss - profit;
                                    
                                    console.log('💰 Win Trade Recovery:');
                                    console.log(`   Previous total loss: $${storedLoss.toFixed(2)}`);
                                    console.log(`   This win profit: $${profit.toFixed(2)}`);
                                    console.log(`   Remaining loss: $${Math.max(0, remainingLoss).toFixed(2)}`);
                                    
                                    if (remainingLoss > 0) {
                                        // Still have loss to recover - update localStorage with remaining amount
                                        localStorage.setItem('totalLossInRow', remainingLoss.toString());
                                        setFlashNotification(`Partial recovery: $${profit.toFixed(2)} recovered. Remaining: $${remainingLoss.toFixed(2)}`, 8);
                                        console.log(`📊 Partial recovery - $${remainingLoss.toFixed(2)} still to recover`);
                                    } else {
                                        // Fully recovered (or exceeded) - clear localStorage
                                        localStorage.removeItem('totalLossInRow');
                                        const exceededAmount = Math.abs(remainingLoss);
                                        if (exceededAmount > 0) {
                                            console.log(`✅ FULL RECOVERY + PROFIT! Extra profit: $${exceededAmount.toFixed(2)}`);
                                            setFlashNotification(`🎉 Full recovery achieved + $${exceededAmount.toFixed(2)} profit!`, 8);
                                        } else {
                                            console.log('✅ FULL RECOVERY ACHIEVED!');
                                            setFlashNotification('🎉 Full recovery achieved!', 8);
                                        }
                                    }
                                } else {
                                    // No stored loss - normal win
                                    console.log('Win! No previous loss to recover');
                                }
                                
                                // Clear loss counter on win
                                lostCountInRow = 0;
                                localStorage.removeItem('lostCountInRow');
                                console.log('Win! Loss counter reset');
                                
                                // Reset pattern detection on any win
                                if (flipTradeStateFlag) {
                                    flipTradeStateFlag = false;
                                    firstThreeTradesLossCount = 0;
                                    
                                    // Clear all pattern detection from localStorage
                                    localStorage.removeItem('flipTradeStateFlag');
                                    localStorage.removeItem('firstThreeTradesLossCount');
                                    localStorage.removeItem('currentSessionTradeCount');
                                    localStorage.removeItem('currentSessionLossCount');
                                    
                                    console.log('✅ Losing streak broken! Pattern flag reset to false');
                                    setFlashNotification('Losing streak broken! Trading normally', 5);
                                }
                            }
                            
                            // Check if we completed a 3-trade session
                            if (currentSessionTradeCount >= 3) {
                                // If all 3 trades were losses
                                if (currentSessionLossCount >= 3) {
                                    firstThreeTradesLossCount++;
                                    localStorage.setItem('firstThreeTradesLossCount', firstThreeTradesLossCount.toString());
                                    console.log(`⚠️ First 3 trades all lost! Count: ${firstThreeTradesLossCount}/3`);
                                    
                                    // If this happened 3 times in a row, set the flag
                                    if (firstThreeTradesLossCount >= 3 && !flipTradeStateFlag) {
                                        flipTradeStateFlag = true;
                                        localStorage.setItem('flipTradeStateFlag', 'true');
                                        console.log('🔄 PATTERN DETECTED: 3 consecutive times first 3 trades lost!');
                                        console.log('🔄 Trade state flip FLAG activated!');
                                        setFlashNotification('Pattern detected! Trade state will be flipped', 8);
                                    }
                                } else {
                                    // Reset if pattern broken (not all 3 trades lost)
                                    if (firstThreeTradesLossCount > 0 && !flipTradeStateFlag) {
                                        console.log('Pattern broken - not all 3 trades were losses');
                                        firstThreeTradesLossCount = 0;
                                        localStorage.removeItem('firstThreeTradesLossCount');
                                    }
                                }
                                
                                // Reset session counters for next 3 trades
                                currentSessionTradeCount = 0;
                                currentSessionLossCount = 0;
                                localStorage.setItem('currentSessionTradeCount', '0');
                                localStorage.setItem('currentSessionLossCount', '0');
                            }
                        
                            let intervalTime;
                            let newMarket;
                            
                            // Stop trading after 5 losses in a row
                            if (lostCountInRow >= 5) {
                                setFlashNotification("Trading stopped: 5 losses in a row reached", 0);
                                console.log('Trading stopped: 5 losses in a row');
                                isRunning = false;
                                return;
                            }
                            
                            if (currentLossAmount < 0) {
                                if(lostCountInRow >= 4){
                                    // Take a 10-minute rest after 3 consecutive losses
                                    intervalTime = (getRandomNumber(5, 15) * getRandomNumber(50, 70) * 1000); // 10 minutes
                                    console.log('🛑 3 losses in a row detected - Taking 10-minute rest');
                                    setFlashNotification('⏸️ 3 losses in a row - Taking 10-minute rest', 15);

                                } else if(lostCountInRow >= 3){
                                    // More variation: 5-45 seconds
                                    intervalTime = (getRandomNumber(15, 25) * 1000);

                                } else if(lostCountInRow >= 2){
                                    // More variation: 5-45 seconds
                                    intervalTime = (getRandomNumber(5, 15) * 1000);

                                } else {
                                    // More variation: 2-20 seconds
                                    intervalTime = (getRandomNumber(1, 5) * 1000);

                                }

                                // 60% chance to switch market after loss (not always)
                                const shouldSwitchMarket = probabilisticBehavior ? Math.random() > 0.4 : true;
                                
                                if (shouldSwitchMarket) {
                                    newMarket = getRandomMarket(marketArray, market);
                                    if(market == newMarket){
                                        newMarket = getRandomMarket(marketArray, market);
                                    } else {
                                        market = newMarket;
                                    }
                                    console.log('Market switched to:', market);
                                }

                                setTimer(intervalTime);
                                setTimeout(() => {
                                    // After 4 losses, 70% chance to flip (not always)
                                    if(lostCountInRow >= 4 && (!probabilisticBehavior || Math.random() > 0.3)) {
                                        // Flip the tradeType for next trade
                                        if(tradeType === 'even') {
                                            tradeType = 'odd';
                                            console.log('Trade state flipped to ODD after 4 losses');
                                        } else {
                                            tradeType = 'even';
                                            console.log('Trade state flipped to EVEN after 4 losses');
                                        }
                                    }
                                    
                                    // Reload page after loss instead of continuing trade
                                    console.log('Reloading page after loss...');
                                    reload();
                                    
                                }, intervalTime);
                            } else {
                                // 🎯 CHECK SESSION COMPLETION
                                const sessionCompleted = checkSessionCompletion(updatedAccountBalance);
                                
                                if (sessionCompleted) {
                                    if (sessionData.currentSession === 1 && sessionData.session1.completed) {
                                        // Session 1 completed - take break
                                        console.log('🎯 Session 1 target reached! Taking break...');
                                        setFlashNotification('✅ Session 1 Complete! Bot will stop for break.', 0);
                                        isRunning = false;
                                        weClose();
                                        return;
                                    } else if (sessionData.currentSession === 2 && sessionData.session2.completed) {
                                        // Session 2 completed - daily target achieved
                                        console.log('🎉 Session 2 target reached! Daily target achieved!');
                                        setFlashNotification('🎉 Daily Target Complete! Trading stopped.', 0);
                                        isRunning = false;
                                        weClose();
                                        return;
                                    }
                                }
                                
                                // Legacy daily target check (backup)
                                if (dailyTargetData && updatedAccountBalance >= dailyTargetData.targetCapital) {
                                    dailyTargetData.targetCompleted = true;
                                    targetCompleted = true;
                                    localStorage.setItem('dailyTargetData', JSON.stringify(dailyTargetData));
                                    
                                    console.log('🎯🎉 DAILY TARGET REACHED!');
                                    console.log(`   Target Capital: $${dailyTargetData.targetCapital.toFixed(2)}`);
                                    console.log(`   Current Balance: $${updatedAccountBalance.toFixed(2)}`);
                                    console.log('   Trading stopped for today.');
                                    
                                    setFlashNotification(`🎯🎉 Daily target reached! $${dailyTargetData.targetCapital.toFixed(2)} achieved! Trading stopped.`, 0);
                                    isRunning = false;
                                    return;
                                }
                                
                                if (currentProfitAmount >= targetAmount) {
                                    // More variation: 5-20 seconds
                                    intervalTime = (getRandomNumber(5, 20) * 1000);

                                    setTimer(intervalTime);
                                    setTimeout(() => {
                                        reserParams();
                                        reload();
                                    }, intervalTime);
                                } else {
                                    // More variation: 3-15 seconds
                                    intervalTime = (getRandomNumber(3, 15) * 1000);

                                    setTimer(intervalTime);
                                    setTimeout(() => {
                                        requestTicksHistory(market);

                                    }, intervalTime);
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

    };

    const getAuthentication = () => {
        setFlashNotification("Authenticating....", 0);
        console.log("Authenticating....");
        ws.send(JSON.stringify({ authorize: apiToken }));

        // Set timeout to reload page if authentication doesn't complete within 2 seconds
        setTimeout(() => {
            if (!authSuccess) {
                console.log("⚠️ Authentication timeout - Reloading page...");
                setFlashNotification("Authentication timeout - Reloading...", 2);
                setTimeout(() => {
                    reload();
                }, 1000);
            }
        }, 2000);
    };


    const stakeChange = (status) => {
        if (status == "Loss") {
            stake = stake * martingaleMultiplier;
            
            // Add small random variation to stake after loss (±1-5%) to avoid exact patterns
            if (humanizeStakes) {
                const variation = 1 + (Math.random() * 0.1 - 0.05); // ±5%
                stake = stake * variation;
                console.log('Stake varied by:', ((variation - 1) * 100).toFixed(2) + '%');
            }
        } else if (status == "Win") {
            stake = amountPutForTrading;
            
            // Add tiny variation to base stake on wins too (±1-3%)
            if (humanizeStakes) {
                const variation = 1 + (Math.random() * 0.06 - 0.03); // ±3%
                stake = stake * variation;
                console.log('Base stake varied by:', ((variation - 1) * 100).toFixed(2) + '%');
            }
        }
    };

    const makeTheTrade = () => {
        if (
            tradeProposal.proposal == undefined ||
            tradeProposal.proposal.id == undefined
        ) {
            isRunning = false;
            webSocketConnectionStart();
        } else {
            buyRequest = {
                buy: tradeProposal.proposal.id,
                price: tradeProposal.proposal.ask_price,
            };
            ws.send(JSON.stringify(buyRequest));
        }
    };

    const placeTrade = (result = null) => {
        if (isTradeOpen == false) {
            if (result != null) {
                if (result == "even") {
                    tradeState = "DIGITODD";
                } else if (result == "odd") {
                    tradeState = "DIGITEVEN";
                }
            } else {
                // Check if flip flag is active - flip the trade state from prediction
                if (flipTradeStateFlag) {
                    // Flip the trade state opposite to prediction
                    if (tradeType == "even") {
                        tradeState = "DIGITODD"; // Opposite of DIGITEVEN
                        console.log('🔄 FLAG ACTIVE: Flipping trade state - predicted EVEN, trading ODD');
                    } else if (tradeType == "odd") {
                        tradeState = "DIGITEVEN"; // Opposite of DIGITODD
                        console.log('🔄 FLAG ACTIVE: Flipping trade state - predicted ODD, trading EVEN');
                    }
                } else {
                    // Normal trading - follow prediction
                    if (tradeType == "even") {
                        tradeState = "DIGITEVEN";
                        // tradeType = "odd";
                    } else if (tradeType == "odd") {
                        tradeState = "DIGITODD";
                        // tradeType = "even";
                    }
                }
            }
            stake = Number(stake);
            stake < 0.35 ? (stake = 0.35) : (stake = stake);
            
            // Check if account balance is sufficient for the stake
            if (updatedAccountBalance > 0 && stake > updatedAccountBalance) {
                console.log(`⚠️ Insufficient balance! Stake: $${stake.toFixed(2)}, Balance: $${updatedAccountBalance.toFixed(2)}`);
                stake = updatedAccountBalance;
                console.log(`✅ Stake adjusted to account balance: $${stake.toFixed(2)}`);
                setFlashNotification(`Stake adjusted to remaining balance: $${stake.toFixed(2)}`, 5);
            }

            // Randomize tick duration (1-3 ticks instead of always 1) - more human-like
            if (randomizeTickDuration) {
                tickCount = getRandomNumber(1, 3);
                console.log('Using random tick count:', tickCount);
            } else {
                tickCount = 1;
            }

            const tradeRequest = {
                proposal: 1,
                amount: stake.toFixed(2),
                basis: "stake",
                contract_type: tradeState, // Use 'DIGITEVEN' for even and 'DIGITODD' for odd
                currency: "USD",
                duration: tickCount,
                duration_unit: "t",
                symbol: market,
            };

            onTradeCount = 1;
            // Send the trade request to the WebSocket
            console.log("Sending trade request:", tradeRequest);
            ws.send(JSON.stringify(tradeRequest));
        }
    };

    const fetchTradeDetails = (contractId) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.error("WebSocket is not open.");
            return;
        }

        const contractDetailsRequest = {
            proposal_open_contract: 1,
            contract_id: contractId,
        };

        ws.send(JSON.stringify(contractDetailsRequest));
    };

    function weClose() {
        if (ws) {
            ws.close();
            ws = null;
        }
    }



    function runScript() {
        isRunning = true;
        placeTrade();
    }


    const requestTicksHistory = (symbol) => {
        // 🕐 CHECK TRADING HOURS BEFORE EACH TRADE REQUEST
        const tradingHoursCheck = isWithinTradingHours();
        if (!tradingHoursCheck.allowed) {
            const now = new Date();
            const currentHour = now.getHours();
            let message = '';
            
            if (currentHour >= TRADING_HOURS.morning.end && currentHour < TRADING_HOURS.afternoon.start) {
                message = `☕ Lunch Break (12 PM - 2 PM)! Trading paused. Current: ${now.toLocaleTimeString()}`;
            } else {
                message = `⏰ Outside trading hours! Bot stopped. Current: ${now.toLocaleTimeString()}`;
            }
            
            console.log(message);
            setFlashNotification(message, 0);
            isRunning = false;
            weClose();
            return;
        }
        
        // 🎯 CHECK IF IN BREAK PERIOD
        const breakCheck = isInBreakPeriod();
        if (breakCheck.inBreak) {
            const message = `⏸️ Session Break! Resume in ${breakCheck.minutesLeft} min at ${breakCheck.breakEnd.toLocaleTimeString()}`;
            console.log(message);
            setFlashNotification(message, 0);
            isRunning = false;
            weClose();
            return;
        }
        
        // Vary history count between 800-1200 instead of fixed 1000 (makes analysis window unpredictable)
        const variedHistoryCount = getRandomNumber(800, 1200);
        
        const ticksHistoryRequest = {
            ticks_history: symbol,
            end: 'latest',
            count: variedHistoryCount,
            style: 'ticks'
        };
        console.log('Requesting', variedHistoryCount, 'ticks for analysis');
        ws.send(JSON.stringify(ticksHistoryRequest));
    };
}


// scriptButton.addEventListener("click", runScript);
// authenticateButton.addEventListener("click", getAuthentication);



function reload() {
    location.reload();
}

function reserParams() {
    currentProfitAmount = 0;
    currentLossAmount = 0;
    lostCountInRow = 0;
    
    // Reset pattern detection variables
    firstThreeTradesLossCount = 0;
    currentSessionTradeCount = 0;
    currentSessionLossCount = 0;
    flipTradeStateFlag = false;
    
    // Clear all localStorage including pattern detection
    localStorage.removeItem('totalLossInRow');
    localStorage.removeItem('lostCountInRow');
    localStorage.removeItem('flipTradeStateFlag');
    localStorage.removeItem('firstThreeTradesLossCount');
    localStorage.removeItem('currentSessionTradeCount');
    localStorage.removeItem('currentSessionLossCount');

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

// 🕐 CHECK IF CURRENT TIME IS WITHIN TRADING HOURS
function isWithinTradingHours() {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Check if in morning session (7 AM - 12 PM)
    if (currentHour >= TRADING_HOURS.morning.start && currentHour < TRADING_HOURS.morning.end) {
        return { allowed: true, session: 'morning' };
    }
    
    // Check if in afternoon session (2 PM - 7 PM)
    if (currentHour >= TRADING_HOURS.afternoon.start && currentHour < TRADING_HOURS.afternoon.end) {
        return { allowed: true, session: 'afternoon' };
    }
    
    // Outside trading hours
    return { allowed: false, session: null };
}

// 🎯 INITIALIZE SESSION DATA
function initializeSessionData() {
    const today = new Date().toDateString();
    
    // Check if we need to reset session data (new day)
    if (!sessionData || sessionData.tradingDate !== today) {
        sessionData = {
            tradingDate: today,
            session1: {
                completed: false,
                startBalance: 0,
                targetBalance: 0,
                profitTarget: 0
            },
            session2: {
                completed: false,
                startBalance: 0,
                targetBalance: 0,
                profitTarget: 0
            },
            breakEndTime: null,
            currentSession: 1
        };
        localStorage.setItem('sessionData', JSON.stringify(sessionData));
        console.log('📅 ✨ NEW SESSION DATA - Fresh session targets created');
    } else {
        console.log('📅 Continuing with existing session data from today');
    }
    
    return sessionData;
}

// 🎯 START SESSION
function startSession(sessionNumber, currentBalance) {
    sessionData = initializeSessionData();
    
    if (sessionNumber === 1) {
        sessionData.session1.startBalance = currentBalance;
        sessionData.session1.profitTarget = currentBalance * (SESSION_1_PROFIT_PERCENTAGE / 100);
        sessionData.session1.targetBalance = currentBalance + sessionData.session1.profitTarget;
        sessionData.currentSession = 1;
        
        console.log(`🎯 SESSION 1 STARTED`);
        console.log(`   Start Balance: $${currentBalance.toFixed(2)}`);
        console.log(`   Profit Target: $${sessionData.session1.profitTarget.toFixed(2)} (${SESSION_1_PROFIT_PERCENTAGE}%)`);
        console.log(`   Target Balance: $${sessionData.session1.targetBalance.toFixed(2)}`);
        
        setFlashNotification(`🎯 Session 1 Started - Target: ${SESSION_1_PROFIT_PERCENTAGE}% ($${sessionData.session1.profitTarget.toFixed(2)})`, 10);
        
    } else if (sessionNumber === 2) {
        sessionData.session2.startBalance = currentBalance;
        sessionData.session2.profitTarget = currentBalance * (SESSION_2_PROFIT_PERCENTAGE / 100);
        sessionData.session2.targetBalance = currentBalance + sessionData.session2.profitTarget;
        sessionData.currentSession = 2;
        
        console.log(`🎯 SESSION 2 STARTED`);
        console.log(`   Start Balance: $${currentBalance.toFixed(2)}`);
        console.log(`   Profit Target: $${sessionData.session2.profitTarget.toFixed(2)} (${SESSION_2_PROFIT_PERCENTAGE}%)`);
        console.log(`   Target Balance: $${sessionData.session2.targetBalance.toFixed(2)}`);
        
        setFlashNotification(`🎯 Session 2 Started - Target: ${SESSION_2_PROFIT_PERCENTAGE}% ($${sessionData.session2.profitTarget.toFixed(2)})`, 10);
    }
    
    localStorage.setItem('sessionData', JSON.stringify(sessionData));
}

// 🎯 CHECK SESSION COMPLETION
function checkSessionCompletion(currentBalance) {
    if (!sessionData) return false;
    
    const currentSessionNum = sessionData.currentSession;
    
    if (currentSessionNum === 1 && !sessionData.session1.completed) {
        // Check if session 1 target reached
        if (currentBalance >= sessionData.session1.targetBalance) {
            sessionData.session1.completed = true;
            
            // Schedule break (30-60 minutes)
            const breakMinutes = Math.floor(Math.random() * (SESSION_BREAK_MAX_MINUTES - SESSION_BREAK_MIN_MINUTES + 1)) + SESSION_BREAK_MIN_MINUTES;
            const breakEndTime = new Date(Date.now() + breakMinutes * 60 * 1000);
            sessionData.breakEndTime = breakEndTime.toISOString();
            
            localStorage.setItem('sessionData', JSON.stringify(sessionData));
            
            console.log(`✅ SESSION 1 COMPLETED!`);
            console.log(`   Target: $${sessionData.session1.targetBalance.toFixed(2)}`);
            console.log(`   Achieved: $${currentBalance.toFixed(2)}`);
            console.log(`   Profit: $${(currentBalance - sessionData.session1.startBalance).toFixed(2)}`);
            console.log(`⏸️ BREAK TIME: ${breakMinutes} minutes`);
            console.log(`   Resume at: ${breakEndTime.toLocaleTimeString()}`);
            
            setFlashNotification(`✅ Session 1 Complete! Break for ${breakMinutes} min. Resume at ${breakEndTime.toLocaleTimeString()}`, 0);
            
            return true;
        }
    } else if (currentSessionNum === 2 && !sessionData.session2.completed) {
        // Check if session 2 target reached (FINAL TARGET)
        if (currentBalance >= sessionData.session2.targetBalance) {
            sessionData.session2.completed = true;
            localStorage.setItem('sessionData', JSON.stringify(sessionData));
            
            const totalProfit = currentBalance - sessionData.session1.startBalance;
            const profitPercentage = (totalProfit / sessionData.session1.startBalance) * 100;
            
            console.log(`✅ SESSION 2 COMPLETED!`);
            console.log(`   Target: $${sessionData.session2.targetBalance.toFixed(2)}`);
            console.log(`   Achieved: $${currentBalance.toFixed(2)}`);
            console.log(`🎉 DAILY TARGET ACHIEVED!`);
            console.log(`   Total Profit: $${totalProfit.toFixed(2)} (${profitPercentage.toFixed(2)}%)`);
            console.log(`   Session 1 Profit: $${(sessionData.session1.targetBalance - sessionData.session1.startBalance).toFixed(2)}`);
            console.log(`   Session 2 Profit: $${(currentBalance - sessionData.session2.startBalance).toFixed(2)}`);
            
            setFlashNotification(`🎉 DAILY TARGET COMPLETE! Total Profit: $${totalProfit.toFixed(2)} (${profitPercentage.toFixed(1)}%)`, 0);
            
            return true;
        }
    }
    
    return false;
}

// 🕐 CHECK IF IN BREAK PERIOD
function isInBreakPeriod() {
    if (!sessionData || !sessionData.breakEndTime) return false;
    
    const now = new Date();
    const breakEnd = new Date(sessionData.breakEndTime);
    
    if (now < breakEnd) {
        const minutesLeft = Math.ceil((breakEnd - now) / (60 * 1000));
        return { inBreak: true, minutesLeft, breakEnd };
    }
    
    return { inBreak: false };
}

// 🎯 LOG SESSION PROGRESS
function logSessionProgress() {
    if (!sessionData) return;
    
    const currentSessionNum = sessionData.currentSession;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 SESSION PROGRESS UPDATE');
    console.log(`📅 Date: ${sessionData.tradingDate}`);
    
    if (currentSessionNum === 1) {
        const progress = updatedAccountBalance - sessionData.session1.startBalance;
        const progressPercent = (progress / sessionData.session1.profitTarget) * 100;
        
        console.log(`📊 SESSION 1 (Target: ${SESSION_1_PROFIT_PERCENTAGE}%)`);
        console.log(`   Start Balance: $${sessionData.session1.startBalance.toFixed(2)}`);
        console.log(`   Current Balance: $${updatedAccountBalance.toFixed(2)}`);
        console.log(`   Target Balance: $${sessionData.session1.targetBalance.toFixed(2)}`);
        console.log(`   Progress: $${progress.toFixed(2)} / $${sessionData.session1.profitTarget.toFixed(2)} (${progressPercent.toFixed(1)}%)`);
        console.log(`   Status: ${sessionData.session1.completed ? '✅ COMPLETED' : '⏳ IN PROGRESS'}`);
    } else if (currentSessionNum === 2) {
        const session1Profit = sessionData.session1.targetBalance - sessionData.session1.startBalance;
        const session2Progress = updatedAccountBalance - sessionData.session2.startBalance;
        const session2ProgressPercent = (session2Progress / sessionData.session2.profitTarget) * 100;
        
        console.log(`📊 SESSION 1: ✅ COMPLETED (+$${session1Profit.toFixed(2)})`);
        console.log(`📊 SESSION 2 (Target: ${SESSION_2_PROFIT_PERCENTAGE}%)`);
        console.log(`   Start Balance: $${sessionData.session2.startBalance.toFixed(2)}`);
        console.log(`   Current Balance: $${updatedAccountBalance.toFixed(2)}`);
        console.log(`   Target Balance: $${sessionData.session2.targetBalance.toFixed(2)}`);
        console.log(`   Progress: $${session2Progress.toFixed(2)} / $${sessionData.session2.profitTarget.toFixed(2)} (${session2ProgressPercent.toFixed(1)}%)`);
        console.log(`   Status: ${sessionData.session2.completed ? '✅ COMPLETED' : '⏳ IN PROGRESS'}`);
        
        const totalProfit = session1Profit + session2Progress;
        const totalStartBalance = sessionData.session1.startBalance;
        const totalProfitPercent = (totalProfit / totalStartBalance) * 100;
        console.log(`💰 Total Today: +$${totalProfit.toFixed(2)} (${totalProfitPercent.toFixed(1)}%)`);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

function initializeDailyTarget() {
    const today = new Date().toDateString(); // e.g., "Mon Dec 16 2025"
    
    // Check if we have data and if it's from today
    if (!dailyTargetData || dailyTargetData.tradingDate !== today) {
        // NEW DAY - Calculate fresh targets only when date changes
        const dailyTargetAmount = initialAccountBalance * 0.20; // 20% of initial capital
        const dailyTargetCapital = parseFloat(initialAccountBalance) + dailyTargetAmount; // Initial + 20%
        
        dailyTargetData = {
            tradingDate: today,
            targetAmount: dailyTargetAmount,
            targetCapital: dailyTargetCapital,
            targetCompleted: false,
            initialCapital: initialAccountBalance
        };
        
        localStorage.setItem('dailyTargetData', JSON.stringify(dailyTargetData));
        
        console.log('📅 ✨ NEW TRADING DAY - Fresh targets calculated:');
        console.log(`   Date: ${today}`);
        console.log(`   Initial Capital: $${initialAccountBalance}`);
        console.log(`   Target Amount: $${dailyTargetAmount.toFixed(2)} (50%)`);
        console.log(`   Target Capital: $${dailyTargetCapital.toFixed(2)}`);
        console.log(`   Status: New day initialized`);
        
        targetCompleted = false;
    } else {
        // SAME DAY - Keep existing targets (no recalculation)
        targetCompleted = dailyTargetData.targetCompleted;
        
        console.log('📅 ♻️ CONTINUING TODAY - Using existing targets:');
        console.log(`   Date: ${today}`);
        console.log(`   Target Amount: $${parseFloat(dailyTargetData.targetAmount).toFixed(2)} (unchanged)`);
        console.log(`   Target Capital: $${parseFloat(dailyTargetData.targetCapital).toFixed(2)} (unchanged)`);
        console.log(`   Initial Capital: $${parseFloat(dailyTargetData.initialCapital).toFixed(2)} (from this morning)`);
        console.log(`   Target Completed: ${targetCompleted ? 'YES ✅' : 'NO ⏳'}`);
    }
}

function resetParams() {
    // Check and initialize daily target
    initializeDailyTarget();
    
    // 🕐 CHECK TRADING HOURS
    const tradingHoursCheck = isWithinTradingHours();
    if (!tradingHoursCheck.allowed) {
        const now = new Date();
        const currentHour = now.getHours();
        let message = '';
        
        if (currentHour < TRADING_HOURS.morning.start) {
            message = `⏰ Too early! Trading starts at ${TRADING_HOURS.morning.start} AM. Current time: ${now.toLocaleTimeString()}`;
        } else if (currentHour >= TRADING_HOURS.morning.end && currentHour < TRADING_HOURS.afternoon.start) {
            message = `☕ Lunch Break! Trading resumes at ${TRADING_HOURS.afternoon.start} PM (2 PM). Current time: ${now.toLocaleTimeString()}`;
        } else {
            message = `🌙 Trading closed! Trading hours: ${TRADING_HOURS.morning.start} AM - ${TRADING_HOURS.morning.end} PM, ${TRADING_HOURS.afternoon.start} PM - ${TRADING_HOURS.afternoon.end} PM. Current time: ${now.toLocaleTimeString()}`;
        }
        
        console.log(message);
        setFlashNotification(message, 0);
        return false; // Prevent trading
    }
    
    console.log(`✅ Trading hours OK - ${tradingHoursCheck.session} session (${new Date().toLocaleTimeString()})`);
    
    // 🎯 INITIALIZE SESSION SYSTEM
    sessionData = initializeSessionData();
    
    // Check if in break period
    const breakCheck = isInBreakPeriod();
    if (breakCheck.inBreak) {
        const message = `⏸️ Session Break! Resume trading in ${breakCheck.minutesLeft} minutes at ${breakCheck.breakEnd.toLocaleTimeString()}`;
        console.log(message);
        setFlashNotification(message, 0);
        return false; // Prevent trading during break
    }
    
    // Determine which session to start
    if (!sessionData.session1.completed) {
        // Start or continue session 1
        if (sessionData.session1.startBalance === 0) {
            startSession(1, updatedAccountBalance);
        } else {
            currentSession = 1;
            console.log(`📊 Continuing Session 1 - Progress: $${updatedAccountBalance.toFixed(2)} / $${sessionData.session1.targetBalance.toFixed(2)}`);
        }
    } else if (sessionData.session1.completed && !sessionData.session2.completed) {
        // Start or continue session 2
        if (sessionData.session2.startBalance === 0) {
            startSession(2, updatedAccountBalance);
        } else {
            currentSession = 2;
            console.log(`📊 Continuing Session 2 - Progress: $${updatedAccountBalance.toFixed(2)} / $${sessionData.session2.targetBalance.toFixed(2)}`);
        }
    } else if (sessionData.session1.completed && sessionData.session2.completed) {
        // Both sessions completed
        const message = `🎉 Daily target already completed! Both sessions finished. Come back tomorrow!`;
        console.log(message);
        setFlashNotification(message, 0);
        return false; // Prevent trading
    }
    
    // Check if target already completed for today
    if (targetCompleted) {
        console.log('🎯 Daily target already completed!');
        setFlashNotification('🎯 Daily target completed! Trading stopped for today.', 0);
        isRunning = false;
        return;
    }
    
    targetAmount =  (initialAccountBalance * (targetPercentage / 100)).toFixed(2);
    // targetAmount =  targetPercentage.toFixed(2);
    setAccountInfo("targetAmount", `$ ${targetAmount}`);
    amountPutForTrading = (initialAccountBalance * (amountPercentage / 100)).toFixed(2);
    // amountPutForTrading = amountPercentage.toFixed(2);
    setAccountInfo("amountPutForTrading", `$ ${amountPutForTrading}`);
    
    // Display daily target info (with safety check)
    if (dailyTargetData) {
        const dailyTargetAmountEl = document.getElementById("dailyTargetAmount");
        const dailyTargetCapitalEl = document.getElementById("dailyTargetCapital");
        
        if (dailyTargetAmountEl && dailyTargetCapitalEl) {
            dailyTargetAmountEl.innerHTML = `$ ${dailyTargetData.targetAmount.toFixed(2)}`;
            dailyTargetCapitalEl.innerHTML = `$ ${dailyTargetData.targetCapital.toFixed(2)}`;
        }
    }
    
    // Load pattern detection state from localStorage on page load/reload
    console.log('📊 Pattern Detection Status:');
    console.log('   Lost count in row:', lostCountInRow);
    console.log('   First 3 trades loss count:', firstThreeTradesLossCount);
    console.log('   Current session trade count:', currentSessionTradeCount);
    console.log('   Current session loss count:', currentSessionLossCount);
    console.log('   Flip flag active:', flipTradeStateFlag);
    
    if (lostCountInRow >= 3) {
        setFlashNotification(`⚠️ ${lostCountInRow} consecutive losses detected - Will take 10-min rest`, 10);
    }
    
    if (flipTradeStateFlag) {
        setFlashNotification('⚠️ Pattern flag is ACTIVE - Trade state will be flipped!', 10);
    }
    
    // Check if there's a stored loss from previous session (including partial recovery)
    const storedLoss = parseFloat(localStorage.getItem('totalLossInRow') || '0');
    
    if (storedLoss > 0) {
        // Calculate stake needed to recover the REMAINING loss
        // Assuming profit is approximately 95% of stake for even/odd trades
        const profitPercentage = 0.95; // Adjust based on your payout ratio
        const requiredStake = storedLoss / profitPercentage;
        
        stake = requiredStake;
        
        // Ensure stake is at least the minimum
        if (stake < 0.35) {
            stake = 0.35;
        }
        
        console.log(`💪 Recovery mode: Remaining loss to recover: $${storedLoss.toFixed(2)}`);
        console.log(`   Setting stake to $${stake.toFixed(2)} to recover remaining loss`);
        setFlashNotification(`Recovery mode: $${storedLoss.toFixed(2)} remaining to recover`, 10);
    } else {
        // No stored loss, use normal stake
        stake = amountPutForTrading;
        console.log('✅ No losses to recover - using normal stake');
    }
}





function setFlashNotification(message, timeInSeconds) {
    $(".flash-notification").html(message);
    if (timeInSeconds > 0) {
        setTimeout(() => {
            $(".flash-notification").html("");
        }, timeInSeconds * 1000);
    }
}

function setAccountInfo(elementId, message) {
    document.getElementById(elementId).innerHTML = message;
}

function setResultNotification(
    contractId,
    tradeTypeDisplay,
    market,
    stake,
    profit = null
) {
    const marketObj = marketArray.find((item) => item.value === market);
    // const capitalizedTradeType = tradeType.charAt(0).toUpperCase() + tradeType.slice(1);

    const element = document.getElementById(contractId);

    if (element) {
        let newClassName = null;
        let status = null;

        if (profit >= 0) {
            newClassName = "green";
            status = "WIN";
        } else if (profit < 0) {
            newClassName = "red";
            status = "LOSS";
        }

        const profitElement = document.getElementById(contractId + "-profit");
        const statusElement = document.getElementById(contractId + "-status");

        if (profitElement) {
            const spanElement = profitElement.querySelector("span"); // Select the <span> inside the parent element
            if (spanElement) {
                spanElement.className = newClassName; // Set the class
                spanElement.innerHTML = profit; // Set the inner HTML
            } else {
                console.log("No <span> element found inside the parent element.");
            }
        } else {
            console.log("Parent element not found.");
        }

        if (statusElement) {
            const spanElement = statusElement.querySelector("span"); // Select the <span> inside the parent element
            if (spanElement) {
                spanElement.className = newClassName; // Set the class
                spanElement.innerHTML = status; // Set the inner HTML
            } else {
                console.log("No <span> element found inside the parent element.");
            }
        } else {
            console.log("Parent element not found.");
        }
    } else {
        $(".result-notification").prepend(`<span class="stake-info" id="${contractId}"><span class="detailt"><span>Contract ID : </span><span class="contract-info">${contractId}</span></span><span class="detailt"><span>Market : </span><span class="contract-info">${marketObj.name}</span></span><span class="detailt"><span>Type : </span><span class="contract-info">${tradeTypeDisplay}</span></span><span class="detailt"><span>Stake : </span><span class="contract-info">${stake}</span></span><span class="detailt"><span>Profit / Loss Amount : </span><span class="contract-info" id="${contractId}-profit"><span class="">-</span></span></span><span class="detailt"><span>Status : </span><span class="contract-info" id="${contractId}-status"><span class="">-</span></span></span></span>`);
    }
}

function setTimer(time) {
    let timeleft = time / 1000; // Convert milliseconds to seconds

    if (!isRunning) {
        timeleft = 0;
        stopTimer = true;
    }

    let timer = setInterval(function () {
        if (timeleft <= 0) {
            clearInterval(timer);
            setFlashNotification(``, 0);
        } else if (timeleft > 0 && !stopTimer) {
            let formattedTime = formatTime(timeleft);
            setFlashNotification(`Bot will run again in <span class="number">${formattedTime}</span>.`,0);
        }
        timeleft -= 1;
    }, 1000);
}

// Helper function to format time (hide hours & minutes if they are 0)
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    let timeString = "";

    if (hours > 0) timeString += `${hours} h `;
    if (minutes > 0) timeString += `${minutes} m `;
    if (secs > 0 || timeString === "") timeString += `${secs} s`;

    return timeString.trim();
}


function setTickCountDown(tickCount, tick) {
    if (tickCount > tick) {
        setFlashNotification(`Trade will close in <span class="number">${tickCount - tick}</span> tick.`,0);
    } else if (tickCount == tick) {
        setFlashNotification(``, 0);
    }
}

function setInfo(contract, lastTradeProfit) {
    updatedAccountBalance = updatedAccountBalance + lastTradeProfit;


    currentProfitAmount = currentProfitAmount + lastTradeProfit;
    currentLossAmount = currentLossAmount + lastTradeProfit;
    if(currentLossAmount >= 0){currentLossAmount = 0;}

    netProfit = updatedAccountBalance - initialAccountBalance;

    if (lastTradeProfit > 0) {
        winTradeCount = winTradeCount + 1;
        totalProfitAmount = totalProfitAmount + lastTradeProfit;
    } else if (lastTradeProfit < 0) {
        lossTradeCount = lossTradeCount + 1;
        totalLossAmount = totalLossAmount + lastTradeProfit;
        totalLossAmount = totalLossAmount + lastTradeProfit;
    }

    setResultNotification(
        lastTradeId,
        tradeType,
        market,
        contract.buy_price,
        lastTradeProfit
    );

    setAccountInfo("totalTradeCount", `${totalTradeCount}`);
    setAccountInfo("winCount", `${winTradeCount}`);
    setAccountInfo("lossCount", `${lossTradeCount}`);

    // 🎯 LOG SESSION PROGRESS AFTER EACH TRADE
    logSessionProgress();

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


function getRandomNumber(min, max) {
    if (min > max) {
        throw new Error("Min value must be less than or equal to Max value");
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isWithinTimeRange() {
    const now = new Date();
    const hour = now.getHours(); // Get current hour (0-23)
    let returnValue = false
    if(hour >= 5 && hour < 18) {
        returnValue = true
    }

    return returnValue;
}

function getRandomMarket(array, current){
    let randomIndex;
    let randomMarket;
  
    do {
      randomIndex = Math.floor(Math.random() * array.length);
      randomMarket = array[randomIndex];
    } while (randomMarket === current);
  
    return randomMarket.value;
  };



function predictNextParity(sequence) {
    if (!sequence || sequence.length === 0) {
      return { error: "Sequence must have at least one number." };
    }
  
    // 1. Calculate historical even/odd ratio
    const evens = sequence.filter(n => n % 2 === 0).length;
    const odds = sequence.length - evens;
    const evenProbability = evens / sequence.length;
    const oddProbability = odds / sequence.length;
  
    // 2. Check for alternating pattern (e.g., [odd, even, odd, even...])
    let isAlternating = true;
    for (let i = 1; i < sequence.length; i++) {
      if (sequence[i] % 2 === sequence[i - 1] % 2) {
        isAlternating = false;
        break;
      }
    }
  
    // 3. Check for constant parity (all even or all odd)
    const allEven = evens === sequence.length;
    const allOdd = odds === sequence.length;
  
    // 4. Check arithmetic sequence parity changes (e.g., +3 flips parity)
    let isArithmeticFlip = false;
    if (sequence.length >= 2) {
      const diff = sequence[1] - sequence[0];
      if (Math.abs(diff) % 2 === 1) { // Odd difference flips parity
        isArithmeticFlip = true;
      }
    }
  
    // 5. Determine prediction and confidence
    let prediction;
    let confidence;
  
    if (allEven) {
      prediction = "even";
      confidence = 0.95; // 95% confidence next is even
    } else if (allOdd) {
      prediction = "odd";
      confidence = 0.95; // 95% confidence next is odd
    } else if (isAlternating) {
      prediction = sequence[sequence.length - 1] % 2 === 0 ? "odd" : "even";
      confidence = 0.85; // 85% confidence in alternation
    } else if (isArithmeticFlip) {
      const lastParity = sequence[sequence.length - 1] % 2;
      prediction = lastParity === 0 ? "odd" : "even";
      confidence = 0.75; // 75% confidence in arithmetic flip
    } else {
      // Fallback: Predict based on historical bias
      prediction = evenProbability > oddProbability ? "even" : "odd";
      confidence = Math.max(evenProbability, oddProbability);
    }
  
    // 6. Return result
    return {
      sequence: sequence,
      prediction: prediction,
      confidence: (confidence * 100).toFixed(1) + "%",
      stats: {
        evens: evens,
        odds: odds,
        evenRate: (evenProbability * 100).toFixed(1) + "%",
        oddRate: (oddProbability * 100).toFixed(1) + "%",
      },
    };
  }
