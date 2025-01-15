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
    const martingaleValue = 3.5143;
    marketSelectElement.value = 'R_50';


    apiToken = accountSelectElement.value;
    market = marketSelectElement.value;
    stopLossInputElement.value.length > 0 ?  stopLoss = stopLossInputElement.value:stopLoss = stopLoss;

    if(targetProfitInputElement.value.length > 0){
        targetProfit = targetProfitInputElement.value;
        profit10 = profitPercentageCalculate(targetProfit,10);
        profit25 = profitPercentageCalculate(targetProfit,25);
        profit50 = profitPercentageCalculate(targetProfit,50);
        profit100 = profitPercentageCalculate(targetProfit,100);
    } else {
        targetProfit = targetProfit
    }

    // targetProfitInputElement.value.length > 0 ? targetProfit = targetProfitInputElement.value : targetProfit = targetProfit;
    initialStakeInputElement.value.length > 0 ? initialStake = initialStakeInputElement.value : initialStake = initialStake;

    let newStake = initialStake;
    let curruntLoss = 0;


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

        if(response != null){

            if (response.msg_type === 'authorize') {
                console.log('Authorization successful.');
                initialAccBalance = response.authorize.balance;
                document.getElementById('initialAccBalance').innerHTML = `$${initialAccBalance}`;
                localStorage.setItem("accountDetails", response.authorize);

                // console.log('stopLoss - ', stopLoss);
                // console.log('targetProfit - ', targetProfit);
                // console.log('initialStake - ', initialStake);
                // console.log('newStake - ', newStake);

                placeTrade(newStake);

            }

            if (response.msg_type === 'proposal') {
                tradeProposal = response;
                makeTheTrade();
            };

            if (response.msg_type === 'buy') {
                lastTradeId = response.buy.contract_id; 
                totalTradeCount = totalTradeCount + 1;
                isTradeOpen = true;

                infoOutput.innerHTML += `Trade started:\nContract ID = ${lastTradeId}, Stake = ${response.buy.buy_price}, Market = ${market}\n`;
                console.log('Trade Successful:', response);
scrollToBottom();
                setTimeout(() => {fetchTradeDetails(lastTradeId);}, 1000);
            }

            if(response.msg_type === 'proposal_open_contract'){
                if(response.proposal_open_contract.contract_id === lastTradeId){
                    const contract = response.proposal_open_contract;

                    if (contract.is_sold) {
                        const profit = contract.profit;
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
    
                        isTradeOpen = false;


                        if(curruntLoss < 0){
                            if(lostCountInRow >= 2){
                                let t = getRandomNumber(2,15) * 1000;
                                setTimer(t);
                                setTimeout(() => {
                                    reset();
                                }, t);
                            } else {
                                reset();
                            }
                            
                        } else {
                            if(currentProfitLossAmount >= targetProfitInputElement.value){
                                t = getRandomNumber(120,420) * 1000; 
                                setTimer(t);
                                setTimeout(() => {
                                    restart();
                                }, t);
                            } else {
                                reset();
                            }
                            
                        }


                    }else{
                        setTimeout(() => {fetchTradeDetails(lastTradeId);}, 1000); 
                    }
                }
            };




        }

    };


    const restart = () => {
        currentProfitLossAmount = 0;
        webSocketConnectionStop();
        setTimeout(() => {
            webSocketConnectionStart();
        }, 1000);
    };

    const getAuthentication = () => {
        ws.send(JSON.stringify({ authorize: apiToken }));
    };


    const placeTrade = (newStake) => {
        newStake = Number(newStake);
        const tradeRequest = {
            proposal: 1,
            amount: newStake.toFixed(2),
            basis: 'stake',
            contract_type: 'DIGITOVER',
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            symbol: market,
            barrier: 2
          };
    
        // Send the trade request to the WebSocket
        console.log('Sending Rise/Fall trade request:', tradeRequest);
        ws.send(JSON.stringify(tradeRequest));
    };

    const makeTheTrade = () => {

        buyRequest = {
            buy: tradeProposal.proposal.id,
            price: tradeProposal.proposal.ask_price,
        };
        ws.send(JSON.stringify(buyRequest));
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
    }

    const reset = (time) => {
        setTimeout(() => {
            placeTrade(newStake);
        }, time);
    };

    const stakeChange = (status) => {
        if(status == "Loss"){
            newStake = newStake * martingaleValue;
        } else if(status == "Win"){
            newStake = initialStake;
        }
        
    };


}

function weClose() {
    if (ws) {
        ws.close();
        ws = null;
    }
}
