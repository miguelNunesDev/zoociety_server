// @ts-check
/// <reference path="../types/index.d.ts" />

const WebSocket = require('ws');
const http = require('https');
const wss = new WebSocket.Server({ port: 3000 });
const sessions = {};

const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Hello, World!\n');
});

server.listen(8080, '0.0.0.0', () => {
    console.log(`Server running`);
});
wss.on('connection', function (ws) {

    let clientId;
    const activePlayers = Object.values(sessions).filter(session => session.isConnected);

    /** @type {ResInit} */
    const msgInit = { event: 'init', payload: activePlayers }
    ws.send(JSON.stringify(msgInit));
    console.log(`Client Connected`);

    ws.on('message', async (msg) => {
        /** @type {Res} */
        // @ts-ignore
        const response = await JSON.parse(msg);

        if (response.event === 'auth') {
            clientId = response.payload.id ?? generateUniqueId();

            if (!sessions[clientId]) {
                console.log('NO ID FOUND');
                sessions[clientId] = { position: { x: 400, y: 100 } }
            };

            sessions[clientId].isConnected = true;
            sessions[clientId].id = clientId;

            console.log('AUTH POS:', sessions[clientId].position)


            /** @type {ResAuth} */
            const msgAuth = {
                event: 'auth',
                payload: { id: clientId, position: sessions[clientId].position }
            }
            ws.send(JSON.stringify(msgAuth))
            console.log(`Client auth`, clientId);

            /** @type {ResPlayerEnter} */
            const msgEnter = {
                event: 'player_enter',
                payload: { id: clientId, position: sessions[clientId].position }
            }
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(msg));
                }
            });
        }

        if (response.event === 'player_move') {

            const { id, position } = response.payload;
            sessions[id].position = position;
            console.log('Move:', position);

            /** @type {ResPlayerMove} */
            const msgMove = {
                event: 'player_move',
                payload: response.payload
            }
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(msgMove));
                }
            });
        }
    });

    ws.on('close', function () {
        if (sessions[clientId]) sessions[clientId].isConnected = false;
        console.log(`Client ${clientId} logout`);

        /** @type {ResPlayerLeave} */
        const msgLeave = {
            event: 'player_leave',
            payload: {
                id: clientId
            }
        }

        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(msgLeave));
            }
        });
    });

    function generateUniqueId() {
        return Math.random().toString(36).substr(2, 9);
    }
});