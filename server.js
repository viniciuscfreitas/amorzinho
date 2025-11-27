const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const CONFIG = require('./config');

const app = express();
const db = new sqlite3.Database('amorzinho.db');

// Grug say: Middleware good, body-parser bad.
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

// Grug fix: Rate limit against brute force on login
const loginLimiter = rateLimit({
    windowMs: CONFIG.LOGIN_RATE_LIMIT_WINDOW_MS,
    max: CONFIG.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    message: { error: 'Muitas tentativas. Tente novamente em 5 minutos.' }
});

// DB Helpers (Promisified for Grug sanity)
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Database Setup
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS couples (
        code TEXT PRIMARY KEY,
        name TEXT,
        guest_name TEXT,
        dates TEXT DEFAULT '[]',
        premium INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        couple_code TEXT,
        title TEXT,
        url TEXT,
        image TEXT,
        price TEXT,
        price_manual TEXT,
        note TEXT,
        bought INTEGER DEFAULT 0,
        bought_by TEXT,
        added_by TEXT,
        is_goal INTEGER DEFAULT 0,
        goal_progress INTEGER DEFAULT 0,
        goal_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS dates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        couple_code TEXT,
        name TEXT,
        date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Grug Utils
function generateCode() {
    let code = '';
    for (let i = 0; i < CONFIG.CODE_LENGTH; i++) {
        code += CONFIG.CODE_CHARS[Math.floor(Math.random() * CONFIG.CODE_CHARS.length)];
    }
    return code;
}

// Grug say: validate code format. 8 chars, alphanumeric only.
function isValidCode(code) {
    if (!code || typeof code !== 'string') return false;
    const cleaned = code.toUpperCase().trim();
    return cleaned.length === CONFIG.CODE_LENGTH && /^[A-Z2-9]+$/.test(cleaned);
}

// Routes

// 1. Login / Create Couple (Grug fix: rate limited)
app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        let { code, name } = req.body;

        if (!code) {
            // Create new couple
            let unique = false;
            while (!unique) {
                code = generateCode();
                const exists = await dbGet('SELECT 1 FROM couples WHERE code = ?', [code]);
                if (!exists) unique = true;
            }
            // Grug fix: if name provided (creation flow), save it immediately
            if (name) {
                await dbRun('INSERT INTO couples (code, name) VALUES (?, ?)', [code, name.trim().substring(0, CONFIG.MAX_NAME_LENGTH)]);
            } else {
                await dbRun('INSERT INTO couples (code) VALUES (?)', [code]);
            }
            return res.json({ code, new: true, name: name || null, guest_name: null });
        }

        // Check existing - validate format
        code = code.toUpperCase().trim();
        if (!isValidCode(code)) {
            return res.status(400).json({ error: 'Código inválido. Deve ter 8 caracteres.' });
        }

        const couple = await dbGet('SELECT * FROM couples WHERE code = ?', [code]);
        if (couple) {
            // Grug say: JSON.parse can break. Try/catch = safe.
            let dates = [];
            try {
                dates = JSON.parse(couple.dates || '[]');
            } catch (e) {
                dates = []; // If broken, use empty
            }
            return res.json({
                code,
                new: false,
                premium: couple.premium,
                dates,
                name: couple.name || null,
                guest_name: couple.guest_name || null
            });
        } else {
            return res.status(404).json({ error: 'Código não encontrado' });
        }
    } catch (e) {
        console.error('Login error:', e);
        return res.status(500).json({ error: 'Erro interno' });
    }
});

// 2. List Items
app.get('/api/items', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) return res.status(400).json({ error: 'Code required' });
        if (!isValidCode(code)) return res.status(400).json({ error: 'Código inválido' });

        const items = await dbAll('SELECT * FROM items WHERE couple_code = ? ORDER BY created_at DESC', [code]);
        res.json(items);
    } catch (e) {
        console.error('List items error:', e);
        return res.status(500).json({ error: 'Erro ao buscar itens' });
    }
});

// Debug helpers
const DEBUG_SCRAPING = process.env.DEBUG_SCRAPING === '1';
const DEBUG_SCRAPING_DIR = path.join(__dirname, 'scrape-debug');

