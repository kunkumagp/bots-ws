const accounts = [
    { name: "KUNKUMAGP Testing", value: "pat_5e757adf550768449c92c663114e4af7ba8c3dd3fd9d62f3faebb55b77ac3786" },
    { name: "KunkumaGP", value: "pat_75687aeb556fbcef179dfe7fa307bd403a28ec334dcbe0a45323c3d92a7c7aae" },
];

const marketArray = [
    { value: "R_10", name: "Volatility 10 Index" },
    { value: "R_25", name: "Volatility 25 Index" },
    { value: "R_50", name: "Volatility 50 Index" },
    { value: "R_75", name: "Volatility 75 Index" },
    { value: "R_100", name: "Volatility 100 Index" },
];

const ACCOUNT_TYPE = "demo";
const APP_ID = "33oWYOQxAL3YJYtTvBRep";

const STAKE_PERCENT = 1;
const TAKE_PROFIT_PERCENT = 50;
const STOP_LOSS_PERCENT = 25;
const DEFAULT_MULTIPLIER = 100;
const DURATION_FALLBACK_TICKS = 5;
const MIN_STAKE = 1.0;
const SESSION_TARGET_PERCENT = 1;
const LOSS_LIMIT_PERCENT = 5;

const accountSelectElement = document.getElementById("account_select");
const marketSelectElement = document.getElementById("market");
const targetProfitInputElement = document.getElementById("target_profit");
const initialStakeInputElement = document.getElementById("initial_stake");
const authenticateButton = document.getElementById("authenticateButton");
const scriptButton = document.getElementById("scriptButton");

let ws = null;
let intervalId = null;
let isRunning = false;
let stopTimer = false;
let authSuccess = false;
let isTradeOpen = false;
let pendingContractType = null;
let proposalAttempts = 0;
let currentMultiplier = DEFAULT_MULTIPLIER;
let multiplierReady = false;

let market = "R_100";
let apiToken = null;
let stake = 0;
let contractType = "MULTUP";
let tradeTypeDisplay = "Multiplier";

let initialAccountBalance = 0;
let updatedAccountBalance = 0;
let netProfit = 0;

let sessionTargetPercentage = SESSION_TARGET_PERCENT / 100;
let targetAmount = 0;
let amountPutForTrading = 0;

let totalTradeCount = 0;
let winTradeCount = 0;
let lossTradeCount = 0;
let totalProfitAmount = 0;
let totalLossAmount = 0;
let currentProfitAmount = 0;
let currentLossAmount = 0;

let lastTradeId = null;
let lastProposalId = null;
let lastAskPrice = null;
let errorCount = 0;

accounts.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.name;
    accountSelectElement.appendChild(option);
});

marketArray.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.name;
    marketSelectElement.appendChild(option);
});

accountSelectElement.value = accounts[0].value;
apiToken = accountSelectElement.value;

accountSelectElement.addEventListener("change", () => {
    apiToken = accountSelectElement.value;
});

marketSelectElement.value = "R_100";

marketSelectElement.addEventListener("change", () => {
    market = marketSelectElement.value;
    if (authSuccess) {
        requestContractInfo();
    }
});

if (targetProfitInputElement) {
    targetProfitInputElement.addEventListener("change", () => {
        const val = Number(targetProfitInputElement.value);
        if (initialAccountBalance > 0 && val > 0) {
            sessionTargetPercentage = val / initialAccountBalance;
            targetAmount = val;
            setAccountInfo("targetAmount", `$ ${targetAmount}`);
        }
    });
}

if (authenticateButton) {
    authenticateButton.addEventListener("click", initializeTradingSession);
}

if (scriptButton) {
    scriptButton.addEventListener("click", runScript);
}

initializeTradingSession();

