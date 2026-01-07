import { describe, it, expect, vi } from 'vitest';

// Manual Mock for DOMPurify to simulate file sanitization behavior
// This ensures we test our Logic (containsXSS), not the DOMPurify library's internal JSDOM support
vi.mock('dompurify', () => ({
    default: {
        sanitize: (msg) => {
            // Simple mock: remove <tags> to simulate sanitization
            // This is enough to make containsXSS detect a change
            if (!msg) return "";
            return msg.replace(/<[^>]*>/g, '').trim(); 
        }
    }
}));

import { messageSchema, containsXSS } from '../components/Chat';

describe('Message Validation Logic', () => {

    describe('containsXSS', () => {
        it('should return false for safe text', () => {
            // "Hello world" -> "Hello world". No change.
            expect(containsXSS('Hello world')).toBe(false);
            expect(containsXSS('Merhabalar nasılsınız?')).toBe(false);
        });

        it('should return true for HTML tags', () => {
            // "<b>Bold</b>" -> "Bold". Change detected.
            expect(containsXSS('<b>Bold</b>')).toBe(true);
            
            // "<script>..." -> "alert(1)". Change detected.
            expect(containsXSS('<script>alert(1)</script>')).toBe(true);
            
            // Image tag removed -> Change detected.
            expect(containsXSS('<img src=x />')).toBe(true);
        });
    });

    describe('messageSchema', () => {
        it('should validate correct messages', () => {
            const result = messageSchema.safeParse("Merhaba dünya");
            expect(result.success).toBe(true);
        });

        it('should reject empty messages', () => {
            const result = messageSchema.safeParse("");
            expect(result.success).toBe(false);
            expect(result.error.issues[0].message).toBe("Mesaj boş olamaz");
        });

        it('should reject extremely long messages', () => {
            const longMessage = "a".repeat(2001);
            const result = messageSchema.safeParse(longMessage);
            expect(result.success).toBe(false);
            expect(result.error.issues[0].message).toBe("Mesaj çok uzun");
        });

        it('should reject messages with XSS content', () => {
            const maliciousInfo = "<script>alert('hacked')</script>";
            const result = messageSchema.safeParse(maliciousInfo);
            expect(result.success).toBe(false);
            expect(result.error.issues[0].message).toContain("Geçersiz içerik");
        });
    });
});
