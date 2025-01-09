function startWebSocket() {
    ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");
    let response;

    apiToken = accountSelectElement.value;

    console.log(ws);

    ws.onopen = function () {
        // Authenticate
        getAuthentication();
        infoOutput.innerHTML += "WebSocket connection opened.\n-------------------------------------\n";
    };

    ws.onclose = function () {
        console.log('Connection closed');
        infoOutput.innerHTML += 'Connection closed\n-----------------------------\n\n';
        console.log('-----------------------------\n');
    };

    ws.onerror = function (err) {
        console.error('WebSocket error:', err);
        infoOutput.innerHTML += `WebSocket error: ${err.message}\n`;
    };


    ws.onmessage = function (event) {
        response = JSON.parse(event.data);

        // console.log('response - ', response);
        return response;

    };



    const getAuthentication = () => {
        ws.send(JSON.stringify({ authorize: apiToken }));
    };

    return response;

}

function weClose() {
    if (ws) {
        ws.close();
        ws = null;
    }
}
