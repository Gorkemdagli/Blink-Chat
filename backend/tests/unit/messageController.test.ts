import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Server, Socket } from 'socket.io';
import { MessageController } from '../../controllers/messageController';
import { MessageService } from '../../services/messageService';

vi.mock('../../services/messageService');
vi.mock('../../config/logger', () => ({
    __esModule: true,
    default: {
        error: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        stream: { write: vi.fn() }
    }
}));

describe('MessageController', () => {
    let mockIo: Partial<Server>;
    let mockSocket: Partial<Socket>;

    beforeEach(() => {
        vi.clearAllMocks();

        mockIo = {
            to: vi.fn().mockReturnThis(),
            emit: vi.fn(),
        };

        mockSocket = {
            to: vi.fn().mockReturnThis(),
            emit: vi.fn(),
        };
    });

    describe('handleSendMessage', () => {
        it('should validate and save message, then broadcast to room and globally', async () => {
            const validData = { roomId: 'room1', userId: 'user1', content: 'msg' };
            const savedMessage = { ...validData, id: 'msg1', user: { username: 'test' } };
            (MessageService.saveMessage as vi.Mock).mockResolvedValueOnce(savedMessage);

            await MessageController.handleSendMessage(mockIo as Server, mockSocket as Socket, validData);

            expect(MessageService.saveMessage).toHaveBeenCalled();
            expect(mockIo.to).toHaveBeenCalledWith('room1');
            expect(mockIo.emit).toHaveBeenCalledWith('newMessage', savedMessage);
        });

        it('should emit error on validation failure', async () => {
            const invalidData = { userId: 'user1' }; // missing roomId and content

            await MessageController.handleSendMessage(mockIo as Server, mockSocket as Socket, invalidData);

            expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.stringContaining('Geçersiz mesaj verisi'));
            expect(MessageService.saveMessage).not.toHaveBeenCalled();
        });
    });

    describe('handleMarkRead', () => {
        it('should call service and emit messages_read', async () => {
            const validData = { roomId: 'room1', userId: 'user1' };
            (MessageService.markMessagesAsRead as vi.Mock).mockResolvedValueOnce([]);

            await MessageController.handleMarkRead(mockIo as Server, mockSocket as Socket, validData);

            expect(MessageService.markMessagesAsRead).toHaveBeenCalledWith('room1', 'user1');
            expect(mockIo.to).toHaveBeenCalledWith('room1');
            expect(mockIo.emit).toHaveBeenCalledWith('messages_read', validData);
        });
    });

    describe('handleTyping / handleStopTyping', () => {
        it('should broadcast typing', () => {
            const data = { roomId: 'room1', userId: 'user1', username: 'test' };
            MessageController.handleTyping(mockSocket as Socket, data);

            expect(mockSocket.to).toHaveBeenCalledWith('room1');
            expect(mockSocket.emit).toHaveBeenCalledWith('typing', { userId: 'user1', username: 'test', isTyping: true });
        });

        it('should broadcast stop_typing', () => {
            const data = { roomId: 'room1', userId: 'user1' };
            MessageController.handleStopTyping(mockSocket as Socket, data);

            expect(mockSocket.to).toHaveBeenCalledWith('room1');
            expect(mockSocket.emit).toHaveBeenCalledWith('stop_typing', { userId: 'user1', isTyping: false });
        });
    });
});
