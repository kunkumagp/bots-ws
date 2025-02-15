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

const martingaleMultiplier = 2.07112;

let isRunning = false, intervalId;
let connectionStatus = false;

let targetPercentage = 1;
let amountPercentage = 1
let savings = 400;


// let targetPercentage = 0.05;
// let amountPercentage = 0.1;


let devideValue = 10/9;

// let targetPercentage = 3;
// let amountPercentage = 4;

let intervalTime = 0 ;

if(targetProfitInputElement.value != ""){
    targetPercentage = targetProfitInputElement.value;
}

if(initialStakeInputElement.value != ""){
    amountPercentage = initialStakeInputElement.value;
}


let fullAccountBalance = 0;
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
marketSelectElement.value = "R_10";
apiToken = accountSelectElement.value;


accountSelectElement.addEventListener("change", () => {
    apiToken = accountSelectElement.value;
});

market = marketSelectElement.value;
market = getRandomMarket(marketArray, market);

ws.onopen = function () {
    console.log("Connection open");
    getAuthentication();

};

ws.onclose = function () {
    console.log("Connection closed");
    console.log("-----------------------------\n");
    connectionStatus = false;
};

ws.onerror = function (err) {
    console.error("WebSocket error:", err);
};

ws.onmessage = function (event) {

    if(isWithinTimeRange()){
        wsResponse = JSON.parse(event.data);

        if (wsResponse != null) {
            if (wsResponse.msg_type === "authorize") {
                connectionStatus = true;
                console.log("Authorization successful.\n-----------------------------\n\n");
                setFlashNotification("Authorization successful", 0);
                fullAccountBalance = wsResponse.authorize.balance;
                // initialAccountBalance = fullAccountBalance - (fullAccountBalance / (devideValue) );
                // initialAccountBalance = fullAccountBalance - savings;
                initialAccountBalance = (fullAccountBalance / 10);
                // initialAccountBalance = fullAccountBalance / 2;
                updatedAccountBalance = initialAccountBalance;
                setAccountInfo("initialAccountBalance", `$ ${fullAccountBalance}`);
                setAccountInfo("investmentAmount", `$ ${initialAccountBalance}`);
                authSuccess = true;
                
                authenticateButton.innerHTML = "Authenticated. Ready to trade.";
                authenticateButton.disabled = true;
                resetParams();


                // scriptButton.innerHTML = "Bot started....";
                // placeTrade();
                runScript();
            }


            if (wsResponse.msg_type === "proposal") {
                if (
                    fullAccountBalance > 0 &&
                    wsResponse.echo_req.amount > fullAccountBalance
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
                    

                        if (currentLossAmount < 0) {
                            if(lostCountInRow >= 2){
                                // intervalTime = (getRandomNumber(1, 2) * 60000 );
                                // intervalTime = (getRandomNumber(30, 40) * 1000);
                                market = getRandomMarket(marketArray, market);
                                // devideValue = 10/9;

                                intervalTime = (getRandomNumber(3, 6) * 1000);
                                setTimer(intervalTime);
                                setTimeout(() => {
                                    if(connectionStatus){
                                        runScript();
                                    } else {
                                        reserParams();
                                        reload();
                                    }
                                }, intervalTime);
                            } else {
                                runScript();
                            }
                        } else {

                            if(netProfit >= (initialAccountBalance / 4)){
                                // intervalTime = (getRandomNumber(20, 30) * 60000 );
                                intervalTime = (getRandomNumber(10, 15) * 60000 );

                                setTimer(intervalTime);
                                setTimeout(() => {
                                    if(connectionStatus){
                                        runScript();
                                    } else {
                                        reserParams();
                                        reload();
                                    }
                                }, intervalTime);
                            } else {
                                if (currentProfitAmount >= targetAmount) {
                                    // intervalTime = (getRandomNumber(30, 40) * 60000 );
                                    // intervalTime = (getRandomNumber(5, 10) * 60000 );
                                    // intervalTime = (getRandomNumber(120, 180) * 1000 );
                                    intervalTime = (getRandomNumber(5, 10) * 1000);
                                    setTimer(intervalTime);
                                    setTimeout(() => {
                                        if(connectionStatus){
                                            runScript();
                                        } else {
                                            reserParams();
                                            reload();
                                        }
                                    }, intervalTime);
                                } else {
                                    runScript();
                                }
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
                tradeType = "odd";
            } else if (tradeType == "odd") {
                tradeState = "DIGITODD";
                tradeType = "even";
            }
        }
        stake = Number(stake);
        stake < 0.35 ? (stake = 0.35) : (stake = stake);

        // tickCount = 1;
        tickCount = getRandomNumber(2, 8);

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






// scriptButton.addEventListener("click", runScript);
// authenticateButton.addEventListener("click", getAuthentication);


function runScript() {
    isRunning = true;
    placeTrade();
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

    // let hourValue = getHourValue();
    // if(hourValue > 5 && hourValue < 9){
    //     targetPercentage = 4;
    //     amountPercentage = 5;
    // } else {
    //     targetPercentage = 0.5;
    //     amountPercentage = 1;
    // }

    targetAmount =  (initialAccountBalance * (targetPercentage / 100)).toFixed(2);


    setAccountInfo("targetAmount", `$ ${(initialAccountBalance / 4 ).toFixed(2)}`);
    amountPutForTrading = (initialAccountBalance * (amountPercentage / 100)).toFixed(2);
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

    return hour >= 5 && hour < 18; // Returns true if between 5 AM and 4 PM
}

function getHourValue() {
    const now = new Date();
    const hour = now.getHours(); // Get current hour (0-23)

    return hour; // Returns true if between 5 AM and 4 PM
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