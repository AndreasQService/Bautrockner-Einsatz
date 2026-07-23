const net = require('net');

function createForwarder(fromPort, toPort) {
    net.createServer(socket => {
        const client = net.connect(toPort, '127.0.0.1');
        socket.pipe(client).pipe(socket);
        socket.on('error', () => {});
        client.on('error', () => {});
    }).listen(fromPort, '127.0.0.1', () => {
        console.log(`[Forwarder] Listening on port ${fromPort} -> forwarding to ${toPort}`);
    });
}

createForwarder(5177, 5180);
createForwarder(5173, 5180);