function resetParams() {
    targetAmount = Number((initialAccountBalance * sessionTargetPercentage).toFixed(2));
    setAccountInfo("targetAmount", `$ ${targetAmount}`);
    amountPutForTrading = Number((initialAccountBalance * (STAKE_PERCENT / 100)).toFixed(2));
    setAccountInfo("amountPutForTrading", `$ ${amountPutForTrading}`);
    stake = amountPutForTrading < MIN_STAKE ? MIN_STAKE : amountPutForTrading;
    if (initialStakeInputElement) {
        initialStakeInputElement.value = Number(stake).toFixed(2);
    }
    if (targetProfitInputElement) {
        targetProfitInputElement.value = targetAmount;
    }
}

async function fetchAuthenticatedConnectionUrl(token) {
    try {
        const accountDetailsResponse = await fetch(
            "https://api.derivws.com/trading/v1/options/accounts",
            {
                method: "GET",
                headers: {
                    "Deriv-App-ID": APP_ID,
                    "Authorization": `Bearer ${token}`,
                },
            }
        );

        if (!accountDetailsResponse.ok) {
            throw new Error(`Failed to fetch account list: ${accountDetailsResponse.statusText}`);
        }

        const accountData = await accountDetailsResponse.json();

        let activeAccount = null;

        if (accountData.data && accountData.data.length > 0) {
            activeAccount = accountData.data.find((acc) => acc.account_type === ACCOUNT_TYPE);
        }

        if (!activeAccount) {
            console.log(`No ${ACCOUNT_TYPE} account found. Creating one...`);
            const createResponse = await fetch(
                "https://api.derivws.com/trading/v1/options/accounts",
                {
                    method: "POST",
                    headers: {
                        "Deriv-App-ID": APP_ID,
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        currency: "USD",
                        group: "row",
                        account_type: "demo",
                    }),
                }
            );

            if (!createResponse.ok) {
                throw new Error(`Failed to create demo account: ${createResponse.statusText}`);
            }

            const createData = await createResponse.json();
            if (Array.isArray(createData.data)) {
                activeAccount = createData.data[0];
            } else {
                activeAccount = createData.data;
            }
            setFlashNotification(`Demo account created: ${activeAccount.account_id}`, 3);
            console.log("Demo account created:", activeAccount);
        }

        if (!activeAccount) {
            throw new Error("No demo account available.");
        }

        console.log(`Using Demo Account ID: ${activeAccount.account_id}`);

        const otpEndpointUrl = `https://api.derivws.com/trading/v1/options/accounts/${activeAccount.account_id}/otp`;

        const response = await fetch(otpEndpointUrl, {
            method: "POST",
            headers: {
                "Deriv-App-ID": APP_ID,
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`REST Handshake failure: ${response.statusText}`);
        }

        const payload = await response.json();
        return payload.data.url;
    } catch (error) {
        console.error("OTP fetch failed:", error);
        setFlashNotification("Authentication routing failed. Check App ID registration.", 0);
        return null;
    }
}

async function initializeTradingSession() {
    if (ws) {
        try { ws.close(); } catch (e) { }
    }

    setFlashNotification("Authenticating...", 0);
    console.log("Requesting single-use token authorization channel...");
    const authorizedUrl = await fetchAuthenticatedConnectionUrl(apiToken);

    if (!authorizedUrl) {
        console.error("Halting. Cannot secure authenticated WebSocket link.");
        return;
    }

    console.log("Connecting to validated stream pipeline...");
    ws = new WebSocket(authorizedUrl);

    ws.onopen = function () {
        console.log("Connection open");
        startPing();
        ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
    };

    ws.onclose = function () {
        console.log("Connection closed");
        stopPing();
        setTimeout(() => {
            if (typeof reload === "function") reload();
        }, 30000);
    };

    ws.onerror = function (err) {
        console.error("WebSocket error:", err);
    };

    ws.onmessage = handleServerMessage;
}

function startPing() {
    if (intervalId) return;
    intervalId = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ ping: 1 }));
        }
    }, 30000);
}

function stopPing() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

