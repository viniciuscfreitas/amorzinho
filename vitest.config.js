// Grug say: Vitest config. Simple!

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Grug fix: Only run .test.js files, not .spec.js (those are Playwright)
        include: ['tests/**/*.test.js'],
        exclude: ['tests/**/*.spec.js', 'node_modules/**']
    }
});
