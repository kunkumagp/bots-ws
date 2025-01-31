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
const scriptButton = document.getElementById("scriptButton");
const authenticateButton = document.getElementById("authenticateButton");
const infoOutput = document.getElementById("info_output");

const martingaleMultiplier = 2.07112;

let initialAccountBalance = 0;
let updatedAccountBalance = 0;

let targetAmount = 0;
let amountPutForTrading = 0;
let currentProfitAmount = 0;
let currentLossAmount = 0;
let totalTradeCount = 0;
let stake = 0;
let onTradeCount = 0;


let totalProfitAmount = 0;
let winTradeCount = 0;
let lostCountInRow = 0;
let totalLossAmount  = 0;

let lastTradeId = null;
let tradeTypeDisplay = null;
let tradeType = "even";
let apiToken = null;
let authSuccess = false;
let isTradeOpen = false;
let automation = false;
let tradeProposal = null;

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

accountSelectElement.value = "iVOpdm24hBhw3JI";
marketSelectElement.value = "R_10";
apiToken = accountSelectElement.value;

authenticateButton.addEventListener("click", authenticate);
// scriptButton.addEventListener("click", startBot);

accountSelectElement.addEventListener("change", () => {
  apiToken = accountSelectElement.value;
});

let ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");

function authenticate() {
  let ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");
  let wsResponse;

  market = marketSelectElement.value;

  console.log("apiToken - ", apiToken);

  ws.onopen = function () {
    // Authenticate
    getAuthentication();
    setFlashNotification("WebSocket connection opened", 0);
  };

  ws.onclose = function () {
    setTimer(0);
    console.log("Connection closed");
    setFlashNotification("Connection closed", 0);
    console.log("-----------------------------\n");
  };

  ws.onerror = function (err) {
    console.error("WebSocket error:", err);
    setFlashNotification(`WebSocket error: ${err.message}`, 0);
  };

  ws.onmessage = function (event) {
    wsResponse = JSON.parse(event.data);

    console.log("wsResponse in auth - ", wsResponse);

    if (wsResponse != null) {
      if (wsResponse.msg_type === "authorize") {
        console.log(
          "Authorization successful.\n-----------------------------\n\n"
        );
        setFlashNotification("Authorization successful", 0);
        initialAccountBalance = wsResponse.authorize.balance;
        updatedAccountBalance = initialAccountBalance;
        setAccountInfo("initialAccountBalance", `$ ${initialAccountBalance}`);
        authSuccess = true;
        resetParams();
        authenticateButton.innerHTML = "Authentication Success. Run the Bot!.";
        placeTrade();
      }

      if (wsResponse.msg_type === "proposal") {
        console.log("wsResponse in proposal - ", wsResponse);

        if (
          updatedAccountBalance > 0 &&
          wsResponse.echo_req.amount > updatedAccountBalance
        ) {
          webSocketConnectionStop();
        } else {
          tradeProposal = wsResponse;
          makeTheTrade();
        }
      }

      if (wsResponse.msg_type === "buy") {
        console.log("wsResponse in buy - ", wsResponse);

        if (
          wsResponse.buy == undefined ||
          wsResponse.buy.contract_id == undefined
        ) {
          // placeTrade();
        } else {
          lastTradeId = wsResponse.buy.contract_id;
          totalTradeCount = totalTradeCount + 1;
          isTradeOpen = true;

          if (wsResponse.buy.shortcode.includes("DIGITEVEN")) {
            tradeTypeDisplay = "Even";
          } else if (wsResponse.buy.shortcode.includes("DIGITODD")) {
            tradeTypeDisplay = "Odd";
          }

          setResultNotification(
            lastTradeId,
            tradeTypeDisplay,
            market,
            wsResponse.buy.buy_price
          );

          // setAccountInfo('percentage10', `$ ${targetProfit.toFixed(2)}`)
          console.log("Trade Successful:", wsResponse);
          // scrollToBottom();

          automation = true;

          setTimeout(() => {
            fetchTradeDetails(lastTradeId);
          }, 500);
        }
      }

      if (wsResponse.msg_type === "proposal_open_contract") {
        if (wsResponse.proposal_open_contract.contract_id === lastTradeId) {

            const contract = wsResponse.proposal_open_contract;

            console.log('contract - ', contract);

            if (contract.is_sold) {
                const profit = contract.profit;
                const result = profit > 0 ? "Win" : "Loss";


                currentProfitAmount = currentProfitAmount + profit;
                currentLossAmount = currentLossAmount + profit;
                if(currentLossAmount >= 0){currentLossAmount = 0;}

                if( profit > 0){
                    totalProfitAmount = totalProfitAmount + profit;
                    winTradeCount = winTradeCount+1;
                    lostCountInRow = 0;
                } else if( profit < 0){
                    totalLossAmount = totalLossAmount + profit;
                    lossTradeCount = lossTradeCount+1;
                    lostCountInRow = lostCountInRow + 1;
                }

                updatedAccountBalance = updatedAccountBalance + profit;

                console.log('initialAccBalance - ', initialAccBalance);
                console.log('updatedAccountBalance - ', updatedAccountBalance);


                let updatedAccountBalanceDisplay = null;
                if(updatedAccountBalance > initialAccBalance){
                    updatedAccountBalanceDisplay = `<span class="green">$ ${updatedAccountBalance.toFixed(2)}</span>`;
                } else if(updatedAccountBalance < initialAccBalance){
                    updatedAccountBalanceDisplay = `<span class="red">$ ${updatedAccountBalance.toFixed(2)}</span>`;
                }
                setAccountInfo("updatedBalance",`${updatedAccountBalanceDisplay}`);

                setAccountInfo("totalTradeCount", `${totalTradeCount}`);
                setAccountInfo("winCount", `${winTradeCount}`);
                setAccountInfo("lossCount", `${lossTradeCount}`);


                let totalProfitAmountDisplay = null;
                if(totalProfitAmount < 0){
                    totalProfitAmountDisplay = `<span class="red">$ ${totalProfitAmount.toFixed(2)}</span>`;
                } else if(totalProfitAmount > 0){
                    totalProfitAmountDisplay = `<span class="green">$ ${totalProfitAmount.toFixed(2)}</span>`;
                }else{
                    totalProfitAmountDisplay = `$ ${totalProfitAmount.toFixed(2)}`;
                }
                setAccountInfo("totalProfit", `${totalProfitAmountDisplay}`);



                let totalLossAmountDisplay = null;
                if(totalLossAmount < 0){
                    totalLossAmountDisplay = `<span class="red">$ ${totalLossAmount.toFixed(2)}</span>`;
                } else if(totalLossAmount > 0){
                    totalLossAmountDisplay = `<span class="green">$ ${totalLossAmount.toFixed(2)}</span>`;
                }else{
                    totalLossAmountDisplay = `$ ${totalLossAmount.toFixed(2)}`;
                }
                setAccountInfo("totalLoss", `${totalLossAmountDisplay}`);



                let currentProfitAmountDisplay = null;
                if(currentProfitAmount < 0){
                    currentProfitAmountDisplay = `<span class="red">$ ${currentProfitAmount.toFixed(2)}</span>`;
                } else if(currentProfitAmount > 0){
                    currentProfitAmountDisplay = `<span class="green">$ ${currentProfitAmount.toFixed(2)}</span>`;
                }else{
                    currentProfitAmountDisplay = `$ ${currentProfitAmount.toFixed(2)}`;
                }
                setAccountInfo("currentProfitAmount",`${currentProfitAmountDisplay}`);



                let currentLossAmountDisplay = null;
                if(currentLossAmount < 0){
                    currentLossAmountDisplay = `<span class="red">$ ${currentLossAmount.toFixed(2)}</span>`;
                } else if(currentLossAmount > 0){
                    currentLossAmountDisplay = `<span class="green">$ ${currentLossAmount.toFixed(2)}</span>`;
                }else{
                    currentLossAmountDisplay = `$ ${currentLossAmount.toFixed(2)}`;
                }
                setAccountInfo("currentLossAmount", `${currentLossAmountDisplay}`);

                // stakeChange(result);
                setResultNotification(
                    lastTradeId,
                    tradeType,
                    market,
                    contract.buy_price,
                    profit
                );

                stakeChange(result);

                isTradeOpen = false;

            } else {
                setTimeout(() => {
                    setTickCountDown(
                        contract.tick_count,
                        contract.tick_stream.length
                    );
                    fetchTradeDetails(lastTradeId);
                }, 1000);
            }
            
        }
      }
    }
  };

  const makeTheTrade = () => {
    console.log("wsResponse in makeTheTrade - ", wsResponse);

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
      ws.send(JSON.stringify(buyRequest));
    }
  };

  const placeTrade = (result = null) => {
    if (isTradeOpen == false) {
      if (result != null) {
        if (result == "even") {
          tradeState = "DIGITODD";
        } else if (result == "odd") {
          tradeState = "DIGITEVEN";
        }
      } else {
        if (tradeType == "even") {
          tradeState = "DIGITEVEN";
          tradeType = "odd";
        } else if (tradeType == "odd") {
          tradeState = "DIGITODD";
          tradeType = "even";
        }
      }
      stake = Number(stake);
      stake < 0.35 ? (stake = 0.35) : (stake = stake);

      tickCount = 1;
      // tickCount = getRandomNumber(5, 8);

      const tradeRequest = {
        proposal: 1,
        amount: stake.toFixed(2),
        basis: "stake",
        contract_type: tradeState, // Use 'DIGITEVEN' for even and 'DIGITODD' for odd
        currency: "USD",
        duration: tickCount,
        duration_unit: "t",
        symbol: market,
      };

      onTradeCount = 1;
      // Send the trade request to the WebSocket
      console.log("Sending Rise/Fall trade request:", tradeRequest);
      ws.send(JSON.stringify(tradeRequest));
    }
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
  };

  const getAuthentication = () => {
    setFlashNotification("Authenticating....", 0);
    console.log("Authenticating....");
    ws.send(JSON.stringify({ authorize: apiToken }));
  };
}

