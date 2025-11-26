// Grug say: Test validation functions. Simple!

import { describe, it, expect } from 'vitest';

// Grug fix: Import functions from server (need to export them first)
// For now, copy the functions here to test

function isValidCode(code) {
    if (!code || typeof code !== 'string') return false;
    const cleaned = code.toUpperCase().trim();
    return cleaned.length === 8 && /^[A-Z2-9]+$/.test(cleaned);
}

function isURL(str) {
    if (!str || typeof str !== 'string') return false;
    return /^(https?:\/\/|www\.)/i.test(str.trim());
}

describe('isValidCode', () => {
    it('should accept valid 8-char code with allowed chars', () => {
        expect(isValidCode('ABC23456')).toBe(true);
    });

    it('should accept lowercase and trim', () => {
        expect(isValidCode('  abc23456  ')).toBe(true);
    });

    it('should reject short codes', () => {
        expect(isValidCode('ABC')).toBe(false);
    });

    it('should reject long codes', () => {
        expect(isValidCode('ABC123456789')).toBe(false);
    });

    it('should reject codes with invalid chars', () => {
        expect(isValidCode('ABC@1234')).toBe(false);
    });

    it('should reject null/undefined', () => {
        expect(isValidCode(null)).toBe(false);
        expect(isValidCode(undefined)).toBe(false);
    });

    it('should reject non-strings', () => {
        expect(isValidCode(12345678)).toBe(false);
    });

    it('should reject codes with 0, 1 (ambiguous chars not in charset)', () => {
        // Grug note: CONFIG.CODE_CHARS excludes 0,1,O,I to avoid confusion
        expect(isValidCode('ABC01234')).toBe(false); // Has 0 and 1
    });
});

describe('isURL', () => {
    it('should detect http URLs', () => {
        expect(isURL('http://example.com')).toBe(true);
    });

    it('should detect https URLs', () => {
        expect(isURL('https://example.com')).toBe(true);
    });

    it('should detect www URLs', () => {
        expect(isURL('www.example.com')).toBe(true);
    });

    it('should reject plain text', () => {
        expect(isURL('just some text')).toBe(false);
    });

    it('should reject null/undefined', () => {
        expect(isURL(null)).toBe(false);
        expect(isURL(undefined)).toBe(false);
    });

    it('should handle whitespace', () => {
        expect(isURL('  https://example.com  ')).toBe(true);
    });
});
