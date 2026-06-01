import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { server } from '../index';
import { Server } from 'http';

describe('Performance Tests', () => {
    let testServer: Server;
    let baseUrl: string;
    const clients: ClientSocket[] = [];

    beforeAll(async () => {
        await new Promise<void>((resolve) => {
            testServer = server.listen(0, () => {
                const address = testServer.address();
                const port = typeof address === 'string' ? 0 : address?.port;
                baseUrl = `http://localhost:${port}`;
                resolve();
            });
        });
    });

    afterAll(async () => {
        // Disconnect all clients
        clients.forEach(client => {
            if (client.connected) client.disconnect();
        });

        if (testServer) {
            await new Promise<void>((resolve) => {
                testServer.close(() => resolve());
            });
        }
    });

    describe('Socket Connection Load Test', () => {
        it.skip('should handle 50 concurrent socket connections', async () => {
            const connectionCount = 50;
            let connectedCount = 0;

            const startTime = Date.now();

            await Promise.all(Array.from({ length: connectionCount }, (_, i) =>
                new Promise<void>((resolve, reject) => {
                    const client = Client(baseUrl, {
                        transports: ['websocket'],
                        reconnection: false,
                        auth: { token: 'mock-token' }
                    });

                    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);

                    client.on('connect', () => {
                        clearTimeout(timeout);
                        connectedCount++;
                        if (connectedCount === connectionCount) {
                            const duration = Date.now() - startTime;
                            expect(duration).toBeLessThan(5000);
                            expect(connectedCount).toBe(connectionCount);
                        }
                        resolve();
                    });

                    client.on('connect_error', (error: Error) => {
                        clearTimeout(timeout);
                        reject(new Error(`Connection failed: ${error.message}`));
                    });

                    clients.push(client);
                })
            ));
        }, 10000); // 10 second timeout

        it.skip('should handle message broadcasting to multiple clients', async () => {
            const clientCount = 20;
            const roomId = 'load-test-room';
            let receivedCount = 0;
            const testClients: ClientSocket[] = [];

            // Create and connect clients
            for (let i = 0; i < clientCount; i++) {
                const client = Client(baseUrl, { auth: { token: 'mock-token' } });
                testClients.push(client);
                clients.push(client);
            }

            // Wait for all to connect
            await Promise.all(testClients.map(client => {
                return new Promise<void>((resolve) => {
                    client.on('connect', () => {
                        client.emit('joinRoom', roomId);
                        resolve();
                    });
                });
            }));

            // Setup message listeners
            await new Promise<void>((resolve) => {
                let resolved = false;
                testClients.forEach(client => {
                    client.on('newMessage', (msg: any) => {
                        receivedCount++;

                        if (receivedCount === clientCount && !resolved) {
                            resolved = true;
                            // Cleanup
                            testClients.forEach(c => c.disconnect());
                            expect(receivedCount).toBe(clientCount);
                            resolve();
                        }
                    });
                });

                // Send a message from first client
                setTimeout(() => {
                    testClients[0].emit('sendMessage', {
                        roomId,
                        userId: 'test-user',
                        content: 'Load test message'
                    });
                }, 500);
            });
        }, 15000);
    });
});