const martingaleMultiplier = 11;
let isRunning = false, intervalId;
let amountPercentage = 1;
let initialAccountBalance = 0;
let updatedAccountBalance = 0;


let currentProfitAmount = 0;
let currentLossAmount = 0;
let netProfit = 0;

let initStake = 0;
let stake = 0;

let totalProfitAmount = 0;
let totalLossAmount = 0;

let totalTradeCount = 0;
let winTradeCount = 0;
let lossTradeCount = 0;

let lostCountInRow = 0;
let ldp = null;

let lastTradeId = null;
let tradeTypeDisplay = null;
let apiToken = null;
let authSuccess = false;
let isTradeOpen = false;
let automation = false;
let tradeProposal = null;
let ws ;

let startRapidTrading = false;
let tradesInRow = 0;
let tradeCountInRow = 1;
let decimalCount = null;

let subscriptionId = null;



apiToken = accountSelectElement.value;
market = marketSelectElement.value;

accountSelectElement.addEventListener("change", () => {
    apiToken = accountSelectElement.value;
});

lowestDigitSelectElement.addEventListener("change", () => {
    ldp = Number(lowestDigitSelectElement.value);
});


marketSelectElement.addEventListener("change", () => {
    market = marketSelectElement.value;
});

scriptButton.addEventListener('click', runScript);


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


function weClose() {
    if (ws) {
        ws.close();
        ws = null;
    }
}

