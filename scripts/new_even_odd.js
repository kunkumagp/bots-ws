// Constants
const API_KEY = 'lkUxtOopvUhCpIX'; // Replace with your Deriv API key
const STREAK_LIMIT = 3; // Number of consecutive even/odd digits to trigger a trade
const INITIAL_STAKE = 0.35; // Starting stake
const DAILY_PROFIT_TARGET = 10; // Profit target in dollars
const DAILY_LOSS_LIMIT = 5; // Loss limit in dollars

// Variables
let balance = 100; // Mock balance (update with your actual balance)
let currentStreak = 0;
let lastOutcome = null; // Tracks the last digit outcome (even/odd)
let profit = 0;
let losses = 0;
let newStake = INITIAL_STAKE;
let lastTradeId = null

// WebSocket Connection
ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089'); // Use the correct app_id for your account

// Utility Functions
const isEven = (digit) => digit % 2 === 0;

// const placeTrade = (prediction, stake) => {
//   console.log(`Placing trade: ${prediction} with stake $${stake}`);
//   // Simulate trade result (replace with actual API trade logic)
//   const randomOutcome = Math.floor(Math.random() * 10); // Simulating digit outcome
//   const tradeWon = (prediction === 'even' && isEven(randomOutcome)) ||
//                    (prediction === 'odd' && !isEven(randomOutcome));
//   if (tradeWon) {
//     profit += stake;
//     console.log(`Trade WON! New profit: $${profit}`);
//   } else {
//     losses += stake;
//     console.log(`Trade LOST! New loss: $${losses}`);
//   }
// };

const resetBot = () => {
  currentStreak = 0;
  lastOutcome = null;
  console.log('Resetting bot...');
};

// Digit Tick Subscription
ws.onopen = () => {
  console.log('Connected to Deriv WebSocket');
  ws.send(JSON.stringify({ ticks: 'R_100' })); // Replace 'R_100' with your chosen market
  getAuthentication();
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);

//   console.log('response - ',response);
  

  // Process Tick Data
  if (response.tick) {
    const lastDigit = parseInt(response.tick.quote.toString().slice(-1)); // Get the last digit
    // console.log(`Last digit: ${lastDigit}`);

    if (lastOutcome === null) {
      lastOutcome = isEven(lastDigit) ? 'even' : 'odd';
      currentStreak = 1;
    } else {
      const currentOutcome = isEven(lastDigit) ? 'even' : 'odd';

      if (currentOutcome === lastOutcome) {
        currentStreak++;
      } else {
        currentStreak = 1;
        lastOutcome = currentOutcome;
      }

    //   console.log(`Current streak: ${currentStreak} (${currentOutcome})`);

      if (currentStreak >= STREAK_LIMIT) {
        const prediction = currentOutcome === 'even' ? 'odd' : 'even';
        placeTrade(prediction, newStake);

        // if(DAILY_PROFIT_TARGET > DAILY_LOSS_LIMIT && profit >= DAILY_PROFIT_TARGET){
        //     console.log(
        //         `Target reached! Profit: $${profit}. Stopping bot.`
        //       );
        //       ws.close();
        // } else if(DAILY_PROFIT_TARGET < DAILY_LOSS_LIMIT && losses >= DAILY_LOSS_LIMIT){
        //     console.log(
        //         `Target lost! Losses: $${losses}. Stopping bot.`
        //       );
        //       ws.close();
        // }

        if (profit >= DAILY_PROFIT_TARGET || losses >= DAILY_LOSS_LIMIT) {
          console.log(
            `Target reached! Profit: $${profit}, Losses: $${losses}. Stopping bot.`
          );
          ws.close();
        }

        resetBot(); // Reset after placing a trade
      }
    }
  }

  if (response.msg_type === 'proposal') {
        tradeProposal = response;
        makeTheTrade();
    }


    if (response.msg_type === 'buy') {
        if(response.buy == undefined || response.buy.contract_id == undefined){
            // requestTicksHistory(market);
        } else {
            
            lastTradeId = response.buy.contract_id; 
            // totalTradeCount = totalTradeCount + 1;
            // isTradeOpen = true;

            // let tradeType;

            // if (response.buy.shortcode.includes('DIGITEVEN')) {
            //     tradeType = 'Even';
            // } else if (response.buy.shortcode.includes('DIGITODD')) {
            //     tradeType = 'Odd';
            // }
            

            // infoOutput.innerHTML += `Trade started:\nContract ID = ${lastTradeId}, Stake = ${response.buy.buy_price}, Market = ${market}, Teade Type = ${tradeType}\n`;
            console.log('Trade Successful:', response);
            // scrollToBottom();

            setTimeout(() => {fetchTradeDetails(lastTradeId);}, 500);
        }
    }

    if(response.msg_type === 'proposal_open_contract'){
        if(response.proposal_open_contract.contract_id === lastTradeId){
            const contract = response.proposal_open_contract;

            if (contract.is_sold) {
                const profitLoss = contract.profit;
                const result = profitLoss > 0 ? 'Win' : 'Loss';

                if (profitLoss > 0) {
                    profit += profitLoss;
                    console.log(`Trade WON! New profit: $${profit}`);
                    newStake = INITIAL_STAKE;
                } else {
                    losses += profitLoss;
                    console.log(`Trade LOST! New loss: $${losses}`);
                    newStake = newStake * 2.1
                }

                // placeTrade(prediction, newStake);

            } else{
                setTimeout(() => {
                    fetchTradeDetails(lastTradeId);
                }, 1000); 
            }
        }
    }

};

ws.onerror = (error) => {
  console.error('WebSocket error:', error.message);
};

ws.onclose = () => {
  console.log('WebSocket connection closed');
};


const getAuthentication = () => {
    ws.send(JSON.stringify({ authorize: API_KEY }));
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
}


function placeTrade(prediction, stake){
    if(prediction == 'even'){
        tradeState = 'DIGITEVEN';
    } else if(prediction == 'odd'){
        tradeState = 'DIGITODD';
    }

    let tickCount = getRandomNumber(1, 5);

    const tradeRequest = {
        proposal: 1,
        amount: stake.toFixed(2),
        basis: 'stake',
        contract_type: tradeState, // Use 'DIGITEVEN' for even and 'DIGITODD' for odd
        currency: 'USD',
        duration: tickCount,
        duration_unit: 't',
        symbol: 'R_100',
    };

    // Send the trade request to the WebSocket
    console.log('Sending Rise/Fall trade request:', tradeRequest);
    ws.send(JSON.stringify(tradeRequest));
};

function makeTheTrade() {
        buyRequest = {
            buy: tradeProposal.proposal.id,
            price: tradeProposal.proposal.ask_price,
        };
        ws.send(JSON.stringify(buyRequest));

};

function getRandomNumber(min, max) {
    if (min > max) {
      throw new Error("Min value must be less than or equal to Max value");
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }