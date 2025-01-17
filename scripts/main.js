const accounts = [
  { name: "KunkumaGP", value: "lkUxtOopvUhCpIX" },
  { name: "Kunkuma Trading", value: "hJfU1x5xpoSTwHe" },
  { name: "W H K G Prasanna 85", value: "iVOpdm24hBhw3JI" }
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
const scriptButton = document.getElementById("scriptButton");
const infoOutput = document.getElementById("info_output");



const stopLossInputElement = document.getElementById("stop_loss");
const savingsElement = document.getElementById("savings");
const targetProfitInputElement = document.getElementById("target_profit");
const initialStakeInputElement = document.getElementById("initial_stake");
const growthRateInputElement = document.getElementById("growth_rate");

let stopLoss = 100;
let targetProfit = 100;
let initialStake = 0.35;
let newAccBalance = 0;
let percentageValue = 0;

let initialAccBalance = 0, 
    totalTradeCount = 0,
    totalProfitAmount = 0,
    totalLossAmount = 0,
    winTradeCount = 0,
    lossTradeCount = 0,
    currentProfitLossAmount = 0,
    lostCountInRow = 0,
    tickCount = 0,
    profit10 = 0,
    profit25 = 0,
    profit50 = 0,
    profit100 = 0
;

// if (initialStakeInputElement.value == "") {
//   initialStakeInputElement.value = initialStake;
// }

// if (stopLossInputElement.value == "") {
//   stopLossInputElement.value = stopLoss;
// }

// if (targetProfitInputElement.value == "") {
//   targetProfitInputElement.value = targetProfit;
// }

// initialStakeInputElement.value = initialStake;
// stopLossInputElement.value = stopLoss;
// targetProfitInputElement.value = targetProfit;

let ws,
  isAuthenticated = false,
  market = null;

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

marketSelectElement.addEventListener("change", () => {
  market = marketSelectElement.value;
});

initialStakeInputElement.addEventListener("change", () => {
  initialStake = initialStakeInputElement.value;
});

function setTimer(time) {
  var timeleft = time / 1000;
  var downloadTimer = setInterval(function () {
    if (timeleft <= 0) {
      clearInterval(downloadTimer);
      document.getElementById("countdown").innerHTML = "Now";
      $(".countdownlabel").removeClass("show");
      $(".countdownlabel").addClass("hide");
    } else {
      $(".countdownlabel").removeClass("hide");
      $(".countdownlabel").addClass("show");
      $(".tickCountLabel").removeClass("show");
      $(".tickCountLabel").addClass("hide");
      document.getElementById("countdown").innerHTML = timeleft;
    }
    timeleft -= 1;
  }, 1000);
}

function setTickCountDown(tickCount, tick) {
  if (tickCount > tick) {
    $(".tickCountLabel").removeClass("hide");
    $(".tickCountLabel").addClass("show");

    $(".countdownlabel").removeClass("show");
    $(".countdownlabel").addClass("hide");

    document.getElementById("tickCountdown").innerHTML = tickCount - tick;
  } else if (tickCount == tick) {
    document.getElementById("countdown").innerHTML = "";
    $(".tickCountLabel").removeClass("show");
    $(".tickCountLabel").addClass("hide");
  }
}

function getTimeCountDown(time) {
  var timeleft = time / 1000;
  var downloadTimer = setInterval(function () {
    if (timeleft <= 0) {
      clearInterval(downloadTimer);
    }
    timeleft -= 1;
  }, 1000);

  return downloadTimer;
}

function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

// Calculate last digit percentages
function calculateLastDigitPercentages(numbers) {
  const totalNumbers = numbers.length;
  const digitCounts = Array(10).fill(0);

  const maxDecimals = Math.max(
    ...numbers.map((num) => (num.toString().split(".")[1] || "").length)
  );
  const normalizedNumbers = numbers.map((num) =>
    Number(num.toFixed(maxDecimals))
  );

  normalizedNumbers.forEach((num) => {
    const lastChar = num.toString().slice(-1); // Get the last digit
    const lastDigit = parseInt(lastChar, 10);
    digitCounts[lastDigit]++;
  });

  const percentages = digitCounts.map((count) => (count / totalNumbers) * 100);
  return percentages;
}

function calculateStakeFromCapital(capital) {
  const stakeRatio = 0.35; // The ratio of stake to capital
  const stakeValue = (capital * stakeRatio) / 100; // Calculate the stake value
  return stakeValue;
}

const getRandomMarket = (array, current) => {
  let randomIndex;
  let randomMarket;

  do {
    randomIndex = Math.floor(Math.random() * array.length);
    randomMarket = array[randomIndex];
  } while (randomMarket === current);

  return randomMarket.value;
};

function predictNexrEvenOdd(arr) {
  if (arr.length < 2) {
    return "Insufficient data to predict";
  }

  const lastNumber = arr[arr.length - 1].toString().slice(-1); // Get the last digit
  const secondLastNumber = arr[arr.length - 2].toString().slice(-1); // Get the last digit

  // const lastNumber = arr[arr.length - 1];
  // const secondLastNumber = arr[arr.length - 2];
  const difference = lastNumber - secondLastNumber;

  // console.log('lastNumber - ',lastNumber);
  // console.log('secondLastNumber - ',secondLastNumber);
  // console.log('difference - ',difference);
  // console.log(difference % 2 === 0);
  // console.log(lastNumber % 2 === 0);
  

  if (difference % 2 === 0) {
    return lastNumber % 2 === 0 ? "even" : "odd";
  } else {
    return lastNumber % 2 === 0 ? "odd" : "even";
  }
}

function calculateLastDigitPercentages(numbers) {
  const totalNumbers = numbers.length;
  const digitCounts = Array(10).fill(0);

  const maxDecimals = Math.max(
    ...numbers.map((num) => (num.toString().split(".")[1] || "").length)
  );
  const normalizedNumbers = numbers.map((num) =>
    Number(num.toFixed(maxDecimals))
  );

  normalizedNumbers.forEach((num) => {
    const lastChar = num.toString().slice(-1); // Get the last digit
    const lastDigit = parseInt(lastChar, 10);
    digitCounts[lastDigit]++;
  });

  const percentages = digitCounts.map((count) => (count / totalNumbers) * 100);
  return percentages;
}

function getRandomNumber(min, max) {
  if (min > max) {
    throw new Error("Min value must be less than or equal to Max value");
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function reportUpdate (totalTradeCount, winCount, lossCount, totalProfit, totalLoss, currentProfitLossAmount, curruntLoss, initialAccBalance) {
  // const totalResults = document.getElementById('totalResults'); // For displaying WebSocket messages

  // document.getElementById('initialAccBalance').innerHTML = response.authorize.balance;
  document.getElementById('totalTradeCount').innerHTML = totalTradeCount;
  document.getElementById('winCount').innerHTML = winCount;
  document.getElementById('lossCount').innerHTML = lossCount;
  newAccBalance = initialAccBalance + currentProfitLossAmount;


  if(totalProfit < 0){
      document.getElementById('totalProfit').innerHTML = `<span style="color: red; font-weight: 900;">$${totalProfit}</span>`;
  } else if(totalProfit == 0){
      document.getElementById('totalProfit').innerHTML = `<span>$${totalProfit}</span>`;
  } else {
      document.getElementById('totalProfit').innerHTML = `<span style="color: green; font-weight: 900;">$${totalProfit}</span>`;
  }


  if(newAccBalance < initialAccBalance){
      document.getElementById('newAccBalance').innerHTML = `<span style="color: red; font-weight: 900;">$${newAccBalance}</span>`;
  } else if(newAccBalance == initialAccBalance){
      document.getElementById('newAccBalance').innerHTML = `<span>$${newAccBalance}</span>`;
  } else {
      document.getElementById('newAccBalance').innerHTML = `<span style="color: green; font-weight: 900;">$${newAccBalance}</span>`;
  }


  if(totalLoss < 0){
      document.getElementById('totalLoss').innerHTML = `<span style="color: red; font-weight: 900;">$${totalLoss}</span>`;
  } else if(totalLoss == 0){
      document.getElementById('totalLoss').innerHTML = `<span>$${totalLoss}</span>`;
  } else {
      document.getElementById('totalLoss').innerHTML = `<span style="color: green; font-weight: 900;">$${totalLoss}</span>`;
  }

  if(currentProfitLossAmount < 0){
      document.getElementById('currentProfitLossAmount').innerHTML = `<span style="color: red; font-weight: 900;">$${currentProfitLossAmount}</span>`;
  } else if(currentProfitLossAmount == 0){
      document.getElementById('currentProfitLossAmount').innerHTML = `<span>$${currentProfitLossAmount}</span>`;
  } else {
      document.getElementById('currentProfitLossAmount').innerHTML = `<span style="color: green; font-weight: 900;">$${currentProfitLossAmount}</span>`;
  }

  if(curruntLoss < 0){
      document.getElementById('curruntLoss').innerHTML = `<span style="color: red; font-weight: 900;">$${curruntLoss}</span>`;
  } else if(curruntLoss == 0){
      document.getElementById('curruntLoss').innerHTML = `<span>$${curruntLoss}</span>`;
  } else {
      document.getElementById('curruntLoss').innerHTML = `<span style="color: green; font-weight: 900;">$${curruntLoss}</span>`;
  }

  console.log('---------------------------------------------------');

  if(currentProfitLossAmount >= profit10 || currentProfitLossAmount >= profit25 || currentProfitLossAmount >= profit50 || currentProfitLossAmount >= profit100){
    $(".percentage").removeClass("hide");
    $(".percentage").addClass("show");

    if(currentProfitLossAmount >= profit100){
      document.getElementById('percentage').innerHTML = `100% profit covered`;
    } else if(currentProfitLossAmount >= profit50){
      document.getElementById('percentage').innerHTML = `50% profit covered`;
    } else if(currentProfitLossAmount >= profit25){
      document.getElementById('percentage').innerHTML = `25% profit covered`;
    } else if(currentProfitLossAmount >= profit10){
      document.getElementById('percentage').innerHTML = `10% profit covered`;
    }
  } else {
    $(".percentage").removeClass("show");
    $(".percentage").addClass("hide");
  }

  
  scrollToBottom();

};

function scrollToBottom(){
  infoOutput.scrollTop = infoOutput.scrollHeight + 100;
};

function profitPercentageCalculate(amount,percentage){
  return amount * (percentage/100);
};




function calculateInitialStake(capital, martingaleMultiplier, steps) {
  let initialStake = capital;
  
  // Iteratively adjust the initial stake to ensure the 10th step fits within the capital
  while (true) {
      let currentStake = initialStake;
      let totalLoss = 0;
      let valid = true;

      for (let i = 0; i < steps; i++) {
          totalLoss += currentStake;

          // Check if the 10th step exceeds the capital
          if (i === steps - 1 && totalLoss > capital) {
              valid = false;
              break;
          }

          currentStake *= martingaleMultiplier;
      }

      if (valid) break;

      initialStake -= 0.0001; // Adjust downward to find the correct stake
  }

  return parseFloat(initialStake.toFixed(4));
}

function calculateMartingaleSteps(capital, initialStake, martingaleMultiplier, steps) {
  const results = [];
  let currentStake = initialStake;
  let totalLoss = 0;

  for (let i = 0; i < steps; i++) {
      results.push({
          step: i + 1,
          stakeValue: parseFloat(currentStake.toFixed(2)),
          lossValue: parseFloat((totalLoss + currentStake).toFixed(2))
      });

      totalLoss += currentStake;
      currentStake *= martingaleMultiplier;
  }

  return results;
}


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