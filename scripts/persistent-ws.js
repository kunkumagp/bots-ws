let ws = null;
let ports = [];

self.onconnect = function (e) {
    const port = e.ports[0];
    ports.push(port);

    port.onmessage = function (event) {
        const msg = event.data;

        if (msg.type === "connect") {
            if (ws && ws.readyState === WebSocket.OPEN) {
                port.postMessage({ type: "open" });
                return;
            }
            if (msg.url) {
                createConnection(msg.url);
            } else {
                port.postMessage({ type: "need_auth" });
            }
        } else if (msg.type === "send") {
            if (ws && ws.readyState === WebSocket.OPEN) {
                try {
                    let parsed = JSON.parse(msg.data);
                    if (parsed.proposal && parsed.symbol) {
                        parsed.underlying_symbol = parsed.symbol;
                        delete parsed.symbol;
                        ws.send(JSON.stringify(parsed));
                        return;
                    }
                } catch (_) {}
                ws.send(msg.data);
            }
        } else if (msg.type === "close") {
            if (ws) { ws.close(); ws = null; }
        }
    };

    port.start();
};

function createConnection(url) {
    if (ws) { ws.close(); ws = null; }

    ws = new WebSocket(url);

    ws.onopen = function () {
        ports = ports.filter(function (p) {
            try { p.postMessage({ type: "ping" }); return true; } catch (_) { return false; }
        });
        ports.forEach(function (p) { p.postMessage({ type: "open" }); });
    };

    ws.onmessage = function (event) {
        ports.forEach(function (p) { p.postMessage({ type: "message", data: event.data }); });
    };

    ws.onclose = function () {
        ports.forEach(function (p) { p.postMessage({ type: "close" }); });
        ws = null;
    };

    ws.onerror = function () {
        ports.forEach(function (p) { p.postMessage({ type: "error" }); });
    };
}
