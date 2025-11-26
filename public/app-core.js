// Grug say: Core app state and utilities. Simple!

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
    pollingInterval: null,
    confirmCallback: null,
    deferredPrompt: null,

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

    toast(msg) {
        const t = document.getElementById('toast');
        t.innerText = msg;
        t.classList.add('visible');
        setTimeout(() => t.classList.remove('visible'), CONFIG.TOAST_DURATION_MS);
    },

    // Grug fix: Get random cute message!
    getRandomMessage(type) {
        const messages = CONFIG.CUTE_MESSAGES[type];
        if (!messages || messages.length === 0) return 'Feito! ✨';
        return messages[Math.floor(Math.random() * messages.length)];
    },

    // Grug fix: Play sound! Simple Web Audio API
    playSound(type) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            if (type === 'bought') {
                // Grug say: Happy "ding" sound
                oscillator.frequency.value = 800;
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            }

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            // Grug say: If sound fails, no problem! Just continue
            console.log('Sound not available:', e);
        }
    },

    // Grug fix: PWA helpers
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
        }, CONFIG.PWA_INSTALL_DELAY_MS);
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
