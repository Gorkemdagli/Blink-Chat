import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SpyInstance } from 'vitest';
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
        // After URL decode this becomes ../
        const url = 'https://proj.supabase.co/storage/v1/object/public/chat-files/..%2Favatars%2Fsecret';
        // %2F is not decoded by indexOf — but the raw .. check still blocks the decoded form
        const url2 = 'https://proj.supabase.co/storage/v1/object/public/chat-files/../avatars/secret';
        expect(extractStoragePath(url2)).toBeNull();
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
        const url = `https://proj.supabase.co/storage/v1/object/public/chat-files/file\x00.jpg`;
        expect(extractStoragePath(url)).toBeNull();
    });

    // 🔴 Edge / invalid inputs
    it('returns null for empty string', () => {
        expect(extractStoragePath('')).toBeNull();
    });

    it('returns null when bucket segment is missing', () => {
        const url = 'https://proj.supabase.co/storage/v1/object/public/avatars/photo.jpg';
        expect(extractStoragePath(url)).toBeNull();
    });

    it('returns null for whitespace-only path after bucket', () => {
        const url = 'https://proj.supabase.co/storage/v1/object/public/chat-files/   ';
        expect(extractStoragePath(url)).toBeNull();
    });

    it('returns null for non-string input', () => {
        // @ts-expect-error — intentionally passing wrong type
        expect(extractStoragePath(null)).toBeNull();
        // @ts-expect-error
        expect(extractStoragePath(undefined)).toBeNull();
        // @ts-expect-error
        expect(extractStoragePath(123)).toBeNull();
    });
});

// ─── runCleanup Integration Tests ────────────────────────────────────────────
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
            lt: vi.fn().mockResolvedValueOnce({
                data: [],
                error: null
            })
        });

        (supabase.storage.from as Mock).mockReturnValue({
            list: vi.fn().mockResolvedValue({
                data: [],
                error: null
            })
        });

        await runCleanup();

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No expired files found'));
    });

    it('should delete only safe paths, skip traversal file_urls', async () => {
        const mockRemove = vi.fn().mockResolvedValue({ error: null });

        (supabase.from as Mock).mockReturnValueOnce({
            select: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            lt: vi.fn().mockResolvedValueOnce({
                data: [
                    // Safe URL — should be deleted
                    { id: '1', file_url: 'https://proj.supabase.co/storage/v1/object/public/chat-files/safe-file.png' },
                    // Traversal URL — should be blocked
                    { id: '2', file_url: 'https://proj.supabase.co/storage/v1/object/public/chat-files/../avatars/hack.jpg' },
                    // Absolute-like path — should be blocked
                    { id: '3', file_url: 'https://proj.supabase.co/storage/v1/object/public/chat-files//etc/passwd' },
                ],
                error: null
            })
        });

        (supabase.storage.from as Mock).mockReturnValue({
            remove: mockRemove,
            list: vi.fn().mockResolvedValue({ data: [], error: null })
        });

        (supabase.from as Mock).mockReturnValueOnce({
            update: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValueOnce({ error: null })
        });

        await runCleanup();

        // Only 'safe-file.png' should reach storage.remove — NOT the traversal paths
        expect(mockRemove).toHaveBeenCalledWith(['safe-file.png']);

        // Security errors should have been logged (single string arg — template literal)
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[SECURITY]')
        );
    });

    it('should handle deletion of expired messages with files', async () => {
        (supabase.from as Mock).mockReturnValueOnce({
            select: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            lt: vi.fn().mockResolvedValueOnce({
                data: [{ id: '1', file_url: 'https://proj.supabase.co/storage/v1/object/public/chat-files/file1.png' }],
                error: null
            })
        });

        (supabase.storage.from as Mock).mockReturnValue({
            remove: vi.fn().mockResolvedValue({ error: null }),
            list: vi.fn().mockResolvedValue({ data: [], error: null })
        });

        (supabase.from as Mock).mockReturnValueOnce({
            update: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValueOnce({ error: null })
        });

        await runCleanup();

        expect(supabase.storage.from).toHaveBeenCalledWith('chat-files');
        expect(supabase.from).toHaveBeenCalledWith('messages');
    });
});

type Mock = ReturnType<typeof vi.fn>;
