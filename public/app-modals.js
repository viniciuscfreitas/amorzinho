// Grug say: All modals - QR, Settings, Confirm, Premium. Keep UI helpers together.

app.loadQRCode = async function (code) {
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
};

app.toggleQR = function () {
    const modal = document.getElementById('qr-modal');
    const mainContent = document.getElementById('main-screen');
    const isOpen = modal.classList.toggle('open');

    modal.setAttribute('aria-hidden', !isOpen);
    document.getElementById('qr-toggle-btn')?.setAttribute('aria-expanded', isOpen);

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
};

app.toggleSettings = function () {
    const modal = document.getElementById('settings-modal');
    const mainContent = document.getElementById('main-screen');
    const isOpen = modal.classList.toggle('open');

    modal.setAttribute('aria-hidden', !isOpen);
    document.getElementById('settings-toggle-btn')?.setAttribute('aria-expanded', isOpen);

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
};

app.showConfirm = function (message, callback) {
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
};

app.closeConfirm = function () {
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
};

app.confirmOk = function () {
    if (this.confirmCallback) {
        this.confirmCallback();
    }
    this.closeConfirm();
};

app.confirmCancel = function () {
    this.closeConfirm();
};

app.copyCode = function () {
    if (this.state.code) {
        navigator.clipboard.writeText(this.state.code).then(() => {
            this.toast('Código copiado!');
        });
    }
};

app.copyDeepLink = function () {
    if (this.state.code) {
        const url = `${window.location.origin}/?code=${this.state.code}`;
        navigator.clipboard.writeText(url).then(() => {
            this.toast('Link copiado!');
        });
    }
};

app.checkout = async function (plan) {
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
};
