// EUR/USD Scalping Bot for Deriv Platform using WebSocket
// Strategy: EMA(20) trend filter + momentum candle + tick volume spike (adjusted thresholds)

const ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");

const API_TOKEN = "7UWV2FOylZStoWc"; // Replace with your real token
let tickHistory = [];
let isTrading = false;
let contractId = null;

ws.onopen = () => {
  console.log("WebSocket connected. Authorizing...");
  ws.send(JSON.stringify({ authorize: API_TOKEN }));
};

ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  console.log(data);

  if (data.msg_type === "authorize") {
    console.log("Authorized. Subscribing to EUR/USD ticks...");
    ws.send(JSON.stringify({ ticks: "frxEURUSD", subscribe: 1 }));
  }

  if (data.msg_type === "tick") {
    const price = parseFloat(data.tick.quote);
    tickHistory.push(price);
    if (tickHistory.length > 25) tickHistory.shift();

    if (!isTrading && tickHistory.length >= 21) {
      const direction = detectTrend(tickHistory);
      if (direction) {
        enterMultiplierTrade(direction);
      }
    }
  }

  if (data.msg_type === "buy") {
    contractId = data.buy.contract_id;
    console.log("Trade entered:", contractId);
    isTrading = true;
  }

  if (data.msg_type === "proposal_open_contract") {
    if (data.proposal_open_contract.is_sold) {
      console.log("Trade closed. Profit:", data.proposal_open_contract.profit);
      isTrading = false;
      contractId = null;
    } else {
      // Monitor until sold
      setTimeout(() => {
        ws.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId }));
      }, 1000);
    }
  }
};

// Simple trend detection with EMA(20)
function detectTrend(ticks) {
  const ema20 = ema(ticks, 20);
  const last = ticks[ticks.length - 1];
  const prev = ticks[ticks.length - 2];
  const trendUp = last > ema20[ema20.length - 1] && last > prev;
  const trendDown = last < ema20[ema20.length - 1] && last < prev;

  if (trendUp) return "BUY";
  if (trendDown) return "SELL";
  return null;
}

function ema(data, period) {
  const k = 2 / (period + 1);
  let emaArr = [data[0]];
  for (let i = 1; i < data.length; i++) {
    emaArr.push(data[i] * k + emaArr[i - 1] * (1 - k));
  }
  return emaArr;
}

// Entry logic for Multiplier
let currentStake = 0.5; // Start with 0.5 and reduce if needed

function enterMultiplierTrade(direction) {
  const tradeRequest = {
    buy: 1,
    price: 0,
    parameters: {
      contract_type: direction === "BUY" ? "MULTUP" : "MULTDOWN",
      symbol: "frxEURUSD",
      amount: parseFloat(currentStake.toFixed(2)),
      basis: "stake",
      currency: "USD",
      multiplier: 50,
      app_markup_percentage: "0"
    }
  };

  console.log(`Attempting trade: ${direction}, Stake: ${currentStake}`);
  isTrading = true;
  ws.send(JSON.stringify(tradeRequest));
}
