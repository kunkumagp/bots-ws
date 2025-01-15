let isRunning = false, intervalId;
// accountSelectElement.value = 'iVOpdm24hBhw3JI';
// marketSelectElement.value = 'R_50';







// // Example Usage
// const initialCapital = 500; // Initial capital
// const martingaleMultiplier = 2.071115; // Martingale multiplier
// const steps = 10; // Number of steps

// // Calculate the initial stake for the given capital
// let initStake = calculateInitialStake(initialCapital, martingaleMultiplier, steps);
// console.log("Initial Stake:", initStake);

// // Calculate the Martingale steps
// let results = calculateMartingaleSteps(initialCapital, initStake, martingaleMultiplier, steps);
// console.log("Initial Martingale Steps:", results);

// // Add new capital and recalculate
// const newCapital = 2000; // Add $2000 more capital
// initStake = calculateInitialStake(newCapital, martingaleMultiplier, steps);
// console.log("Updated Initial Stake with New Capital:", initStake);

// // Recalculate the Martingale steps with the updated capital
// results = calculateMartingaleSteps(newCapital, initStake, martingaleMultiplier, steps);
// console.log("Updated Martingale Steps with New Capital:", results);





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
    const martingaleMultiplier = 2.071120;
    let tradeType = 'even';
    // initialStakeInputElement.value = 1;
    let newStake = 0;
    let curruntLoss = 0;

    apiToken = accountSelectElement.value;
    market = getRandomMarket(marketArray, market); 
    marketSelectElement.value = market;

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

        // console.log('response - ', response);
       

        if(response != null){

            if (response.msg_type === 'authorize') {
                console.log('Authorization successful.');
                initialAccBalance = response.authorize.balance;
                document.getElementById('initialAccBalance').innerHTML = `$${initialAccBalance}`;
                localStorage.setItem("accountDetails", response.authorize);
                resetParams();
                // placeTrade(newStake);
               
                // setNewStake();
                requestTicksHistory(market);    

            }

            if (response.msg_type === 'history') {
                const lastDigitList = response.history.prices;
                placeTrade(lastDigitList, newStake);
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

                    let tradeType;

                    if (response.buy.shortcode.includes('DIGITEVEN')) {
                        tradeType = 'Even';
                    } else if (response.buy.shortcode.includes('DIGITODD')) {
                        tradeType = 'Odd';
                    }
                    
    
                    infoOutput.innerHTML += `Trade started:\nContract ID = ${lastTradeId}, Stake = ${response.buy.buy_price}, Market = ${market}, Teade Type = ${tradeType}\n`;
                    console.log('Trade Successful:', response);
                    scrollToBottom();
    
                    setTimeout(() => {fetchTradeDetails(lastTradeId);}, 500);
                }
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
                        newAccBalance = initialAccBalance + currentProfitLossAmount;
    
                        isTradeOpen = false;

                        let t = 0;

                        if(curruntLoss < 0){

                            if(lostCountInRow > 3){ 
                                // t = getRandomNumber(10,60) * 1000; 
                                // market = getRandomMarket(marketArray, market);
                            }
                            else if(lostCountInRow > 2){ 
                                t = getRandomNumber(10,30) * 1000; 
                                // market = getRandomMarket(marketArray, market); 
                            }
                            else if(lostCountInRow == 2){ 
                                // t = getRandomNumber(2,15) * 1000; 
                            }
                            // t = getRandomNumber(2,8) * 1000; 

                            setTimer(t);
                            setTimeout(() => {
                                reset();
                            }, t);


                            // if(lostCountInRow > 2){
                            //     t = getRandomNumber(10,30) * 1000;
                            //     market = getRandomMarket(marketArray, market);
                            //     // marketSelectElement.value = market;
                            //     setTimer(t);
                            //     setTimeout(() => {
                            //         reset();
                            //     }, t);
                            // } else if(lostCountInRow == 2){
                            //     setTimer(t);
                            //     setTimeout(() => {
                            //         reset();
                            //     }, t);
                            // } else {
                            //     reset();
                            // }
                            
                        } else {
                            if(currentProfitLossAmount >= profit10){
                                // webSocketConnectionStop();
                                t = getRandomNumber(120,180) * 1000; 
                                setTimer(t);
                                setTimeout(() => {
                                    restart();
                                }, t);
                            } else {
                                reset();
                            }

                            // reset();

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

    const resetParams = () => {
        let capital = null;

        if(savingsElement.value.length > 0){
            capital = initialAccBalance - savingsElement.value;
        } else {
            capital = initialAccBalance;
        }
        market = marketSelectElement.value;
        // stopLossInputElement.value.length > 0 ?  stopLoss = stopLossInputElement.value:stopLoss = stopLoss;
        profit10 = profitPercentageCalculate(capital,10);
        profit25 = profitPercentageCalculate(capital,25);
        profit50 = profitPercentageCalculate(capital,50);
        profit100 = profitPercentageCalculate(capital,100);
        
        targetProfitInputElement.value=profit10.toFixed(2);
       
        // capital = 300;

        console.log('capital - ', capital);

        // let calculatedStake = Math.floor((capital * (0.5/100)) - 0.5);
        // let calculatedStake = (capital * (1/100)) - 1.5;
        let calculatedStake = (capital * (1/100)) - 3.5;
        let inputStake = initialStakeInputElement.value;

        console.log('calculatedStake - ', calculatedStake);
        
        if(calculatedStake < 0.35){
            initialStake = 0.35;
        } else {
            initialStake = calculatedStake;
            initialStakeInputElement.value = initialStake;
        }
        newStake = initialStake;
        console.log('newStake - ', newStake);
        console.log('initialStake - ', initialStake);

        // if(inputStake.length > 0){
        //     initialStake = initialStakeInputElement.value;
        // } else {
        //     if(calculatedStake < 1){
        //         initialStake = 0.35;
        //     } else {
        //         initialStake = calculatedStake;
        //         initialStakeInputElement.value = initialStake;
        //     }
        // }

        // initialStakeInputElement.value = calculatedStake;

        // initialStakeInputElement.value.length > 0 ? initialStake = initialStakeInputElement.value : initialStake = initialStake;
        currentProfitLossAmount = 0;
    };



    const getAuthentication = () => {
        ws.send(JSON.stringify({ authorize: apiToken }));
    };


    const placeTrade = (digitArray, newStake) => {
        // let nextNumberIs = predictNexrEvenOdd(digitArray);
        let tradeState = '';
        tickCount = getRandomNumber(5, 10);
        // nextNumberIs == 'even' ? tradeState = 'DIGITEVEN' : 'DIGITODD';

        // if(nextNumberIs == 'even'){
        //     tradeState = 'DIGITEVEN';
        // } else if(nextNumberIs == 'odd'){
        //     tradeState = 'DIGITODD';
        // }

        if(tradeType == 'even'){
            tradeState = 'DIGITEVEN';
            tradeType = 'odd';
        } else if(tradeType == 'odd'){
            tradeState = 'DIGITODD';
            tradeType = 'even';

        }

        // tradeState = 'DIGITEVEN';


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
        requestTicksHistory(market);
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
        } else if(status == "Win"){
            newStake = initialStake;
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
