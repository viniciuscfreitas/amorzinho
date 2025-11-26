const app = {
    state: {
        code: null,
        items: [],
        dates: [],
        lastLogin: null,
        currentUserName: null,
        currentUserRole: null,
        creatorName: null,
        guestName: null
    },

    pendingLinkUrl: null,

    lastFocusedElement: null,

    init() {
        const storedCode = localStorage.getItem('amorzinho_code');
        if (storedCode) {
            this.state.code = storedCode;
            // Load last login for streak
            const lastLogin = localStorage.getItem(`amorzinho_lastLogin_${storedCode}`);
            if (lastLogin) this.state.lastLogin = lastLogin;
            // Grug fix: load current user name
            const userName = localStorage.getItem(`amorzinho_userName_${storedCode}`);
            if (userName) this.state.currentUserName = userName;
            this.loadData(storedCode);
        } else {
            this.switchScreen('login-screen');
        }

        // Grug fix: detect URL when pasted in title field, auto-fetch title
        const titleInput = document.getElementById('item-title');
        if (titleInput) {
            titleInput.addEventListener('paste', (e) => {
                setTimeout(async () => {
                    const pasted = titleInput.value.trim();
                    if (this.isURL(pasted)) {
                        this.pendingLinkUrl = pasted;
                        // Grug say: keep URL in title field, fetch title automatically
                        this.toast('Buscando informações do link...');
                        try {
                            const res = await fetch('/api/fetch-link', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ url: pasted })
                            });
                            const data = await res.json();
                            if (data.title) {
                                titleInput.value = data.title;
                                // URL is implicitly handled by addItem checking isURL(title)
                                // or we could store it in a data attribute if we really wanted,
                                // but for now let's rely on the user seeing the title.
                                // If the user wants to keep the URL, they can undo.
                            } else {
                                titleInput.value = pasted; // Fallback to URL if no title
                            }
                        } catch (e) {
                            titleInput.value = pasted; // Fallback to URL on error
                        }
                    }
                }, 10);
            });
        }
    },

    // Grug fix: simple URL detection
    isURL(str) {
        if (!str || typeof str !== 'string') return false;
        // Grug logic: starts with http/https or www.
        return /^(https?:\/\/|www\.)/i.test(str.trim());
    },

    switchScreen(screenId) {
        document.querySelectorAll('.app-container').forEach(s => {
            s.classList.add('hidden');
            s.setAttribute('aria-hidden', 'true');
            s.inert = true;
        });

        const active = document.getElementById(screenId);
        active.classList.remove('hidden');
        active.setAttribute('aria-hidden', 'false');
        active.inert = false;
    },

    /* --- AUTH & UTILS --- */

    async createCouple() {
        // Grug fix: don't create yet. Just open wizard.
        // Creation happens when they click "Começar" in the wizard.
        this.state.code = null; // Ensure we know we are creating
        this.showNameWizard();
    },

    async login() {
        const code = document.getElementById('code-input').value.toUpperCase().trim();
        if (code.length < 4) return this.toast('Código muito curto');

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code })
            });
            const data = await res.json();

            if (data.code) {
                this.state.code = data.code;
                localStorage.setItem('amorzinho_code', data.code);

                // Grug fix: store names for UI logic
                this.state.creatorName = data.name;
                this.state.guestName = data.guest_name;

                // Grug fix: DO NOT assume identity from server.
                // Only local storage knows who I am.
                // If I am new, I will be null, and wizard will trigger.

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
                    // Grug say: DO NOT load data yet. Block access.
                    if (data.name && data.guest_name) {
                        this.showIdentityModal(data.name, data.guest_name);
                        return;
                    }

                    // Case 2: New user or guest slot open -> Wizard needed
                    // We load data so main screen is behind wizard
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
        } catch (e) {
            console.error(e);
            this.toast('Erro de conexão');
        }
    },

    showIdentityModal(name1, name2) {
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
    },

    selectIdentity(name) {
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
    },

    logout() {
        this.stopPolling();

        // Grug fix: clear all local data for this code to allow fresh start/testing
        if (this.state.code) {
            localStorage.removeItem(`amorzinho_userName_${this.state.code}`);
            localStorage.removeItem(`amorzinho_dates_${this.state.code}`);
            localStorage.removeItem(`amorzinho_lastLogin_${this.state.code}`);
        }
        localStorage.removeItem('amorzinho_code');

        location.reload();
    },

    async loadData(code) {
        try {
            // Grug fix: load user name from localStorage (already set on login, no extra HTTP call)
            if (!this.state.currentUserName) {
                const storedName = localStorage.getItem(`amorzinho_userName_${code}`);
                if (storedName) {
                    this.state.currentUserName = storedName;
                }
            }

            const res = await fetch(`/api/items?code=${code}`);
            const data = await res.json();

            if (Array.isArray(data)) {
                this.state.items = data;

                // Grug say: localStorage can be corrupted. Try/catch = safe.
                let localDates = [];
                try {
                    localDates = JSON.parse(localStorage.getItem(`amorzinho_dates_${code}`) || '[]');
                } catch (e) {
                    localDates = []; // If broken, use empty
                }
                if (this.state.dates.length === 0) {
                    this.state.dates = localDates;
                }

                this.switchScreen('main-screen');

                // Update QR code - Grug say: use local endpoint, not external service
                await this.loadQRCode(code);

                const displayCode = document.getElementById('display-code');
                if (displayCode) displayCode.innerText = code;

                this.renderItems();
                this.renderDates();
                this.checkStreak();

                // Grug fix: start real-time polling (7s)
                this.startPolling(code);

                // Grug fix: show PWA install button
                this.showPWAInstall();
            } else {
                this.toast('Erro ao carregar itens');
            }
        } catch (e) {
            console.error(e);
            this.toast('Erro ao carregar dados');
        }
    },

    showNameWizard() {
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
    },

    hideNameWizard() {
        const wizard = document.getElementById('name-wizard');
        const mainContent = document.getElementById('main-screen');
        if (!wizard) return;

        wizard.classList.remove('open');
        wizard.setAttribute('aria-hidden', 'true');
        if (mainContent) mainContent.inert = false;

        if (this.lastFocusedElement) {
            this.lastFocusedElement.focus();
        }
    },

    async saveName() {
        const input = document.getElementById('wizard-name');
        const name = input ? input.value.trim() : '';
        const birthday = document.getElementById('wizard-birthday').value;
        const anniversary = document.getElementById('wizard-anniversary').value;

        if (!name) {
            return this.toast('Digite seu nome, por favor.');
        }

        // Grug fix: if no code, we are CREATING a new couple
        if (!this.state.code) {
            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: '', name: name })
                });
                const data = await res.json();

                if (data.code) {
                    this.state.code = data.code;
                    localStorage.setItem('amorzinho_code', data.code);

                    // Initialize dates for new couple
                    this.state.dates = [
                        this.getNextHoliday(14, 2, 'São Valentim 💘'),
                        this.getNextHoliday(12, 6, 'Dia dos Namorados 🇧🇷'),
                        this.getNextHoliday(25, 12, 'Natal 🎄'),
                        this.getNextHoliday(31, 12, 'Ano Novo ✨')
                    ];

                    // Proceed to save dates and finish setup (logic continues below)
                    // We don't need to call save-name API again because login already did it

                    this.state.currentUserName = name;
                    localStorage.setItem(`amorzinho_userName_${this.state.code}`, name);
                    this.state.lastLogin = new Date().toISOString();
                    localStorage.setItem(`amorzinho_lastLogin_${data.code}`, this.state.lastLogin);

                    // Continue to date saving logic...
                } else {
                    return this.toast('Erro ao criar história.');
                }
            } catch (e) {
                console.error(e);
                return this.toast('Erro de conexão.');
            }
        } else {
            // Existing couple logic
            try {
                const res = await fetch('/api/save-name', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: this.state.code, name })
                });
                const data = await res.json();
                if (!data.success) {
                    return this.toast('Erro ao salvar nome: ' + (data.error || 'Tente novamente'));
                }
            } catch (e) {
                console.error(e);
                return this.toast('Erro ao salvar nome');
            }
        }

        // Common logic for both flows (saving dates and finishing)
        this.state.currentUserName = name;
        localStorage.setItem(`amorzinho_userName_${this.state.code}`, name);

        // Grug fix: save birthday
        if (birthday) {
            this.state.dates.push(this.getNextHolidayFromDate(birthday, `Aniversário de ${name} 🎂`));
        }

        // Grug fix: save anniversary (check if already exists to avoid dupes)
        if (anniversary) {
            const existingAnniversary = this.state.dates.findIndex(d => d.name.includes('Nosso Início'));
            const annivDate = this.getNextHolidayFromDate(anniversary, 'Nosso Início 💑');

            // Grug fix: store original date for pre-filling guest wizard
            annivDate.originalDate = anniversary;

            if (existingAnniversary !== -1) {
                // Update existing
                this.state.dates[existingAnniversary] = annivDate;
            } else {
                // Add new
                this.state.dates.push(annivDate);
            }
        }

        this.saveLocalDates();
        this.syncDates();

        this.hideNameWizard();

        // If we just created, we need to load data
        if (!document.getElementById('main-screen').classList.contains('hidden')) {
            // Already loaded? No, we might be in login screen still visually
            this.loadData(this.state.code);
        } else {
            this.loadData(this.state.code);
        }

        this.toast('História iniciada com amor ❤️');
    },

    // Grug fix: real-time polling every 7s
    pollingInterval: null,
    startPolling(code) {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        this.pollingInterval = setInterval(async () => {
            if (!this.state.code) return;

            try {
                // Poll Items
                const resItems = await fetch(`/api/items?code=${code}`);
                const dataItems = await resItems.json();
                if (Array.isArray(dataItems)) {
                    // Grug say: compare content to see if update needed
                    const currentSig = JSON.stringify(this.state.items.map(i => ({ id: i.id, b: i.bought, t: i.title })));
                    const newSig = JSON.stringify(dataItems.map(i => ({ id: i.id, b: i.bought, t: i.title })));

                    if (currentSig !== newSig) {
                        this.state.items = dataItems;
                        this.renderItems();
                    }
                }

                // Poll Couple Data (Dates & Names)
                // Grug say: reuse login endpoint to get full couple data
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
                        this.checkStreak(); // Update counter if dates changed
                        this.saveLocalDates();
                    }
                }

                // Update names if changed
                if (dataCouple.name !== this.state.creatorName || dataCouple.guest_name !== this.state.guestName) {
                    this.state.creatorName = dataCouple.name;
                    this.state.guestName = dataCouple.guest_name;
                    // Could re-render wizard hint if open, but unlikely needed
                }

            } catch (e) {
                console.error('Polling error', e);
            }
        }, 7000);
    },

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    },

    // Grug fix: PWA install button (mobile only)
    deferredPrompt: null,
    isMobile() {
        // Grug say: simple mobile detection
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (window.innerWidth <= 768);
    },
    showPWAInstall() {
        // Grug fix: only show on mobile
        if (!this.isMobile()) return;

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            return; // Already installed
        }

        // Show install button after a delay
        setTimeout(() => {
            const installBtn = document.getElementById('pwa-install-btn');
            if (installBtn) {
                installBtn.style.display = 'flex';
            }
        }, 2000);
    },

    toast(msg) {
        const t = document.getElementById('toast');
        t.innerText = msg;
        t.classList.add('visible');
        setTimeout(() => t.classList.remove('visible'), 4000);
    },

    /* --- FEATURES --- */

    checkStreak() {
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
            // Grug say: calculate real streak from lastLogin
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
    },

    toggleAdvanced() {
        const advanced = document.getElementById('advanced-options');
        advanced.classList.toggle('hidden');
        const btn = document.querySelector('button[onclick="app.toggleAdvanced()"]');
        const isExpanded = !advanced.classList.contains('hidden');
        if (btn) btn.setAttribute('aria-expanded', isExpanded);

        if (isExpanded) {
            setTimeout(() => document.getElementById('item-url').focus(), 100);
        }
    },

    // Grug fix: toggle goal date input
    toggleGoalDate() {
        const isGoal = document.getElementById('item-is-goal').checked;
        const dateContainer = document.getElementById('goal-date-container');
        if (dateContainer) {
            if (isGoal) {
                dateContainer.classList.remove('hidden');
            } else {
                dateContainer.classList.add('hidden');
            }
        }
    },

    async addItem() {
        let title = document.getElementById('item-title').value.trim();
        let note = document.getElementById('item-note').value.trim();
        let isGoal = document.getElementById('item-is-goal').checked;
        let goalDate = document.getElementById('item-goal-date').value;
        let url = '';
        const cachedLink = this.pendingLinkUrl;

        // Grug fix: prefer the cached link (from paste) before checking the typed title
        if (cachedLink && this.isURL(cachedLink)) {
            url = cachedLink;
        } else if (title && this.isURL(title)) {
            url = title;
        }

        if (!title) return this.toast('Diga o que você deseja ou cole um link...');
        this.pendingLinkUrl = null;

        // Grug fix: show loading state
        const btn = document.querySelector('#add-item-card button.icon-btn');
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i>';
        btn.disabled = true;

        try {
            const res = await fetch('/api/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: this.state.code,
                    title: title,
                    url: url,
                    note: note,
                    userName: this.state.currentUserName,
                    is_goal: isGoal,
                    goal_date: goalDate
                })
            });
            const data = await res.json();

            if (data.id) {
                this.state.items.unshift({
                    id: data.id,
                    title: data.title,
                    url: url,
                    price: data.price || '???',
                    price_manual: data.price_manual || '',
                    note: data.note || '',
                    added_by: data.added_by || 'Você',
                    image: data.image,
                    is_goal: data.is_goal,
                    goal_progress: 0,
                    goal_date: data.goal_date
                });
                this.renderItems();
                this.toast(isGoal ? 'Meta criada! Vamos juntos! 🚀' : 'Guardado com carinho ✨');

                // Clear inputs
                document.getElementById('item-title').value = '';
                document.getElementById('item-note').value = '';
                document.getElementById('item-is-goal').checked = false;
                document.getElementById('item-goal-date').value = '';
                this.toggleGoalDate();

            } else {
                this.toast('Erro ao salvar: ' + (data.error || 'Erro desconhecido'));
            }
        } catch (e) {
            console.error(e);
            this.toast('Erro de conexão');
        } finally {
            // Restore button state
            btn.innerHTML = originalIcon;
            btn.disabled = false;
        }
    },

    async updateProgress(id, progress) {
        try {
            const res = await fetch(`/api/items/${id}/progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ progress })
            });
            const data = await res.json();
            if (data.success) {
                const item = this.state.items.find(i => i.id === id);
                if (item) item.goal_progress = progress;
                this.renderItems();

                if (progress === 100) {
                    this.toast('Meta alcançada! Parabéns! 🎉');
                    if (window.confetti) {
                        confetti({
                            particleCount: 150,
                            spread: 80,
                            origin: { y: 0.6 }
                        });
                    }
                }
            }
        } catch (e) {
            console.error(e);
            this.toast('Erro ao atualizar progresso');
        }
    },

    async toggleBought(id) {
        try {
            const res = await fetch(`/api/items/${id}/buy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName: this.state.currentUserName })
            });
            const data = await res.json();
            if (data.success) {
                const item = this.state.items.find(i => i.id === id);
                if (item) {
                    item.bought = data.bought;
                    item.bought_by = data.bought_by;
                }
                this.renderItems();
                if (data.bought) {
                    this.toast('Presente garantido! 🎁');
                    // Grug fix: dopamine hit
                    if (window.confetti) {
                        confetti({
                            particleCount: 100,
                            spread: 70,
                            origin: { y: 0.6 },
                            colors: ['#FF6B6B', '#FF8E8E', '#FFD1D1']
                        });
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    },

    // Grug fix: confirmation modal (replaces ugly native confirm)
    confirmCallback: null,
    showConfirm(message, callback) {
        this.confirmCallback = callback;
        const modal = document.getElementById('confirm-modal');
        const messageEl = document.getElementById('confirm-message');
        const mainContent = document.getElementById('main-screen');

        messageEl.textContent = message;
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        mainContent.inert = true;

        this.lastFocusedElement = document.activeElement;
        setTimeout(() => document.getElementById('close-confirm-btn').focus(), 100);

        modal.onkeydown = (e) => {
            if (e.key === 'Escape') this.closeConfirm();
        };
    },

    closeConfirm() {
        const modal = document.getElementById('confirm-modal');
        const mainContent = document.getElementById('main-screen');

        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        mainContent.inert = false;
        this.confirmCallback = null;
        modal.onkeydown = null;

        // Grug fix: restore focus like other modals
        if (this.lastFocusedElement) {
            this.lastFocusedElement.focus();
        }
    },

    confirmOk() {
        if (this.confirmCallback) {
            this.confirmCallback();
        }
        this.closeConfirm();
    },

    confirmCancel() {
        this.closeConfirm();
    },

    async deleteItem(id) {
        const item = this.state.items.find(i => i.id === id);
        // Grug fix: use custom modal instead of native confirm
        this.showConfirm(`Tem certeza que deseja apagar "${item.title}"?`, async () => {
            try {
                const res = await fetch(`/api/items/${id}/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code: this.state.code,
                        userName: this.state.currentUserName
                    })
                });
                const data = await res.json();

                if (data.success) {
                    this.state.items = this.state.items.filter(i => i.id !== id);
                    this.renderItems();
                    this.toast('Item apagado.');
                } else {
                    this.toast('Erro ao apagar: ' + (data.error || 'Erro desconhecido'));
                }
            } catch (e) {
                console.error(e);
                this.toast('Erro de conexão');
            }
        });
    },

    renderItems() {
        const container = document.getElementById('wish-list');
        container.innerHTML = '';

        if (this.state.items.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding: 40px; color: var(--text-muted);">
                    <i class="ph-duotone ph-sparkle" style="font-size: 32px; margin-bottom: 8px;" aria-hidden="true"></i>
                    <p class="subtitle">A lista está vazia.<br>Comece a sonhar.</p>
                </div>
            `;
            return;
        }

        this.state.items.forEach(item => {
            const isUrl = item.url && item.url.length > 0 && !item.url.includes('placeholder.local');
            const isBought = item.bought === 1 || item.bought === true;
            const isGoal = item.is_goal === 1 || item.is_goal === true;

            let icon = 'ph-gift';
            if (isGoal) icon = 'ph-flag-checkered';
            else if (isUrl) {
                if (item.url.includes('airbnb')) icon = 'ph-house';
                else if (item.url.includes('flight')) icon = 'ph-airplane';
                else icon = 'ph-bag';
            }

            const boughtClass = isBought ? 'bought-item' : '';
            const goalClass = isGoal ? 'goal-item' : '';

            const article = document.createElement('article');
            article.className = `wish-item ${boughtClass} ${goalClass}`;

            let actionHtml = '';
            if (isBought && !isGoal) {
                const addedByMe = item.added_by === this.state.currentUserName;
                const boughtByMe = item.bought_by === this.state.currentUserName;

                let msg = '';
                if (addedByMe && boughtByMe) {
                    msg = 'Você mesmo comprou! 🛍️';
                } else if (addedByMe && !boughtByMe) {
                    msg = 'Alguém te ama muito! ❤️';
                } else if (!addedByMe && boughtByMe) {
                    msg = 'Presente garantido! 🎁';
                } else if (!addedByMe && !boughtByMe) {
                    // Other person added and bought their own item
                    msg = `${item.added_by} comprou! 🛍️`;
                }

                actionHtml += `<div style="margin-top:4px; font-size:0.875rem; color:var(--accent-dark); font-weight:700;">${msg}</div>`;
            }

            // Price & Note logic (same as before)
            let displayPrice = '';
            if (item.price_manual && item.price_manual.trim()) displayPrice = item.price_manual.trim();
            else if (item.price && item.price.trim() && item.price !== '???') displayPrice = item.price.trim();

            let priceHtml = displayPrice ? `<div style="margin-top:4px; font-size:0.875rem; color:var(--accent-dark); font-weight:600;">${displayPrice}</div>` : '';

            const addedBy = item.added_by || 'Você';
            let addedByHtml = (addedBy && addedBy !== 'Você') ? `<div style="margin-top:2px; font-size:0.75rem; color:var(--text-muted);">Adicionado por ${addedBy}</div>` : '';

            let noteHtml = (item.note && item.note.trim()) ? `<div style="margin-top:4px; font-size:0.8rem; color:var(--text-muted); font-style:italic;">${item.note}</div>` : '';

            const canDelete = this.state.currentUserName && addedBy === this.state.currentUserName;

            // Title logic
            const boughtStyle = isBought ? 'text-decoration: line-through; opacity: 0.7;' : '';
            const titleStyle = isUrl ? `${boughtStyle} cursor: pointer; text-decoration: none;` : boughtStyle;
            const titleAriaLabel = isUrl ? `${item.title} (abre em nova aba)` : item.title;
            const titleOnClick = isUrl ? `onclick="window.open('${item.url}', '_blank')"` : '';
            const titleRole = isUrl ? 'role="link"' : '';
            const arrowIcon = isUrl ? '<i class="ph ph-arrow-up-right" aria-hidden="true" style="font-size: 0.875rem; display: inline-block; margin-left: 4px;"></i>' : '';

            const titleElement = `<h3 class="wish-title" style="${titleStyle}" ${titleOnClick} ${titleRole} aria-label="${titleAriaLabel}">${item.title} ${arrowIcon}</h3>`;

            // GOAL UI
            let goalUI = '';
            if (isGoal) {
                const progress = parseInt(item.goal_progress) || 0;

                // Deadline
                let deadlineHtml = '';
                if (item.goal_date) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const target = new Date(item.goal_date + 'T00:00:00');
                    const diffTime = target - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    let timeText = '';
                    if (diffDays < 0) timeText = `Atrasado ${Math.abs(diffDays)} dias`;
                    else if (diffDays === 0) timeText = 'É hoje!';
                    else if (diffDays === 1) timeText = 'Amanhã';
                    else timeText = `Faltam ${diffDays} dias`;

                    deadlineHtml = `<div style="margin-top:4px; font-size:0.8rem; color:var(--text-muted);">${timeText}</div>`;
                }

                goalUI = `
                    <div style="margin-top: 8px; width: 100%;">
                        ${deadlineHtml}
                        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-top: 8px; margin-bottom: 4px; color: var(--text-muted);">
                            <span>Progresso</span>
                            <span>${progress}%</span>
                        </div>
                        <div style="height: 6px; background: rgba(0,0,0,0.1); border-radius: 3px; overflow: hidden; margin-bottom: 8px;">
                            <div style="height: 100%; width: ${progress}%; background: var(--accent-dark); transition: width 0.3s ease;"></div>
                        </div>
                        <div style="display: flex; gap: 4px;">
                            ${[0, 25, 50, 75, 100].map(p => `
                                <button onclick="app.updateProgress(${item.id}, ${p})"
                                    style="flex: 1; padding: 6px; font-size: 0.7rem; border-radius: 8px; border: 1px solid var(--accent-dark); background: ${progress >= p ? 'var(--accent-dark)' : 'transparent'}; color: ${progress >= p ? 'white' : 'var(--accent-dark)'}; cursor: pointer; font-weight: 500;">
                                    ${p}%
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            article.innerHTML = `
                <div class="wish-icon" aria-hidden="true">
                    <i class="ph-duotone ${icon}"></i>
                </div>
                <div class="wish-content">
                    ${titleElement}
                    ${priceHtml}
                    ${noteHtml}
                    ${addedByHtml}
                    <div>${actionHtml}</div>
                    ${goalUI}
                </div>
                <div style="display:flex; flex-direction: column; gap:8px; flex-shrink: 0; align-items: flex-start; padding-top: 2px;">
                    ${!isGoal ? `<button onclick="app.toggleBought(${item.id})" aria-label="${isBought ? 'Desmarcar comprado' : 'Marcar como comprado'}" class="btn-remove" style="color: ${isBought ? 'var(--accent-dark)' : 'var(--text-muted)'}">
                        <i class="ph ${isBought ? 'ph-check-circle' : 'ph-circle'}" aria-hidden="true" style="font-size: 1.5rem;"></i>
                    </button>` : ''}
                    ${canDelete ? `<button onclick="app.deleteItem(${item.id})" aria-label="Apagar desejo: ${item.title}" class="btn-remove">
                        <i class="ph ph-trash" aria-hidden="true" style="font-size: 1.25rem;"></i>
                    </button>` : ''}
                </div>
            `;
            container.appendChild(article);
        });
    },

    /* --- DATES --- */

    // Grug helper: calculate next occurrence of a date
    getNextHoliday(day, month, name) {
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
    },

    // Grug helper: calculate next occurrence from a full date string (YYYY-MM-DD)
    getNextHolidayFromDate(dateString, name) {
        if (!dateString) return null;
        const [y, m, d] = dateString.split('-').map(Number);
        return this.getNextHoliday(d, m, name);
    },

    saveLocalDates() {
        if (this.state.code) {
            localStorage.setItem(`amorzinho_dates_${this.state.code}`, JSON.stringify(this.state.dates));
        }
    },

    // Grug say: DRY. One function to sync dates.
    async syncDates() {
        try {
            await fetch('/api/dates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: this.state.code, dates: this.state.dates })
            });
        } catch (e) {
            console.log('Date sync failed, but saved locally');
        }
    },

    async addDate() {
        const name = document.getElementById('date-name').value;
        const date = document.getElementById('date-val').value;
        if (!name || !date) return;

        this.state.dates.push({ name, date });
        localStorage.setItem(`amorzinho_dates_${this.state.code}`, JSON.stringify(this.state.dates));

        await this.syncDates();
        this.renderDates();

        document.getElementById('date-name').value = '';
        document.getElementById('date-name').focus();
    },

    renderDates() {
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
                        <div style="font-size: 0.9rem; opacity: 0.8;">
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
    },

    renderHeroWidget(sortedDates) {
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
            <div class="card" style="background: linear-gradient(135deg, var(--accent-color), var(--accent-dark)); color: white; text-align: center; padding: 24px;">
                <div style="font-size: 2.5rem; font-weight: 800; line-height: 1.1; margin-bottom: 8px;">
                    ${title}
                </div>
                <div style="font-size: 1.1rem; opacity: 0.9; font-weight: 500;">
                    ${subtitle}
                </div>
            </div>
        `;
    },

    async removeDate(idx) {
        this.state.dates.splice(idx, 1);
        this.saveLocalDates();
        await this.syncDates();
        this.renderDates();
    },

    /* --- UI HELPERS (ACCESSIBLE) --- */

    async loadQRCode(code) {
        const img = document.getElementById('qr-img');
        if (!img || !code) return;

        try {
            const res = await fetch(`/api/qrcode?code=${code}`);
            const data = await res.json();
            if (data.qr) {
                img.src = data.qr;
                img.alt = `Código QR para o código do casal ${code}`;
            }
        } catch (e) {
            console.error('QR load error:', e);
            // Fallback: show code text if QR fails
            img.alt = `Código: ${code}`;
        }
    },

    toggleQR() {
        const modal = document.getElementById('qr-modal');
        const mainContent = document.getElementById('main-screen');
        const isOpen = modal.classList.toggle('open');

        modal.setAttribute('aria-hidden', !isOpen);

        if (isOpen) {
            // Load QR code when modal opens (in case it wasn't loaded yet)
            if (this.state.code) {
                this.loadQRCode(this.state.code);
            }
            this.lastFocusedElement = document.activeElement;
            mainContent.inert = true;
            setTimeout(() => document.getElementById('close-qr-btn').focus(), 100);

            modal.onkeydown = (e) => {
                if (e.key === 'Escape') this.toggleQR();
            };
        } else {
            mainContent.inert = false;
            if (this.lastFocusedElement) {
                this.lastFocusedElement.focus();
            }
            modal.onkeydown = null;
        }
    },

    toggleSettings() {
        const modal = document.getElementById('settings-modal');
        const mainContent = document.getElementById('main-screen');
        const isOpen = modal.classList.toggle('open');

        modal.setAttribute('aria-hidden', !isOpen);

        if (isOpen) {
            this.renderDates();
            this.lastFocusedElement = document.activeElement;
            mainContent.inert = true;
            setTimeout(() => document.getElementById('close-settings-btn').focus(), 100);

            modal.onkeydown = (e) => {
                if (e.key === 'Escape') this.toggleSettings();
            };
        } else {
            mainContent.inert = false;
            if (this.lastFocusedElement) {
                this.lastFocusedElement.focus();
            }
            modal.onkeydown = null;
        }
    },

    copyCode() {
        if (this.state.code) {
            navigator.clipboard.writeText(this.state.code).then(() => {
                this.toast('Código copiado!');
            });
        }
    },

    copyDeepLink() {
        if (this.state.code) {
            const url = `${window.location.origin}/?code=${this.state.code}`;
            navigator.clipboard.writeText(url).then(() => {
                this.toast('Link copiado!');
            });
        }
    },

    async checkout(plan) {
        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: this.state.code, plan })
            });
            const data = await res.json();
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                this.toast('Erro ao iniciar pagamento');
            }
        } catch (e) {
            console.error(e);
            this.toast('Erro de conexão');
        }
    },

    installPWA() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            this.deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the A2HS prompt');
                }
                this.deferredPrompt = null;
                document.getElementById('pwa-install-btn').style.display = 'none';
            });
        }
    }
};

// Grug fix: PWA install prompt capture
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    app.deferredPrompt = e;
});

// Grug fix: init app on load
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
