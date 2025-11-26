// Grug say: All magic numbers in one place. Easy change, no hunt through code!

module.exports = {
    // Server Config
    PORT: process.env.PORT || 3000,

    // Code Generation
    CODE_LENGTH: 8,
    CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
    MIN_CODE_INPUT_LENGTH: 4,

    // Limits
    FREE_ITEM_LIMIT: 30,
    LOGIN_RATE_LIMIT_WINDOW_MS: 5 * 60 * 1000, // 5 minutes
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS: 10,

    // Scraping
    SCRAPING_TIMEOUT_MS: 8000,
    MAX_TITLE_LENGTH: 200,
    MAX_URL_LENGTH: 500,
    MAX_NOTE_LENGTH: 200,
    MAX_PRICE_MANUAL_LENGTH: 50,

    // Names
    MAX_NAME_LENGTH: 30,
    MIN_NAME_LENGTH: 2,

    // Polling (Frontend)
    POLL_INTERVAL_MS: 7000,

    // AbacatePay
    PLAN_PRICES: {
        monthly: 900,  // R$ 9.00 in cents
        yearly: 6900   // R$ 69.00 in cents
    }
};
