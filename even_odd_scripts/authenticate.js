function authenticate() {
    console.log('12312 - ', 1231231);
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
        wsResponse = JSON.parse(event.data);

        console.log('wsResponse - ', wsResponse);

        if (wsResponse != null) {
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
                // scriptButton.innerHTML = "Bot started....";
                // placeTrade();
                // runScript();
            }

        }
    }

    const getAuthentication = () => {
        setFlashNotification("Authenticating....", 0);
        console.log("Authenticating....");
        ws.send(JSON.stringify({ authorize: apiToken }));
    };
}