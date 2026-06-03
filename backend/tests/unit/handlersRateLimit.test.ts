import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Server, Socket } from 'socket.io';
import { setupSocketHandlers } from '../../socket/handlers';
import redis from '../../redisClient';

// Mock MessageController so the handler doesn't touch real services
vi.mock('../../controllers/messageController', () => ({
    MessageController: {
        handleSendMessage: vi.fn(),
    },
}));

// Mock redisClient — handler calls incr/expire/get/set in connection setup
// and rateLimitMsg in the sendMessage listener
vi.mock('../../redisClient', () => ({
    default: {
        incr: vi.fn().mockResolvedValue(1),
        decr: vi.fn().mockResolvedValue(0),
        expire: vi.fn().mockResolvedValue(1),
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1),
        rateLimitMsg: vi.fn().mockResolvedValue(1),
        decrementConnections: vi.fn().mockResolvedValue(0),
    }
}));

vi.mock('../../config/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

interface CapturedHandlers {
    connection: (socket: any) => void;
}

function makeFakeIO(): { io: Server; captured: CapturedHandlers } {
    const captured: CapturedHandlers = { connection: () => {} };
    const io: any = {
        use: vi.fn((_middleware: any) => io),
        on: vi.fn((event: string, cb: any) => {
            if (event === 'connection') captured.connection = cb;
        }),
        to: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        engine: { clientsCount: 1 },
    };
    return { io: io as Server, captured };
}

function makeFakeSocket(userId: string, socketId: string) {
    const handlers: Record<string, any> = {};
    return {
        id: socketId,
        data: { userId, email: `${userId}@example.com` },
        handshake: { auth: { token: 'mock-jwt' } },
        emit: vi.fn(),
        join: vi.fn(),
        leave: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn((event: string, cb: any) => {
            handlers[event] = cb;
        }),
        _handlers: handlers,
    };
}

describe('setupSocketHandlers — rate-limit keying', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keys rateLimitMsg by userId, not socket.id', async () => {
        const { io, captured } = makeFakeIO();
        setupSocketHandlers(io);

        const fakeSocket = makeFakeSocket('user-abc', 'sock-xyz');
        await captured.connection(fakeSocket);

        // Trigger the captured sendMessage handler
        const sendMessageHandler = (fakeSocket.on as vi.Mock).mock.calls
            .find(([event]) => event === 'sendMessage')?.[1];
        expect(sendMessageHandler).toBeDefined();

        await sendMessageHandler({
            roomId: 'room1',
            userId: 'client-supplied-user-id', // overridden by handler from JWT
            content: 'hi',
        });

        const rateLimitMsgMock = (redis as any).rateLimitMsg as ReturnType<typeof vi.fn>;
        expect(rateLimitMsgMock).toHaveBeenCalledTimes(1);
        const key = rateLimitMsgMock.mock.calls[0][0];
        expect(key).toBe('ratelimit:msg:user-abc');
        expect(key).not.toContain('sock-xyz');
    });
});
