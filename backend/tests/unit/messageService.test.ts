import { MessageService } from '../../services/messageService';
import supabase from '../../supabaseClient';
import redis from '../../redisClient';
import xss from 'xss';

jest.mock('xss', () => jest.fn((val) => `sanitized_${val}`));
jest.mock('../../config/logger', () => ({
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
}));

describe('MessageService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('saveMessage', () => {
        it('should save a message and handle cache miss (fetch user from DB)', async () => {
            const data = { roomId: 'room1', userId: 'user1', content: 'test content' };

            // Mock redis cache miss
            (redis.get as jest.Mock).mockResolvedValueOnce(null);

            // Mock DB insert
            (supabase.from as jest.Mock).mockReturnValueOnce({
                insert: jest.fn().mockReturnValueOnce({
                    select: jest.fn().mockResolvedValueOnce({
                        data: [{ id: 'msg1', content: 'sanitized_test content', user_id: 'user1', room_id: 'room1' }],
                        error: null
                    })
                })
            });

            // Mock DB fetch user
            (supabase.from as jest.Mock).mockReturnValueOnce({
                select: jest.fn().mockReturnValueOnce({
                    eq: jest.fn().mockReturnValueOnce({
                        single: jest.fn().mockResolvedValueOnce({
                            data: { id: 'user1', username: 'testuser' },
                            error: null
                        })
                    })
                })
            });

            const result = await MessageService.saveMessage(data);

            expect(xss).toHaveBeenCalledWith('test content');
            expect(result.content).toBe('sanitized_test content');
            expect(result.user).toEqual({ id: 'user1', username: 'testuser' });
            expect(redis.set).toHaveBeenCalled();
        });

        it('should save a message and handle cache hit', async () => {
            const data = { roomId: 'room1', userId: 'user1', content: 'test content' };

            // Mock redis cache hit
            (redis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify({ id: 'user1', username: 'cacheduser' }));

            // Mock DB insert
            (supabase.from as jest.Mock).mockReturnValueOnce({
                insert: jest.fn().mockReturnValueOnce({
                    select: jest.fn().mockResolvedValueOnce({
                        data: [{ id: 'msg1', content: 'sanitized_test content', user_id: 'user1', room_id: 'room1' }],
                        error: null
                    })
                })
            });

            const result = await MessageService.saveMessage(data);

            expect(result.user).toEqual({ id: 'user1', username: 'cacheduser' });
            // Should not fetch from DB again
            expect(supabase.from).toHaveBeenCalledTimes(1);
        });

        it('should throw error if insert fails', async () => {
            const data = { roomId: 'room1', userId: 'user1', content: 'test content' };

            // Mock DB insert error
            (supabase.from as jest.Mock).mockReturnValueOnce({
                insert: jest.fn().mockReturnValueOnce({
                    select: jest.fn().mockResolvedValueOnce({
                        data: null,
                        error: new Error('DB Error')
                    })
                })
            });

            await expect(MessageService.saveMessage(data)).rejects.toThrow('Message could not be sent');
        });
    });

    describe('markMessagesAsRead', () => {
        it('should update unread messages status', async () => {
            (supabase.from as jest.Mock).mockReturnValueOnce({
                update: jest.fn().mockReturnValueOnce({
                    eq: jest.fn().mockReturnValueOnce({
                        neq: jest.fn().mockReturnValueOnce({
                            not: jest.fn().mockReturnValueOnce({
                                select: jest.fn().mockResolvedValueOnce({
                                    data: [{ id: 'msg1' }, { id: 'msg2' }],
                                    error: null
                                })
                            })
                        })
                    })
                })
            });

            const result = await MessageService.markMessagesAsRead('room1', 'user1');
            expect(result).toHaveLength(2);
        });
    });
});
