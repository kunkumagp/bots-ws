// Replace with your Deriv API Token
const API_TOKEN = 'lkUxtOopvUhCpIX';

// Configuration
const config = {
    stakePercentage: 0.35, // 1% of balance
    profitTarget: 5, // Stop trading after this profit (USD)
    lossLimit: 5, // Stop trading after this loss (USD)
    contractType: 'DIGITOVER', // DIGITUNDER or DIGITOVER
    prediction: 2, // Predict digits under or over this number
};

// Variables
let totalProfit = 0;
let totalLoss = 0;
let baseStake = 1; // Will be adjusted based on account balance

// Initialize WebSocket
function initWebSocket() {
    const ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");

    // Handle WebSocket open event
    ws.onopen = () => {
        console.log('Connected to Deriv WebSocket');
        authenticate(ws);
    };

    // Handle WebSocket message event
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('message - ', message);
        
        handleMessage(message, ws);
    };

    // Handle WebSocket close event
    ws.onclose = () => {
        console.log('WebSocket closed. Reconnecting...');
        setTimeout(initWebSocket, 1000); // Reconnect after 1 second
    };
}

// Authenticate
function authenticate(ws) {
    ws.send(JSON.stringify({ authorize: API_TOKEN }));
}

// Fetch account balance
function getBalance(ws) {
    ws.send(JSON.stringify({ balance: 1 }));
}

// Place a trade
function placeTrade(ws, stake) {
    ws.send(JSON.stringify({
        buy: 1,
        price: stake,
        parameters: {
            amount: stake,
            basis: 'stake',
            contract_type: config.contractType,
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            symbol: 'R_100',
            barrier: config.prediction
        }
    }));
}

// Handle WebSocket messages
function handleMessage(message, ws) {
    if (message.msg_type === 'authorize') {
        console.log('Authorization successful');
        getBalance(ws);
    } else if (message.msg_type === 'balance') {
        const balance = message.balance.balance;
        console.log('Current Balance:', balance);
        baseStake = (balance * config.stakePercentage).toFixed(2);
        startTrading(ws);
    } else if (message.msg_type === 'buy') {
        console.log('Trade placed:', message.buy);
    } else if (message.msg_type === 'proposal_open_contract') {
        handleContractResult(message.proposal_open_contract, ws);
    }
}

// Handle trade results
function handleContractResult(contract, ws) {
    if (contract.status === 'won') {
        const profit = parseFloat(contract.profit);
        totalProfit += profit;
        console.log(`Trade Won! Profit: ${profit.toFixed(2)}`);
    } else if (contract.status === 'lost') {
        const loss = parseFloat(contract.buy_price);
        totalLoss += loss;
        console.log(`Trade Lost! Loss: ${loss.toFixed(2)}`);
    }

    if (totalProfit >= config.profitTarget) {
        console.log('Profit target reached. Stopping bot.');
        ws.close();
    } else if (totalLoss >= config.lossLimit) {
        console.log('Loss limit reached. Stopping bot.');
        ws.close();
    } else {
        setTimeout(() => placeTrade(ws, baseStake), 1000); // Place the next trade after a delay
    }
}

// Start trading loop
function startTrading(ws) {
    console.log('Starting trading...');
    placeTrade(ws, baseStake);
}

// Initialize the bot
initWebSocket();
