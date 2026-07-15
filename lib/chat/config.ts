// Client-safe chat configuration: IDs, display copy, greetings, starter
// prompts, and whitelist guards. No system-prompt text lives here — that is
// server-only in lib/chat/prompts.ts, keyed by the same IDs so the two files
// stay in lockstep via the Record types.

export const LENS_IDS = [
    'sikhai',
    'guru-nanak',
    'guru-angad',
    'guru-amar-das',
    'guru-ram-das',
    'guru-arjan',
    'guru-hargobind',
    'guru-har-rai',
    'guru-har-krishan',
    'guru-tegh-bahadur',
    'guru-gobind-singh',
] as const;
export type LensId = (typeof LENS_IDS)[number];

export const MODE_IDS = ['balanced', 'simple', 'gurbani-first', 'vichaar', 'sakhi'] as const;
export type ModeId = (typeof MODE_IDS)[number];

export const LANGUAGE_IDS = ['english', 'bilingual', 'punjabi'] as const;
export type LanguageId = (typeof LANGUAGE_IDS)[number];

export type Lens = {
    id: LensId;
    name: string;
    ordinal?: string;
    tagline: string;
    greeting: string;
    starterPrompts: string[];
};

export type Mode = { id: ModeId; name: string; description: string };
export type Language = { id: LanguageId; name: string; description: string };
export type TopicPack = { id: string; label: string; prompts: string[] };

export type ChatContext = {
    type: 'hukamnama' | 'shabad';
    title: string;
    text: string;
    capturedAt: number;
};

export const DEFAULT_PREFS = {
    lensId: 'sikhai',
    modeId: 'balanced',
    languageId: 'english',
} as const satisfies { lensId: LensId; modeId: ModeId; languageId: LanguageId };

// Size caps shared by the API route (authoritative) and the client (courtesy
// pre-truncation before a context is stored/sent).
export const MAX_MESSAGE_CHARS = 4000;
export const MAX_CONTEXT_TITLE_CHARS = 200;
export const MAX_CONTEXT_TEXT_CHARS = 8000;

export const isLensId = (v: unknown): v is LensId => LENS_IDS.includes(v as LensId);
export const isModeId = (v: unknown): v is ModeId => MODE_IDS.includes(v as ModeId);
export const isLanguageId = (v: unknown): v is LanguageId => LANGUAGE_IDS.includes(v as LanguageId);

const FATEH = 'Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh.';