function handleServerMessage(event) {
    const wsResponse = JSON.parse(event.data);
    if (!wsResponse) return;

    if (wsResponse.msg_type === "balance" && !authSuccess) {
        if (wsResponse.balance && typeof wsResponse.balance.balance !== "undefined") {
            console.log("Authorization successful.\n-----------------------------\n\n");
            setFlashNotification("Authorization successful", 0);

            initialAccountBalance = parseFloat(wsResponse.balance.balance);
            updatedAccountBalance = initialAccountBalance;
            setAccountInfo("initialAccountBalance", `$ ${initialAccountBalance}`);
            authSuccess = true;

            if (authenticateButton) {
                authenticateButton.innerHTML = "Authenticated. Ready to trade.";
                authenticateButton.disabled = true;
            }

            resetParams();
            requestContractInfo();
        } else {
            if (typeof reload === "function") reload();
        }
    }

    if (wsResponse.msg_type === "contracts_for") {
        if (wsResponse.echo_req && wsResponse.echo_req.contracts_for !== market) return;
        if (wsResponse.contracts_for && Array.isArray(wsResponse.contracts_for.available)) {
            const contractInfo = wsResponse.contracts_for.available.find(
                (item) => item.contract_type === "MULTUP"
            );
            if (contractInfo && Array.isArray(contractInfo.multiplier_range) && contractInfo.multiplier_range.length > 0) {
                currentMultiplier = chooseMultiplier(contractInfo.multiplier_range);
                multiplierReady = true;
                errorCount = 0;
                console.log(`[CONTRACTS] ${market} multiplier range: ${contractInfo.multiplier_range.join(", ")} -> using ${currentMultiplier}`);
                setFlashNotification(`${market}: multiplier ${currentMultiplier} configured`, 5);
            }
            runScript();
        }
    }

    if (wsResponse.msg_type === "proposal") {
        if (!pendingContractType) return;
        if (wsResponse.echo_req && wsResponse.echo_req.contract_type !== pendingContractType) return;

        if (isTradeOpen) return;

        const proposalEcho = wsResponse.echo_req || {};
        if (updatedAccountBalance > 0 && proposalEcho.amount > updatedAccountBalance) {
            stopBot("Stake exceeds available balance.");
            return;
        }

        if (wsResponse.proposal && wsResponse.proposal.id && wsResponse.proposal.ask_price) {
            lastProposalId = wsResponse.proposal.id;
            lastAskPrice = Number(wsResponse.proposal.ask_price);
            const buyRequest = {
                buy: lastProposalId,
                price: lastAskPrice,
            };
            console.log("buyRequest:", buyRequest);
            ws.send(JSON.stringify(buyRequest));
        }
    }

    if (wsResponse.msg_type === "error") {
        console.error("API error:", wsResponse.error);
        const erroredProposal = wsResponse.error && wsResponse.error.echo_req && wsResponse.error.echo_req.proposal;

        if (erroredProposal && pendingContractType && !isTradeOpen) {
            if (proposalAttempts < 1) {
                proposalAttempts = proposalAttempts + 1;
                console.log("Retrying proposal with duration...");
                setTimeout(() => sendProposal(true), 1500);
            } else {
                pendingContractType = null;
                isRunning = false;
                errorCount = errorCount + 1;
                if (errorCount >= 3) {
                    stopBot("Unable to place trade after repeated attempts.");
                    return;
                }
                multiplierReady = false;
                setFlashNotification(`Proposal rejected. Rechecking ${market} in 30s.`, 0);
                setTimeout(() => requestContractInfo(), 30000);
            }
        } else if (!isTradeOpen) {
            pendingContractType = null;
            isRunning = false;
        }
    }

    if (wsResponse.msg_type === "buy") {
        if (wsResponse.buy && wsResponse.buy.contract_id !== undefined) {
            lastTradeId = wsResponse.buy.contract_id;
            totalTradeCount = totalTradeCount + 1;
            isTradeOpen = true;
            isRunning = false;
            pendingContractType = null;
            proposalAttempts = 0;
            errorCount = 0;

            setResultNotification(lastTradeId, tradeTypeDisplay, market, wsResponse.buy.buy_price);
            console.log("Trade Successful:", wsResponse);

            setTimeout(() => {
                fetchTradeDetails(lastTradeId);
            }, 500);
        } else {
            pendingContractType = null;
            isRunning = false;
        }
    }

    if (wsResponse.msg_type === "proposal_open_contract") {
        if (wsResponse.proposal_open_contract.contract_id === lastTradeId) {
            const contract = wsResponse.proposal_open_contract;

            if (contract.is_sold) {
                const profit = parseFloat(contract.profit);
                setInfo(contract, profit);
                isTradeOpen = false;
                scheduleNextTrade();
            } else {
                if (typeof contract.profit !== "undefined") {
                    const live = Number(contract.profit).toFixed(2);
                    setFlashNotification(`Trade open - Live P/L: <span class="number">$${live}</span>`, 0);
                }
                setTimeout(() => {
                    fetchTradeDetails(lastTradeId);
                }, 1000);
            }
        }
    }
}

