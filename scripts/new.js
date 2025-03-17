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
const scriptButton = document.getElementById("scriptButton");
const infoOutput = document.getElementById("info_output");

const params = new URLSearchParams(window.location.search);
const tokenValue = params.get('token');
const dTargetValue = params.get('dtarget');

let 
    targetPercentage,
    amountPercentage,
    tickHistoryCount = 250
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

accountSelectElement.value = 'lkUxtOopvUhCpIX';
// accountSelectElement.value = tokenValue;
marketSelectElement.value = "R_10";


let ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");


apiToken = accountSelectElement.value;


accountSelectElement.addEventListener("change", () => {
    apiToken = accountSelectElement.value;
});

// market = marketSelectElement.value;
market = getRandomMarket(marketArray, '');


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

    if (wsResponse != null) {

        console.log('wsResponse: ', wsResponse);


        if (wsResponse.msg_type === "authorize") {
            console.log("Authorization successful.\n-----------------------------\n\n");
            setFlashNotification("Authorization successful", 0);
            initialAccountBalance = wsResponse.authorize.balance;
            updatedAccountBalance = initialAccountBalance;
            setAccountInfo("initialAccountBalance", `$ ${initialAccountBalance}`);
            authSuccess = true;
            authenticateButton.innerHTML = "Authenticated. Ready to trade.";
            authenticateButton.disabled = true;

            resetParams();

            requestTicksHistory(market);
         
        }

        if (wsResponse.msg_type === 'history') {
            const lastDigitList = wsResponse.history.prices;
            console.log('lastDigitList: ', lastDigitList);

            let lastDigitArray = getLastDigitArray(lastDigitList);
            console.log('lastDigitArray: ', lastDigitArray);

            let probability = calculateProbability(lastDigitArray);

            if(probability.probabilityNext10Even > probability.probabilityNext10Odd){
                console.log('Even');
            } else if(probability.probabilityNext10Even < probability.probabilityNext10Odd){
                console.log('Odd');
            }



            // try {
            //     const nextNumber = predictNextNumbers(lastDigitArray);
            //     console.log("Predicted next number:", nextNumber);

            // } catch (error) {
            //     console.error(error.message);
            // }

        }



    }
};

const getAuthentication = () => {
    setFlashNotification("Authenticating....", 0);
    console.log("Authenticating....");
    ws.send(JSON.stringify({ authorize: apiToken }));
};

const requestTicksHistory = (symbol) => {
    const ticksHistoryRequest = {
        ticks_history: symbol,
        end: 'latest',
        count: tickHistoryCount, // Increased count for a larger dataset (more ticks for better prediction)
        style: 'ticks'
    };
    ws.send(JSON.stringify(ticksHistoryRequest));
};



function getRandomMarket(array, current) {
    let randomIndex;
    let randomMarket;

    do {
        randomIndex = Math.floor(Math.random() * array.length);
        randomMarket = array[randomIndex];
    } while (randomMarket === current);

    return randomMarket.value;
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
    targetAmount =  (initialAccountBalance * (targetPercentage / 100)).toFixed(2);
    setAccountInfo("targetAmount", `$ ${targetAmount}`);
    amountPutForTrading = (initialAccountBalance * (amountPercentage / 100)).toFixed(2);
    setAccountInfo("amountPutForTrading", `$ ${amountPutForTrading}`);
    stake = amountPutForTrading;
}



function getLastDigitArray(numbers) {
    // Step 1: Remove decimal points and convert to integers
    const integerNumbers = numbers.map(num => {
        // Convert number to string, remove decimal, and parse as integer
        return parseInt(num.toString().replace('.', ''), 10);
    });

    // Step 2: Find the maximum length of the numbers
    const maxLength = Math.max(...integerNumbers.map(num => num.toString().length));

    // Step 3: Get the last digit of each number, pad with 0 if necessary
    const lastDigits = integerNumbers.map(num => {
        const numStr = num.toString();
        // If the number's length is less than maxLength, pad with 0
        if (numStr.length < maxLength) {
            return 0; // Pad with 0 as per your requirement
        }
        // Otherwise, get the last digit
        return parseInt(numStr[numStr.length - 1], 10);
    });

    return lastDigits;
}


function predictNextNumbers(sequence) {
    if (sequence.length < 2) {
        throw new Error("Not enough data to make a prediction.");
    }

    // Step 1: Prepare data for linear regression
    const X = sequence.map((_, index) => index); // Independent variable (index)
    const y = sequence; // Dependent variable (sequence values)

    // Step 2: Calculate linear regression coefficients (y = mx + b)
    const n = X.length;
    const sumX = X.reduce((acc, val) => acc + val, 0);
    const sumY = y.reduce((acc, val) => acc + val, 0);
    const sumXY = X.reduce((acc, val, i) => acc + val * y[i], 0);
    const sumX2 = X.reduce((acc, val) => acc + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Step 3: Predict the next 10 numbers
    const nextNumbers = [];
    for (let i = 0; i < 10; i++) {
        const nextIndex = X.length + i; // Next index after the last one
        const nextNumber = slope * nextIndex + intercept;
        nextNumbers.push(parseFloat(nextNumber.toFixed())); // Keep 2 decimal places
    }

    return nextNumbers;
}


function calculateProbability(data) {
    // Count the number of even and odd numbers in the dataset
    let evenCount = 0;
    let oddCount = 0;

    for (let num of data) {
        if (num % 2 === 0) {
            evenCount++;
        } else {
            oddCount++;
        }
    }

    // Calculate the probability of the next number being even or odd
    const totalNumbers = data.length;
    const probabilityEven = evenCount / totalNumbers;
    const probabilityOdd = oddCount / totalNumbers;

    // Calculate the probability of the next 10 numbers being even or odd
    const probabilityNext10Even = Math.pow(probabilityEven, 10);
    const probabilityNext10Odd = Math.pow(probabilityOdd, 10);

    return {
        probabilityNext10Even,
        probabilityNext10Odd
    };
}