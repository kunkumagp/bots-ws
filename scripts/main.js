const accounts = [
    {name: 'KunkumaGP',value: 'lkUxtOopvUhCpIX'},
    {name: 'Kunkuma Trading',value: 'yubZ4jcrU2ffmgl'},
    {name: 'W H K G Prasanna 85',value: 'iVOpdm24hBhw3JI'}
];

const marketArray = [
    {value: "R_10", name: "Volatility 10 Index"},
    {value: "R_25", name: "Volatility 25 Index"},
    {value: "R_50", name: "Volatility 50 Index"},
    {value: "R_75", name: "Volatility 75 Index"},
    {value: "R_100", name: "Volatility 100 Index"},
]


const accountSelectElement = document.getElementById("account_select");
const marketSelectElement = document.getElementById("market");
const scriptButton = document.getElementById('scriptButton');
const infoOutput = document.getElementById('info_output');

const stopLossInputElement = document.getElementById('stop_loss');
const targetProfitInputElement = document.getElementById('target_profit');
const initialStakeInputElement = document.getElementById('initial_stake');


let stopLoss = 100;
let targetProfit = 100;
let initialStake = 0.35;

console.log('init - ', initialStakeInputElement.value);
console.log('stopLossInputElement - ', stopLossInputElement.value);
console.log('targetProfitInputElement - ', targetProfitInputElement.value);

if(initialStakeInputElement.value == ""){
    initialStakeInputElement.value = initialStake;
}

if(stopLossInputElement.value == ""){
    stopLossInputElement.value = stopLoss;
}

if(targetProfitInputElement.value == ""){
    targetProfitInputElement.value = targetProfit;
}


// initialStakeInputElement.value = initialStake;
// stopLossInputElement.value = stopLoss;
// targetProfitInputElement.value = targetProfit;


let ws, isAuthenticated = false, market = null;

accounts.forEach(item => {
    const option = document.createElement("option");
    option.value = item.value;  // Set the value
    option.textContent = item.name;  // Set the display text
    accountSelectElement.appendChild(option);  // Append to the <select>
});

marketArray.forEach(item => {
    const option = document.createElement("option");
    option.value = item.value;  // Set the value
    option.textContent = item.name;  // Set the display text
    marketSelectElement.appendChild(option);  // Append to the <select>
});

marketSelectElement.addEventListener('change', ()=>{
    market = marketSelectElement.value;
});

initialStakeInputElement.addEventListener('change', ()=>{
    initialStake = initialStakeInputElement.value;
});


function setTimer (time){
    var timeleft = (time / 1000);
    var downloadTimer = setInterval(function(){
        if(timeleft <= 0){
          clearInterval(downloadTimer);
          document.getElementById("countdown").innerHTML = "Now";
          $('.countdownlabel').removeClass("show");
          $('.countdownlabel').addClass("hide");
        } else {
          $('.countdownlabel').removeClass("hide");
          $('.countdownlabel').addClass("show");
          document.getElementById("countdown").innerHTML = timeleft;
        }
        timeleft -= 1;
      }, 1000);
}

function getTimeCountDown (time){
    var timeleft = (time / 1000);
    var downloadTimer = setInterval(function(){
        if(timeleft <= 0){
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

    const maxDecimals = Math.max(...numbers.map(num => (num.toString().split('.')[1] || '').length));
    const normalizedNumbers = numbers.map(num => Number(num.toFixed(maxDecimals)));

    normalizedNumbers.forEach(num => {
        const lastChar = num.toString().slice(-1); // Get the last digit
        const lastDigit = parseInt(lastChar, 10);
        digitCounts[lastDigit]++;
    });

    const percentages = digitCounts.map(count => (count / totalNumbers) * 100);
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

  return randomMarket;
};

function predictNexrEvenOdd(arr) {
  if (arr.length < 2) {
      return "Insufficient data to predict";
  }
  const lastNumber = arr[arr.length - 1];
  const secondLastNumber = arr[arr.length - 2];
  const difference = lastNumber - secondLastNumber;
  
  if (difference % 2 === 0) {
      return (lastNumber % 2 === 0) ? "even" : "odd";
  } else {
      return (lastNumber % 2 === 0) ? "odd" : "even";
  }
}

function calculateLastDigitPercentages(numbers) {
  const totalNumbers = numbers.length;
  const digitCounts = Array(10).fill(0);

  const maxDecimals = Math.max(...numbers.map(num => (num.toString().split('.')[1] || '').length));
  const normalizedNumbers = numbers.map(num => Number(num.toFixed(maxDecimals)));

  normalizedNumbers.forEach(num => {
      const lastChar = num.toString().slice(-1); // Get the last digit
      const lastDigit = parseInt(lastChar, 10);
      digitCounts[lastDigit]++;
  });

  const percentages = digitCounts.map(count => (count / totalNumbers) * 100);
  return percentages;
}


function getRandomNumber(min, max) {
  if (min > max) {
    throw new Error("Min value must be less than or equal to Max value");
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
