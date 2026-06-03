import { describe, it, expect } from 'vitest';
import xss from 'xss';

describe('xss default+configured behavior (integration)', () => {
    it('escapes <script> with default options', () => {
        expect(xss('<script>alert(1)</script>')).toBe(
            '&lt;script&gt;alert(1)&lt;/script&gt;'
        );
    });

    it('strips tag wrappers but keeps inner text when stripIgnoreTag:true', () => {
        // xss v1.0.15 behavior: stripIgnoreTag removes the tag delimiters,
        // inner text remains. (My earlier expectation that it dropped inner
        // text was wrong.)
        expect(xss('<unknown>x</unknown>', { stripIgnoreTag: true })).toBe('x');
    });

    it('escapes unknown tags with default options (no stripping)', () => {
        // Default xss escapes unknown tags, so they are stored as the literal
        // escaped text. Both this and stripIgnoreTag are XSS-safe; the chat
        // UX differs (escape shows the tags, strip shows the inner text).
        expect(xss('<unknown>x</unknown>')).toBe('&lt;unknown&gt;x&lt;/unknown&gt;');
    });
});