export const LENSES: Record<LensId, Lens> = {
    'sikhai': {
        id: 'sikhai',
        name: 'SikhAI',
        tagline: 'Wisdom from Sri Guru Granth Sahib Ji and the lives of all ten Gurus',
        greeting: `${FATEH} How can I help you learn about Sikhi today?`,
        starterPrompts: [
            'What is Seva, and why is it central to Sikhi?',
            'Explain the meaning of the Mool Mantar',
            "Tell me about Guru Nanak Dev Ji's life",
            'What does Gurbani teach about facing hardship?',
        ],
    },
    'guru-nanak': {
        id: 'guru-nanak',
        name: 'Guru Nanak Dev Ji',
        ordinal: 'First Guru',
        tagline: 'Ik Onkar — Oneness, honest living, and sharing with others',
        greeting: `${FATEH} This conversation draws on the life and teachings of Guru Nanak Dev Ji — Oneness, honest work, and remembrance of the One. What is on your mind?`,
        starterPrompts: [
            'What does Ik Onkar mean for how I treat others?',
            'How do I live Kirat Karo, Naam Japo, Vand Chhako today?',
            "Share a sakhi from Guru Nanak Dev Ji's Udasis",
            'Why did Guru Nanak Dev Ji question empty rituals?',
        ],
    },
    'guru-angad': {
        id: 'guru-angad',
        name: 'Guru Angad Dev Ji',
        ordinal: 'Second Guru',
        tagline: 'Discipline, learning, and care for body and mind',
        greeting: `${FATEH} This conversation draws on the life and teachings of Guru Angad Dev Ji — devotion, discipline, and the gift of learning. What is on your mind?`,
        starterPrompts: [
            'How can discipline strengthen my spiritual life?',
            'Why did Guru Angad Dev Ji champion the Gurmukhi script?',
            'What does Sikhi teach about caring for body and mind?',
            "Share the sakhi of Bhai Lehna's devotion",
        ],
    },
    'guru-amar-das': {
        id: 'guru-amar-das',
        name: 'Guru Amar Das Ji',
        ordinal: 'Third Guru',
        tagline: 'Equality, langar, and the dignity of every person',
        greeting: `${FATEH} This conversation draws on the life and teachings of Guru Amar Das Ji — equality, seva, and the dignity of every person. What is on your mind?`,
        starterPrompts: [
            'What does langar teach us about equality?',
            'How did Guru Amar Das Ji uplift the dignity of women?',
            'What is the message of Anand Sahib?',
            'How do I serve people whom society overlooks?',
        ],
    },
    'guru-ram-das': {
        id: 'guru-ram-das',
        name: 'Guru Ram Das Ji',
        ordinal: 'Fourth Guru',
        tagline: 'Humility, seva, and building community',
        greeting: `${FATEH} This conversation draws on the life and teachings of Guru Ram Das Ji — humility, seva, and building community. What is on your mind?`,
        starterPrompts: [
            'How do I practice true humility?',
            'What do the Laavan teach about love and partnership?',
            'Why is seva at the heart of Sikh life?',
            'Tell me about the founding of Amritsar',
        ],
    },
    'guru-arjan': {
        id: 'guru-arjan',
        name: 'Guru Arjan Dev Ji',
        ordinal: 'Fifth Guru',
        tagline: 'Acceptance of Hukam and peace amid suffering',
        greeting: `${FATEH} This conversation draws on the life and teachings of Guru Arjan Dev Ji — sweet acceptance of Hukam and peace amid suffering. What is on your mind?`,
        starterPrompts: [
            "How do I accept Waheguru's Hukam when life hurts?",
            'What is Sukhmani Sahib about?',
            "What does 'Tera Kia Meetha Lagai' mean for my struggles?",
            'How did Guru Arjan Dev Ji meet his shaheedi with peace?',
        ],
    },
    'guru-hargobind': {
        id: 'guru-hargobind',
        name: 'Guru Hargobind Sahib Ji',
        ordinal: 'Sixth Guru',
        tagline: 'Miri-Piri — balancing worldly duty with the spirit',
        greeting: `${FATEH} This conversation draws on the life and teachings of Guru Hargobind Sahib Ji — Miri-Piri, courage, and worldly duty joined with the spirit. What is on your mind?`,
        starterPrompts: [
            'What does Miri-Piri mean for my daily life?',
            'How do I balance ambition with spirituality?',
            'When is it right to stand up against injustice?',
            'Tell me about Bandi Chhor Divas',
        ],
    },
    'guru-har-rai': {
        id: 'guru-har-rai',
        name: 'Guru Har Rai Sahib Ji',
        ordinal: 'Seventh Guru',
        tagline: 'Compassion, gentleness, and care for creation',
        greeting: `${FATEH} This conversation draws on the life and teachings of Guru Har Rai Sahib Ji — compassion, gentleness, and care for all creation. What is on your mind?`,
        starterPrompts: [
            'How do I grow gentleness and compassion?',
            'What does Sikhi teach about caring for nature?',
            'Share the sakhi of Guru Har Rai Ji and the broken flower',
            'How can healing others be a form of seva?',
        ],
    },
    'guru-har-krishan': {
        id: 'guru-har-krishan',
        name: 'Guru Har Krishan Sahib Ji',
        ordinal: 'Eighth Guru',
        tagline: 'Selfless service in crisis and wisdom beyond age',
        greeting: `${FATEH} This conversation draws on the life and teachings of Guru Har Krishan Sahib Ji — selfless service in crisis and wisdom beyond age. What is on your mind?`,
        starterPrompts: [
            'How can I serve others through hardship or illness?',
            'What can young people offer their community?',
            'Tell me about Guru Har Krishan Ji serving the sick in Delhi',
            "What does 'wisdom beyond age' mean in Sikhi?",
        ],
    },
    'guru-tegh-bahadur': {
        id: 'guru-tegh-bahadur',
        name: 'Guru Tegh Bahadur Ji',
        ordinal: 'Ninth Guru',
        tagline: "Fearlessness, detachment, and defending others' freedom",
        greeting: `${FATEH} This conversation draws on the life and teachings of Guru Tegh Bahadur Ji — fearlessness, detachment, and standing up for the freedom of others. What is on your mind?`,
        starterPrompts: [
            'How do I live without fear and without causing fear?',
            "Why did Guru Tegh Bahadur Ji give his life for another faith's freedom?",
            'What do the Saloks of the Ninth Guru teach about attachment?',
            'How do I stay steady when everything feels temporary?',
        ],
    },
    'guru-gobind-singh': {
        id: 'guru-gobind-singh',
        name: 'Guru Gobind Singh Ji',
        ordinal: 'Tenth Guru',
        tagline: 'Sant-Sipahi — courage, Khalsa spirit, and chardi kala',
        greeting: `${FATEH} This conversation draws on the life and teachings of Guru Gobind Singh Ji — the Sant-Sipahi spirit, chardi kala, and courage in the face of loss. What is on your mind?`,
        starterPrompts: [
            'What does it mean to be a Sant-Sipahi today?',
            'How do I stay in chardi kala through loss?',
            'Tell me about Vaisakhi 1699 and the Panj Pyare',
            'What is the significance of the Khalsa?',
        ],
    },
};

