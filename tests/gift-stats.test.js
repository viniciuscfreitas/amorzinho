import '../../public/config.js';
import '../../public/app-dates.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('gift stats', () => {
    beforeEach(() => {
        // Mock app state
        app.state = {
            currentUserName: 'Alice',
            items: [
                { bought: true, bought_by: 'Alice' },
                { bought: true, bought_by: 'Bob' },
                { bought: false }
            ]
        };
    });

    it('counts gifts given and received correctly', () => {
        const stats = app.getGiftStats();
        expect(stats.myGifts).toBe(1);
        expect(stats.partnerGifts).toBe(1);
    });
});
