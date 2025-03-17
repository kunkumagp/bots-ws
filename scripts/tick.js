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

const params = new URLSearchParams(window.location.search);
const tokenValue = params.get('token'); // Replace 'yourParam' with the actual parameter name
const marketValue = params.get('market'); // Replace 'yourParam' with the actual parameter name

const accountSelectElement = document.getElementById("account_select");
const marketSelectElement = document.getElementById("market");
const targetProfitInputElement = document.getElementById("target_profit");
const initialStakeInputElement = document.getElementById("initial_stake");
const authenticateButton = document.getElementById("authenticateButton");
const scriptButton = document.getElementById('scriptButton');

const martingaleMultiplier = 2.07112;

let subscriptionId = null;

let ws,
    tradeProposal,
    lastTradeId,
    tradeTypeDisplay,
    isRunning = false,
    intervalId,
    isTradeOpen = false,
    automation = false,
    authSuccess = false,
    stopTimer = false,
    initialAccountBalance = 0,
    updatedAccountBalance = 0,
    totalTradeCount = 0,
    winTradeCount = 0,
    totalProfitAmount = 0,
    lossTradeCount = 0,
    totalLossAmount = 0,
    currentProfitAmount = 0,
    currentLossAmount = 0,
    stake = 0.35,
    initialStake = 0.35,
    stakePercentage = 0.35,
    targetAmount = 0;
    duration = 5,
    cutofNumber = 6,
    lostCountInRow = 0,
    tickHistoryCount = 100,
    previousTickValue = null,
    currentTickValue = null
    ;

let tickCountObject = {
    total: 0,
    up: 0,
    down: 0
}

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

accountSelectElement.value = tokenValue;
marketSelectElement.value = marketValue;
apiToken = accountSelectElement.value;

// market = getRandomMarket(marketArray, '');

market = marketSelectElement.value;


accountSelectElement.addEventListener("change", () => {
    apiToken = accountSelectElement.value;
});


marketSelectElement.addEventListener("change", () => {
    market = marketSelectElement.value;
});


// scriptButton.addEventListener('click', runScript);
runScript();


function runScript() {
    if (isRunning) {
        // Stop the loop and close the WebSocket
        webSocketConnectionStop();
    } else {
        // Start the loop and open the WebSocket
        webSocketConnectionStart();
    }
}



function webSocketConnectionStart() {
    isRunning = true;
    console.log('WebSocket connection started.');
    scriptButton.innerHTML = "Script running....Stop WebSocket";
    startWebSocket()

};

function webSocketConnectionStop() {
    isRunning = false;
    clearInterval(intervalId); // Stop the interval loop
    weClose();
    console.log('WebSocket connection stopped.');
    scriptButton.innerHTML = "Start WebSocket";
};


