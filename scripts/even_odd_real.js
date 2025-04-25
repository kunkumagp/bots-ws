const accounts = [
    { name: "KunkumaGP", value: "lkUxtOopvUhCpIX" },
    { name: "KUNKUMAGP Real", value: "Y71P0GIOxz3YYvr" },
    { name: "Kunkuma Trading", value: "hJfU1x5xpoSTwHe" },
    { name: "W H K G Prasanna 85", value: "iVOpdm24hBhw3JI" },
];

let marketArray = [
    { value: "R_10", name: "Volatility 10 Index" },
    // { value: "1HZ10V", name: "Volatility 10 (1s) Index" },
    { value: "R_25", name: "Volatility 25 Index" },
    // { value: "1HZ25V", name: "Volatility 25 (1s) Index" },
    { value: "R_50", name: "Volatility 50 Index" },
    // { value: "1HZ50V", name: "Volatility 50 (1s) Index" },
    { value: "R_75", name: "Volatility 75 Index" },
    // { value: "1HZ75V", name: "Volatility 75 (1s) Index" },
    { value: "R_100", name: "Volatility 100 Index" },
    // { value: "1HZ100V", name: "Volatility 100 (1s) Index" },
];

const accountSelectElement = document.getElementById("account_select");
const marketSelectElement = document.getElementById("market");
const targetProfitInputElement = document.getElementById("target_profit");
const initialStakeInputElement = document.getElementById("initial_stake");
const authenticateButton = document.getElementById("authenticateButton");
const scriptButton = document.getElementById("scriptButton");
const infoOutput = document.getElementById("info_output");


// const martingaleMultiplier = 2.07112;
const martingaleMultiplier = 1.2;

const dayTarget = 354;

let isRunning = false, intervalId;

let targetPercentage = 0.005;
// let amountPercentage = 0.01;
let amountPercentage = 0.1;

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
let isConnectionOpen = false;

let stopTimer = false;
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

accountSelectElement.value = "lkUxtOopvUhCpIX";
marketSelectElement.value = "R_100";
apiToken = accountSelectElement.value;


accountSelectElement.addEventListener("change", () => {
    apiToken = accountSelectElement.value;
});

// market = marketSelectElement.value;
market = getRandomMarket(marketArray, '');

