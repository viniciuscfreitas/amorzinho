// Grug say: Auth, login, logout, name wizard. All in one place!

// Login / Create
app.createCouple = async function () {
    // Grug fix: don't create yet. Just open wizard.
    this.state.code = null; // Ensure we know we are creating
    this.showNameWizard();
};

app.login = async function () {
    const code = document.getElementById('code-input').value.toUpperCase().trim();
    if (code.length < CONFIG.MIN_CODE_INPUT_LENGTH) {
        return this.toast('Código muito curto');
    }

    // Grug fix: Use safeFetch!
    const { data, error } = await safeFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code })
    });

    if (error) {
        return this.toast('Erro ao entrar: ' + error);
    }

    if (data.code) {
        this.state.code = data.code;
        localStorage.setItem('amorzinho_code', data.code);

        // Grug fix: store names for UI logic
        this.state.creatorName = data.name;
        this.state.guestName = data.guest_name;

        // Update last login for streak calculation
        this.state.lastLogin = new Date().toISOString();
        localStorage.setItem(`amorzinho_lastLogin_${data.code}`, this.state.lastLogin);

        if (data.dates) {
            this.state.dates = data.dates;
            localStorage.setItem(`amorzinho_dates_${data.code}`, JSON.stringify(data.dates));
        }

        // Grug fix: check identity BEFORE loading data
        const localName = localStorage.getItem(`amorzinho_userName_${data.code}`);

        if (!localName) {
            // Case 1: Both names taken -> Identity Recovery needed
            if (data.name && data.guest_name) {
                this.showIdentityModal(data.name, data.guest_name);
                return;
            }

            // Case 2: New user or guest slot open -> Wizard needed
            this.loadData(data.code);
            if (!data.name || !data.guest_name) {
                this.showNameWizard();
            }
        } else {
            // Case 3: Known user -> Load normally
            this.loadData(data.code);
        }

        this.toast('Bem-vindo ao nosso amor ❤️');
    } else {
        this.toast('Erro ao entrar: ' + (data.error || 'Erro desconhecido'));
    }
};

app.logout = function () {
    this.stopPolling();

    // Grug fix: clear all local data for this code
    if (this.state.code) {
        localStorage.removeItem(`amorzinho_userName_${this.state.code}`);
        localStorage.removeItem(`amorzinho_dates_${this.state.code}`);
        localStorage.removeItem(`amorzinho_lastLogin_${this.state.code}`);
    }
    localStorage.removeItem('amorzinho_code');

    location.reload();
};

app.loadData = async function (code) {
    // Grug fix: load user name from localStorage
    if (!this.state.currentUserName) {
        const storedName = localStorage.getItem(`amorzinho_userName_${code}`);
        if (storedName) {
            this.state.currentUserName = storedName;
        }
    }

    // Grug fix: Use safeFetch!
    const { data, error } = await safeFetch(`/api/items?code=${code}`);

    if (error) {
        return this.toast('Erro ao carregar dados: ' + error);
    }

    if (Array.isArray(data)) {
        this.state.items = data;

        // Grug say: localStorage can be corrupted. Try/catch = safe.
        let localDates = safeJSONParse(localStorage.getItem(`amorzinho_dates_${code}`) || '[]', []);

        if (this.state.dates.length === 0) {
            this.state.dates = localDates;
        }

        this.switchScreen('main-screen');

        // Update QR code
        await this.loadQRCode(code);

        const displayCode = document.getElementById('display-code');
        if (displayCode) displayCode.innerText = code;

        this.renderItems();
        this.renderDates();
        this.checkStreak();

        // Grug fix: start real-time polling
        this.startPolling(code);

        // Grug fix: show PWA install button
        this.showPWAInstall();
    } else {
        this.toast('Erro ao carregar itens');
    }
};

