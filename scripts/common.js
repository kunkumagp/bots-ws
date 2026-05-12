function getRandomMarket(array, current) {
    let randomIndex;
    let randomMarket;

    do {
        randomIndex = Math.floor(Math.random() * array.length);
        randomMarket = array[randomIndex];
    } while (randomMarket === current);

    return randomMarket.value;
};

const getAuthentication = () => {
    setFlashNotification("Authenticating....", 0);
    console.log("Authenticating....");
    ws.send(JSON.stringify({ authorize: apiToken }));
};

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

function resetParams() {
    targetAmount = (initialAccountBalance * (targetPercentage)).toFixed(2);
    setAccountInfo("targetAmount", `$ ${targetAmount}`);
    amountPutForTrading = (initialAccountBalance * (amountPercentage)).toFixed(2);
    setAccountInfo("amountPutForTrading", `$ ${amountPutForTrading}`);
    stake = amountPutForTrading;
}





const placeEvenOddTrade = (selectedContractType = "even") => {
    if (isTradeOpen == false) {
        const tradeState = selectedContractType === "odd" ? "DIGITODD" : "DIGITEVEN";

        stake = Number(stake);
        stake < 0.35 ? (stake = 0.35) : (stake = stake);
        tickCount = 1;
        // tickCount = getRandomNumber(1, 3);
        

        const tradeRequest = {
            proposal: 1,
            amount: stake.toFixed(2),
            basis: "stake",
            contract_type: tradeState,
            currency: "USD",
            duration: tickCount,
            duration_unit: "t",
            symbol: market,
        };

        console.log("Sending Rise/Fall trade request:", tradeRequest);
        ws.send(JSON.stringify(tradeRequest));
    }

};

function placeTheTrade(contractType) {
    if (isTradeOpen) return;
    pendingContractType = contractType;
    console.log('Preparing proposal for contract type :', contractType);
    placeEvenOddTrade(contractType);
}

const makeTheTrade = (tradeProposal, contractType) => {
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
        console.log('buyRequest: ', buyRequest);

        ws.send(JSON.stringify(buyRequest));
        pendingContractType = null;
    }
};

const stakeChange = (status) => {
    if (status == "Loss") {
        stake = stake * martingaleMultiplier;
    } else if (status == "Win") {
        stake = amountPutForTrading;
    }
};


const stakeChangeForTotal = (status) => {
    if (status == "Loss") {
        const storedLost = parseFloat(localStorage.getItem('totalLostAmount')) || 0;
        if (storedLost !== 0) {
            const calcStake = Number(((Math.abs(storedLost) / 80) * 100).toFixed(2));
            stake = calcStake;
        }
    } else if (status == "Win") {
        stake = amountPutForTrading;
    }
};

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

    if (dayTarget > 0 && netProfit >= dayTarget) {
        console.log(`Day target reached. Net profit: ${netProfit.toFixed(2)} / Target: ${dayTarget}`);
        setFlashNotification("Day target reached. Reloading page...", 0);
        setTimeout(() => {
            reload();
        }, 1000);
    }

    if (lastTradeProfit > 0) {
        winTradeCount = winTradeCount + 1;
        totalProfitAmount = totalProfitAmount + lastTradeProfit;
    } else if (lastTradeProfit < 0) {
        lossTradeCount = lossTradeCount + 1;
        totalLossAmount = totalLossAmount + lastTradeProfit;

        // persist running total of losses (stored as negative value) in localStorage under key 'totalLostAmount'
        try {
            const stored = parseFloat(localStorage.getItem('totalLostAmount')) || 0;
            const updated = stored + lastTradeProfit; // lastTradeProfit is negative
            localStorage.setItem('totalLostAmount', updated.toFixed(2));
        } catch (e) {}
    }

    // If we won, reduce persisted totalLostAmount (move towards zero)
    if (lastTradeProfit > 0) {
        try {
            let stored = parseFloat(localStorage.getItem('totalLostAmount')) || 0;
            if (stored !== 0) {
                stored = stored + lastTradeProfit; // add positive profit to negative stored value
                if (stored >= 0) {
                    stored = 0;
                }
                localStorage.setItem('totalLostAmount', stored.toFixed(2));
                // if recovered fully, restore stake to normal trading amount
                if (stored === 0) {
                    try { stake = amountPutForTrading; } catch (e) {}
                    try { if (initialStakeInputElement) initialStakeInputElement.value = stake; } catch (e) {}
                }
            }
        } catch (e) {}
    }

    setResultNotification(
        lastTradeId,
        contractType === "DIGITODD" ? "Odd" : "Even",
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

function setTimer(time) {
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
}

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

function reload() {
    location.reload();
}