botRun();
function botRun() {

    ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");
    
    ws.onopen = function () {
        console.log("Connection open");
        getAuthentication();
    
    };
    
    ws.onclose = function () {
        console.log("Connection closed");
        console.log("-----------------------------\n");
        isConnectionOpen = false;
    };
    
    ws.onerror = function (err) {
        console.error("WebSocket error:", err);
    };
    
    ws.onmessage = function (event) {
        const modal = document.getElementById("myModal");
    
        if(isWithinTimeRange()){
            wsResponse = JSON.parse(event.data);
    
            if (wsResponse != null) {
    
                if (wsResponse.msg_type === "authorize" && wsResponse.authorize === undefined) {
                    reload();
                } else if (wsResponse.msg_type === "authorize") {
                    isConnectionOpen = true;
                    console.log("Authorization successful.\n-----------------------------\n\n");
                    setFlashNotification("Authorization successful", 0);
                    
                        initialAccountBalance = wsResponse.authorize.balance;
                        updatedAccountBalance = initialAccountBalance;
                        setAccountInfo("initialAccountBalance", `$ ${initialAccountBalance}`);
                        authSuccess = true;
                        authenticateButton.innerHTML = "Authenticated. Ready to trade.";
                        authenticateButton.disabled = true;
                        resetParams();
                        // scriptButton.innerHTML = "Bot started....";
                        // placeTrade();
                        // runScript();

                        if(dayTarget > 0 && updatedAccountBalance >= dayTarget){
                            modal.style.display = "block";
                        } else {
                            // runScript();
                            requestTicksHistory(market);
                        }

                        
                        

                }



                if (wsResponse.msg_type === 'history') {
                    const lastDigitList = wsResponse.history.prices;
                    const lastDigits = getLastDigits(lastDigitList);

                    const probabilities = predictNextThirdNumberParity(lastDigits);
                    // console.log(probabilities); 

                    const newProbabilities = predictNextParity(lastDigits);
                    const number = parseFloat(newProbabilities.confidence.replace('%', '')) / 100;

                    console.log(newProbabilities);

                    // const result = predictNextThird(lastDigits);
                    // console.log(result);
                    // const number = parseFloat(result.confidence.replace('%', '')) / 100;




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


                    // if(result.prediction == "even" && number > 0.7){
                    //     tradeType = 'even';
                    //     runScript();
                    // } else if(result.prediction == "odd" && number > 0.7){
                    //     tradeType = 'odd';
                    //     runScript();
                    // } else {
                    //     setTimeout(() => {
                    //         requestTicksHistory(market);
                    //     }, 1000);
                    // }

                    
                    // if(probabilities.even > 0.6){
                    //     tradeType = 'even';
                    //     runScript();
                    // } else if(probabilities.odd > 0.6){
                    //     tradeType = 'odd';
                    //     runScript();
                    // } else {
                    //     setTimeout(() => {
                    //         requestTicksHistory(market);
                    //     }, 1000);
                    // }

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
                            }
                            let newTime;

    
                            if (currentLossAmount < 0) {
    
                                if(lostCountInRow != 0){
                                    market = getRandomMarket(marketArray, market);
                                    // newTime = (getRandomNumber(60, 180) * 1000);
                                    
                                    if(lostCountInRow >= 3){
                                        // newTime = (getRandomNumber(60, 300) * 1000);
                                        newTime = (getRandomNumber(60, 90) * 1000);
                                    } else {
                                        newTime = (getRandomNumber(1, 5) * 1000);
                                    }

                                    setTimer(newTime);
                                    setTimeout(() => {
                                        // if(isConnectionOpen){
                                        //     runScript();
                                        // } else {
                                        //     botRun();
                                        // }
                                        botRun();
                                    }, newTime);
    
                                } else {
                                    runScript();
                                }
    
                            } else {
                                if (currentProfitAmount >= targetAmount) {
                                    // let newTime = (getRandomNumber(30, 40) * 60000 );
                                    // let newTime = (getRandomNumber(2, 3) * 60000 );
                                    // let newTime = (getRandomNumber(40, 60) * 1000);
                                    newTime = (getRandomNumber(1, 5) * 1000);
                                    setTimer(newTime);
                                    setTimeout(() => {
                                        reserParams();
                                        reload();
                                    }, newTime);
                                } else {
                                    runScript();
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
    
    };
    
    const getAuthentication = () => {
        setFlashNotification("Authenticating....", 0);
        console.log("Authenticating....");
        ws.send(JSON.stringify({ authorize: apiToken }));
    };
    
    
    const stakeChange = (status) => {
        if (status == "Loss") {
            stake = Number(Math.abs(currentLossAmount)) * martingaleMultiplier;
                // stake = stake * martingaleMultiplier;
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
                        tradeType = "odd";
                    } else if (tradeType == "odd") {
                        tradeState = "DIGITODD";
                        tradeType = "even";
                    }

            }
            stake = Number(stake);
            stake < 0.35 ? (stake = 0.35) : (stake = stake);
    
            tickCount = 2;
            // tickCount = getRandomNumber(5, 8);
            // tickCount = getRandomNumber(1, 3);
    
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


    const requestTicksHistory = (symbol) => {
        const ticksHistoryRequest = {
            ticks_history: symbol,
            end: 'latest',
            count: 500, // Increased count for a larger dataset (more ticks for better prediction)
            style: 'ticks'
        };
        ws.send(JSON.stringify(ticksHistoryRequest));
    };
    
    
    
    
    // scriptButton.addEventListener("click", runScript);
    // authenticateButton.addEventListener("click", getAuthentication);
    
    
    function runScript() {
        isRunning = true;
        placeTrade();
    }
    
}

function reConnectingWs() {
    ws.onopen = function () {
        console.log("Connection open");
        authenticating();
    };
    
    ws.onclose = function () {
        console.log("Connection closed");
        console.log("-----------------------------\n");
    };
    
    ws.onerror = function (err) {
        console.error("WebSocket error:", err);
    };
    
    ws.onmessage = function (event) {
    
            wsResponse = JSON.parse(event.data);
    
            if (wsResponse != null) {
    
                if (wsResponse.msg_type === "authorize" && wsResponse.authorize === undefined) {
                    reload();
                } else if (wsResponse.msg_type === "authorize") {
                    console.log("Authorization successful.\n-----------------------------\n\n");
                    setFlashNotification("Authorization successful", 0);
                }
    
            }
    
    };
    
    const authenticating = () => {
        setFlashNotification("Authenticating....", 0);
        console.log("Authenticating....");
        ws.send(JSON.stringify({ authorize: apiToken }));
    };
}

function reload() {
    location.reload();
}

function reserParams() {
    currentProfitAmount = 0;
    currentLossAmount = 0;
    lostCountInRow = 0;

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
    targetAmount =  (initialAccountBalance * (targetPercentage / 100)).toFixed(2);
    setAccountInfo("targetAmount", `$ ${targetAmount}`);

    let currentLoss = Number(Math.abs(currentLossAmount));
    if(currentLoss != 0){
        amountPutForTrading = currentLoss * martingaleMultiplier;
    } else {
        amountPutForTrading = (initialAccountBalance * (amountPercentage / 100)).toFixed(2);
    }

    // amountPutForTrading = (initialAccountBalance * (amountPercentage / 100)).toFixed(2);
    setAccountInfo("amountPutForTrading", `$ ${amountPutForTrading}`);
    stake = amountPutForTrading;
}

function weClose() {
    if (ws) {
        ws.close();
        ws = null;
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

    let returnValue = false;

    if((hour >= 7 && hour < 16) || (hour >= 18 && hour < 23)){
        returnValue = true;
    }

    return returnValue; // Returns true if between 5 AM and 4 PM
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

  function predictNextThirdNumberParity(numberSeries) {
    // Validate input
    if (!Array.isArray(numberSeries) || numberSeries.length < 3) {
        throw new Error("Input must be an array with at least 3 numbers");
    }

    // Extract every third number from the series (starting from index 2)
    const thirdNumbers = [];
    for (let i = 2; i < numberSeries.length; i += 3) {
        if (typeof numberSeries[i] !== 'number') {
            throw new Error("All elements in the series must be numbers");
        }
        thirdNumbers.push(numberSeries[i]);
    }

    // If we don't have at least 2 third numbers to analyze pattern, return basic probability
    if (thirdNumbers.length < 2) {
        const last = numberSeries[numberSeries.length - 1];
        const isLastEven = last % 2 === 0;
        return {
            even: isLastEven ? 0.75 : 0.25,
            odd: isLastEven ? 0.25 : 0.75
        };
    }

    // Calculate historical probabilities
    let evenCount = 0;
    let oddCount = 0;
    
    for (const num of thirdNumbers) {
        if (num % 2 === 0) {
            evenCount++;
        } else {
            oddCount++;
        }
    }

    // Calculate probabilities based on history
    const total = evenCount + oddCount;
    const baseEvenProb = evenCount / total;
    const baseOddProb = oddCount / total;

    // Apply simple pattern detection (alternating pattern)
    let patternAdjustment = 0;
    if (thirdNumbers.length >= 3) {
        const last1 = thirdNumbers[thirdNumbers.length - 1];
        const last2 = thirdNumbers[thirdNumbers.length - 2];
        const last3 = thirdNumbers[thirdNumbers.length - 3];
        
        // Check for alternating pattern
        if ((last1 % 2 !== last2 % 2) && (last2 % 2 !== last3 % 2)) {
            const lastParity = last1 % 2;
            patternAdjustment = 0.2; // Slightly increase probability of opposite
            return {
                even: lastParity === 0 ? 0.3 : 0.7,
                odd: lastParity === 0 ? 0.7 : 0.3
            };
        }
        
        // Check for repeating pattern (3 in a row same parity)
        if ((last1 % 2 === last2 % 2) && (last2 % 2 === last3 % 2)) {
            patternAdjustment = 0.3; // Stronger adjustment for breaking streak
            return {
                even: last1 % 2 === 0 ? 0.4 : 0.6,
                odd: last1 % 2 === 0 ? 0.6 : 0.4
            };
        }
    }

    // Return base probabilities if no clear pattern
    return {
        even: baseEvenProb,
        odd: baseOddProb
    };
}




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

  function mostCommonDecimalPlaces(arr) {
    const decimalCounts = arr.map(num => {
        const decimalPart = num.toString().split(".")[1];
        return decimalPart ? decimalPart.length : 0;
    });

    const frequency = {};
    decimalCounts.forEach(count => {
        frequency[count] = (frequency[count] || 0) + 1;
    });

    return Object.keys(frequency).reduce((a, b) => frequency[a] >= frequency[b] ? Number(a) : Number(b));
}

// function getLastDecimalDigit(num, decimalPlaces) {
//     const decimalPart = num.toString().split(".")[1] || ""; // Get decimal part or empty string
//     const paddedDecimal = decimalPart.padEnd(decimalPlaces, "0"); // Pad with zeros if needed
//     return Number(paddedDecimal.charAt(decimalPlaces - 1)); // Get the desired decimal place
// }



// For decimal parts with only 1 digit, adds a '0' to make it 2 digits
function getLastDigits(numbers) {
    return numbers.map(num => {
        // Convert number to string
        const numStr = num.toString();
        
        // Check if there's a decimal point
        if (numStr.includes('.')) {
            const parts = numStr.split('.');
            // Ensure there are exactly 2 decimal places
            const decimalPart = parts[1].length === 1 ? parts[1] + '0' : parts[1];
            return parseInt(decimalPart.slice(-1));
        } else {
            // If no decimal point, last digit is 0 (like 1855 -> 1855.00)
            return 0;
        }
    });
}

function parsePercentage(str) {
    const num = parseFloat(str);
    return str.includes('%') ? num : num / 100;
}







function predictNextThird(lastDigits) {
    if (lastDigits.length < 3) {
      return { prediction: null, message: "Need at least 3 digits to start predicting." };
    }
  
    const patternMap = {};
    let totalPatterns = 0;
  
    // Learn from sequences
    for (let i = 0; i < lastDigits.length - 2; i++) {
      const key = `${lastDigits[i]},${lastDigits[i + 1]}`;
      const third = lastDigits[i + 2];
      const isEven = third % 2 === 0;
  
      if (!patternMap[key]) {
        patternMap[key] = { even: 0, odd: 0 };
      }
  
      if (isEven) {
        patternMap[key].even++;
      } else {
        patternMap[key].odd++;
      }
  
      totalPatterns++;
    }
  
    // Use the last 2 digits to predict the 3rd
    const lastKey = `${lastDigits[lastDigits.length - 2]},${lastDigits[lastDigits.length - 1]}`;
    const data = patternMap[lastKey];
  
    if (!data) {
      return { prediction: null, message: "Pattern not found in data." };
    }
  
    const prediction = data.even > data.odd ? "even" : "odd";
    const confidence = ((Math.max(data.even, data.odd) / (data.even + data.odd)) * 100).toFixed(2);
  
    return {
      prediction,
      confidence: `${confidence}%`,
      sampleSize: data.even + data.odd,
      message: `Prediction based on ${data.even + data.odd} matches of pattern [${lastKey}]`
    };
  }
  