// Grug say: Playwright config. Simple!

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 30000,
    retries: 1,
    use: {
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
        headless: true,
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    webServer: {
        command: 'node server.js',
        port: 3000,
        timeout: 120000,
        reuseExistingServer: !process.env.CI,
    },
});
