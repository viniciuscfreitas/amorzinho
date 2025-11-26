// Grug say: Safe fetch helper. Always return {data, error}. No surprise!

/**
 * Grug fix: Consistent error handling for all fetch calls
 * 
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<{data: any, error: string|null}>}
 */
async function safeFetch(url, options = {}) {
    try {
        const response = await fetch(url, options);

        // Grug say: Check if response ok
        if (!response.ok) {
            return {
                data: null,
                error: `HTTP ${response.status}: ${response.statusText}`
            };
        }

        const data = await response.json();
        return { data, error: null };
    } catch (e) {
        // Grug say: Network error or JSON parse error
        return {
            data: null,
            error: e.message || 'Erro de conexão'
        };
    }
}

/**
 * Grug fix: Safe JSON parse. Never throw!
 * 
 * @param {string} jsonString - JSON string to parse
 * @param {any} fallback - Fallback value if parse fails
 * @returns {any}
 */
function safeJSONParse(jsonString, fallback = null) {
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.warn('JSON parse failed, using fallback:', e.message);
        return fallback;
    }
}

// Grug say: Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { safeFetch, safeJSONParse };
}
