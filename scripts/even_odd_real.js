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

let lostCountInRow = 0;

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
        if (isWithinTimeRange() && wsResponse != null) {
            if (wsResponse.msg_type === 'history') {
                const priceList = wsResponse.history.prices;
                const lastDigits = priceList.map(p => Number(String(p).slice(-1)));

                // console.log('Price List: ', priceList);
                // console.log('Last 500 ticks last digits: ', lastDigits);

                const newProbabilities = predictNextParity(lastDigits);
                const number = parseFloat(newProbabilities.confidence.replace('%', '')) / 100;
                console.log('Predicted Probabilities: ', newProbabilities);
                


                if(newProbabilities.prediction == "even" && number > 0.7){
                    tradeType = 'even';
                    runScript();
                } else if(newProbabilities.prediction == "odd" && number > 0.7){
                    tradeType = 'odd';
                    runScript();
                } else {
                    setTimeout(() => {
                        requestTicksHistory(market);
                    }, 1000);
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

                            if(profit < 0){
                                lostCountInRow = lostCountInRow + 1;
                                // Store total loss amount in localStorage
                                let storedLoss = parseFloat(localStorage.getItem('totalLossInRow') || '0');
                                storedLoss += Math.abs(profit);
                                localStorage.setItem('totalLossInRow', storedLoss.toString());
                                console.log('Total loss in row stored:', storedLoss);
                            } else {
                                // Clear loss counter and localStorage on win
                                lostCountInRow = 0;
                                localStorage.removeItem('totalLossInRow');
                                console.log('Win! Loss counter reset and localStorage cleared');
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
                                if(lostCountInRow >= 3){
                                    // Increase interval to 5-6 minutes after 3 losses
                                    intervalTime = (getRandomNumber(300, 360) * 1000); // 5-6 minutes

                                } else if(lostCountInRow >= 2){
                                    intervalTime = (getRandomNumber(1, 20) * 1000 );

                                } else {
                                    intervalTime = (getRandomNumber(1, 10) * 1000 );

                                }

                                newMarket = getRandomMarket(marketArray, market);

                                if(market == newMarket){
                                    newMarket = getRandomMarket(marketArray, market);
                                }else {
                                    market = newMarket;
                                }

                                setTimer(intervalTime);
                                setTimeout(() => {
                                    // After 4 losses, flip the trade state
                                    if(lostCountInRow >= 4) {
                                        // Flip the tradeType for next trade
                                        if(tradeType === 'even') {
                                            tradeType = 'odd';
                                            console.log('Trade state flipped to ODD after 4 losses');
                                        } else {
                                            tradeType = 'even';
                                            console.log('Trade state flipped to EVEN after 4 losses');
                                        }
                                    }
                                    requestTicksHistory(market);
                                    console.log('loss: trade again');
                                    
                                }, intervalTime);
                            } else {
                                if (currentProfitAmount >= targetAmount) {
                                    intervalTime = (getRandomNumber(1, 10) * 1000 );

                                    setTimer(intervalTime);
                                    setTimeout(() => {
                                        reserParams();
                                        reload();
                                    }, intervalTime);
                                } else {
                                    intervalTime = (getRandomNumber(1, 10) * 1000 );

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
    };


    const stakeChange = (status) => {
        if (status == "Loss") {
            stake = stake * martingaleMultiplier;
        } else if (status == "Win") {
            stake = amountPutForTrading;
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
                if (tradeType == "even") {
                    tradeState = "DIGITEVEN";
                    // tradeType = "odd";
                } else if (tradeType == "odd") {
                    tradeState = "DIGITODD";
                    // tradeType = "even";
                }
            }
            stake = Number(stake);
            stake < 0.35 ? (stake = 0.35) : (stake = stake);

            tickCount = 1;
            // tickCount = getRandomNumber(5, 8);

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
            console.log("Sending Rise/Fall trade request:", tradeRequest);
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
        const ticksHistoryRequest = {
            ticks_history: symbol,
            end: 'latest',
            count: historyTickCount, // Increased count for a larger dataset (more ticks for better prediction)
            style: 'ticks'
        };
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
    
    // Clear localStorage when resetting params
    localStorage.removeItem('totalLossInRow');

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

function resetParams() {
    // targetAmount =  (initialAccountBalance * (targetPercentage / 100)).toFixed(2);
    targetAmount =  targetPercentage.toFixed(2);
    setAccountInfo("targetAmount", `$ ${targetAmount}`);
    // amountPutForTrading = (initialAccountBalance * (amountPercentage / 100)).toFixed(2);
    amountPutForTrading = amountPercentage.toFixed(2);
    setAccountInfo("amountPutForTrading", `$ ${amountPutForTrading}`);
    // stake = amountPutForTrading;
    stake = amountPutForTrading;
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
    } else if(hour >= 18 && hour < 24) {
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
