// Grug say: Item rendering helpers. Each function do ONE thing!

/**
 * Grug fix: Build wish icon HTML
 */
function buildWishIcon(item) {
    const isUrl = item.url && item.url.length > 0 && !item.url.includes('placeholder.local');
    const isGoal = item.is_goal === 1 || item.is_goal === true;

    let icon = 'ph-gift';
    if (isGoal) {
        icon = 'ph-flag-checkered';
    } else if (isUrl) {
        if (item.url.includes('airbnb')) icon = 'ph-house';
        else if (item.url.includes('flight')) icon = 'ph-airplane';
        else icon = 'ph-bag';
    }

    return `
        <div class="wish-icon" aria-hidden="true">
            <i class="ph-duotone ${icon}"></i>
        </div>
    `;
}

/**
 * Grug fix: Build wish title HTML
 */
function buildWishTitle(item) {
    const isUrl = item.url && item.url.length > 0 && !item.url.includes('placeholder.local');
    const isBought = item.bought === 1 || item.bought === true;

    const boughtStyle = isBought ? 'text-decoration: line-through; opacity: 0.7;' : '';
    const titleStyle = isUrl ? `${boughtStyle} cursor: pointer; text-decoration: none;` : boughtStyle;
    const titleAriaLabel = isUrl ? `${item.title} (abre em nova aba)` : item.title;
    const titleOnClick = isUrl ? `onclick="window.open('${item.url}', '_blank')"` : '';
    const titleRole = isUrl ? 'role="link"' : '';
    const arrowIcon = isUrl ? '<i class="ph ph-arrow-up-right" aria-hidden="true" style="font-size: 0.875rem; display: inline-block; margin-left: 4px;"></i>' : '';

    return `<h3 class="wish-title" style="${titleStyle}" ${titleOnClick} ${titleRole} aria-label="${titleAriaLabel}">${item.title} ${arrowIcon}</h3>`;
}

/**
 * Grug fix: Build price and note HTML
 */
function buildPriceAndNote(item) {
    let html = '';

    // Price
    let displayPrice = '';
    if (item.price_manual && item.price_manual.trim()) {
        displayPrice = item.price_manual.trim();
    } else if (item.price && item.price.trim() && item.price !== '???') {
        displayPrice = item.price.trim();
    }

    if (displayPrice) {
        html += `<div style="margin-top:2px; font-size:0.85rem; color:var(--accent-dark); font-weight:600;">${displayPrice}</div>`;
    }

    // Note
    if (item.note && item.note.trim()) {
        html += `<div style="margin-top:2px; font-size:0.8rem; color:var(--text-muted); font-style:italic;">${item.note}</div>`;
    }

    return html;
}

/**
 * Grug fix: Build "added by" and "bought by" messages
 */
function buildItemMessages(item, currentUserName) {
    const addedBy = item.added_by || 'Você';
    const isBought = item.bought === 1 || item.bought === true;
    const isGoal = item.is_goal === 1 || item.is_goal === true;

    let html = '';

    // "Added by" message
    if (addedBy && addedBy !== 'Você') {
        html += `<div style="margin-top:2px; font-size:0.75rem; color:var(--text-muted);">Adicionado por ${addedBy}</div>`;
    }

    // "Bought" message
    if (isBought && !isGoal) {
        const addedByMe = addedBy === currentUserName;
        const boughtByMe = item.bought_by === currentUserName;

        let msg = '';
        if (addedByMe && boughtByMe) {
            msg = 'Você mesmo comprou! 🛍️';
        } else if (addedByMe && !boughtByMe) {
            msg = 'Alguém te ama muito! ❤️';
        } else if (!addedByMe && boughtByMe) {
            msg = 'Presente garantido! 🎁';
        } else if (!addedByMe && !boughtByMe) {
            msg = `${addedBy} comprou! 🛍️`;
        }

        html += `<div style="margin-top:4px; font-size:0.8rem; color:var(--accent-dark); font-weight:700;">${msg}</div>`;
    }

    return html;
}

/**
 * Grug fix: Build goal progress UI
 */
function buildGoalUI(item) {
    const isGoal = item.is_goal === 1 || item.is_goal === true;
    if (!isGoal) return '';

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

    // Progress bar and buttons
    return `
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

/**
 * Grug fix: Build action buttons (buy/delete)
 */
function buildActionButtons(item, currentUserName) {
    const isBought = item.bought === 1 || item.bought === true;
    const isGoal = item.is_goal === 1 || item.is_goal === true;
    const addedBy = item.added_by || 'Você';
    const canDelete = currentUserName && addedBy === currentUserName;

    let html = '<div style="display:flex; flex-direction: column; gap:4px; flex-shrink: 0; align-items: center;">';

    // Buy button (not for goals)
    if (!isGoal) {
        const buttonColor = isBought ? 'var(--accent-dark)' : 'var(--text-muted)';
        const icon = isBought ? 'ph-check-circle' : 'ph-circle';
        const label = isBought ? 'Desmarcar comprado' : 'Marcar como comprado';

        html += `
            <button onclick="app.toggleBought(${item.id})" aria-label="${label}" class="btn-remove" style="color: ${buttonColor}">
                <i class="ph ${icon}" aria-hidden="true" style="font-size: 1.25rem;"></i>
            </button>
        `;
    }

    // Delete button
    if (canDelete) {
        html += `
            <button onclick="app.deleteItem(${item.id})" aria-label="Apagar desejo: ${item.title}" class="btn-remove">
                <i class="ph ph-trash" aria-hidden="true" style="font-size: 1.1rem;"></i>
            </button>
        `;
    }

    html += '</div>';
    return html;
}

// Grug say: Export helpers
if (typeof window !== 'undefined') {
    window.itemHelpers = {
        buildWishIcon,
        buildWishTitle,
        buildPriceAndNote,
        buildItemMessages,
        buildGoalUI,
        buildActionButtons
    };
}
