const { io: Client } = require('socket.io-client');

const { server } = require('../index');

describe('Performance Tests', () => {
    let testServer;
    let baseUrl;
    const clients = [];

    beforeAll((done) => {
        testServer = server.listen(0, () => {
            const port = testServer.address().port;
            baseUrl = `http://localhost:${port}`;
            done();
        });
    });

    afterAll((done) => {
        // Disconnect all clients
        clients.forEach(client => {
            if (client.connected) client.disconnect();
        });

        if (testServer) {
            testServer.close(done);
        } else {
            done();
        }
    });

    describe('Socket Connection Load Test', () => {
        it('should handle 50 concurrent socket connections', (done) => {
            const connectionCount = 50;
            let connectedCount = 0;

            const startTime = Date.now();

            for (let i = 0; i < connectionCount; i++) {
                const client = new Client(baseUrl, {
                    transports: ['websocket'],
                    reconnection: false
                });

                client.on('connect', () => {
                    connectedCount++;

                    if (connectedCount === connectionCount) {
                        const duration = Date.now() - startTime;

                        // All connections should establish within 5 seconds
                        expect(duration).toBeLessThan(5000);
                        expect(connectedCount).toBe(connectionCount);

                        done();
                    }
                });

                client.on('connect_error', (error) => {
                    done(new Error(`Connection failed: ${error.message}`));
                });

                clients.push(client);
            }
        }, 10000); // 10 second timeout

        it('should handle message broadcasting to multiple clients', (done) => {
            const clientCount = 20;
            const roomId = 'load-test-room';
            let receivedCount = 0;
            const testClients = [];

            // Create and connect clients
            for (let i = 0; i < clientCount; i++) {
                const client = new Client(baseUrl);
                testClients.push(client);
            }

            // Wait for all to connect
            Promise.all(testClients.map(client => {
                return new Promise((resolve) => {
                    client.on('connect', () => {
                        client.emit('joinRoom', roomId);
                        resolve();
                    });
                });
            })).then(() => {
                // Setup message listeners
                testClients.forEach(client => {
                    client.on('newMessage', (msg) => {
                        receivedCount++;

                        if (receivedCount === clientCount) {
                            // Cleanup
                            testClients.forEach(c => c.disconnect());

                            expect(receivedCount).toBe(clientCount);
                            done();
                        }
                    });
                });

                // Send a message from first client
                testClients[0].emit('sendMessage', {
                    roomId,
                    userId: 'test-user',
                    content: 'Load test message'
                });
            });
        }, 15000);
    });
});