function maybeSaveDebugHtml(url, html) {
    if (!DEBUG_SCRAPING) return;
    try {
        if (!fs.existsSync(DEBUG_SCRAPING_DIR)) {
            fs.mkdirSync(DEBUG_SCRAPING_DIR, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeName = `fetch-debug-${timestamp}-${Math.random().toString(36).slice(2, 6)}.html`;
        const filePath = path.join(DEBUG_SCRAPING_DIR, safeName);
        fs.writeFileSync(filePath, `<!-- ${url} -->\n${html}`, 'utf8');
        console.log('fetchLinkData: HTML salvo para debug em', filePath);
    } catch (e) {
        console.error('Erro ao salvar HTML de debug:', e);
    }
}

// Grug fix: SIMPLIFIED scraping logic - 80/20 solution!
// Grug say: Just use Open Graph tags. If site no have, site problem not grug problem!
async function fetchLinkData(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.SCRAPING_TIMEOUT_MS);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const html = await response.text();
        const $ = cheerio.load(html);

        // Grug say: 80/20! Just Open Graph tags + simple fallbacks
        let title = $('meta[property="og:title"]').attr('content') ||
            $('meta[name="twitter:title"]').attr('content') ||
            $('title').text().trim() ||
            '';

        let image = $('meta[property="og:image"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content') ||
            '';

        let price = $('meta[property="product:price:amount"]').attr('content') ||
            $('meta[property="og:price:amount"]').attr('content') ||
            '';

        // Grug fix: If no price in meta tags, try find R$ pattern in page text
        if (!price) {
            const bodyText = $('body').text().substring(0, 10000);
            const match = bodyText.match(/R\$\s?(\d{1,3}(?:\.\d{3})*,\d{2})/);
            if (match) price = match[0];
        }

        const missingTitle = !title;
        const missingPrice = !price;

        if (missingTitle || missingPrice) {
            console.warn(`fetchLinkData: ${missingTitle ? 'no title' : ''}${missingTitle && missingPrice ? ' and ' : ''}${missingPrice ? 'no price' : ''} for`, url);
            maybeSaveDebugHtml(url, html);
        }

        // Grug fix: Format price
        if (price) {
            let cleanPrice = price.toString().replace(/[^\d,.]/g, '');

            if (cleanPrice.includes(',')) {
                cleanPrice = cleanPrice.replace(/\./g, '').replace(',', '.');
            } else {
                if (cleanPrice.match(/\.\d{3}$/)) {
                    cleanPrice = cleanPrice.replace(/\./g, '');
                }
            }

            const numPrice = parseFloat(cleanPrice);
            if (!isNaN(numPrice) && numPrice > 0) {
                price = 'R$ ' + numPrice.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            } else {
                price = '???';
            }
        } else {
            price = '???';
        }

        title = title.trim().substring(0, CONFIG.MAX_TITLE_LENGTH);
        image = image.substring(0, CONFIG.MAX_URL_LENGTH);

        return { title, price, image };
    } catch (e) {
        console.error('Fetch link error:', e);
        return { title: '', price: '???', image: '' };
    }
}

// Grug fix: API endpoint for frontend to call
app.post('/api/fetch-link', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'URL required' });
        }
        // Grug say: fetch and return data
        const data = await fetchLinkData(url);
        res.json(data);
    } catch (e) {
        console.error('Fetch-link endpoint error:', e);
        res.json({ title: '', price: '???', image: '' });
    }
});

// 3. Add Item (Grug fix: now with auto-fetch support + name + price_manual + note + is_goal + goal_date)
app.post('/api/items', async (req, res) => {
    try {
        const { code, url, title, price_manual, note, userName, is_goal, goal_date } = req.body;
        if (!code) return res.status(400).json({ error: 'Missing code' });
        if (!isValidCode(code)) return res.status(400).json({ error: 'Código inválido' });

        // Grug check: user must give title OR url
        let finalTitle = title || '';
        let finalPrice = '???';
        let finalImage = '';

        // Grug fix: if URL provided, always fetch to get price (even if title exists)
        if (url) {
            try {
                const fetched = await fetchLinkData(url);

                // Use fetched title if no title provided, otherwise keep user's title
                if (!finalTitle || finalTitle.trim() === '') {
                    finalTitle = fetched.title || url;
                }
                // Always use fetched price if available
                if (fetched.price && fetched.price !== '???') {
                    finalPrice = fetched.price;
                }
                if (fetched.image) {
                    finalImage = fetched.image;
                }
            } catch (e) {
                console.error('Fetch error in addItem:', e);
                if (!finalTitle || finalTitle.trim() === '') {
                    finalTitle = url; // Fallback to URL only if no title
                }
            }
        }

        if (!finalTitle || finalTitle.trim().length === 0) {
            return res.status(400).json({ error: 'Title ou URL required' });
        }

        // Sanitize title
        const cleanTitle = finalTitle.trim().substring(0, CONFIG.MAX_TITLE_LENGTH);

        // Check limits and get couple name
        const couple = await dbGet('SELECT premium, name FROM couples WHERE code = ?', [code]);
        if (!couple) return res.status(404).json({ error: 'Código não encontrado' });

        const countRow = await dbGet('SELECT COUNT(*) as count FROM items WHERE couple_code = ?', [code]);

        if (!couple.premium && countRow.count >= CONFIG.FREE_ITEM_LIMIT) {
            return res.status(402).json({ error: 'Limite atingido. Pague o Grug.' });
        }

        // Grug fix: use provided userName, or fallback to couple name, or 'Você'
        let addedBy = userName || 'Você';
        // Security check: ensure userName is actually one of the couple (optional, but good)
        if (!userName) {
            addedBy = couple.name || 'Você';
        }

        // Grug fix: save with fetched data + name + price_manual + note + is_goal + goal_date
        const info = await dbRun(
            'INSERT INTO items (couple_code, added_by, url, title, price, price_manual, image, note, is_goal, goal_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [code, addedBy, (url || '').substring(0, CONFIG.MAX_URL_LENGTH), cleanTitle, finalPrice, (price_manual || '').substring(0, CONFIG.MAX_PRICE_MANUAL_LENGTH), finalImage.substring(0, CONFIG.MAX_URL_LENGTH), (note || '').substring(0, CONFIG.MAX_NOTE_LENGTH), is_goal ? 1 : 0, goal_date || null]
        );

        res.json({ id: info.lastID, title: cleanTitle, price: finalPrice, price_manual: price_manual || '', note: note || '', image: finalImage, added_by: addedBy, is_goal: is_goal ? 1 : 0, goal_date: goal_date || null });
    } catch (e) {
        console.error('Add item error:', e);
        return res.status(500).json({ error: 'Erro ao salvar item' });
    }
});

