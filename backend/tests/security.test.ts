import request, { Response } from 'supertest';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import xss from 'xss';
import { app, server } from '../index';
import { Server } from 'http';
import { Request, Response as ExpressResponse } from 'express';

// Add a test route to verify CORS on a successful response
app.get('/api/test-cors', (req: Request, res: ExpressResponse) => {
    res.status(200).json({ message: 'CORS OK' });
});

describe('Security Headers & Middleware', () => {
    let testServer: Server;
    let baseUrl: string;
    let clientSocket: ClientSocket;

    beforeAll((done) => {
        testServer = server.listen(0, () => {
            const address = testServer.address();
            const port = typeof address === 'string' ? 0 : address?.port;
            baseUrl = `http://localhost:${port}`;
            done();
        });
    });

    afterAll((done) => {
        if (clientSocket) clientSocket.close();
        if (testServer) {
            testServer.close(done);
        } else {
            done();
        }
    });

    describe('Rate Limiting', () => {
        it('should enforce rate limits on /api/ routes', async () => {
            const requests = [];
            for (let i = 0; i < 35; i++) {
                requests.push(request(app).get('/api/test-limit'));
            }
            const responses = await Promise.all(requests);
            const tooManyRequests = responses.some((res: Response) => res.status === 429);
            expect(tooManyRequests).toBe(true);
        });
    });

    describe('CORS Configuration', () => {
        it('should allow requests from allowed origin', async () => {
            const res = await request(app)
                .get('/api/test-cors')
                .set('Origin', 'http://localhost:5173');

            expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
        });

        it('should block requests from unauthorized origin', async () => {
            const res = await request(app)
                .get('/api/test-cors')
                .set('Origin', 'http://malicious-site.com');

            expect(res.headers['access-control-allow-origin']).toBeUndefined();
        });
    });

    describe('XSS Sanitization (Socket.IO)', () => {
        beforeAll((done) => {
            clientSocket = Client(baseUrl, {
                auth: { token: 'mock-token' }
            });
            clientSocket.on('connect', done);
            clientSocket.on('connect_error', (err) => done(err));
        });

        it('should sanitize HTML tags from messages', (done) => {
            const roomId = 'test-room-' + Date.now();
            const userId = 'test-user-id';
            const maliciousContent = '<script>alert("xss")</script>Hello';
            const expectedSanitized = xss(maliciousContent);

            clientSocket.emit('joinRoom', roomId);

            clientSocket.on('newMessage', (msg: any) => {
                try {
                    expect(msg.content).not.toContain('<script>');
                    expect(msg.content).toBe(expectedSanitized);
                    done();
                } catch (error) {
                    done(error);
                }
            });

            clientSocket.emit('sendMessage', {
                roomId,
                userId,
                content: maliciousContent
            });
        }, 10000);
    });
});
