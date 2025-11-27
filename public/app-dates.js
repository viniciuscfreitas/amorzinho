// Grug say: Dates, holidays, streak counter. Together mode love!

// Grug helper: calculate next occurrence of a date
app.getNextHoliday = function (day, month, name) {
    const today = new Date();
    let year = today.getFullYear();
    // Note: Month is 0-indexed in JS (0 = Jan, 11 = Dec)
    let date = new Date(year, month - 1, day);

    // If date has passed this year, move to next year
    if (date < today) {
        date.setFullYear(year + 1);
    }

    // Format YYYY-MM-DD
    const dateStr = date.toISOString().split('T')[0];
    return { name, date: dateStr };
};

// Grug helper: calculate next occurrence from a full date string (YYYY-MM-DD)
app.getNextHolidayFromDate = function (dateString, name) {
    if (!dateString) return null;
    const [y, m, d] = dateString.split('-').map(Number);
    return this.getNextHoliday(d, m, name);
};

app.saveLocalDates = function () {
    if (this.state.code) {
        localStorage.setItem(`amorzinho_dates_${this.state.code}`, JSON.stringify(this.state.dates));
    }
};

// Grug say: DRY. One function to sync dates.
app.syncDates = async function () {
    try {
        await fetch('/api/dates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: this.state.code, dates: this.state.dates })
        });
    } catch (e) {
        console.log('Date sync failed, but saved locally');
    }
};

app.addDate = async function () {
    const name = document.getElementById('date-name').value;
    const date = document.getElementById('date-val').value;
    if (!name || !date) return;

    this.state.dates.push({ name, date });
    localStorage.setItem(`amorzinho_dates_${this.state.code}`, JSON.stringify(this.state.dates));

    await this.syncDates();
    this.renderDates();

    document.getElementById('date-name').value = '';
    document.getElementById('date-name').focus();
};

app.renderDates = function () {
    const container = document.getElementById('dates-container');
    container.innerHTML = '';

    // Grug fix: sort dates by proximity
    const sortedDates = this.state.dates.map(d => {
        const dateObj = new Date(d.date);
        const today = new Date();
        // Reset hours
        dateObj.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        const diffTime = dateObj - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { ...d, diffDays, dateObj };
    }).sort((a, b) => a.diffDays - b.diffDays);

    // Render List
    sortedDates.forEach((d, idx) => {
        const dayStr = d.diffDays === 0 ? 'Hoje' : (d.diffDays > 0 ? `Faltam ${d.diffDays} dias` : `${Math.abs(d.diffDays)} dias atrás`);
        const dateReadable = d.dateObj.toLocaleDateString('pt-BR');

        // Find original index for deletion
        const originalIdx = this.state.dates.findIndex(od => od.name === d.name && od.date === d.date);

        container.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(0,0,0,0.03); border-radius: 12px;">
                <div>
                    <div style="font-weight: 600; font-size: 0.9rem;">${d.name}</div>
                    <div style="font-size: 0.8rem; color: var(--accent-dark); font-weight:700;">${dayStr}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="font-size: 0.85rem; opacity: 0.8;">
                        <span class="sr-only">Data:</span> ${dateReadable}
                    </div>
                    <button onclick="app.removeDate(${originalIdx})" class="icon-btn" style="width: 32px; height: 32px; min-width: 32px; min-height: 32px; font-size: 1rem;" aria-label="Remover data">
                        <i class="ph ph-trash" aria-hidden="true"></i>
                    </button>
                </div>
            </div>
        `;
    });

    this.renderHeroWidget(sortedDates);
};

app.renderHeroWidget = function (sortedDates) {
    const container = document.getElementById('hero-widget');
    if (!container) return;

    // Find first future date (or today)
    const nextDate = sortedDates.find(d => d.diffDays >= 0);

    if (!nextDate) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    const isToday = nextDate.diffDays === 0;
    const title = isToday ? 'É Hoje! 🎉' : `Faltam ${nextDate.diffDays} dias`;
    const subtitle = `para ${nextDate.name}`;

    container.innerHTML = `
        <div class="card" style="background: linear-gradient(135deg, var(--accent-bg), var(--accent-dark)); color: white; text-align: center; padding: 20px;">
            <div style="font-size: 2rem; font-weight: 800; line-height: 1.1; margin-bottom: 4px;">
                ${title}
            </div>
            <div style="font-size: 1rem; opacity: 0.9; font-weight: 500;">
                ${subtitle}
            </div>
        </div>
    `;
};

app.removeDate = async function (idx) {
    this.state.dates.splice(idx, 1);
    this.saveLocalDates();
    await this.syncDates();
    this.renderDates();
};

app.checkStreak = function () {
    const disp = document.getElementById('streak-display');
    if (!disp) return;

    // Grug fix: calculate days since "Nosso Início" (Anniversary)
    let days = 0;
    let label = 'dias amando';

    const anniversary = this.state.dates.find(d => d.name.includes('Nosso Início'));

    if (anniversary && anniversary.originalDate) {
        const start = new Date(anniversary.originalDate);
        const today = new Date();
        // Reset hours to compare dates only
        start.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        const diffTime = today - start;
        days = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        // If negative (future date?), show 0
        if (days < 0) days = 0;
    } else {
        // Fallback: use login streak if no anniversary set
        days = 1;
        if (this.state.lastLogin && this.state.code) {
            const lastLoginDate = new Date(this.state.lastLogin);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            lastLoginDate.setHours(0, 0, 0, 0);

            const diffTime = today - lastLoginDate;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            // If logged in today or yesterday, streak continues
            if (diffDays === 0 || diffDays === 1) {
                // Try to get stored streak
                const storedStreak = localStorage.getItem(`amorzinho_streak_${this.state.code}`);
                if (storedStreak && diffDays === 0) {
                    days = parseInt(storedStreak, 10) || 1;
                } else if (storedStreak && diffDays === 1) {
                    days = parseInt(storedStreak, 10) + 1;
                    localStorage.setItem(`amorzinho_streak_${this.state.code}`, days.toString());
                } else {
                    days = 1;
                    localStorage.setItem(`amorzinho_streak_${this.state.code}`, '1');
                }
            } else {
                // Streak broken, reset to 1
                days = 1;
                localStorage.setItem(`amorzinho_streak_${this.state.code}`, '1');
            }
        }
    }

    disp.innerHTML = `<i class="ph-fill ph-heart" aria-hidden="true"></i> ${days} ${days === 1 ? 'dia' : 'dias'} amando`;
    disp.setAttribute('aria-label', `${days} ${days === 1 ? 'dia' : 'dias'} de amor`);
};