// 4. Toggle Buy Item
app.post('/api/items/:id/buy', async (req, res) => {
    try {
        const { id } = req.params;
        const { userName } = req.body;

        const item = await dbGet('SELECT bought FROM items WHERE id = ?', [id]);
        if (!item) return res.status(404).json({ error: 'Item gone' });

        const newStatus = item.bought ? 0 : 1;
        const boughtBy = newStatus ? (userName || null) : null; // Clear bought_by when unmarking

        await dbRun('UPDATE items SET bought = ?, bought_by = ? WHERE id = ?', [newStatus, boughtBy, id]);
        res.json({ success: true, bought: newStatus, bought_by: boughtBy });
    } catch (e) {
        console.error('Toggle buy error:', e);
        return res.status(500).json({ error: 'Erro ao atualizar item' });
    }
});

// Grug fix: Update Goal Progress
app.post('/api/items/:id/progress', async (req, res) => {
    try {
        const { id } = req.params;
        const { progress } = req.body;

        await dbRun('UPDATE items SET goal_progress = ? WHERE id = ?', [progress, id]);
        res.json({ success: true, progress });
    } catch (e) {
        console.error('Update progress error:', e);
        return res.status(500).json({ error: 'Erro ao atualizar progresso' });
    }
});

// 5. Delete Item (Grug fix: validate user can delete)
app.post('/api/items/:id/delete', async (req, res) => {
    try {
        const { id } = req.params;
        const { code, userName } = req.body;

        // Grug fix: get item to check who added it
        const item = await dbGet('SELECT couple_code, added_by FROM items WHERE id = ?', [id]);
        if (!item) {
            return res.status(404).json({ error: 'Item não encontrado' });
        }

        // Grug fix: validate code matches (required now)
        if (!code || !isValidCode(code) || item.couple_code !== code) {
            return res.status(403).json({ error: 'Não autorizado' });
        }

        // Grug fix: validate user can delete (only who added it)
        const requestedUser = userName || 'Você';
        if (item.added_by && item.added_by !== requestedUser) {
            return res.status(403).json({ error: 'Apenas quem adicionou pode deletar' });
        }

        await dbRun('DELETE FROM items WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (e) {
        console.error('Delete item error:', e);
        return res.status(500).json({ error: 'Erro ao deletar item' });
    }
});

// 6. Generate QR
app.get('/api/qrcode', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('Code required');

    const url = `${req.protocol}://${req.get('host')}/?code=${code}`;

    try {
        const qr = await QRCode.toDataURL(url);
        res.json({ qr, url });
    } catch (e) {
        res.status(500).send('QR Error');
    }
});

// 7. Update Dates
app.post('/api/dates', async (req, res) => {
    try {
        const { code, dates } = req.body;
        if (!code || !isValidCode(code)) return res.status(400).json({ error: 'Código inválido' });
        if (!Array.isArray(dates)) return res.status(400).json({ error: 'Dates must be array' });

        await dbRun('UPDATE couples SET dates = ? WHERE code = ?', [JSON.stringify(dates), code]);
        res.json({ success: true });
    } catch (e) {
        console.error('Update dates error:', e);
        return res.status(500).json({ error: 'Erro ao atualizar datas' });
    }
});