export const MODES: Record<ModeId, Mode> = {
    'balanced': {
        id: 'balanced',
        name: 'Balanced',
        description: 'Clear answers with Gurbani references where they fit',
    },
    'simple': {
        id: 'simple',
        name: 'Simple',
        description: 'Plain English with every term explained — great for newcomers',
    },
    'gurbani-first': {
        id: 'gurbani-first',
        name: 'Gurbani-first',
        description: 'Every answer anchored on a quoted tukk with translation',
    },
    'vichaar': {
        id: 'vichaar',
        name: 'Vichaar',
        description: 'Short, reflective answers that end with a question for you',
    },
    'sakhi': {
        id: 'sakhi',
        name: 'Sakhi',
        description: 'Learn through stories from Sikh history',
    },
};

export const LANGUAGES: Record<LanguageId, Language> = {
    'english': {
        id: 'english',
        name: 'English',
        description: 'Answers in plain English',
    },
    'bilingual': {
        id: 'bilingual',
        name: 'Punjabi-American',
        description: 'English answers woven with romanized Punjabi and translations',
    },
    'punjabi': {
        id: 'punjabi',
        name: 'Punjabi',
        description: 'Replies in Punjabi, matching your script (Gurmukhi or romanized)',
    },
};

export const TOPIC_PACKS: TopicPack[] = [
    {
        id: 'life',
        label: 'Life advice',
        prompts: [
            'How do I deal with anger?',
            'What does Sikhi say about relationships and marriage?',
            'How do I balance ambition with contentment?',
            'How can I be a better friend and family member through Gurmat?',
        ],
    },
    {
        id: 'hardship',
        label: 'Hardship & grief',
        prompts: [
            'How do I cope with losing a loved one?',
            'What does Gurbani say about suffering?',
            'How do I find hope when I feel alone?',
            'Why do painful things happen if Waheguru is kind?',
        ],
    },
    {
        id: 'concepts',
        label: 'Concepts',
        prompts: [
            'What is Hukam?',
            'Explain Haumai and how to overcome it',
            'What is Naam Simran and how do I begin?',
            'What are the Five Thieves (Panj Chor)?',
        ],
    },
    {
        id: 'history',
        label: 'History & sakhis',
        prompts: [
            'Tell me a sakhi about courage',
            'What happened at Vaisakhi 1699?',
            'Who were the Panj Pyare?',
            'Tell me about the shaheedi of the Sahibzade',
        ],
    },
    {
        id: 'practice',
        label: 'Daily practice',
        prompts: [
            'What is Nitnem and how do I start?',
            'How do I begin a simran practice?',
            'What is the significance of the Five Ks?',
            'How should I prepare for my first visit to a Gurdwara?',
        ],
    },
];

// Starter chips shown instead of the lens starters while a deep-linked
// passage is attached to an empty conversation.
export const CONTEXT_STARTERS: Record<ChatContext['type'], string[]> = {
    hukamnama: [
        "What is today's Hukamnama asking of me?",
        'Explain this Hukamnama line by line',
        'What is the central message of this shabad?',
        'How do I carry this Hukamnama into my day?',
    ],
    shabad: [
        'Explain this Shabad line by line',
        'What is the central theme of this Ang?',
        'Who composed these lines, and in what context?',
        'How can I reflect on this Bani today?',
    ],
};