function startWebSocket() {

    ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");

    ws.onopen = function () {
        console.log("Connection open");
        getAuthentication();
    
    };
    
    ws.onclose = function () {
        console.log("Connection closed");
        console.log("-----------------------------\n");
    };
    
    ws.onerror = function (err) {
        console.error("WebSocket error:", err);
    };
    
    
    
    ws.onmessage = function (event) {
    
        // if(isWithinTimeRange()){
        wsResponse = JSON.parse(event.data);
    
        if (wsResponse != null && isRunning) {

            console.log('wsResponse: ', wsResponse);

            if (wsResponse.msg_type === "authorize") {
                console.log("Authorization successful.\n-----------------------------\n\n");
                setFlashNotification("Authorization successful", 0);
                initialAccountBalance = wsResponse.authorize.balance;
                updatedAccountBalance = initialAccountBalance;
                setAccountInfo("initialAccountBalance", `$ ${initialAccountBalance}`);
                authSuccess = true;
                resetUniqueParams();

                requestTicksHistory();

                
            }

            if (wsResponse.msg_type === 'history') {
                const lastDigitList = wsResponse.history.prices;

                decimalCount = mostCommonDecimalPlaces(lastDigitList);
                console.log('lastDigitList: ', lastDigitList);
                

                startTrades();

            }


            if (wsResponse.msg_type === 'tick') {
                const tickValue = wsResponse.tick.quote;
                // let lastDigit = parseInt(tickValue.toString().slice(-1));
                let lastDigit = getLastDecimalDigit(tickValue, decimalCount);

                console.log('tickValue: ', tickValue);
                console.log('lastDigit: ', lastDigit);
                console.log('ldp: ', ldp);


                // Check if the response contains the subscription ID
                if (wsResponse.subscription && wsResponse.subscription.id) {
                    subscriptionId = wsResponse.subscription.id; // Store the subscription ID
                    // console.log("Subscribed with ID:", subscriptionId);
                }

                if(lastDigit === ldp){
                    placeTrade(ldp);
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
                        "Differ",
                        market,
                        wsResponse.buy.buy_price
                    );
    
                    // setAccountInfo('percentage10', `$ ${targetProfit.toFixed(2)}`)
                    console.log("Trade Successful:", wsResponse);
                    // scrollToBottom();
                    tradesInRow = tradesInRow + 1;
    
                    automation = true;
                    stopTicks();
    
                    setTimeout(() => {
                        fetchTradeDetails(lastTradeId);
                    }, 1000);
                }
            }

            if (wsResponse.msg_type === "proposal_open_contract") {
                if (wsResponse.proposal_open_contract.contract_id === lastTradeId) {
                    const contract = wsResponse.proposal_open_contract;

                    console.log('contract: ', contract);

                    if (contract.is_sold) {
                        const profit = contract.profit;
                        const result = profit > 0 ? "Win" : "Loss";
    
                        setInfo(contract, profit);

                      




                        // stakeChange(result);
                        isTradeOpen = false;

                        if(profit < 0){
                            startRapidTrading = false;
                            tradesInRow = 0;
                        } else {
                            startRapidTrading = true;
                        }
                        

                        startTrades();

                    } else {
                        setTimeout(() => {
                            fetchTradeDetails(lastTradeId);
                        }, 1000);
                    }
                    
                }
            }

        }
    }

    const getAuthentication = () => {
        setFlashNotification("Authenticating....", 0);
        console.log("Authenticating....");
        ws.send(JSON.stringify({ authorize: apiToken }));
    };

    const startTrades = () => {
        isRunning = true;
        placeTrade(ldp);

        // if(startRapidTrading == false){
        //     console.log('Start initial trading.');

        //     startTicks();
        // } else if(startRapidTrading == true && tradesInRow < tradeCountInRow) {
        //     console.log('Start rapid trading.');

        //     stopTicks();
        //     placeTrade(ldp);
        // } else if(startRapidTrading == true && tradesInRow == tradeCountInRow){
        //     console.log('Start tick again.');

        //     startRapidTrading = false;
        //     tradesInRow = 0;
            
        //     startTicks();
        // }
    };


    const placeTrade = (ldp) => {
        if (isTradeOpen == false) {
            stake = Number(stake);
            stake < 0.35 ? (stake = 0.35) : (stake = stake);
            const tradeRequest = {
                proposal: 1,
                amount: stake.toFixed(2),
                basis: "stake",
                contract_type: "DIGITDIFF", // Use 'DIGITDIFF' for Differs
                currency: "USD",
                duration: 1,
                duration_unit: "t",
                symbol: market,
                barrier: ldp, // Replace with the desired digit (0-9)
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
            ticks_history: market,
            end: 'latest',
            count: 10, // Increased count for a larger dataset (more ticks for better prediction)
            style: 'ticks'
        };
        ws.send(JSON.stringify(ticksHistoryRequest));
    };


    const stakeChange = (status) => {

        let currentLoss = Number(Math.abs(currentLossAmount));

        // let initAmount = Number(amountPutForTrading);
        // let currentLoss = Number(Math.abs(currentLossAmount));

        // console.log('initAmount: ', initAmount);
        // console.log('currentLoss: ', currentLoss);

        // if(currentLoss > 0){
        //     if(initAmount < currentLoss){
        //         stake = currentLoss * martingaleMultiplier;
        //     } else {
        //         stake = initAmount * martingaleMultiplier;
        //     }
        // } else{
        //     stake = initAmount;
        // }


        // console.log('stake after change: ', stake);


        // console.log('-----------------------------------------------');


        if (currentLoss > 0) {
            stake = initStake * martingaleMultiplier;
        } else if (status == "Win") {
            stake = initStake;
        }

        // if (status == "Loss") {
        //     stake = stake * martingaleMultiplier;
        // } else if (status == "Win") {
        //     stake = amountPutForTrading;
        // }
    };
}


function resetUniqueParams() {
    amountPutForTrading = (initialAccountBalance * (amountPercentage / 100)).toFixed(2);
    // amountPutForTrading = Number(1);
    setAccountInfo("amountPutForTrading", `$ ${amountPutForTrading}`);
    stake = amountPutForTrading;
    initStake = amountPutForTrading;
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

function getLastDecimalDigit(num, decimalPlaces) {
    const decimalPart = num.toString().split(".")[1] || ""; // Get decimal part or empty string
    const paddedDecimal = decimalPart.padEnd(decimalPlaces, "0"); // Pad with zeros if needed
    return Number(paddedDecimal.charAt(decimalPlaces - 1)); // Get the desired decimal place
}