// Identity Recovery Modal
app.showIdentityModal = function (name1, name2) {
    const modal = document.getElementById('identity-modal');
    const btn1 = document.getElementById('btn-identity-1');
    const btn2 = document.getElementById('btn-identity-2');
    const mainContent = document.getElementById('main-screen');

    if (!modal || !btn1 || !btn2) return;

    btn1.textContent = `Sou ${name1}`;
    btn1.onclick = () => this.selectIdentity(name1);

    btn2.textContent = `Sou ${name2}`;
    btn2.onclick = () => this.selectIdentity(name2);

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    if (mainContent) mainContent.inert = true;
};

app.selectIdentity = function (name) {
    const modal = document.getElementById('identity-modal');
    const mainContent = document.getElementById('main-screen');

    this.state.currentUserName = name;
    localStorage.setItem(`amorzinho_userName_${this.state.code}`, name);

    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    if (mainContent) mainContent.inert = false;

    this.toast(`Bem-vindo de volta, ${name}! ❤️`);

    // Reload data to ensure everything is correct with new identity
    this.loadData(this.state.code);
};

// Name Wizard
app.showNameWizard = function () {
    const wizard = document.getElementById('name-wizard');
    const mainContent = document.getElementById('main-screen');
    if (!wizard) return;

    wizard.classList.add('open');
    wizard.setAttribute('aria-hidden', 'false');
    if (mainContent) mainContent.inert = true;

    this.lastFocusedElement = document.activeElement;
    setTimeout(() => {
        const input = document.getElementById('wizard-name');
        if (input) {
            input.value = '';
            input.focus();
        }

        // Grug fix: pre-fill anniversary if exists (for guest confirmation)
        const annivInput = document.getElementById('wizard-anniversary');
        const annivHint = document.getElementById('wizard-anniversary-hint');

        if (annivInput && this.state.dates) {
            const anniv = this.state.dates.find(d => d.name.includes('Nosso Início'));
            if (anniv && anniv.originalDate) {
                annivInput.value = anniv.originalDate;

                // Show who defined it
                if (annivHint && this.state.creatorName) {
                    annivHint.textContent = `Preenchido por ${this.state.creatorName}`;
                    annivHint.style.display = 'block';
                }
            } else {
                annivInput.value = '';
                if (annivHint && this.state.creatorName) {
                    annivHint.textContent = `${this.state.creatorName} não colocou a data. Quer preencher?`;
                    annivHint.style.display = 'block';
                } else if (annivHint) {
                    annivHint.style.display = 'none';
                }
            }
        }
    }, 100);
};

app.hideNameWizard = function () {
    const wizard = document.getElementById('name-wizard');
    const mainContent = document.getElementById('main-screen');
    if (!wizard) return;

    wizard.classList.remove('open');
    wizard.setAttribute('aria-hidden', 'true');
    if (mainContent) mainContent.inert = false;

    if (this.lastFocusedElement) {
        this.lastFocusedElement.focus();
    }
};

// Grug fix: Helper to get name from wizard input
app.getNameFromWizard = function () {
    const input = document.getElementById('wizard-name');
    return input ? input.value.trim() : '';
};

// Grug fix: Helper to get dates from wizard
app.getDatesFromWizard = function () {
    return {
        birthday: document.getElementById('wizard-birthday').value,
        anniversary: document.getElementById('wizard-anniversary').value
    };
};

// Grug fix: Create new couple (only this, nothing else!)
app.createNewCouple = async function (name) {
    // Grug fix: Use safeFetch!
    const payload = { name };
    const { data, error } = await safeFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (error || !data.code) {
        throw new Error(error || data.error || 'Erro ao criar história');
    }

    // Set up new couple
    this.state.code = data.code;
    localStorage.setItem('amorzinho_code', data.code);

    // Initialize dates
    this.state.dates = CONFIG.DEFAULT_HOLIDAYS.map(h =>
        this.getNextHoliday(h.day, h.month, h.name)
    );

    this.state.currentUserName = name;
    localStorage.setItem(`amorzinho_userName_${this.state.code}`, name);
    this.state.lastLogin = new Date().toISOString();
    localStorage.setItem(`amorzinho_lastLogin_${data.code}`, this.state.lastLogin);

    return data.code;
};

