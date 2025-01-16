let isRunning = false, intervalId;


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


function webSocketConnectionStart(){
    isRunning = true;
    console.log('WebSocket connection started.');
    infoOutput.textContent += 'WebSocket connection started.\n';
    scriptButton.innerHTML = "Script running....Stop WebSocket";
    startWebSocket()
    
};

function webSocketConnectionStop(){
    isRunning = false;
    clearInterval(intervalId); // Stop the interval loop
    weClose();
    console.log('WebSocket connection stopped.');
    infoOutput.textContent += 'WebSocket connection stopped.\n';
    scriptButton.innerHTML = "Start WebSocket";
};

function startWebSocket() {
    ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");
    let response = null, tradeProposal, lastTradeId ;
    const martingaleMultiplier = 10;
    let tradeType = 'even';
    // initialStakeInputElement.value = 1;
    let newStake = 0;
    let curruntLoss = 0;
    let percentageValue = null;
    initialStake = 1;

    apiToken = accountSelectElement.value;
    market = getRandomMarket(marketArray, market); 
    marketSelectElement.value = market;
    newStake = initialStakeInputElement.value;

    let targetProfit = targetProfitInputElement.value;

    percentageValue = growthRateInputElement.value;

    ws.onopen = function () {
        // Authenticate
        getAuthentication();
        infoOutput.innerHTML += "WebSocket connection opened.\n-------------------------------------\n";
    };

    ws.onclose = function () {
        console.log('Connection closed');
        infoOutput.innerHTML += 'Connection closed\n-----------------------------\n\n';
        console.log('-----------------------------\n');
    };

    ws.onerror = function (err) {
        console.error('WebSocket error:', err);
        infoOutput.innerHTML += `WebSocket error: ${err.message}\n`;
    };


    ws.onmessage = function (event) {
        response = JSON.parse(event.data);

        console.log('response - ', response);

       

        if(response != null){

            if (response.msg_type === 'authorize') {
                console.log('Authorization successful.');
                initialAccBalance = response.authorize.balance;
                document.getElementById('initialAccBalance').innerHTML = `$${initialAccBalance}`;
                localStorage.setItem("accountDetails", response.authorize);

                profit10 = profitPercentageCalculate(initialAccBalance,10);
                profit25 = profitPercentageCalculate(initialAccBalance,25);
                profit50 = profitPercentageCalculate(initialAccBalance,50);
                profit100 = profitPercentageCalculate(initialAccBalance,100);


                // placeTrade(newStake);
                placeTrade();
               
                // setNewStake();
                // requestTicksHistory(market);    

            }


            if (response.msg_type === 'proposal') {
                if(newAccBalance > 0 && response.echo_req.amount > newAccBalance){
                    webSocketConnectionStop();
                } else {
                    tradeProposal = response;
                    makeTheTrade();
                }
            };

            if (response.msg_type === 'buy') {
                if(response.buy == undefined || response.buy.contract_id == undefined){
                    requestTicksHistory(market);
                } else {
                    
                    lastTradeId = response.buy.contract_id; 
                    totalTradeCount = totalTradeCount + 1;
                    isTradeOpen = true;

                    infoOutput.innerHTML += `Trade started:\nContract ID = ${lastTradeId}, Stake = ${response.buy.buy_price}, Market = ${market}\n`;
                    console.log('Trade Successful:', response);
                    scrollToBottom();
    
                    setTimeout(() => {fetchTradeDetails(lastTradeId);}, 500);
                }
            }

            if(response.msg_type === 'proposal_open_contract'){
                if(response.proposal_open_contract.contract_id === lastTradeId){
                    const contract = response.proposal_open_contract;
                    const profit = contract.profit;

                    console.log('profit - ', profit);
                    console.log('targetProfit - ', targetProfit);

                    if(profit > targetProfit){
                        console.log(`Take Profit reached: ${profit}`);
                        closeContract(contract.contract_id);
                    }

                    if (contract.is_sold) {
                        const result = profit > 0 ? 'Win' : 'Loss';
    
                        infoOutput.innerHTML += `Trade Result: <span style="color: ${profit > 0 ? 'green' : 'red'}; font-weight: 900;">${result}</span>, Profit: <span style="color: ${profit > 0 ? 'green' : 'red'}; font-weight: 900;">$${profit.toFixed(2)}</span>\n-------------------------------------\n`;
    

                        currentProfitLossAmount = currentProfitLossAmount + profit;
                        curruntLoss = curruntLoss + profit;
                        if(curruntLoss >= 0){curruntLoss = 0;}

                        if( profit > 0){
                            totalProfitAmount = totalProfitAmount + profit;
                            winTradeCount = winTradeCount+1;
                            lostCountInRow = 0;
                        } else if( profit < 0){
                            totalLossAmount = totalLossAmount + profit;
                            lossTradeCount = lossTradeCount+1;
                            lostCountInRow = lostCountInRow + 1;
                        }

                        stakeChange(result);

                        reportUpdate(totalTradeCount, winTradeCount, lossTradeCount, totalProfitAmount, totalLossAmount, currentProfitLossAmount, curruntLoss, initialAccBalance);
                        newAccBalance = initialAccBalance + currentProfitLossAmount;
    
                        isTradeOpen = false;

                        let t = 0;

                        reset();

                    }else{
                        setTimeout(() => {
                            fetchTradeDetails(lastTradeId);
                        }, 1000); 
                    }
                }
            };




        }

    };



    const getAuthentication = () => {
        ws.send(JSON.stringify({ authorize: apiToken }));
    };

    const closeContract = (contractId) => {
        const sellRequest = {
            sell: contractId,
            price: 0, // Accept any price (market sell)
        };
    
        console.log('Closing contract:', sellRequest);
        ws.send(JSON.stringify(sellRequest));
    };

    const placeTrade = () => {
       

        newStake = Number(newStake);

        const tradeRequest = {
            buy: 1,
            price: newStake, // Stake amount
            parameters: {
                amount: newStake, // Stake amount
                basis: 'stake', // Define stake basis
                contract_type: 'ACCU', // Accumulator contract type
                currency: 'USD', // Currency for trading
                duration_unit: 't', // Tick duration
                symbol: market, // Underlying market
                growth_rate: percentageValue, // Choose one from growth_rate_range
            },
        }
        ;
    
        // Send the trade request to the WebSocket
        console.log('Sending Rise/Fall trade request:', tradeRequest);
        ws.send(JSON.stringify(tradeRequest));
    };

    const makeTheTrade = () => {
        if(tradeProposal.proposal == undefined || tradeProposal.proposal.id == undefined){
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
        
        // console.log('Waiting for the results...');
        
        ws.send(JSON.stringify(contractDetailsRequest));
    }

    const reset = (time) => {
        placeTrade();
    };

    const restart = () => {

        webSocketConnectionStop();
        setTimeout(() => {
            webSocketConnectionStart();
        }, 1000);
    };

    const stakeChange = (status) => {
        if(status == "Loss"){
            newStake = newStake * martingaleMultiplier;
            targetProfit = newStake * (15 / 100);
        } else if(status == "Win"){
            newStake = initialStake;
            targetProfit = targetProfitInputElement.value;
            // setNewStake();
        }
        
    };

    const setNewStake = () => {
        let martingaleSteps = 12;
        newAccBalance = initialAccBalance + currentProfitLossAmount;
        // console.log('initialAccBalance - ', initialAccBalance);
        // console.log('currentProfitLossAmount - ', currentProfitLossAmount);
        // console.log('newAccBalance - ', newAccBalance);
        // console.log('martingaleMultiplier - ', martingaleMultiplier);
        
        let calculatedStake = (calculateInitialStake(newAccBalance, martingaleMultiplier, martingaleSteps)) - 0.02;

        // if(calculatedStake < 0.35 ){newStake = 0.35;} 
        // else if(calculatedStake > 0.35 && calculatedStake < 1){newStake = calculatedStake}
        // if(calculatedStake > 1){newStake =  Math.floor(calculatedStake)}


        console.log("Updated Initial Stake with New Capital:", calculatedStake);

        let results = calculateMartingaleSteps(newAccBalance, calculatedStake, martingaleMultiplier, martingaleSteps);
        console.log("Updated Martingale Steps with New Capital:", results);
        initialStakeInputElement.value = newStake;
        console.log('newStake - ', newStake);

    };


    const requestTicksHistory = (symbol) => {
        const ticksHistoryRequest = {
            ticks_history: symbol,
            end: 'latest',
            count: 100, // Increased count for a larger dataset (more ticks for better prediction)
            style: 'ticks'
        };
        ws.send(JSON.stringify(ticksHistoryRequest));
    };


}

function weClose() {
    if (ws) {
        ws.close();
        ws = null;
    }
}
