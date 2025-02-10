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

const martingaleMultiplier = 2.07112;

let isRunning = false, isAuthenticated = false, intervalId;

// let targetPercentage = 0.08;
// let amountPercentage = 0.1;

let targetPercentage = 10;
let amountPercentage = 8;

if(targetProfitInputElement.value != ""){
    targetPercentage = targetProfitInputElement.value;
}

if(initialStakeInputElement.value != ""){
    amountPercentage = initialStakeInputElement.value;
}


let initialAccountBalance = 0;
let updatedAccountBalance = 0;

let targetAmount = 0;
let amountPutForTrading = 0;

let currentProfitAmount = 0;
let currentLossAmount = 0;
let netProfit = 0;

let stake = 0;
let onTradeCount = 0;

let totalProfitAmount = 0;
let totalLossAmount = 0;

let totalTradeCount = 0;
let winTradeCount = 0;
let lossTradeCount = 0;

let lostCountInRow = 0;

let lastTradeId = null;
let tradeTypeDisplay = null;
let tradeType = "even";
let apiToken = null;
let authSuccess = false;
let isTradeOpen = false;
let automation = false;
let tradeProposal = null;

let stopTimer = false;
let ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");

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

accountSelectElement.value = "lkUxtOopvUhCpIX";
marketSelectElement.value = "R_10";
apiToken = accountSelectElement.value;


accountSelectElement.addEventListener("change", () => {
    apiToken = accountSelectElement.value;
});

market = marketSelectElement.value;

authenticateButton.addEventListener('click', function () {
    authenticateScript();
});

scriptButton.disabled = true;


scriptButton.addEventListener('click', function () {
    runBotScript();
});

function runBotScript() {
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
    scriptButton.innerHTML = "Script running....Stop WebSocket";
    scriptButton.disabled = false;
    startWebSocket()
    
};

function webSocketConnectionStop(){
    setTimer(0);
    setFlashNotification(``, 0);
    isRunning = false;
    clearInterval(intervalId); // Stop the interval loop
    weClose();
    console.log('WebSocket connection stopped.');
    scriptButton.innerHTML = "Start WebSocket";
};



function weClose() {
    if (ws) {
        ws.close();
        ws = null;
    }
}


function authenticateScript() {
    console.log(44444);
    
    if (!isAuthenticated) {
        authenticate();
    }
}


function authenticate() {
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

        // if(isWithinTimeRange()){
        authResponse = JSON.parse(event.data);

        if (authResponse != null) {
            if (authResponse.msg_type === "authorize") {
                console.log("Authorization successful.\n-----------------------------\n\n");
                setFlashNotification("Authorization successful", 0);
                initialAccountBalance = authResponse.authorize.balance;
                updatedAccountBalance = initialAccountBalance;
                setAccountInfo("initialAccountBalance", `$ ${initialAccountBalance}`);
                authenticateButton.innerHTML = "Authenticated. Ready to trade.";
                authenticateButton.disabled = true;
                scriptButton.disabled = false;
                authSuccess = true;
                resetParams();
            }
        }
    };

    const getAuthentication = () => {
        setFlashNotification("Authenticating....", 0);
        console.log("Authenticating....");
        ws.send(JSON.stringify({ authorize: apiToken }));
    };

}



function resetParams() {

    // let hourValue = getHourValue();
    // console.log(hourValue);
    
    // // if (hourValue >= 6 && hourValue <= 11) {
    // //     targetPercentage = 20;
    // //     amountPercentage = 15;
    // // } else {
    // //     // targetPercentage = 0.5;
    // //     // amountPercentage = 1;

    // //     targetPercentage = 0.3;
    // //     amountPercentage = 0.5;
    // // }

    // targetPercentage = 5;
    // amountPercentage = 8;

    targetAmount = (initialAccountBalance * (targetPercentage / 100)).toFixed(2);
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

function getHourValue() {
    const now = new Date();
    const hour = now.getHours(); // Get current hour (0-23)

    return hour; // Returns true if between 5 AM and 4 PM
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