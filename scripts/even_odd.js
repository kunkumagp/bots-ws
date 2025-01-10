let isRunning = false, intervalId;
// accountSelectElement.value = 'iVOpdm24hBhw3JI';
// marketSelectElement.value = 'R_50';

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
    const martingaleValue = 2.071120;
    // initialStakeInputElement.value = 1;


    let initialAccBalance = 0, 
        totalTradeCount = 0,
        newProfit = 0,
        totalProfitAmount = 0,
        totalLossAmount = 0,
        winTradeCount = 0,
        lossTradeCount = 0,
        lossAmount = 0,
        lostCountInRow = 0,
        tickCount = 0
        ;


    apiToken = accountSelectElement.value;
    market = marketSelectElement.value;
    stopLossInputElement.value.length > 0 ?  stopLoss = stopLossInputElement.value:stopLoss = stopLoss;
    targetProfitInputElement.value.length > 0 ? targetProfit = targetProfitInputElement.value : targetProfit = targetProfit;
    initialStakeInputElement.value.length > 0 ? initialStake = initialStakeInputElement.value : initialStake = initialStake;

    let newStake = initialStake;


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

                // placeTrade(newStake);
                requestTicksHistory(market);    


            }

            if (response.msg_type === 'history') {
                const lastDigitList = response.history.prices;
                placeTrade(lastDigitList, newStake);
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

                setTimeout(() => {fetchTradeDetails(lastTradeId);}, 500);
            }

            if(response.msg_type === 'proposal_open_contract'){
                if(response.proposal_open_contract.contract_id === lastTradeId){
                    const contract = response.proposal_open_contract;

                    if (contract.is_sold) {
                        const profit = contract.profit;
                        const result = profit > 0 ? 'Win' : 'Loss';
    
                        infoOutput.innerHTML += `Trade Result: <span style="color: ${profit > 0 ? 'green' : 'red'}; font-weight: 900;">${result}</span>, Profit: <span style="color: ${profit > 0 ? 'green' : 'red'}; font-weight: 900;">$${profit.toFixed(2)}</span>\n-------------------------------------\n`;
    
                        lossAmount = lossAmount + profit;
                        newProfit = totalProfitAmount + totalLossAmount;

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

                        if(lossAmount > 0){lossAmount = 0;}

                        const spanColor = newProfit > 0 ? 'green' : 'red';
                        reportUpdate(totalTradeCount, winTradeCount, lossTradeCount, totalProfitAmount, totalLossAmount, lossAmount, newProfit, initialAccBalance);
    
                        isTradeOpen = false;


                        if(lossAmount < 0){
                            if(lostCountInRow >= 2){
                                if(lostCountInRow >= 3){
                                    market = getRandomMarket(marketArray, market);
                                }
                                let t = getRandomNumber(2,15) * 1000;
                                setTimer(t);
                                setTimeout(() => {
                                    reset();
                                }, t);
                            } else {
                                reset();
                            }
                            
                        } else {
                            reset();
                            // setTimer(5000);
                            // setTimeout(() => {
                            //     reset();
                            // }, 5000);
                        }

                    }else{
                        setTimeout(() => {
                            setTickCountDown(contract.tick_count, contract.tick_stream.length);
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


    const placeTrade = (digitArray, newStake) => {
        let nextNumberIs = predictNexrEvenOdd(digitArray);
        let tradeState = '';
        tickCount = getRandomNumber(5, 10);
        nextNumberIs == 'even' ? tradeState = 'DIGITEVEN' : 'DIGITODD';

        newStake = Number(newStake);

        const tradeRequest = {
            proposal: 1,
            amount: newStake.toFixed(2),
            basis: 'stake',
            contract_type: tradeState, // Use 'DIGITEVEN' for even and 'DIGITODD' for odd
            currency: 'USD',
            duration: tickCount,
            duration_unit: 't',
            symbol: market,
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
        
        console.log('Waiting for the results...');
        
        ws.send(JSON.stringify(contractDetailsRequest));
    }

    const reset = (time) => {
        requestTicksHistory(market);
    };

    const stakeChange = (status) => {
        if(status == "Loss"){
            newStake = newStake * martingaleValue;
        } else if(status == "Win"){
            newStake = initialStake;
        }
        
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

    const reportUpdate = (totalTradeCount, winCount, lossCount, totalProfit, totalLoss, currentLossAmount, currentProfitAmount, initialAccBalance) => {
        // const totalResults = document.getElementById('totalResults'); // For displaying WebSocket messages

        // document.getElementById('initialAccBalance').innerHTML = response.authorize.balance;
        document.getElementById('totalTradeCount').innerHTML = totalTradeCount;
        document.getElementById('winCount').innerHTML = winCount;
        document.getElementById('lossCount').innerHTML = lossCount;
        let newAccBalance = initialAccBalance + currentProfitAmount;


        if(totalProfit < 0){
            document.getElementById('totalProfit').innerHTML = `<span style="color: red; font-weight: 900;">$${totalProfit}</span>`;
        } else if(totalProfit == 0){
            document.getElementById('totalProfit').innerHTML = `<span>$${totalProfit}</span>`;
        } else {
            document.getElementById('totalProfit').innerHTML = `<span style="color: green; font-weight: 900;">$${totalProfit}</span>`;
        }


        if(newAccBalance < initialAccBalance){
            document.getElementById('newAccBalance').innerHTML = `<span style="color: red; font-weight: 900;">$${newAccBalance}</span>`;
        } else if(newAccBalance == initialAccBalance){
            document.getElementById('newAccBalance').innerHTML = `<span>$${newAccBalance}</span>`;
        } else {
            document.getElementById('newAccBalance').innerHTML = `<span style="color: green; font-weight: 900;">$${newAccBalance}</span>`;
        }


        if(totalLoss < 0){
            document.getElementById('totalLoss').innerHTML = `<span style="color: red; font-weight: 900;">$${totalLoss}</span>`;
        } else if(totalLoss == 0){
            document.getElementById('totalLoss').innerHTML = `<span>$${totalLoss}</span>`;
        } else {
            document.getElementById('totalLoss').innerHTML = `<span style="color: green; font-weight: 900;">$${totalLoss}</span>`;
        }

        if(currentLossAmount < 0){
            document.getElementById('currentLossAmount').innerHTML = `<span style="color: red; font-weight: 900;">$${currentLossAmount}</span>`;
        } else if(currentLossAmount == 0){
            document.getElementById('currentLossAmount').innerHTML = `<span>$${currentLossAmount}</span>`;
        } else {
            document.getElementById('currentLossAmount').innerHTML = `<span style="color: green; font-weight: 900;">$${currentLossAmount}</span>`;
        }

        if(currentProfitAmount < 0){
            document.getElementById('currentProfitAmount').innerHTML = `<span style="color: red; font-weight: 900;">$${currentProfitAmount}</span>`;
        } else if(currentProfitAmount == 0){
            document.getElementById('currentProfitAmount').innerHTML = `<span>$${currentProfitAmount}</span>`;
        } else {
            document.getElementById('currentProfitAmount').innerHTML = `<span style="color: green; font-weight: 900;">$${currentProfitAmount}</span>`;
        }


        infoOutput.scrollTop = infoOutput.scrollHeight;

    };

}

function weClose() {
    if (ws) {
        ws.close();
        ws = null;
    }
}
