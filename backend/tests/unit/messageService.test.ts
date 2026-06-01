import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageService } from '../../services/messageService';
import supabase from '../../supabaseClient';
import redis from '../../redisClient';
import xss from 'xss';

vi.mock('xss', () => ({
    default: vi.fn((val) => `sanitized_${val}`)
}));

vi.mock('../../redisClient', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
    }
}));

vi.mock('../../supabaseClient', () => ({
    default: {
        from: vi.fn()
    }
}));

vi.mock('../../config/logger', () => ({
    default: {
        error: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        info: vi.fn()
    }
}));

describe('MessageService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('saveMessage', () => {
        it('should save a message and handle cache miss (fetch user from DB)', async () => {
            const data = { roomId: 'room1', userId: 'user1', content: 'test content' };

            // Mock redis cache miss
            (redis.get as vi.Mock).mockResolvedValueOnce(null);

            // Mock DB insert
            (supabase.from as vi.Mock).mockReturnValueOnce({
                insert: vi.fn().mockReturnValueOnce({
                    select: vi.fn().mockResolvedValueOnce({
                        data: [{ id: 'msg1', content: 'sanitized_test content', user_id: 'user1', room_id: 'room1' }],
                        error: null
                    })
                })
            });

            // Mock DB fetch user
            (supabase.from as vi.Mock).mockReturnValueOnce({
                select: vi.fn().mockReturnValueOnce({
                    eq: vi.fn().mockReturnValueOnce({
                        single: vi.fn().mockResolvedValueOnce({
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
            (redis.get as vi.Mock).mockResolvedValueOnce(JSON.stringify({ id: 'user1', username: 'cacheduser' }));

            // Mock DB insert
            (supabase.from as vi.Mock).mockReturnValueOnce({
                insert: vi.fn().mockReturnValueOnce({
                    select: vi.fn().mockResolvedValueOnce({
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
            (supabase.from as vi.Mock).mockReturnValueOnce({
                insert: vi.fn().mockReturnValueOnce({
                    select: vi.fn().mockResolvedValueOnce({
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
            (supabase.from as vi.Mock).mockReturnValueOnce({
                update: vi.fn().mockReturnValueOnce({
                    eq: vi.fn().mockReturnValueOnce({
                        neq: vi.fn().mockReturnValueOnce({
                            not: vi.fn().mockReturnValueOnce({
                                select: vi.fn().mockResolvedValueOnce({
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