// Grug fix: Save name for existing couple (only this!)
app.saveExistingUserName = async function (name) {
    // Grug fix: Use safeFetch!
    const { data, error } = await safeFetch('/api/save-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: this.state.code, name })
    });

    if (error || !data.success) {
        throw new Error(error || data.error || 'Erro ao salvar nome');
    }
};

// Grug fix: Add birthday to dates (only this!)
app.addBirthdayToDate = function (birthday, name) {
    if (!birthday) return;

    const birthdayDate = this.getNextHolidayFromDate(birthday, `Aniversário de ${name} 🎂`);
    this.state.dates.push(birthdayDate);
};

// Grug fix: Add or update anniversary (only this!)
app.saveAnniversary = function (anniversary) {
    if (!anniversary) return;

    const existingIndex = this.state.dates.findIndex(d => d.name.includes('Nosso Início'));
    const annivDate = this.getNextHolidayFromDate(anniversary, 'Nosso Início 💑');
    annivDate.originalDate = anniversary;

    if (existingIndex !== -1) {
        this.state.dates[existingIndex] = annivDate;
    } else {
        this.state.dates.push(annivDate);
    }
};

// Grug fix: Main saveName function - now simple!
app.saveName = async function () {
    const name = this.getNameFromWizard();
    if (!name) {
        return this.toast('Digite seu nome, por favor.');
    }

    try {
        // Grug say: Create OR save, never both!
        if (!this.state.code) {
            await this.createNewCouple(name);
        } else {
            await this.saveExistingUserName(name);
        }

        // Common for both flows: set current user
        this.state.currentUserName = name;
        localStorage.setItem(`amorzinho_userName_${this.state.code}`, name);

        // Save dates from wizard
        const dates = this.getDatesFromWizard();
        this.addBirthdayToDate(dates.birthday, name);
        this.saveAnniversary(dates.anniversary);

        // Sync and finish
        this.saveLocalDates();
        this.syncDates();
        this.hideNameWizard();
        this.loadData(this.state.code);
        this.toast('História iniciada com amor ❤️');
    } catch (e) {
        console.error(e);
        this.toast(e.message || 'Erro ao salvar');
    }
};

// Polling
app.startPolling = function (code) {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(async () => {
        if (!this.state.code) return;

        try {
            // Poll Items
            const resItems = await fetch(`/api/items?code=${code}`);
            const dataItems = await resItems.json();
            if (Array.isArray(dataItems)) {
                const currentSig = JSON.stringify(this.state.items.map(i => ({ id: i.id, b: i.bought, t: i.title })));
                const newSig = JSON.stringify(dataItems.map(i => ({ id: i.id, b: i.bought, t: i.title })));

                if (currentSig !== newSig) {
                    this.state.items = dataItems;
                    this.renderItems();
                }
            }

            // Poll Couple Data (Dates & Names)
            const resCouple = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code })
            });
            const dataCouple = await resCouple.json();

            if (dataCouple.dates) {
                const currentDatesSig = JSON.stringify(this.state.dates);
                const newDatesSig = JSON.stringify(dataCouple.dates);

                if (currentDatesSig !== newDatesSig) {
                    this.state.dates = dataCouple.dates;
                    this.renderDates();
                    this.checkStreak();
                    this.saveLocalDates();
                }
            }

            // Update names if changed
            if (dataCouple.name !== this.state.creatorName || dataCouple.guest_name !== this.state.guestName) {
                this.state.creatorName = dataCouple.name;
                this.state.guestName = dataCouple.guest_name;
            }

        } catch (e) {
            console.error('Polling error', e);
        }
    }, CONFIG.POLL_INTERVAL_MS);
};

app.stopPolling = function () {
    if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
    }
};

// Grug fix: Visibility check - stop polling when tab hidden
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        app.stopPolling();
    } else if (app.state.code) {
        app.startPolling(app.state.code);
    }
});
