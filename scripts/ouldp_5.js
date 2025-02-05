const WebSocket = require('ws');

const API_URL = 'wss://ws.binaryws.com/websockets/v3?app_id=1089'; // Replace with your app_id
const ws = new WebSocket(API_URL);

let initialStake = 160; // Win Stake
let stopLoss = 1600;
let targetProfit = 1700;
let martingaleFactor = 0.8;
let currentStake = initialStake;
let totalProfit = 0;

ws.onopen = () => {
    console.log('Connected to Deriv WebSocket API');
    requestTicks();
};

function requestTicks() {
    ws.send(JSON.stringify({
        ticks: 'R_75'
    }));
}

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.tick) {
        processTick(data.tick);
    }
};

function processTick(tick) {
    let lastDigit = tick.quote.toString().slice(-1);
    let tradeType = lastDigit >= 5 ? 'DIGITOVER' : 'DIGITUNDER';
    executeTrade(tradeType);
}

function executeTrade(tradeType) {
    if (totalProfit >= targetProfit) {
        console.log('Target profit reached! Stopping the bot.');
        ws.close();
        return;
    }

    let tradeRequest = {
        buy: 1,
        price: currentStake,
        parameters: {
            amount: currentStake,
            basis: 'stake',
            contract_type: tradeType,
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            symbol: 'R_75'
        }
    };

    ws.send(JSON.stringify(tradeRequest));
}

ws.onmessage = (event) => {
    let data = JSON.parse(event.data);
    if (data.buy) {
        handleTradeResponse(data.buy);
    }
};

function handleTradeResponse(response) {
    if (response.payout) {
        let profit = response.payout - currentStake;
        totalProfit += profit;
        console.log(`Trade Result: ${profit >= 0 ? 'Win' : 'Loss'}, Profit: ${profit}`);
        currentStake = profit < 0 ? currentStake * (1 + martingaleFactor) : initialStake;
    }

    if (currentStake > stopLoss) {
        console.log('Stop loss reached! Stopping the bot.');
        ws.close();
    }
}