function startWebSocket() {

    ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");


    ws.onopen = function () {
        console.log("Connection open");
        getAuthentication();

    };

    ws.onclose = function () {
        console.log("Connection closed");
        console.log("-----------------------------\n");
        reload();
    };

    ws.onerror = function (err) {
        console.error("WebSocket error:", err);
    };

    ws.onmessage = function (event) {

        // if(isWithinTimeRange()){

            wsResponse = JSON.parse(event.data);

            // console.log('wsResponse: ', wsResponse);


            if (wsResponse != null) {

                if (wsResponse.msg_type === "authorize") {
                    console.log("Authorization successful.\n-----------------------------\n\n");
                    setFlashNotification("Authorization successful", 0);
                    initialAccountBalance = wsResponse.authorize.balance;
                    updatedAccountBalance = initialAccountBalance;
                    setAccountInfo("initialAccountBalance", `$ ${initialAccountBalance}`);
                    authSuccess = true;
                    authenticateButton.innerHTML = "Authenticated. Ready to trade.";
                    authenticateButton.disabled = true;

                    resetParams()
                    
                    // [Call the function to identify the market trend in here]

                    startTicks();
                    // requestTicksHistory(market);

                }

                if (wsResponse.msg_type === 'tick') {
                    const tickValue = wsResponse.tick.quote;

                    // Check if the response contains the subscription ID
                    if (wsResponse.subscription && wsResponse.subscription.id) {
                        subscriptionId = wsResponse.subscription.id; // Store the subscription ID
                        // console.log("Subscribed with ID:", subscriptionId);
                    }

                    if(previousTickValue == null && currentTickValue == null){
                        currentTickValue = tickValue;
                    } else {
                        previousTickValue = currentTickValue;
                        currentTickValue = tickValue;

                        tickCountObject.total = tickCountObject.total + 1;

                        if(previousTickValue < currentTickValue){
                            tickCountObject.up = tickCountObject.up + 1;
                        } else if(previousTickValue > currentTickValue){
                            tickCountObject.down = tickCountObject.down + 1;
                        } else if(previousTickValue == currentTickValue){
                            reset();
                        }

                    }

                    
                    console.log('Tick value: ',tickValue);
                    console.log('tickCountObject: ',tickCountObject);
                    setFlashNotification(`<span class="signal ">${tickCountObject.total}</span>.`, 0);
                    

                    if(tickCountObject.total == 10){
                        // requestTicksHistory(market);
                        tradeProccess();
                        stopTicks();
                    }

                }

                if (wsResponse.msg_type === 'history') {
                    const lastDigitList = wsResponse.history.prices;
                    let trend = analyzeMarketTrend(lastDigitList);
                    let last10Values = lastDigitList.slice(-10);
                    let upDownObject = getUpDownCount(last10Values);
                    let marketSignal = getTrendSignal(upDownObject);

                    // console.log('trend: ',trend);
                    // console.log('last10Values: ',last10Values);
                    console.log('upDownObject: ',upDownObject);

                    if(trend == "up" && marketSignal.signal == "up" && marketSignal.percentage >= `70%` ){
                        console.log('Trade Up');
                        console.log('Market Signal: ',marketSignal);

                        tradeTypeDisplay = "Rise";
                        setFlashNotification(`<span class="signal green">Strong Up</span>.`, 0);

                        // setTimeout(() => {
                            // placeTrade('up');
                        // }, 1000);

                    } else if(trend == "down" && marketSignal.signal == "down" && marketSignal.percentage >= `70%` ){
                        console.log('Trade Down');
                        console.log('Market Signal: ',marketSignal);
                        setFlashNotification(`<span class="signal red">Strong Down</span>.`, 0);
                        tradeTypeDisplay = "Fall";

                        // setTimeout(() => {
                            // placeTrade('down');
                        // }, 1000);

                    }  else {
                        reset();
                        // startTicks();

                        console.log('Analizing...');
                        setFlashNotification(`<span class="signal blink_me">Analizing...</span>`, 0);
                        setTimeout(() => {
                            requestTicksHistory(market);
                        }, 1000);


                        
                        // if(trend == "up" && marketSignal.signal == "up" && (marketSignal.percentage >= `50%` && marketSignal.percentage < `70%`) ){
                        //     setFlashNotification(`<span class="signal ">Medium Up</span>.`, 0);
                        // } else if(trend == "down" && marketSignal.signal == "down" && (marketSignal.percentage >= `50%` && marketSignal.percentage < `70%`) ){
                        //     setFlashNotification(`<span class="signal ">Medium Down</span>.`, 0);
                        // } else {
                        //     setFlashNotification(`<span class="signal blue">Neutral</span>.`, 0);
                        // }
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

                        console.log(contract);

                        if (contract.is_sold) {
                            let newTime;

                            isTradeOpen = false;
                            const profit = contract.profit;
                            const result = profit > 0 ? "Win" : "Loss";
                            setInfo(contract, profit);
                            // stakeChange(result);

                            setResultNotification(
                                lastTradeId,
                                tradeTypeDisplay,
                                market,
                                contract.buy_price,
                                profit
                            );

                            if(profit < 0){
                                lostCountInRow = lostCountInRow + 1;

                                newTime = 1000;

                                if(lostCountInRow >= 2){
                                    newTime = (1 * 60000);
                                } else if(lostCountInRow >= 3){
                                    market = getRandomMarket(marketArray, market);
                                    console.log('change market');
                                }
                                // setTimer(newTime);
                                
                                // setTimeout(() => {
                                //     reset();
                                //     // startTicks();
                                //     requestTicksHistory(market);
                                // }, newTime);

                                reset();
                                startTicks();

                            } else {
                                if(currentProfitAmount < targetAmount){
                                    // if(lostCountInRow == 4){
                                    //     newTime = (5 * 60000);
                                    // } else {
                                    //     newTime = (1 * 60000);
                                    // }
                                    // setTimer(newTime);
                                    // setTimeout(() => {
                                    //     reload();
                                    // }, newTime);

                                } else if(currentProfitAmount >= targetAmount){
                                    // newTime = ((10 + Number(lostCountInRow)) * 60000);
                                    // setTimer(newTime);
                                    // setTimeout(() => {
                                    //     reload();
                                    // }, newTime);
                                }

                                lostCountInRow = 0;

                                reset();
                                startTicks();
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
        // }

    }

    const tradeProccess = () => {
        console.log('tickCountObject: ',tickCountObject);

        if(tickCountObject.total == 10 && (tickCountObject.up >= 7 && tickCountObject.down <= 3)){
            console.log('STRONG UP');
            tradeTypeDisplay = "Rise";
            setFlashNotification(`<span class="signal green">Strong Up</span>.`, 0);
            placeTrade('up');
        } else if(tickCountObject.total == 10 && (tickCountObject.down >= 7 && tickCountObject.up <= 3)){
            console.log('STRONG DOWN');
            tradeTypeDisplay = "Fall";
            setFlashNotification(`<span class="signal red">Strong Down</span>.`, 0);
            placeTrade('down');
        } else {
            console.log('Analizing...');
            setFlashNotification(`<span class="signal blink_me">Analizing...</span>`, 0);

            reset();
            setTimeout(() => {
                startTicks();
            }, 3000);
        }


    };



    const getAuthentication = () => {
        setFlashNotification("Authenticating....", 0);
        console.log("Authenticating....");
        ws.send(JSON.stringify({ authorize: apiToken }));
    };

    const startTicks = () => {
        ws.send(JSON.stringify({
            ticks: market,
            subscribe: 1,
        }));
    };

    const stopTicks = () => {
        ws.send(JSON.stringify({
            forget: subscriptionId, // Use the stored subscription ID
        }));
    };

    const requestTicksHistory = (symbol) => {
        const ticksHistoryRequest = {
            ticks_history: symbol,
            end: 'latest',
            count: tickHistoryCount, // Increased count for a larger dataset (more ticks for better prediction)
            style: 'ticks'
        };
        ws.send(JSON.stringify(ticksHistoryRequest));
    };

    const placeTrade = (direction) => {
        if (isTradeOpen == false) {

            let tradeType;

            if (direction == "up") {
                tradeType = 'CALL';
            } else if (direction == "down") {
                tradeType = 'PUT';
            }

            stake = Number(stake);
            stake < 0.35 ? (stake = 0.35) : (stake = stake);


            const tradeRequest = {
                proposal: 1,
                amount: stake.toFixed(2),
                basis: "stake",
                contract_type: tradeType, // Use 'CALL' for rise and 'PUT' for fall
                currency: "USD",
                duration: duration,
                duration_unit: "t",
                symbol: market,
                // barrier: 0,  // Setting a barrier
                // barrier_equal: 1, // Allowing equals
            };

            // Send the trade request to the WebSocket
            console.log("Sending Rise/Fall trade request:", tradeRequest);
            ws.send(JSON.stringify(tradeRequest));
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

    const stakeChange = (status) => {
        if (status == "Loss") {
            stake = stake * martingaleMultiplier;
        } else if (status == "Win") {
            stake = amountPutForTrading;
        }
    };

}

function reset() {
    tickCountObject = {
        total: 0,
        up: 0,
        down: 0
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

function weClose() {
    if (ws) {
        ws.close();
        ws = null;
    }
}

function setAccountInfo(elementId, message) {
    document.getElementById(elementId).innerHTML = message;
}

function analyzeMarketTrend(prices) {
    if (!Array.isArray(prices) || prices.length < 10) {
        return "Not enough data to determine trend.";
    }

    const shortSMA = prices.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const longSMA = prices.slice(-10).reduce((a, b) => a + b, 0) / 10;

    if (shortSMA > longSMA) {
        return "up";
    } else if (shortSMA < longSMA) {
        return "down";
    } else {
        return "Sideways trend.";
    }
}

function getTrendSignal(trendData) {
    if (!trendData || typeof trendData !== "object") {
        return { error: "Invalid data" };
    }

    const { total, up, down } = trendData;
    if (total === 0) {
        return { error: "Total must be greater than zero" };
    }

    const upPercentage = (up / total) * 100;
    const downPercentage = (down / total) * 100;

    if (up > down) {
        return { signal: "up", percentage: `${upPercentage.toFixed(0)}%` };
    } else if (down > up) {
        return { signal: "down", percentage: `${downPercentage.toFixed(0)}%` };
    } else {
        return { signal: "neutral", percentage: "50%" };
    }
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
    }

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

function setTickCountDown(tickCount, tick) {
    if (tickCount > tick) {
        setFlashNotification(`Trade will close in <span class="number">${tickCount - tick}</span> tick.`, 0);
    } else if (tickCount == tick) {
        setFlashNotification(``, 0);
    }
}

function getUpDownCount(data) {
    let result = { up: 0, down: 0, total: data.length };

    for (let i = 1; i < data.length; i++) {
        if (data[i] > data[i - 1]) {
            result.up++;
        } else if (data[i] < data[i - 1]) {
            result.down++;
        }
    }

    return result;
}

function reload() {
    location.reload();
}

function resetParams() {
    // stake = Number(initialAccountBalance) * (Number(stakePercentage)/100);

    // targetAmount =  (initialAccountBalance * ((stakePercentage/5) / 100)).toFixed(2);
    // targetAmount =  (initialAccountBalance * (0.8 / 100)).toFixed(2);
    targetAmount =  0.3;
    setAccountInfo("targetAmount", `$ ${targetAmount}`);
    // amountPutForTrading = (initialAccountBalance * (stakePercentage / 100)).toFixed(2);
    // amountPutForTrading = (initialAccountBalance * (1 / 100)).toFixed(2);
    amountPutForTrading = 0.35;
    setAccountInfo("amountPutForTrading", `$ ${amountPutForTrading}`);
    stake = amountPutForTrading;
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

function getRandomMarket(array, current){
    let randomIndex;
    let randomMarket;
  
    do {
      randomIndex = Math.floor(Math.random() * array.length);
      randomMarket = array[randomIndex];
    } while (randomMarket === current);
  
    return randomMarket.value;
  };

  function isWithinTimeRange() {
    const now = new Date();
    const hour = now.getHours(); // Get current hour (0-23)

    let returnHours;
    if((hour >= 6 && hour < 11) || (hour >= 13 && hour < 15) || (hour >= 16 && hour < 23)){
        returnHours = true;
    } else {
        returnHours = false;
    }


    return returnHours; // Returns true if between 5 AM and 4 PM
}