// 8. AbacatePay Checkout (Grug fix: simple checkout)
app.post('/api/checkout', async (req, res) => {
    try {
        const { code, plan } = req.body; // plan: 'monthly' or 'yearly'
        if (!code || !isValidCode(code)) return res.status(400).json({ error: 'Código inválido' });
        if (!['monthly', 'yearly'].includes(plan)) return res.status(400).json({ error: 'Plano inválido' });

        const amount = CONFIG.PLAN_PRICES[plan];
        const apiKey = process.env.ABACATEPAY_API_KEY || '';

        if (!apiKey) {
            return res.status(500).json({ error: 'AbacatePay não configurado' });
        }

        // Grug say: call AbacatePay API (docs: https://docs.abacatepay.com)
        const abacateRes = await fetch('https://api.abacatepay.com/billing/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                amount: amount,
                description: `Amorzinho Premium - ${plan === 'monthly' ? 'Mensal' : 'Anual'}`,
                metadata: {
                    couple_code: code,
                    plan: plan
                }
            })
        });

        const abacateData = await abacateRes.json();

        // Grug fix: AbacatePay returns { data: {...}, error: null } format
        if (abacateData.error || !abacateData.data || !abacateData.data.url) {
            console.error('AbacatePay error:', abacateData.error);
            return res.status(500).json({ error: 'Erro ao criar checkout' });
        }

        res.json({ checkoutUrl: abacateData.data.url, billingId: abacateData.data.id });
    } catch (e) {
        console.error('Checkout error:', e);
        return res.status(500).json({ error: 'Erro ao processar checkout' });
    }
});

// 9. AbacatePay Webhook (Grug fix: mark premium when paid)
app.post('/api/webhook', async (req, res) => {
    try {
        // Grug say: AbacatePay sends { data: {...}, error: null }
        if (CONFIG.WEBHOOK_SECRET) {
            const incomingSecret = req.header('x-abacatepay-secret') || req.header('x-abacatepay-webhook-secret');
            if (!incomingSecret || incomingSecret !== CONFIG.WEBHOOK_SECRET) {
                console.warn('AbacatePay webhook rejected: invalid secret');
                return res.status(403).send('Forbidden');
            }
        }
        const { data } = req.body;

        // Grug fix: check if payment is completed
        if (data && data.status === 'PAID' && data.metadata && data.metadata.couple_code) {
            const code = data.metadata.couple_code;
            if (isValidCode(code)) {
                await dbRun('UPDATE couples SET premium = 1 WHERE code = ?', [code]);
                console.log(`Premium activated for couple: ${code}`);
            }
        }

        res.status(200).send('OK');
    } catch (e) {
        console.error('Webhook error:', e);
        res.status(200).send('OK'); // Always return OK to webhook
    }
});

// 10. Save Name (Grug fix: simple endpoint for name wizard)
app.post('/api/save-name', async (req, res) => {
    try {
        const { code, name, role } = req.body;
        if (!code || !isValidCode(code) || !name || name.trim().length < CONFIG.MIN_NAME_LENGTH) {
            return res.status(400).json({ error: 'Nome inválido' });
        }

        const cleanName = name.trim().substring(0, CONFIG.MAX_NAME_LENGTH);

        // Grug fix: determine column based on role OR empty slots
        let column = 'name';

        if (role === 'guest') {
            column = 'guest_name';
        } else if (role === 'creator') {
            column = 'name';
        } else {
            // Auto-detect if role not sent
            const couple = await dbGet('SELECT name, guest_name FROM couples WHERE code = ?', [code]);
            if (couple) {
                if (!couple.name) column = 'name';
                else if (!couple.guest_name) column = 'guest_name';
                else column = 'name'; // Default to overwriting creator if both full (fallback)
            }
        }

        await dbRun(`UPDATE couples SET ${column} = ? WHERE code = ?`, [cleanName, code]);
        res.json({ success: true, role: column === 'name' ? 'creator' : 'guest' });
    } catch (e) {
        console.error('Save name error:', e);
        res.status(500).json({ error: 'Erro ao salvar nome' });
    }
});

// Serve frontend (Grug fix: catch-all for SPA - Express 5 compatible)
app.use((req, res, next) => {
    // Grug say: skip API routes and files with extensions
    if (req.path.startsWith('/api') || req.path.match(/\.[a-z]+$/i)) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(CONFIG.PORT, () => {
    console.log(`Amorzinho running on port ${CONFIG.PORT}`);
    console.log(`Grug happy. Complexity low.`);
});