function resetParams() {
  console.log("initialAccountBalance - ", initialAccountBalance);

  targetAmount = initialAccountBalance * (5 / 100);
  setAccountInfo("targetAmount", `$ ${targetAmount}`);

  amountPutForTrading = initialAccountBalance * (4 / 100);
  setAccountInfo("amountPutForTrading", `$ ${amountPutForTrading}`);

  stake = amountPutForTrading;

  console.log("targetAmount - ", targetAmount);
  console.log("amountPutForTrading - ", amountPutForTrading);
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
    $(".result-notification").prepend(
      `<span class="stake-info" id="${contractId}"><span class="detailt"><span>Contract ID : </span><span class="contract-info">${contractId}</span></span><span class="detailt"><span>Market : </span><span class="contract-info">${marketObj.name}</span></span><span class="detailt"><span>Type : </span><span class="contract-info">${tradeTypeDisplay}</span></span><span class="detailt"><span>Stake : </span><span class="contract-info">${stake}</span></span><span class="detailt"><span>Profit / Loss Amount : </span><span class="contract-info" id="${contractId}-profit"><span class="">-</span></span></span><span class="detailt"><span>Status : </span><span class="contract-info" id="${contractId}-status"><span class="">-</span></span></span></span>`
    );
  }
}

function setTimer(time) {
  var timeleft = time / 1000;
  if (isRunning == false) {
    timeleft = 0;
    stopTimer = true;
  }
  var downloadTimer = setInterval(function () {
    if (timeleft <= 0) {
      clearInterval(downloadTimer);
      setFlashNotification(``, 0);
    } else if (timeleft > 0 && stopTimer == false) {
      setFlashNotification(
        `Bot will run again in  <span class="number">${timeleft}</span> seconds.`,
        0
      );
    }
    timeleft -= 1;
  }, 1000);
}

function setTickCountDown(tickCount, tick) {
    if (tickCount > tick) {
        setFlashNotification(`Trade will close in <span class="number">${tickCount - tick}</span> tick.`,0);
    } else if (tickCount == tick) {
        setFlashNotification(``, 0);
    }
}