function chooseMultiplier(range) {
    const sorted = range.map(Number).sort((a, b) => a - b);
    if (sorted.includes(DEFAULT_MULTIPLIER)) return DEFAULT_MULTIPLIER;
    let best = sorted[0];
    sorted.forEach((value) => {
        if (Math.abs(value - DEFAULT_MULTIPLIER) < Math.abs(best - DEFAULT_MULTIPLIER)) {
            best = value;
        }
    });
    return best;
}

function runScript() {
    if (!authSuccess) {
        setFlashNotification("Waiting for authentication...", 0);
        return;
    }
    if (isRunning || isTradeOpen) return;
    placeMultiplierTrade();
}

function placeMultiplierTrade() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (isTradeOpen || pendingContractType) return;
    if (initialAccountBalance <= 0) return;

    if (!multiplierReady) {
        requestContractInfo();
        return;
    }

    stake = Number(amountPutForTrading);
    if (stake < MIN_STAKE) stake = MIN_STAKE;

    contractType = Math.random() < 0.5 ? "MULTUP" : "MULTDOWN";
    tradeTypeDisplay = contractType === "MULTUP" ? "Multiplier Up" : "Multiplier Down";
    pendingContractType = contractType;
    proposalAttempts = 0;

    console.log(`[ENTRY] ${tradeTypeDisplay} on ${market} | stake ${stake.toFixed(2)} | multiplier ${currentMultiplier} | TP ${(stake * TAKE_PROFIT_PERCENT / 100).toFixed(2)} / SL ${(stake * STOP_LOSS_PERCENT / 100).toFixed(2)}`);
    sendProposal(false);
}

function sendProposal(withDuration) {
    const tradeRequest = {
        proposal: 1,
        amount: Number(stake.toFixed(2)),
        basis: "stake",
        contract_type: contractType,
        currency: "USD",
        multiplier: currentMultiplier,
        underlying_symbol: market,
        limit_order: {
            take_profit: Number((stake * (TAKE_PROFIT_PERCENT / 100)).toFixed(2)),
            stop_loss: Number((stake * (STOP_LOSS_PERCENT / 100)).toFixed(2)),
        },
    };

    if (withDuration) {
        tradeRequest.duration = DURATION_FALLBACK_TICKS;
        tradeRequest.duration_unit = "t";
    }

    console.log("Sending Multiplier trade request:", tradeRequest);
    ws.send(JSON.stringify(tradeRequest));
}

function requestContractInfo() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    multiplierReady = false;
    ws.send(JSON.stringify({ contracts_for: market, req_id: 1001 }));
}

function scheduleNextTrade() {
    if (netProfit >= targetAmount) {
        setFlashNotification("Session target reached.", 0);
        setTimeout(() => reload(), 2000);
        return;
    }

    if (totalLossAmount <= -(initialAccountBalance * (LOSS_LIMIT_PERCENT / 100))) {
        stopBot(`Loss limit of ${LOSS_LIMIT_PERCENT}% reached. Stopped.`);
        return;
    }

    const wait = (typeof getRandomNumber === "function" ? getRandomNumber(3, 8) : 5) * 1000;
    isRunning = true;
    console.log(`Waiting ${wait / 1000} seconds before next trade.`);
    if (typeof setTimer === "function") setTimer(wait);
    setTimeout(() => {
        isRunning = false;
        runScript();
    }, wait);
}

