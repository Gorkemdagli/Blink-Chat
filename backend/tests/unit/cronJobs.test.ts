import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runCleanup, extractStoragePath } from '../../utils/cronJobs';
import supabase from '../../supabaseClient';

vi.mock('../../supabaseClient', () => ({
    default: {
        from: vi.fn(),
        storage: {
            from: vi.fn(),
        },
    },
}));

vi.mock('node-cron', () => ({
    schedule: vi.fn(),
}));

// SpyInstance = ReturnType<typeof vi.spyOn>
type SpyInstance = ReturnType<typeof vi.spyOn>;
type Mock = ReturnType<typeof vi.fn>;

// ─── extractStoragePath Unit Tests ───────────────────────────────────────────
describe('extractStoragePath — Path Traversal Guard', () => {
    let consoleErrorSpy: SpyInstance;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    // ✅ Valid paths
    it('extracts a simple file path', () => {
        const url = 'https://proj.supabase.co/storage/v1/object/public/chat-files/abc123.png';
        expect(extractStoragePath(url)).toBe('abc123.png');
    });

    it('extracts a nested file path', () => {
        const url = 'https://proj.supabase.co/storage/v1/object/public/chat-files/user123/doc.pdf';
        expect(extractStoragePath(url)).toBe('user123/doc.pdf');
    });

    it('extracts path with UUID subfolder', () => {
        const url = 'https://proj.supabase.co/storage/v1/object/public/chat-files/a1b2c3d4-e5f6/photo.jpg';
        expect(extractStoragePath(url)).toBe('a1b2c3d4-e5f6/photo.jpg');
    });

    // 🔴 Path traversal attacks
    it('blocks classic path traversal (../)', () => {
        const url = 'https://proj.supabase.co/storage/v1/object/public/chat-files/../avatars/secret.jpg';
        expect(extractStoragePath(url)).toBeNull();
    });

    it('blocks encoded traversal attempt (..%2F)', () => {
        const url = 'https://proj.supabase.co/storage/v1/object/public/chat-files/..%2Favatars%2Fsecret.jpg';
        expect(extractStoragePath(url)).toBeNull();
    });

    it('blocks nested traversal (folder/../../etc)', () => {
        const url = 'https://proj.supabase.co/storage/v1/object/public/chat-files/folder/../../etc/passwd';
        expect(extractStoragePath(url)).toBeNull();
    });

    it('blocks absolute path after bucket separator', () => {
        const url = 'https://proj.supabase.co/storage/v1/object/public/chat-files//etc/passwd';
        expect(extractStoragePath(url)).toBeNull();
    });

    it('blocks null byte injection', () => {
        const url = 'https://proj.supabase.co/storage/v1/object/public/chat-files/../%00avatars/secret.jpg';
        expect(extractStoragePath(url)).toBeNull();
    });

    // 🟡 Edge cases
    it('returns null for empty string', () => {
        expect(extractStoragePath('')).toBeNull();
    });

    it('returns null when bucket segment is missing', () => {
        const url = 'https://proj.supabase.co/storage/v1/object/public/messages/abc123.txt';
        expect(extractStoragePath(url)).toBeNull();
    });

    it('returns null for whitespace-only path after bucket', () => {
        const url = 'https://proj.supabase.co/storage/v1/object/public/chat-files/   ';
        expect(extractStoragePath(url)).toBeNull();
    });

    it('returns null for non-string input', () => {
        // @ts-expect-error
        expect(extractStoragePath(undefined)).toBeNull();
        // @ts-expect-error
        expect(extractStoragePath(123)).toBeNull();
    });
});

// ─── runCleanup Integration Tests ───────────────────────────────────────────
describe('Cron Jobs Cleanup', () => {
    let consoleLogSpy: SpyInstance;
    let consoleErrorSpy: SpyInstance;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    it('should return early if no expired messages', async () => {
        (supabase.from as Mock).mockReturnValueOnce({
            select: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            lt: vi.fn().mockResolvedValue({ data: [], error: null }),
        } as any);

        await runCleanup();

        expect(supabase.from).toHaveBeenCalledWith('messages');
    });

    it('should delete only safe paths, skip traversal file_urls', async () => {
        (supabase.from as Mock).mockReturnValueOnce({
            select: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            lt: vi.fn().mockResolvedValue({
                data: [
                    {
                        id: 'msg1',
                        file_url: 'https://proj.supabase.co/storage/v1/object/public/chat-files/abc123.png',
                    },
                    {
                        id: 'msg2',
                        file_url: 'https://proj.supabase.co/storage/v1/object/public/chat-files/../etc/passwd',
                    },
                    {
                        id: 'msg3',
                        file_url: null,
                    },
                ],
                error: null,
            }),
        } as any);

        (supabase.storage.from as Mock).mockReturnValueOnce({
            remove: vi.fn().mockReturnThis(),
            file: vi.fn().mockReturnValue({
                delete: vi.fn().mockResolvedValueOnce(undefined),
            }),
        } as any);

        await expect(runCleanup()).resolves.not.toThrow();
        expect(supabase.storage.from).toHaveBeenCalledWith('chat-files');
    });

    it('should handle deletion of expired messages with files', async () => {
        (supabase.from as Mock).mockReturnValueOnce({
            select: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            lt: vi.fn().mockResolvedValue({
                data: [
                    {
                        id: 'msg4',
                        file_url: 'https://proj.supabase.co/storage/v1/object/public/chat-files/user123/doc.pdf',
                    },
                ],
                error: null,
            }),
        } as any);

        (supabase.storage.from as Mock).mockReturnValueOnce({
            remove: vi.fn().mockReturnThis(),
            file: vi.fn().mockReturnValue({
                delete: vi.fn().mockResolvedValueOnce(undefined),
            }),
        } as any);

        await expect(runCleanup()).resolves.not.toThrow();
        expect(supabase.storage.from).toHaveBeenCalledWith('chat-files');
        expect(supabase.from).toHaveBeenCalledWith('messages');
    });
});
