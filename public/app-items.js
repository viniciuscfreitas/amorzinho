// Grug say: All item operations. Add, delete, buy, update progress, render.

app.toggleAddOptions = function () {
    const options = document.getElementById('add-options');
    options.classList.toggle('hidden');
    const btn = document.querySelector('button[onclick="app.toggleAddOptions()"]');
    const isExpanded = !options.classList.contains('hidden');
    if (btn) {
        btn.setAttribute('aria-expanded', isExpanded);
        // Rotate icon or change text if needed, but for now simple toggle
    }

    if (isExpanded) {
        setTimeout(() => document.getElementById('item-note').focus(), 100);
    }
};

// Grug fix: toggle goal date input
app.toggleGoalDate = function () {
    const isGoal = document.getElementById('item-is-goal').checked;
    const dateContainer = document.getElementById('goal-date-container');
    if (dateContainer) {
        if (isGoal) {
            dateContainer.classList.remove('hidden');
        } else {
            dateContainer.classList.add('hidden');
        }
    }
};

app.addItem = async function () {
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
            this.toast(this.getRandomMessage('itemAdded'));
        } else {
            this.toast('Erro ao salvar: ' + (data.error || 'Erro desconhecido'));
        }

        // Clear inputs
        document.getElementById('item-title').value = '';
        document.getElementById('item-note').value = '';
        document.getElementById('item-is-goal').checked = false;
        document.getElementById('item-goal-date').value = '';
        this.toggleGoalDate();


    } catch (e) {
        console.error(e);
        this.toast('Erro de conexão');
    } finally {
        // Restore button state
        btn.innerHTML = originalIcon;
        btn.disabled = false;
    }
};

app.updateProgress = async function (id, progress) {
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
};

app.toggleBought = async function (id) {
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
                this.toast(this.getRandomMessage('itemBought'));
                // Grug fix: play happy ding sound
                this.playSound('bought');
                // Grug fix: dopamine hit
                if (window.confetti) {
                    confetti({
                        particleCount: 100,
                        spread: 70,
                        origin: { y: 0.6 },
                        colors: ['#9E3845', '#E8B4B8', '#D8E2D5']
                    });
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
};

app.deleteItem = async function (id) {
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
};

app.renderItems = function () {
    const container = document.getElementById('wish-list');
    container.innerHTML = '';

    // Grug fix: Empty state
    if (this.state.items.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px; color: var(--text-muted);">
                <i class="ph-duotone ph-sparkle" style="font-size: 32px; margin-bottom: 8px;" aria-hidden="true"></i>
                <p class="subtitle">A lista está vazia.<br>Comece a sonhar.</p>
            </div>
        `;
        return;
    }

    // Grug say: Render each item using helpers!
    this.state.items.forEach(item => {
        const isBought = item.bought === 1 || item.bought === true;
        const isGoal = item.is_goal === 1 || item.is_goal === true;

        const boughtClass = isBought ? 'bought-item' : '';
        const goalClass = isGoal ? 'goal-item' : '';

        const article = document.createElement('article');
        article.className = `wish-item ${boughtClass} ${goalClass}`;

        // Grug fix: Use helper functions! Much simpler!
        article.innerHTML = `
            ${window.itemHelpers.buildWishIcon(item)}
            <div class="wish-content">
                ${window.itemHelpers.buildWishTitle(item)}
                ${window.itemHelpers.buildPriceAndNote(item)}
                ${window.itemHelpers.buildItemMessages(item, this.state.currentUserName)}
                ${window.itemHelpers.buildGoalUI(item)}
            </div>
            ${window.itemHelpers.buildActionButtons(item, this.state.currentUserName)}
        `;

        container.appendChild(article);
    });
};
