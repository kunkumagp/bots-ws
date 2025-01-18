let isRunning = false,
    intervalId;

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
    weClose();
    console.log("WebSocket connection stopped.");
    // infoOutput.textContent += 'WebSocket connection stopped.\n';
    // scriptButton.innerHTML = "Start WebSocket";
}

function startWebSocket() {
    const martingaleMultiplier = 2.07112;
    let tradeType = "even";
    let tradingCapital = 0;
    let targetProfit = 0;
    let curruntLoss = 0;
    let tradeProposal, lastTradeId;

    ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");
    apiToken = accountSelectElement.value;
    market = getRandomMarket(marketArray, market);
    marketSelectElement.value = market;

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
                console.log('initialAccBalance - ', initialAccBalance);
                setAccountInfo("initialAccBalance", `$ ${initialAccBalance}`);
                resetParams();
                placeTrade();
            }

            if (response.msg_type === "proposal") {
                if (newAccBalance > 0 && response.echo_req.amount > newAccBalance) {
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
                    placeTrade();
                } else {
                    lastTradeId = response.buy.contract_id;
                    totalTradeCount = totalTradeCount + 1;
                    isTradeOpen = true;

                    if (response.buy.shortcode.includes("DIGITEVEN")) {
                        tradeType = "Even";
                    } else if (response.buy.shortcode.includes("DIGITODD")) {
                        tradeType = "Odd";
                    }

                    // infoOutput.innerHTML += `Trade started:\nContract ID = ${lastTradeId}, Stake = ${response.buy.buy_price}, Market = ${market}, Teade Type = ${tradeType}\n`;
                    setResultNotification(
                        lastTradeId,
                        tradeType,
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
                        const result = profit > 0 ? 'Win' : 'Loss';

                        currentProfitLossAmount = currentProfitLossAmount + profit;
                        curruntLoss = curruntLoss + profit;
                        if (curruntLoss >= 0) {
                            curruntLoss = 0;
                        }

                        if (profit > 0) {
                            totalProfitAmount = totalProfitAmount + profit;
                            winTradeCount = winTradeCount + 1;
                            lostCountInRow = 0;
                        } else if (profit < 0) {
                            totalLossAmount = totalLossAmount + profit;
                            lossTradeCount = lossTradeCount + 1;
                            lostCountInRow = lostCountInRow + 1;
                        }

                        console.log("curruntLoss - ", curruntLoss);


                        setAccountInfo("updatedBalance", `$ ${initialAccBalance + currentProfitLossAmount}`);
                        setAccountInfo("totalTradeCount", `$ ${totalTradeCount}`);
                        setAccountInfo("winCount", `$ ${winTradeCount}`);
                        setAccountInfo("lossCount", `$ ${lossTradeCount}`);
                        setAccountInfo("totalProfit", `$ ${totalProfitAmount}`);
                        setAccountInfo("totalLoss", `$ ${totalLossAmount}`);
                        setAccountInfo("currentProfitLossAmount", `$ ${currentProfitLossAmount}`);
                        setAccountInfo("curruntLoss", `$ ${curruntLoss}`);




                        // stakeChange(result);
                        setResultNotification(
                            lastTradeId,
                            tradeType,
                            market,
                            contract.buy_price,
                            profit
                        );

                        newAccBalance = initialAccBalance + currentProfitLossAmount;

                        stakeChange(result);

                        isTradeOpen = false;
                        let t = 0;

                        if(curruntLoss < 0){
                            t = getRandomNumber(1,5) * 1000; 

                            if(lostCountInRow > 3){ 
                                t = getRandomNumber(30,120) * 1000; 
                                // market = getRandomMarket(marketArray, market);
                            }
                            else if(lostCountInRow > 2){ 
                                // t = getRandomNumber(10,30) * 1000; 
                                // market = getRandomMarket(marketArray, market); 
                            }
                            else if(lostCountInRow == 2){ 
                                // t = getRandomNumber(2,15) * 1000; 
                            }

                            setTimer(t);
                            setTimeout(() => {
                                placeTrade();
                            }, t);
                        } else{
                            if(currentProfitLossAmount >= profit10){
                                t = 10 * 1000; 
                                setTimer(t);
                                setTimeout(() => {
                                    restart();
                                }, (t + 1000));
                            } else {
                                t = 2000; 
                                setTimer(t);
                                setTimeout(() => {
                                    placeTrade();
                                }, t);
                            }
                        }

                        // placeTrade();
                    } else {
                        setTimeout(() => {

                            setTickCountDown(contract.tick_count, contract.tick_stream.length);
                            fetchTradeDetails(lastTradeId);
                        }, 1000);
                    }
                }
            }
        }
    };

    const stakeChange = (status) => {
        if(status == "Loss"){
            newStake = newStake * martingaleMultiplier;
        } else if(status == "Win"){
            newStake = initialStake;
            // setNewStake();
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
        if(isRunning){
            webSocketConnectionStop();
            setTimeout(() => {
                webSocketConnectionStart();
            }, 1000);
        }
        
    };

    function resetParams() {
        if (savingsElement.value.length > 0) {
            tradingCapital =
                (initialAccBalance - initialAccBalance * (savingsElement.value / 100)) *
                (5 / 100);
            console.log(
                "reduse amount - ",
                initialAccBalance * (savingsElement.value / 100)
            );
        } else {
            tradingCapital = initialAccBalance * (5 / 100);
        }
        setAccountInfo(
            "amountPutForTrading",
            `$ ${tradingCapital.toFixed(2)}`
        );

        targetProfit = profitPercentageCalculate(tradingCapital, 10);
        setAccountInfo("percentage10", `$ ${targetProfit.toFixed(2)}`);

        // initialStakeInputElement.value.length > 0 ? initialStake = initialStakeInputElement.value : initialStake = initialStake;
        initialStake = profitPercentageCalculate(tradingCapital, 11).toFixed(2);
        initialStake < 0.35 ? (newStake = 0.35) : (newStake = initialStake);

        // console.log("initialAccBalance - ", initialAccBalance);
        // console.log("tradingCapital - ", tradingCapital);
        // console.log("targetProfit - ", targetProfit);
        // console.log("initialStake - ", initialStake);
        // console.log("newStake - ", newStake);
    }

    const placeTrade = () => {
        if (tradeType == "even") {
            tradeState = "DIGITEVEN";
            tradeType = "odd";
        } else if (tradeType == "odd") {
            tradeState = "DIGITODD";
            tradeType = "even";
        }

        newStake = Number(newStake);
        tickCount = 1;

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
}


function setTickCountDown(tickCount, tick) {
    if (tickCount > tick) {
        setFlashNotification(`Trade will close in <span class="number">${tickCount - tick}</span> tick.`, 0);

        // $(".tickCountLabel").removeClass("hide");
        // $(".tickCountLabel").addClass("show");
    
        // $(".countdownlabel").removeClass("show");
        // $(".countdownlabel").addClass("hide");
    
        // document.getElementById("tickCountdown").innerHTML = tickCount - tick;
      } else if (tickCount == tick) {
        setFlashNotification(``, 0);

        // document.getElementById("countdown").innerHTML = "";
        // $(".tickCountLabel").removeClass("show");
        // $(".tickCountLabel").addClass("hide");
      }
}

function setAccountInfo(elementId, message) {
    document.getElementById(elementId).innerHTML = message;
}

function setResultNotification(
    contractId,
    tradeType,
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

        if(profit >= 0){
            newClassName = "green";
            status = "WIN" ;
        } else if(profit < 0){
            newClassName = "red";
            status = "LOSS" ;
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

        $(".result-notification").append(
            `<span class="stake-info" id="${contractId}"><span class="detailt"><span>Contract ID : </span><span class="contract-info">${contractId}</span></span><span class="detailt"><span>Market : </span><span class="contract-info">${marketObj.name}</span></span><span class="detailt"><span>Type : </span><span class="contract-info">${tradeType}</span></span><span class="detailt"><span>Stake : </span><span class="contract-info">${stake}</span></span><span class="detailt"><span>Profit / Loss Amount : </span><span class="contract-info" id="${contractId}-profit"><span class="">-</span></span></span><span class="detailt"><span>Status : </span><span class="contract-info" id="${contractId}-status"><span class="">-</span></span></span></span>`
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
  var downloadTimer = setInterval(function () {
    if (timeleft <= 0) {
      clearInterval(downloadTimer);
    //   document.getElementById("countdown").innerHTML = "Now";
    //   $(".countdownlabel").removeClass("show");
    //   $(".countdownlabel").addClass("hide");
    setFlashNotification(``, 0);

    } else {
    //   $(".countdownlabel").removeClass("hide");
    //   $(".countdownlabel").addClass("show");
    //   $(".tickCountLabel").removeClass("show");
    //   $(".tickCountLabel").addClass("hide");
    //   document.getElementById("countdown").innerHTML = timeleft;

    setFlashNotification(`Bot will run again in  <span class="number">${timeleft}</span> seconds.`, 0);

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
