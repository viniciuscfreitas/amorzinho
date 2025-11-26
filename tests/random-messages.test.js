import '../../public/config.js';
import '../../public/app-core.js'; // getRandomMessage is defined in app-core
import { describe, it, expect, beforeEach } from 'vitest';

describe('random messages', () => {
    beforeEach(() => {
        // Ensure CONFIG is loaded
        // No extra setup needed
    });

    it('returns a message from the correct category', () => {
        const msg = app.getRandomMessage('itemAdded');
        const possible = CONFIG.CUTE_MESSAGES.itemAdded;
        expect(possible).toContain(msg);
    });

    it('falls back to generic message when category missing', () => {
        const msg = app.getRandomMessage('nonexistent');
        expect(msg).toBe('Feito! ✨');
    });
});
