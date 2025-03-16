
let tradeType;



const accounts = [
    { name: "KunkumaGP", value: "lkUxtOopvUhCpIX" },
    { name: "KUNKUMAGP Real", value: "Y71P0GIOxz3YYvr" },
    { name: "Kunkuma Trading", value: "hJfU1x5xpoSTwHe" },
    { name: "W H K G Prasanna 85", value: "iVOpdm24hBhw3JI" },
];

let marketArray = [
    { value: "R_10", name: "Volatility 10 Index" },
    { value: "1HZ10V", name: "Volatility 10 (1s) Index" },
    { value: "R_25", name: "Volatility 25 Index" },
    { value: "1HZ25V", name: "Volatility 25 (1s) Index" },
    { value: "R_50", name: "Volatility 50 Index" },
    { value: "1HZ50V", name: "Volatility 50 (1s) Index" },
    { value: "R_75", name: "Volatility 75 Index" },
    { value: "1HZ75V", name: "Volatility 75 (1s) Index" },
    { value: "R_100", name: "Volatility 100 Index" },
    { value: "1HZ100V", name: "Volatility 100 (1s) Index" },
];

const lastDigits = [
    { name: 0, value: 0 },
    { name: 1, value: 1 },
    { name: 2, value: 2 },
    { name: 3, value: 3 },
    { name: 4, value: 4 },
    { name: 5, value: 5 },
    { name: 6, value: 6 },
    { name: 7, value: 7 },
    { name: 8, value: 8 },
    { name: 9, value: 9 },
];



const accountSelectElement = document.getElementById("account_select");
const marketSelectElement = document.getElementById("market");
const targetProfitInputElement = document.getElementById("target_profit");
const initialStakeInputElement = document.getElementById("initial_stake");
const authenticateButton = document.getElementById("authenticateButton");
const scriptButton = document.getElementById("scriptButton");
const infoOutput = document.getElementById("info_output");
const lowestDigitSelectElement = document.getElementById("lowest_digit");





accounts.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value; // Set the value
    if(item.value == "lkUxtOopvUhCpIX"){
        option.selected = true;
    }
    option.textContent = item.name; // Set the display text
    accountSelectElement.appendChild(option); // Append to the <select>
});

marketArray.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value; // Set the value
    if(item.value == "1HZ100V"){
        option.selected = true;
    }
    option.textContent = item.name; // Set the display text
    marketSelectElement.appendChild(option); // Append to the <select>
});

lastDigits.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value; // Set the value
    option.textContent = item.name; // Set the display text
    lowestDigitSelectElement.appendChild(option); // Append to the <select>
});

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

function resetParams() {
    targetAmount =  (initialAccountBalance * (targetPercentage / 100)).toFixed(2);
    setAccountInfo("targetAmount", `$ ${targetAmount}`);
    amountPutForTrading = (initialAccountBalance * (amountPercentage / 100)).toFixed(2);
    setAccountInfo("amountPutForTrading", `$ ${amountPutForTrading}`);
    stake = amountPutForTrading;
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

        if (profit > 0) {
            newClassName = "green";
            status = "WIN";
        } else if (profit < 0) {
            newClassName = "red";
            status = "LOSS";
        } else {
            newClassName = "";
            status = "-";
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
            setFlashNotification(`Bot will run again in <span class="number">${formattedTime}</span>.`,0);
        }
        timeleft -= 1;
    }, 1000);
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
        setFlashNotification(`Trade will close in <span class="number">${tickCount - tick}</span> tick.`,0);
    } else if (tickCount == tick) {
        setFlashNotification(``, 0);
    }
}

function setInfo(contract, lastTradeProfit) {
    updatedAccountBalance = updatedAccountBalance + lastTradeProfit;


    currentProfitAmount = currentProfitAmount + lastTradeProfit;
    currentLossAmount = currentLossAmount + lastTradeProfit;
    if(currentLossAmount >= 0){currentLossAmount = 0;}

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

    let returnHours;
    if((hour >= 6 && hour < 11) || (hour >= 13 && hour < 18) || (hour >= 20 && hour < 23)){
        returnHours = true;
    } else {
        returnHours = false;
    }


    return returnHours; // Returns true if between 5 AM and 4 PM
}

function getRandomMarket(array, current){
    let randomIndex;
    let randomMarket;
  
    do {
      randomIndex = Math.floor(Math.random() * array.length);
      randomMarket = array[randomIndex];
    } while (randomMarket === current);
  
    return randomMarket.value;
  };



  function getLastDigitPercentage(arr) {
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

    // Get last digit of the last value in the array
    let lastDigitOfLastValue = lastDigits[lastDigits.length - 1];

    // Count occurrences of each digit (0-9)
    let counts = Array(10).fill(0);
    lastDigits.forEach(digit => counts[digit]++);

    // Convert to percentage
    let percentages = {};
    let minPercentage = 100;
    let minDigit = null;
    let minCount = 0;
    let total = arr.length;
    
    counts.forEach((count, digit) => {
        let percentage = (count / total) * 100;
        percentages[digit] = percentage;

        // Track the lowest percentage digit
        if (percentage < minPercentage) {
            minPercentage = percentage;
            minDigit = digit;
            minCount = 1;
        } else if (percentage === minPercentage) {
            minCount++; // More than one digit has the same lowest percentage
        }
    });

    // Only return minDigit if it's unique and below 8.7%
    if (minCount > 1 || minPercentage >= 8) {
        minDigit = null;
    }

    return { 
        percentages, 
        lowest: minDigit, 
        lastDigitOfLastValue 
    };
}

function getLowestNonZeroIndex(arr) {
    let minIndex = -1;
    let minValue = Infinity;

    for (let i = 0; i < arr.length; i++) {
        if (arr[i] > 0 && arr[i] < minValue) {
            minValue = arr[i];
            minIndex = i;
        }
    }

    return minIndex;
}