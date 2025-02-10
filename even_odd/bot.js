function startWebSocket() {

    if(isWithinTimeRange()){

        ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");

        // market = getRandomMarket(marketArray, '');


        ws.onopen = function () {
            console.log("Connection open");
            reAuthentication();
            
            if (!isAuthenticated) {
                runScript();
            } else {
                location.reload();
            }
        };

        ws.onclose = function () {
            // setTimer(0);
            // setFlashNotification(`Bot has stoped.`, 0);

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
                    updateParams();
                }

                // if (wsResponse.msg_type === "authorize") {
                //     console.log("Authorization successful.\n-----------------------------\n\n");
                //     setFlashNotification("Authorization successful", 0);
                //     initialAccountBalance = wsResponse.authorize.balance;
                //     updatedAccountBalance = initialAccountBalance;
                //     setAccountInfo("initialAccountBalance", `$ ${initialAccountBalance}`);
                //     authSuccess = true;
                //     // authenticateButton.innerHTML = "Authenticated. Ready to trade.";
                //     // authenticateButton.disabled = true;
                //     resetParams();
                //     // scriptButton.innerHTML = "Bot started....";
                //     // placeTrade();
                //     runScript();
                // }


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

                            if (profit < 0) {
                                lostCountInRow = lostCountInRow + 1;
                            }


                            if (currentLossAmount < 0) {
                                if (lostCountInRow >= 2) {
                                    let newTime = (getRandomNumber(30, 40) * 1000);
                                    setTimer(newTime);
                                    setTimeout(() => {
                                        runScript();
                                    }, newTime);
                                } else {
                                    runScript();
                                }
                            } else {
                                if (currentProfitAmount >= targetAmount) {
                                    let newTime = (getRandomNumber(180, 300) * 1000);
                                    // let newTime = (getRandomNumber(5, 8) * 1000);
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
            // }

        };

        
    } else {
        let message = "Time is not good for trading...";
        console.log(message);
        setFlashNotification(message, 0);
        
        authenticateButton.innerHTML = "Authenticate.";
        authenticateButton.disabled = false;

        scriptButton.innerHTML = "Start WebSocket.";
        scriptButton.disabled = true;
}


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

    const reAuthentication = () => {
        console.log("loggin....");
        ws.send(JSON.stringify({ authorize: apiToken }));
    };


    function runScript() {
        isRunning = true;
        placeTrade();
    }

    function reload() {
        // location.reload();
        startWebSocket();
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
        if(time > 0){

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
                    setFlashNotification(`Bot will run again in <span class="number">${formattedTime}</span>.`, 0);
                }
                timeleft -= 1;
            }, 1000);
        } else {
            timeleft = 0;
            stopTimer = true;
        }

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
            setFlashNotification(`Trade will close in <span class="number">${tickCount - tick}</span> tick.`, 0);
        } else if (tickCount == tick) {
            setFlashNotification(``, 0);
        }
    }

    function setInfo(contract, lastTradeProfit) {
        updatedAccountBalance = updatedAccountBalance + lastTradeProfit;


        currentProfitAmount = currentProfitAmount + lastTradeProfit;
        currentLossAmount = currentLossAmount + lastTradeProfit;
        if (currentLossAmount >= 0) { currentLossAmount = 0; }

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

        return hour >= 5 && hour < 19; // Returns true if between 5 AM and 4 PM
    }

    function getRandomMarket(array, current) {
        let randomIndex;
        let randomMarket;
    
        do {
            randomIndex = Math.floor(Math.random() * array.length);
            randomMarket = array[randomIndex];
        } while (randomMarket === current);
    
        return randomMarket.value;
    };
    
   
    function getHourValue() {
        const now = new Date();
        const hour = now.getHours(); // Get current hour (0-23)
    
        return hour; // Returns true if between 5 AM and 4 PM
    }

        
    function updateParams() {

        let hourValue = getHourValue();
        if (hourValue >= 6 && hourValue <= 9) {
            targetPercentage = 4;
            amountPercentage = 5;
        } else {
            // targetPercentage = 0.5;
            // amountPercentage = 1;

            targetPercentage = 0.3;
            amountPercentage = 0.5;
        }

        targetAmount = (updatedAccountBalance * (targetPercentage / 100)).toFixed(2);
        setAccountInfo("targetAmount", `$ ${targetAmount}`);
        amountPutForTrading = (updatedAccountBalance * (amountPercentage / 100)).toFixed(2);
        setAccountInfo("amountPutForTrading", `$ ${amountPutForTrading}`);
        stake = amountPutForTrading;
    }

}