// Grug say: Integration tests! Not unit tests, not e2e. Sweet spot!
// Run with: npm test

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Grug fix: Generate unique test code to avoid collisions
function generateTestCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'TEST';
    for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

test.describe('Amorzinho Integration Tests', () => {
    let testCode;

    test.beforeEach(() => {
        testCode = generateTestCode();
    });

    test('should create new couple and login', async ({ page }) => {
        await page.goto(BASE_URL);

        // Click "Ou comece uma nova história"
        await page.click('text=Ou comece uma nova história');

        // Fill wizard
        await page.fill('#wizard-name', 'Grug Test');
        await page.fill('#wizard-birthday', '1990-01-01');
        await page.fill('#wizard-anniversary', '2020-06-12');

        // Submit
        await page.click('text=Começar');

        //Wait for main screen
        await page.waitForSelector('#main-screen:not(.hidden)');

        // Should show streak
        const streak = await page.textContent('#streak-display');
        expect(streak).toContain('dia');
    });

    test('should add item without URL', async ({ page }) => {
        // Create couple first
        await page.goto(BASE_URL);
        await page.click('text=Ou comece uma nova história');
        await page.fill('#wizard-name', 'Grug');
        await page.click('text=Começar');
        await page.waitForSelector('#main-screen:not(.hidden)');

        // Add item
        await page.fill('#item-title', 'Livro do Grug');
        await page.click('#add-item-card button[aria-label*="Salvar"]');

        // Wait for toast
        await page.waitForSelector('#toast.visible');

        // Should appear in list
        const itemText = await page.textContent('#wish-list');
        expect(itemText).toContain('Livro do Grug');
    });

    test('should toggle item bought status', async ({ page }) => {
        // Setup: Create couple and add item
        await page.goto(BASE_URL);
        await page.click('text=Ou comece uma nova história');
        await page.fill('#wizard-name', 'Grug');
        await page.click('text=Começar');
        await page.waitForSelector('#main-screen:not(.hidden)');

        await page.fill('#item-title', 'Test Item');
        await page.click('#add-item-card button[aria-label*="Salvar"]');
        await page.waitForSelector('#toast.visible');

        // Click buy button
        await page.click('.wish-item button[aria-label*="Marcar como comprado"]');

        // Should show bought state
        const item = await page.$('.wish-item.bought-item');
        expect(item).not.toBeNull();
    });

    test('should create and track goal progress', async ({ page }) => {
        // Setup
        await page.goto(BASE_URL);
        await page.click('text=Ou comece uma nova história');
        await page.fill('#wizard-name', 'Grug');
        await page.click('text=Começar');
        await page.waitForSelector('#main-screen:not(.hidden)');

        // Enable goal mode
        await page.check('#item-is-goal');
        await page.fill('#item-title', 'Viagem para Paris');
        await page.fill('#item-goal-date', '2025-12-25');
        await page.click('#add-item-card button[aria-label*="Salvar"]');
        await page.waitForSelector('#toast.visible');

        // Should show progress bar
        const progressBar = await page.$('.wish-item.goal-item');
        expect(progressBar).not.toBeNull();

        // Update progress to 50%
        await page.click('.wish-item button:has-text("50%")');

        // Should update
        await page.waitForTimeout(500);
        const progressText = await page.textContent('.wish-item');
        expect(progressText).toContain('50%');
    });

    test('should add and display important dates', async ({ page }) => {
        // Setup
        await page.goto(BASE_URL);
        await page.click('text=Ou comece uma nova história');
        await page.fill('#wizard-name', 'Grug');
        await page.click('text=Começar');
        await page.waitForSelector('#main-screen:not(.hidden)');

        // Open settings
        await page.click('button[aria-label*="Configurações"]');

        // Add date
        await page.fill('#date-name', 'Aniversário do Grug');
        await page.fill('#date-val', '2025-12-31');
        await page.click('button[aria-label="Adicionar data especial"]');

        // Should appear in list
        const datesText = await page.textContent('#dates-container');
        expect(datesText).toContain('Aniversário do Grug');
    });

    test('should handle login with existing code', async ({ request }) => {
        // Create couple via API
        const createRes = await request.post(`${BASE_URL}/api/login`, {
            data: { code: '', name: 'Test Grug' }
        });
        const createData = await createRes.json();
        const code = createData.code;

        // Now login with that code via UI
        const { page } = await request.newContext();
        await page.goto(BASE_URL);
        await page.fill('#code-input', code);
        await page.click('text=Entrar no Nosso Segredo');

        await page.waitForSelector('#main-screen:not(.hidden)');
        const displayedCode = await page.textContent('#display-code');
        expect(displayedCode).toBe(code);

        await page.close();
    });
});

test.describe('API Integration Tests', () => {
    test('POST /api/login should create new couple', async ({ request }) => {
        const res = await request.post(`${BASE_URL}/api/login`, {
            data: { code: '', name: 'Grug' }
        });
        const data = await res.json();

        expect(res.status()).toBe(200);
        expect(data.code).toHaveLength(8);
        expect(data.new).toBe(true);
    });

    test('POST /api/items should add item', async ({ request }) => {
        // Create couple first
        const createRes = await request.post(`${BASE_URL}/api/login`, {
            data: { code: '', name: 'Grug' }
        });
        const { code } = await createRes.json();

        // Add item
        const res = await request.post(`${BASE_URL}/api/items`, {
            data: {
                code,
                title: 'Test Item',
                userName: 'Grug'
            }
        });
        const data = await res.json();

        expect(res.status()).toBe(200);
        expect(data.id).toBeDefined();
        expect(data.title).toBe('Test Item');
    });

    test('POST /api/items/:id/buy should toggle bought status', async ({ request }) => {
        // Setup: Create couple and item
        const createRes = await request.post(`${BASE_URL}/api/login`, {
            data: { code: '', name: 'Grug' }
        });
        const { code } = await createRes.json();

        const itemRes = await request.post(`${BASE_URL}/api/items`, {
            data: { code, title: 'Test' }
        });
        const { id } = await itemRes.json();

        // Buy
        const buyRes = await request.post(`${BASE_URL}/api/items/${id}/buy`, {
            data: { userName: 'Grug' }
        });
        const buyData = await buyRes.json();

        expect(buyRes.status()).toBe(200);
        expect(buyData.bought).toBe(1);

        // Unbuy
        const unbuyRes = await request.post(`${BASE_URL}/api/items/${id}/buy`, {
            data: { userName: 'Grug' }
        });
        const unbuyData = await unbuyRes.json();

        expect(unbuyData.bought).toBe(0);
    });

    test('Rate limiting should block excessive login attempts', async ({ request }) => {
        const promises = [];
        // Try 15 attempts (limit is 10)
        for (let i = 0; i < 15; i++) {
            promises.push(
                request.post(`${BASE_URL}/api/login`, {
                    data: { code: 'TESTCODE' }
                })
            );
        }

        const results = await Promise.all(promises);
        const statuses = results.map(r => r.status());

        // At least one should be 429 (Too Many Requests)
        expect(statuses).toContain(429);
    });
});
