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
const scriptButton = document.getElementById('scriptButton');

const martingaleMultiplier = 1.2;

let ws,
    tradeProposal,
    lastTradeId,
    tradeTypeDisplay,
    isRunning = false,
    intervalId,
    isTradeOpen = false,
    automation = false,
    authSuccess = false,
    initialAccountBalance = 0,
    updatedAccountBalance = 0,
    totalTradeCount = 0,
    stake = 1,
    initialStake = 1,
    duration = 4
    ;

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

accountSelectElement.value = "iVOpdm24hBhw3JI";
marketSelectElement.value = "R_10";
apiToken = accountSelectElement.value;
market = marketSelectElement.value;


accountSelectElement.addEventListener("change", () => {
    apiToken = accountSelectElement.value;
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
        wsResponse = JSON.parse(event.data);

        // console.log('wsResponse: ', wsResponse);


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
                // resetParams();
                // scriptButton.innerHTML = "Bot started....";
                // placeTrade();
                // runScript();

                // runMarketAnalysisWithHistory();

                // setTimeout(() => {
                    requestTicksHistory();
                // }, 5000);

            }


            if (wsResponse.msg_type === 'history') {
                const lastDigitList = wsResponse.history.prices;
                let upDownObject = getUpDownCount(lastDigitList);

                // console.log(lastDigitList);

                console.log(upDownObject);

                if (
                    (upDownObject.up < upDownObject.down)
                    && (upDownObject.down >= 7)
                    // && (upDownObject.last == "down")
                ) {
                    console.log('Strong Down');
                    tradeTypeDisplay = "Fall";
                    setTimeout(() => {
                        placeTrade('down');
                    }, 2000);
                } else if (
                    (upDownObject.up > upDownObject.down)
                    && (upDownObject.up >= 7)
                    // && (upDownObject.last == "up")
                ) {
                    console.log('Strong Up');
                    tradeTypeDisplay = "Rise";
                    setTimeout(() => {
                        placeTrade('up');
                    }, 2000);
                } else {
                    console.log('Analizing....');
                    setTimeout(() => {
                        requestTicksHistory();
                    }, 2000);
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

                    console.log(contract);

                    if (contract.is_sold) {
                        isTradeOpen = false;
                        const profit = contract.profit;
                        const result = profit > 0 ? "Win" : "Loss";
                        // setInfo(contract, profit);
                        // stakeChange(result);

                        setResultNotification(
                            lastTradeId,
                            tradeTypeDisplay,
                            market,
                            contract.buy_price,
                            profit
                        );

                        if(profit < 0){
                            // market = getRandomMarket(marketArray, market);
                        }


                        setTimeout(() => {
                            requestTicksHistory();
                        }, 5000);
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



    const getAuthentication = () => {
        setFlashNotification("Authenticating....", 0);
        console.log("Authenticating....");
        ws.send(JSON.stringify({ authorize: apiToken }));
    };

    const requestTicksHistory = () => {
        const ticksHistoryRequest = {
            ticks_history: market,
            end: 'latest',
            count: 11, // Increased count for a larger dataset (more ticks for better prediction)
            style: 'ticks'
        };
        ws.send(JSON.stringify(ticksHistoryRequest));
    };


    const placeTrade = (direction) => {
        if (isTradeOpen == false) {

            let tradeType;

            if (direction == "up") {
                tradeType = 'CALL';
            } else if (direction == "down") {
                tradeType = 'PUT';
            }

            stake = Number(stake);
            stake < 0.35 ? (stake = 0.35) : (stake = stake);


            const tradeRequest = {
                proposal: 1,
                amount: stake.toFixed(2),
                basis: "stake",
                contract_type: tradeType, // Use 'CALL' for rise and 'PUT' for fall
                currency: "USD",
                duration: duration,
                duration_unit: "t",
                symbol: market,
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

    const stakeChange = (status) => {
        if (status == "Loss") {
            stake = stake * martingaleMultiplier;
        } else if (status == "Win") {
            stake = initialStake;
        }
    };
    


};


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

function getUpDownCount(data) {
    let result = { up: 0, down: 0, last: '' };

    for (let i = 1; i < data.length; i++) {
        if (data[i] > data[i - 1]) {
            result.up++;
        } else if (data[i] < data[i - 1]) {
            result.down++;
        }
    }

    if (data.length > 1) {
        result.last = data[data.length - 1] > data[data.length - 2] ? 'up' : 'down';
    }

    return result;
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

function setTickCountDown(tickCount, tick) {
    if (tickCount > tick) {
        setFlashNotification(`Trade will close in <span class="number">${tickCount - tick}</span> tick.`, 0);
    } else if (tickCount == tick) {
        setFlashNotification(``, 0);
    }
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



function analyzeMarketsWithHistory(callback) {
    const markets = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'];
    const marketVolatility = {};
    let processedMarkets = 0;
  
    // Fetch historical ticks for a specific market
    function fetchHistoricalTicks(market) {
        const marketWs = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");
  
        marketWs.onopen = () => {
            const ticksHistoryRequest = {
                ticks_history: market,
                end: 'latest',
                count: 100, // Number of historical ticks
                style: 'ticks'
            };
            marketWs.send(JSON.stringify(ticksHistoryRequest));
        };
  
        marketWs.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.history && data.history.prices) {
                marketWs.close();
                calculateVolatility(market, data.history.prices);
            } else if (data.error) {
                console.error(`Error fetching data for ${market}: ${data.error.message}`);
                marketWs.close();
                calculateVolatility(market, []); // Handle as empty data
            }
        };
  
        marketWs.onerror = (err) => {
            console.error(`WebSocket error for ${market}: ${err.message}`);
            marketWs.close();
            calculateVolatility(market, []); // Handle as empty data
        };
    }
  
    // Calculate the standard deviation for the given tick data
    function calculateVolatility(market, tickData) {
        if (tickData.length === 0) {
            marketVolatility[market] = Infinity; // Mark as invalid
        } else {
            const priceChanges = tickData.map((tick, index) => {
                if (index === 0) return 0; // No change for the first tick
                return Math.abs(tick - tickData[index - 1]);
            }).slice(1); // Remove the first entry (0)
  
            const mean = priceChanges.reduce((sum, value) => sum + value, 0) / priceChanges.length;
            const variance = priceChanges.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / priceChanges.length;
            const standardDeviation = Math.sqrt(variance);
            marketVolatility[market] = standardDeviation;
        }
  
        processedMarkets += 1;
  
        // When all markets are processed, return results via callback
        if (processedMarkets === markets.length) {
            const sortedMarkets = Object.entries(marketVolatility).sort((a, b) => a[1] - b[1]);
            const mostStable = sortedMarkets[0];
            const mostVolatile = sortedMarkets[sortedMarkets.length - 1];
  
            console.log('Market Volatility Analysis:', marketVolatility);
            console.log(`Most Stable Market: ${mostStable[0]}, Volatility: ${mostStable[1]}`);
            console.log(`Most Volatile Market: ${mostVolatile[0]}, Volatility: ${mostVolatile[1]}`);

            // market = getMarketByValue(mostVolatile[0]);
  
            if (callback) {
                callback({
                    mostStable: { market: mostStable[0], volatility: mostStable[1] },
                    mostVolatile: { market: mostVolatile[0], volatility: mostVolatile[1] },
                    marketVolatility,
                });
            }
        }
    }
  
    // Start fetching historical ticks for all markets
    for (const market of markets) {
        fetchHistoricalTicks(market);
    }
  }
  
  // Example: Use the function with a callback
  function runMarketAnalysisWithHistory() {
    analyzeMarketsWithHistory((result) => {
        market = result.mostStable.market;
        mostStableMarket = result.mostStable.market;
        // infoOutput.innerHTML += `Most Stable Market: ${result.mostStable.market}, Volatility: ${result.mostStable.volatility}\n`;
        // infoOutput.innerHTML += `Most Volatile Market: ${result.mostVolatile.market}, Volatility: ${result.mostVolatile.volatility}\n`;
    });
  }

  function getMarketByValue(value) {
    return marketArray.find(market => market.value === value);
}