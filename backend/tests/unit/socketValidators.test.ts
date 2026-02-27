import { MessageDataSchema, MarkReadSchema, TypingSchema, StopTypingSchema } from '../../validators/socketValidators';

describe('Socket Validators', () => {
    describe('MessageDataSchema', () => {
        it('should validate valid text message', () => {
            const data = { roomId: 'room1', userId: 'user1', content: 'hello' };
            const result = MessageDataSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should validate valid file message', () => {
            const data = { roomId: 'room1', userId: 'user1', content: '', fileUrl: 'https://mock.supabase.co/storage/v1/object/public/chat-files/file.png', messageType: 'image', fileName: 'file.png' };
            const result = MessageDataSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should reject missing roomId', () => {
            const data = { userId: 'user1', content: 'hello' };
            const result = MessageDataSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject invalid file extensions', () => {
            const data = { roomId: 'room1', userId: 'user1', content: 'hello', fileName: 'malicious.exe' };
            const result = MessageDataSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject oversized files', () => {
            const data = { roomId: 'room1', userId: 'user1', content: 'hello', fileSize: 30 * 1024 * 1024 }; // 30MB
            const result = MessageDataSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject empty content without fileUrl', () => {
            const data = { roomId: 'room1', userId: 'user1', content: '   ' };
            const result = MessageDataSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('MarkReadSchema', () => {
        it('should validate valid data', () => {
            const result = MarkReadSchema.safeParse({ roomId: 'room1', userId: 'user1' });
            expect(result.success).toBe(true);
        });

        it('should reject if missing fields', () => {
            const result = MarkReadSchema.safeParse({ roomId: 'room1' });
            expect(result.success).toBe(false);
        });
    });

    describe('TypingSchema', () => {
        it('should validate valid data', () => {
            const result = TypingSchema.safeParse({ roomId: 'room1', userId: 'user1', username: 'testuser' });
            expect(result.success).toBe(true);
        });

        it('should reject if missing username', () => {
            const result = TypingSchema.safeParse({ roomId: 'room1', userId: 'user1' });
            expect(result.success).toBe(false);
        });
    });

    describe('StopTypingSchema', () => {
        it('should validate valid data', () => {
            const result = StopTypingSchema.safeParse({ roomId: 'room1', userId: 'user1' });
            expect(result.success).toBe(true);
        });
    });
});
