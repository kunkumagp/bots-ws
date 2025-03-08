marketArray = [
    { value: "1HZ10V", name: "Volatility 10 (1s) Index" },
    { value: "1HZ25V", name: "Volatility 25 (1s) Index" },
    { value: "1HZ50V", name: "Volatility 50 (1s) Index" },
    { value: "1HZ75V", name: "Volatility 75 (1s) Index" },
    { value: "1HZ100V", name: "Volatility 100 (1s) Index" },
];

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

accountSelectElement.value = 'lkUxtOopvUhCpIX';
// accountSelectElement.value = tokenValue;
marketSelectElement.value = "1HZ25V";


const martingaleMultiplier = 12;



let isRunning = false, intervalId;

let targetPercentage = 0.3;
// let amountPercentage = 0.35;
let amountPercentage = 1;

let initialAccountBalance = 0;
let updatedAccountBalance = 0;

let targetAmount = 0;
let amountPutForTrading = 1;

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
let apiToken = null;
let authSuccess = false;
let isTradeOpen = false;
let automation = false;
let tradeProposal = null;
let tickHistoryCount = 1001;
let onTradesCount = 5;
let lowestNumber = null;

let stopTimer = false;
let ws ;


apiToken = accountSelectElement.value;


accountSelectElement.addEventListener("change", () => {
    apiToken = accountSelectElement.value;
});

// market = marketSelectElement.value;
market = getRandomMarket(marketArray, '');

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
                resetParams();
                requestTicksHistory(market);


                stake = updatedAccountBalance / 25;
             
            }
    
    
            if (wsResponse.msg_type === 'history') {
                // console.log(wsResponse);
                const lastDigitList = wsResponse.history.prices;
                // test(lastDigitList);
                // let ldp = getLastDigitPercentage(lastDigitList);


                let prices = wsResponse.history.prices;
                let digitStats = Array(10).fill(0); // Store count for each digit
        
                // Count occurrences of each last digit
                prices.forEach(price => {
                    let lastDigit = parseInt(price.toString().slice(-1));
                    digitStats[lastDigit] += 1;
                });
        
                // Convert counts to percentages
                let totalTicks = prices.length;
                let digitPercentages = digitStats.map(count => ((count / totalTicks) * 100).toFixed(1));
        
                console.log("Last Digit Percentages:", digitPercentages);

                
                // console.log(ldp);
                // setAccountInfo("lowestNumber", `Lowest number is <span class="number">${ldp.lowest}</span>`)

                setTimeout(() => {
                            requestTicksHistory(market);
                        }, 1000);
                // if(ldp.lastDigitOfLastValue === ldp.lowest){
                //     placeTrade(ldp.lowest);
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
    
    
                    setResultNotification(
                        lastTradeId,
                        "Differ",
                        market,
                        wsResponse.buy.buy_price
                    );
    
                    // setAccountInfo('percentage10', `$ ${targetProfit.toFixed(2)}`)
                    console.log("Trade Successful:", wsResponse);
                    // scrollToBottom();
    
                    automation = true;

                    onTradesCount = onTradesCount + 1;
    
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


                        if(onTradesCount > 0){

                        }
    
                        setTimeout(() => {
                            // resetParams();
                            runScript();
                        }, 500);
    
                    } else {
                        setTimeout(() => {
                            fetchTradeDetails(lastTradeId);
                        }, 500);
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
    
    
    const stakeChange = (status) => {

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
    
    const requestTicksHistory = (symbol) => {
        console.log('symbol: ', symbol);
        const ticksHistoryRequest = {
            ticks_history: symbol,
            end: 'latest',
            count: tickHistoryCount, // Increased count for a larger dataset (more ticks for better prediction)
            style: 'ticks'
        };
        ws.send(JSON.stringify(ticksHistoryRequest));
    };
    
    const placeTrade = (lowestNumber, result = null) => {
        if (isTradeOpen == false) {

            console.log("1 - place order: ", stake);
    
            stake = Number(stake);
            stake < 0.35 ? (stake = 0.35) : (stake = stake);
            console.log("2 - place order: ", stake);
    
            const tradeRequest = {
                proposal: 1,
                amount: stake.toFixed(2),
                basis: "stake",
                contract_type: "DIGITDIFF", // Use 'DIGITDIFF' for Differs
                currency: "USD",
                duration: getRandomNumber(1, 5),
                duration_unit: "t",
                symbol: "R_10",
                barrier: lowestNumber, // Replace with the desired digit (0-9)
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
    
    
    function runScript() {
        isRunning = true;
        // placeTrade();
        requestTicksHistory(market);
    }

    function reload() {
        location.reload();
    }


}





// scriptButton.addEventListener("click", runScript);
// authenticateButton.addEventListener("click", getAuthentication);



function weClose() {
    if (ws) {
        ws.close();
        ws = null;
    }
}


function test(arr) {
    // Find the maximum decimal count
    let maxDecimals = 0;
    arr.forEach(num => {
        const decimalPart = num.toString().split(".")[1];
        if (decimalPart) {
            maxDecimals = Math.max(maxDecimals, decimalPart.length);
        }
    });

    // Get last digits considering the max decimal count
    let lastDigits = arr.map(num => {
        return Math.floor(num * Math.pow(10, maxDecimals)) % 10;
    });

    let counts = Array(10).fill(0);
    lastDigits.forEach(digit => counts[digit]++);

    console.log('counts: ', counts);

}