// Grug say: Frontend config! Match backend CONFIG but for browser.

const CONFIG = {
    // Code Validation
    CODE_LENGTH: 8,
    MIN_CODE_INPUT_LENGTH: 4,

    // Polling
    POLL_INTERVAL_MS: 7000,

    // Toast
    TOAST_DURATION_MS: 4000,

    // PWA Install Button Delay
    PWA_INSTALL_DELAY_MS: 2000,

    // Holidays (repeating dates)
    DEFAULT_HOLIDAYS: [
        { day: 14, month: 2, name: 'São Valentim 💘' },
        { day: 12, month: 6, name: 'Dia dos Namorados 🇧🇷' },
        { day: 25, month: 12, name: 'Natal 🎄' },
        { day: 31, month: 12, name: 'Ano Novo ✨' }
    ],

    // Grug fix: Cute random messages! 💕
    CUTE_MESSAGES: {
        itemAdded: [
            'Anotado com carinho! 💕',
            'Seu mozão vai adorar saber! 😍',
            'Mais um sonhinho na lista! ✨',
            'Guardadinho aqui! 🎁',
            'Desejo registrado! 💝'
        ],
        itemBought: [
            'Que dupla! 💪',
            'O amor de vocês é lindo! 🌟',
            'Juntos e conectados! 💑',
            'Relacionamento de sucesso! ❤️'
        ]
    }
};