function stopBot(message) {
    console.log("[BOT STOPPED]", message);
    isRunning = false;
    isTradeOpen = false;
    pendingContractType = null;
    stopPing();
    if (message) {
        setFlashNotification(message, 0);
    }
    if (scriptButton) {
        scriptButton.disabled = true;
        scriptButton.innerText = "Stopped";
    }
}

function setInfo(contract, lastTradeProfit) {
    updatedAccountBalance = updatedAccountBalance + lastTradeProfit;

    currentProfitAmount = currentProfitAmount + lastTradeProfit;
    currentLossAmount = currentLossAmount + lastTradeProfit;
    if (currentLossAmount >= 0) currentLossAmount = 0;

    netProfit = updatedAccountBalance - initialAccountBalance;

    if (lastTradeProfit > 0) {
        winTradeCount = winTradeCount + 1;
        totalProfitAmount = totalProfitAmount + lastTradeProfit;
    } else if (lastTradeProfit < 0) {
        lossTradeCount = lossTradeCount + 1;
        totalLossAmount = totalLossAmount + lastTradeProfit;
    }

    setResultNotification(lastTradeId, tradeTypeDisplay, market, contract.buy_price, lastTradeProfit);

    setAccountInfo("totalTradeCount", `${totalTradeCount}`);
    setAccountInfo("winCount", `${winTradeCount}`);
    setAccountInfo("lossCount", `${lossTradeCount}`);

    let updatedAccountBalanceDisplay = null;
    if (updatedAccountBalance > initialAccountBalance) {
        updatedAccountBalanceDisplay = `<span class="green">$ ${updatedAccountBalance.toFixed(2)}</span>`;
    } else if (updatedAccountBalance < initialAccountBalance) {
        updatedAccountBalanceDisplay = `<span class="red">$ ${updatedAccountBalance.toFixed(2)}</span>`;
    } else {
        updatedAccountBalanceDisplay = `$ ${updatedAccountBalance.toFixed(2)}`;
    }
    setAccountInfo("updatedAccountBalance", `${updatedAccountBalanceDisplay}`);

    let netProfitDisplay = null;
    if (netProfit > 0) {
        netProfitDisplay = `<span class="green">$ ${netProfit.toFixed(2)}</span>`;
    } else if (netProfit < 0) {
        netProfitDisplay = `<span class="red">$ ${netProfit.toFixed(2)}</span>`;
    } else {
        netProfitDisplay = `$ ${netProfit.toFixed(2)}`;
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

function setResultNotification(contractId, tradeTypeDisplayParam, currentMarket, stakeValue, profit = null) {
    const marketObj = marketArray.find((item) => item.value === currentMarket);

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
            const spanElement = profitElement.querySelector("span");
            if (spanElement) {
                if (newClassName) spanElement.className = newClassName;
                spanElement.innerHTML = profit;
            }
        }

        if (statusElement) {
            const spanElement = statusElement.querySelector("span");
            if (spanElement) {
                if (newClassName) spanElement.className = newClassName;
                spanElement.innerHTML = status;
            }
        }
    } else {
        $(".result-notification").prepend(`<span class="stake-info" id="${contractId}"><span class="detailt"><span>Contract ID : </span><span class="contract-info">${contractId}</span></span><span class="detailt"><span>Market : </span><span class="contract-info">${marketObj.name}</span></span><span class="detailt"><span>Type : </span><span class="contract-info">${tradeTypeDisplayParam}</span></span><span class="detailt"><span>Stake : </span><span class="contract-info">${stakeValue}</span></span><span class="detailt"><span>Profit / Loss Amount : </span><span class="contract-info" id="${contractId}-profit"><span class="">-</span></span></span><span class="detailt"><span>Status : </span><span class="contract-info" id="${contractId}-status"><span class="">-</span></span></span></span>`);
    }
}