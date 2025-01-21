let isRunning = false,
    intervalId;

const martingaleMultiplier = 2.07112;
let tradeType = "even";
let tradingCapital = 0;
let tradeProposal, lastTradeId;
let stopTimer = false;
let updatedAccountBalance = 0;

let fullAmount = 0;
let targetAmount = 0;
let amountForTrading = 0;

apiToken = 'iVOpdm24hBhw3JI';



scriptButton.addEventListener("click", runScript);

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
    console.log("WebSocket connection started.");
    setFlashNotification("WebSocket connection started", 4);
    scriptButton.innerHTML = "Script running....click to stop";
    setTimeout(() => {
        startWebSocket();
    }, 4000);
}

function webSocketConnectionStop() {
    isRunning = false;
    clearInterval(intervalId); // Stop the interval loop
    setTimer(0);
    weClose();
    console.log("WebSocket connection stopped.");
    // infoOutput.textContent += 'WebSocket connection stopped.\n';
    scriptButton.innerHTML = "Start WebSocket";
}

function startWebSocket() {
    ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");
    apiToken = accountSelectElement.value;
    // market = getRandomMarket(marketArray, market);
    // marketSelectElement.value = market;
    market = marketSelectElement.value;
    currentProfitAmount = 0;
    currentLossAmount = 0;

    ws.onopen = function () {
        // Authenticate
        getAuthentication();
        setFlashNotification("WebSocket connection opened", 0);
    };

    ws.onclose = function () {
        setTimer(0);
        console.log("Connection closed");
        setFlashNotification("Connection closed", 0);
        console.log("-----------------------------\n");
    };

    ws.onerror = function (err) {
        console.error("WebSocket error:", err);
        setFlashNotification(`WebSocket error: ${err.message}`, 0);
    };

    ws.onmessage = function (event) {
        response = JSON.parse(event.data);

        if (response != null) {
            if (response.msg_type === "authorize") {
                console.log(
                    "Authorization successful.\n-----------------------------\n\n"
                );
                setFlashNotification("Authorization successful", 0);
                initialAccBalance = response.authorize.balance;
                updatedAccountBalance = initialAccBalance;
                console.log("initialAccBalance - ", initialAccBalance);
                setAccountInfo("initialAccBalance", `$ ${initialAccBalance}`);
                // resetParams();
                restart();
            }

            if (response.msg_type === 'history') {
                const lastDigitList = response.history.prices;
                console.log('lastDigitList - ', lastDigitList);

                const tradeType = checkLastDigitParity(lastDigitList);
                console.log('tradeType - ',tradeType);

                if(tradeType == 0){
                    setFlashNotification("Analizing...", 0);
                    requestTicksHistory();
                } else {
                    setFlashNotification("", 0);
                    placeTrade(tradeType);
                }
                
            }

            if (response.msg_type === "proposal") {
                if (updatedAccountBalance > 0 && response.echo_req.amount > updatedAccountBalance) {
                    webSocketConnectionStop();
                } else {
                    tradeProposal = response;
                    makeTheTrade();
                }
            }

            if (response.msg_type === "buy") {
                
                if (
                    response.buy == undefined ||
                    response.buy.contract_id == undefined
                ) {
                    // placeTrade(tradeType);
                    placeTrade();
                } else {
                    lastTradeId = response.buy.contract_id;
                    totalTradeCount = totalTradeCount + 1;
                    isTradeOpen = true;

                    if (response.buy.shortcode.includes("DIGITEVEN")) {
                        tradeTypeDisplay = "Even";
                    } else if (response.buy.shortcode.includes("DIGITODD")) {
                        tradeTypeDisplay = "Odd";
                    }

                    setResultNotification(
                        lastTradeId,
                        tradeTypeDisplay,
                        market,
                        response.buy.buy_price
                    );

                    // setAccountInfo('percentage10', `$ ${targetProfit.toFixed(2)}`)
                    console.log("Trade Successful:", response);
                    // scrollToBottom();

                    setTimeout(() => {
                        fetchTradeDetails(lastTradeId);
                    }, 500);
                }
            }

            if (response.msg_type === "proposal_open_contract") {
                if (response.proposal_open_contract.contract_id === lastTradeId) {
                    const contract = response.proposal_open_contract;

                    if (contract.is_sold) {
                        const profit = contract.profit;
                        const result = profit > 0 ? "Win" : "Loss";



                        currentProfitAmount = currentProfitAmount + profit;
                        currentLossAmount = currentLossAmount + profit;
                        if(currentLossAmount >= 0){currentLossAmount = 0;}

                        if( profit > 0){
                            totalProfitAmount = totalProfitAmount + profit;
                            winTradeCount = winTradeCount+1;
                            lostCountInRow = 0;
                        } else if( profit < 0){
                            totalLossAmount = totalLossAmount + profit;
                            lossTradeCount = lossTradeCount+1;
                            lostCountInRow = lostCountInRow + 1;
                        }



                        // currentLossAmount = currentLossAmount + profit;
                        // if (currentLossAmount >= 0) {
                        //     currentLossAmount = 0;
                        // }

                        // if (profit > 0) {
                        //     currentProfitAmount = currentProfitAmount + profit;
                        //     totalProfitAmount = totalProfitAmount + profit;
                        //     winTradeCount = winTradeCount + 1;
                        //     lostCountInRow = 0;
                        // } else if (profit < 0) {
                        //     totalLossAmount = totalLossAmount + profit;
                        //     lossTradeCount = lossTradeCount + 1;
                        //     lostCountInRow = lostCountInRow + 1;
                        // }

                        updatedAccountBalance = updatedAccountBalance + profit;

                        console.log('initialAccBalance - ', initialAccBalance);
                        console.log('updatedAccountBalance - ', updatedAccountBalance);


                        let updatedAccountBalanceDisplay = null;
                        if(updatedAccountBalance > initialAccBalance){
                            updatedAccountBalanceDisplay = `<span class="green">$ ${updatedAccountBalance.toFixed(2)}</span>`;
                        } else if(updatedAccountBalance < initialAccBalance){
                            updatedAccountBalanceDisplay = `<span class="red">$ ${updatedAccountBalance.toFixed(2)}</span>`;
                        }
                        setAccountInfo("updatedBalance",`${updatedAccountBalanceDisplay}`);

                        setAccountInfo("totalTradeCount", `${totalTradeCount}`);
                        setAccountInfo("winCount", `${winTradeCount}`);
                        setAccountInfo("lossCount", `${lossTradeCount}`);


                        let totalProfitAmountDisplay = null;
                        if(totalProfitAmount < 0){
                            totalProfitAmountDisplay = `<span class="red">$ ${totalProfitAmount.toFixed(2)}</span>`;
                        } else if(totalProfitAmount > 0){
                            totalProfitAmountDisplay = `<span class="green">$ ${totalProfitAmount.toFixed(2)}</span>`;
                        }else{
                            totalProfitAmountDisplay = `$ ${totalProfitAmount.toFixed(2)}`;
                        }
                        setAccountInfo("totalProfit", `${totalProfitAmountDisplay}`);



                        let totalLossAmountDisplay = null;
                        if(totalLossAmount < 0){
                            totalLossAmountDisplay = `<span class="red">$ ${totalLossAmount.toFixed(2)}</span>`;
                        } else if(totalLossAmount > 0){
                            totalLossAmountDisplay = `<span class="green">$ ${totalLossAmount.toFixed(2)}</span>`;
                        }else{
                            totalLossAmountDisplay = `$ ${totalLossAmount.toFixed(2)}`;
                        }
                        setAccountInfo("totalLoss", `${totalLossAmountDisplay}`);



                        let currentProfitAmountDisplay = null;
                        if(currentProfitAmount < 0){
                            currentProfitAmountDisplay = `<span class="red">$ ${currentProfitAmount.toFixed(2)}</span>`;
                        } else if(currentProfitAmount > 0){
                            currentProfitAmountDisplay = `<span class="green">$ ${currentProfitAmount.toFixed(2)}</span>`;
                        }else{
                            currentProfitAmountDisplay = `$ ${currentProfitAmount.toFixed(2)}`;
                        }
                        setAccountInfo("currentProfitAmount",`${currentProfitAmountDisplay}`);



                        let currentLossAmountDisplay = null;
                        if(currentLossAmount < 0){
                            currentLossAmountDisplay = `<span class="red">$ ${currentLossAmount.toFixed(2)}</span>`;
                        } else if(currentLossAmount > 0){
                            currentLossAmountDisplay = `<span class="green">$ ${currentLossAmount.toFixed(2)}</span>`;
                        }else{
                            currentLossAmountDisplay = `$ ${currentLossAmount.toFixed(2)}`;
                        }
                        setAccountInfo("currentLossAmount", `${currentLossAmountDisplay}`);

                        // stakeChange(result);
                        setResultNotification(
                            lastTradeId,
                            tradeType,
                            market,
                            contract.buy_price,
                            profit
                        );

                        stakeChange(result);

                        isTradeOpen = false;
                        let t = 0;

                        if (currentLossAmount < 0) {
                            // t = getRandomNumber(1, 5) * 1000;

                            if (lostCountInRow > 3) {
                                // t = getRandomNumber(30, 120) * 1000;
                                // market = getRandomMarket(marketArray, market);
                            } else if (lostCountInRow > 2) {
                                // t = getRandomNumber(10,30) * 1000;
                                // market = getRandomMarket(marketArray, market);
                            } else if (lostCountInRow == 2) {
                                // t = getRandomNumber(2,15) * 1000;
                            }

                            setTimer(t);
                            setTimeout(() => {
                                // restart();
                                // resetSubValues();
                                // resetParams();
                                // requestTicksHistory();
                                placeTrade();
                            }, t);
                        } else {
                            if (currentProfitAmount >= targetAmount) {
                                resetSubValues();
                                // t = 60000 * 60;
                                t = 60000 * 15;
                                setTimer(t);
                                setTimeout(() => {
                                    restartTheBot();
                                }, t + 1000);
                            } else {
                                // t = 2000;
                                resetSubValues();

                                setTimer(t);
                                setTimeout(() => {
                                    restart();
                                }, t);
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

    const stakeChange = (status) => {
        if (status == "Loss") {
            newStake = newStake * martingaleMultiplier;
        } else if (status == "Win") {
            newStake = initialStake;
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
    };

    const restart = () => {
        resetSubValues();
        resetParams();
        // requestTicksHistory();
        placeTrade();
    };

    const restartTheBot = () => {
        setAccountInfo("currentProfitAmount", `-`);
        setAccountInfo("currentLossAmount", `-`);
        webSocketConnectionStop();
        setTimeout(() => {
            webSocketConnectionStart();
        }, 1000);
    };

    const resetSubValues = () => {
        setAccountInfo("amountPutForTrading", `-`);
        setAccountInfo("percentage10", `-`);
        
        // currentProfitAmount = 0;
        // currentLossAmount = 0;
    };

    function resetParams() {
        // if (savingsElement.value.length > 0) {
        //     tradingCapital =
        //         (updatedAccountBalance - updatedAccountBalance * (savingsElement.value / 100)) *
        //         (5 / 100);
        //     console.log(
        //         "reduse amount - ",
        //         updatedAccountBalance * (savingsElement.value / 100)
        //     );
        // } else {
        //     tradingCapital = updatedAccountBalance * (10 / 100);
        // }
        // setAccountInfo("amountPutForTrading", `$ ${tradingCapital.toFixed(2)}`);

        // targetProfit = profitPercentageCalculate(tradingCapital, 10);
        // setAccountInfo("percentage10", `$ ${targetProfit.toFixed(2)}`);

        // initialStake = profitPercentageCalculate(tradingCapital, 11).toFixed(2);
        // initialStake < 0.35 ? (newStake = 0.35) : (newStake = initialStake);

        fullAmount = Math.floor(updatedAccountBalance);
        targetAmount = Math.floor(((fullAmount / 100).toFixed(2) * 5));
        amountForTrading = Math.floor(((fullAmount / 100).toFixed(2) * 3));

        console.log('updatedAccountBalance - ', fullAmount );
        console.log('targetAmount - ', targetAmount);
        console.log('amountForTrading - ', amountForTrading);

        setAccountInfo("amountPutForTrading", `$ ${fullAmount}`);
        setAccountInfo("percentage10", `$ ${targetAmount}`);

        amountForTrading < 0.35 ? (newStake = 0.35) : (newStake = amountForTrading);

        // newStake = amountForTrading;

    }

    const placeTrade = (result = null) => {

        if(result != null){
            if (result == "even") {
                tradeState = "DIGITODD";
            } else if (result == "odd") {
                tradeState = "DIGITEVEN";
            }
        } else {
            if(tradeType == 'even'){
                tradeState = 'DIGITEVEN';
                tradeType = 'odd';
            } else if(tradeType == 'odd'){
                tradeState = 'DIGITODD';
                tradeType = 'even';
            }
        }

        newStake = Number(newStake);
        // tickCount = 1;
        tickCount = getRandomNumber(5, 8);

        const tradeRequest = {
            proposal: 1,
            amount: newStake.toFixed(2),
            basis: "stake",
            contract_type: tradeState, // Use 'DIGITEVEN' for even and 'DIGITODD' for odd
            currency: "USD",
            duration: tickCount,
            duration_unit: "t",
            symbol: market,
        };

        // Send the trade request to the WebSocket
        console.log("Sending Rise/Fall trade request:", tradeRequest);
        ws.send(JSON.stringify(tradeRequest));
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

    const getAuthentication = () => {
        ws.send(JSON.stringify({ authorize: apiToken }));
    };

    const requestTicksHistory = () => {
        const ticksHistoryRequest = {
            ticks_history: market,
            end: 'latest',
            count: 3, // Increased count for a larger dataset (more ticks for better prediction)
            style: 'ticks'
        };
        ws.send(JSON.stringify(ticksHistoryRequest));
    };

}

function setTickCountDown(tickCount, tick) {
    if (tickCount > tick) {
        setFlashNotification(`Trade will close in <span class="number">${tickCount - tick}</span> tick.`,0);
    } else if (tickCount == tick) {
        setFlashNotification(``, 0);
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
        $(".result-notification").prepend(
            `<span class="stake-info" id="${contractId}"><span class="detailt"><span>Contract ID : </span><span class="contract-info">${contractId}</span></span><span class="detailt"><span>Market : </span><span class="contract-info">${marketObj.name}</span></span><span class="detailt"><span>Type : </span><span class="contract-info">${tradeTypeDisplay}</span></span><span class="detailt"><span>Stake : </span><span class="contract-info">${stake}</span></span><span class="detailt"><span>Profit / Loss Amount : </span><span class="contract-info" id="${contractId}-profit"><span class="">-</span></span></span><span class="detailt"><span>Status : </span><span class="contract-info" id="${contractId}-status"><span class="">-</span></span></span></span>`
        );
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

function setTimer(time) {
    var timeleft = time / 1000;
    if(isRunning == false){timeleft = 0;stopTimer = true;}
    var downloadTimer = setInterval(function () {

        if (timeleft <= 0) {
            clearInterval(downloadTimer);
            setFlashNotification(``, 0);
        } else if (timeleft > 0 && stopTimer == false){
            setFlashNotification(
                `Bot will run again in  <span class="number">${timeleft}</span> seconds.`,
                0
            );
        }
        timeleft -= 1;
    }, 1000);
}

function weClose() {
    if (ws) {
        ws.close();
        ws = null;
    }
}


function checkLastDigitParity(numbers) {
    // Extract the last digit of each number
    const lastDigits = numbers.map((num) => Math.floor(num * 10) % 10);

    console.log('lastDigits - ', lastDigits);

    let evenCount = 0;
    let oddCount = 0;

    lastDigits.forEach(digit => {
        digit % 2 === 0 ? evenCount++ : oddCount++;
    });

    if(evenCount == numbers.length){
        return 'even';
    } else if(oddCount == numbers.length){
        return 'odd';
    } else {
        return 0; 
    }
    

    // Check if all last digits are the same
    // const allMatch = lastDigits.every((digit) => digit === lastDigits[0]);
    // console.log('allMatch - ', allMatch);

    // if (allMatch) {
    //     const parity = lastDigits[0] % 2 === 0 ? 'even' : 'odd';
    //     return parity; // Return "even" or "odd" based on the common last digit
    // } else {
    //     return 0; // Return "not matched" if the digits are different
    // }
}