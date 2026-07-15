// English dictionary — the SCHEMA SOURCE for all translations. `Dictionary`
// is inferred from this object, so pa.ts / pa-latn.ts get a compile error for
// any missing or extra key. Sections are ordered the way a visitor meets them
// (nav → home → pages → chrome) so the file reads top to bottom.
//
// Strings with {placeholders} are interpolated via lib/i18n/fmt.ts; keep the
// placeholder names verbatim in translations (word order around them is free).
// Brand names ("SikhAI", "Gemini", "Rohan Singh") are never translated.

import type { ChatCopy } from '@/lib/chat/config';

const FATEH = 'Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh.';

const chatConfig: ChatCopy = {
    lenses: {
        'sikhai': {
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
    },
    modes: {
        'balanced': {
            name: 'Balanced',
            description: 'Clear answers with Gurbani references where they fit',
        },
        'simple': {
            name: 'Simple',
            description: 'Plain English with every term explained — great for newcomers',
        },
        'gurbani-first': {
            name: 'Gurbani-first',
            description: 'Every answer anchored on a quoted tukk with translation',
        },
        'vichaar': {
            name: 'Vichaar',
            description: 'Short, reflective answers that end with a question for you',
        },
        'sakhi': {
            name: 'Sakhi',
            description: 'Learn through stories from Sikh history',
        },
    },
    replyLanguages: {
        'english': {
            name: 'English',
            description: 'Answers in plain English',
        },
        'bilingual': {
            name: 'Punjabi-American',
            description: 'English answers woven with romanized Punjabi and translations',
        },
        'punjabi': {
            name: 'Punjabi',
            description: 'Replies in Punjabi, matching your script (Gurmukhi or romanized)',
        },
    },
    topicPacks: {
        'life': {
            label: 'Life advice',
            prompts: [
                'How do I deal with anger?',
                'What does Sikhi say about relationships and marriage?',
                'How do I balance ambition with contentment?',
                'How can I be a better friend and family member through Gurmat?',
            ],
        },
        'hardship': {
            label: 'Hardship & grief',
            prompts: [
                'How do I cope with losing a loved one?',
                'What does Gurbani say about suffering?',
                'How do I find hope when I feel alone?',
                'Why do painful things happen if Waheguru is kind?',
            ],
        },
        'concepts': {
            label: 'Concepts',
            prompts: [
                'What is Hukam?',
                'Explain Haumai and how to overcome it',
                'What is Naam Simran and how do I begin?',
                'What are the Five Thieves (Panj Chor)?',
            ],
        },
        'history': {
            label: 'History & sakhis',
            prompts: [
                'Tell me a sakhi about courage',
                'What happened at Vaisakhi 1699?',
                'Who were the Panj Pyare?',
                'Tell me about the shaheedi of the Sahibzade',
            ],
        },
        'practice': {
            label: 'Daily practice',
            prompts: [
                'What is Nitnem and how do I start?',
                'How do I begin a simran practice?',
                'What is the significance of the Five Ks?',
                'How should I prepare for my first visit to a Gurdwara?',
            ],
        },
    },
    contextStarters: {
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
    },
};

const en = {
    fateh: FATEH,

    nav: {
        mainNavAria: 'Main',
        about: 'About',
        hukamnama: 'Hukamnama',
        chat: 'Ask SikhAI',
        seva: 'Seva Events',
        shabad: 'Shabad Search',
        greeting: 'Sat Sri Akal, {name}',
        signIn: 'Sign In',
        signOut: 'Sign Out',
        toggleMenu: 'Toggle navigation menu',
        switchToLight: 'Switch to light mode',
        switchToDark: 'Switch to dark mode',
        changeLanguage: 'Change language',
    },

    home: {
        badge: 'Powered by Google Gemini',
        heroLine1: 'Wisdom of the Gurus,',
        heroLine2: 'Illuminated by AI.',
        heroSubtitle:
            'Explore Gurbani, find local Sangat, and discover daily Hukamnamas in a space designed for peace, learning, and Seva.',
        ctaChat: 'Start Chatting',
        ctaHukamnama: "Today's Hukamnama",
        previewWindowTitle: 'SikhAI Chat',
        previewAiLine: 'Waheguru Ji Ka Khalsa... How can I help you understand Gurbani today?',
        previewUserLine: 'What does the Guru Granth Sahib say about humility?',
        exploreTitle: 'Explore SikhAI',
        exploreSubtitle: 'Four ways to connect with Gurbani and Sangat — all in one place.',
        features: {
            chat: {
                title: 'Ask SikhAI',
                desc: 'Ask questions and get Gurbani-grounded answers, streamed in real time.',
                cta: 'Start chatting',
            },
            hukamnama: {
                title: 'Daily Hukamnama',
                desc: "Today's Hukamnama from Darbar Sahib, in Gurmukhi and English.",
                cta: 'Read today’s',
            },
            shabad: {
                title: 'Shabad Search',
                desc: 'Look up any Ang (1–1430) of the Guru Granth Sahib.',
                cta: 'Search Gurbani',
            },
            seva: {
                title: 'Seva Events',
                desc: 'Find and join local Sangat seva opportunities.',
                cta: 'Browse events',
            },
        },
    },

    about: {
        badge: '</> The Architect',
        builtBy: 'Built By',
        bio1Before: 'Computer Science undergraduate at ',
        bio1School: 'UC Irvine',
        bio1After: " (Class of '27) with a relentless passion for AI/ML and Full Stack engineering.",
        bio2Before: 'This platform leverages ',
        bio2Highlight: 'Generative AI',
        bio2After:
            ' to bridge the gap between ancient wisdom and modern technology. It represents the intersection of spiritual heritage and state-of-the-art language models.',
        portfolioCta: 'View My Portfolio',
        linkedinCta: 'Connect on LinkedIn',
    },

    chat: {
        title: 'Ask SikhAI',
        newChat: 'New chat',
        clearPrompt: 'Clear this chat?',
        clearConfirm: 'Clear',
        cancel: 'Cancel',
        confirmClearAria: 'Confirm clearing the conversation',
        guidedBy: 'Guided by {name}',
        change: 'Change',
        latest: 'Latest',
        dismiss: 'Dismiss',
        browseByTopic: 'Browse by topic',
        settingsTitle: 'Chat settings',
        closeSettings: 'Close settings',
        perspective: 'Perspective',
        perspectiveNote:
            "SikhAI never speaks as a Guru — it answers guided by the chosen Guru's life, Bani, and teachings.",
        responseStyle: 'Response style',
        language: 'Language',
        autoLanguage: 'Auto (site language)',
        guruPerspectiveAria: 'Guru perspective',
        poweredBy: 'Powered by Gemini',
        done: 'Done',
        lensSwitchNotice: 'Now answering through the lens of {name}',
        lensSwitchNoticeDefault: 'Now answering as SikhAI, drawing on all ten Gurus',
        inputPlaceholder: 'Ask a question...',
        messageAria: 'Message',
        sendAria: 'Send message',
        stopAria: 'Stop generating',
        thinking: 'SikhAI is thinking',
        interrupted: 'Response interrupted',
        copyAria: 'Copy message',
        copiedAria: 'Copied',
        regenerateAria: 'Regenerate response',
        discussing: 'Discussing: {title}',
        stopDiscussingAria: 'Stop discussing this passage',
        config: chatConfig,
    },

    hukamnama: {
        title: "Today's Hukamnama",
        today: 'Today',
        dateFormat: '{month} {date}, {year}',
        liveFrom: 'Live from Darbar Sahib',
        unable: 'Unable to load the Hukamnama right now.',
        ang: 'Ang {n}',
        discussCta: "Discuss today's Hukamnama with SikhAI",
    },

    shabad: {
        title: 'Find by {ang}',
        angWord: 'Ang',
        angNumberAria: 'Ang number',
        placeholder: 'Enter Ang Number (1-1430)',
        searchButton: 'Search',
        helpText: 'Enter a page number to read the Gurbani from that Ang.',
        fetching: 'Fetching Ang...',
        invalidDigits: 'Please enter a valid Ang number (digits only).',
        angRange: 'Ang number must be between 1 and 1430.',
        notFound: 'Ang not found. Please try a number between 1-1430.',
        fetchFailed: 'Failed to fetch Gurbani.',
        angLabel: 'Ang {n}',
        askAboutAng: 'Ask about this Ang',
        lineN: 'Line {n}',
        granth: 'Guru Granth Sahib Ji',
        gurmukhiUnavailable: 'Gurmukhi Unavailable',
        translationUnavailable: 'Translation unavailable',
    },

    seva: {
        heroTitle: 'Serve with {word}',
        heroWord: 'Humility',
        // Gurbani (Ang 26) — quoted per language: romanized here, Gurmukhi in pa.
        quote: '“Vich duniya sev kamaiye, ta dargah baisan paiye.”',
        postEvent: '+ Post Event',
        signInPrompt: 'You must be signed in to join a Seva event.',
        joinError: 'Something went wrong joining the event. Please try again.',
        dismissAria: 'Dismiss notice',
        loading: 'Loading...',
        spotsLeft: '{n} spots left',
        joined: 'Joined! Waheguru',
        full: 'Full - Waheguru',
        join: 'Join Seva',
        // Display labels only — the raw category value stays the data/style key.
        categories: {
            Langar: 'Langar',
            Service: 'Service',
            Education: 'Education',
            Other: 'Other',
        },
    },

    sevaCreate: {
        title: 'Post New Seva',
        cancel: 'Cancel',
        eventTitle: 'Event Title',
        eventTitlePlaceholder: 'e.g. Weekend Langar Prep',
        category: 'Category',
        volunteersNeeded: 'Volunteers Needed',
        neededPlaceholder: 'e.g. 5',
        location: 'Location (Gurudwara)',
        locationPlaceholder: 'e.g. Gurudwara Singh Sabha',
        dateTime: 'Date & Time',
        datePlaceholder: 'e.g. Sat, Jan 20 • 4:00 AM',
        description: 'Description',
        optional: '(optional)',
        descriptionPlaceholder: 'What will volunteers be doing?',
        createError: 'Something went wrong creating the event. Please try again.',
        posting: 'Posting...',
        submit: 'Create Seva Event',
    },

    footer: {
        builtBy: 'Built by',
        navAria: 'Footer',
    },

    meta: {
        title: 'SikhAI - Wisdom of the Gurus, Illuminated by AI',
        titleTemplate: '%s | SikhAI',
        description: 'Architecting a Modern Bridge Between Ancient Heritage and Generative AI.',
        ogImageAlt: 'SikhAI Logo',
        aboutTitle: 'About',
        chatTitle: 'Ask SikhAI',
        shabadTitle: 'Shabad Search',
        sevaTitle: 'Seva Events',
        sevaCreateTitle: 'Post a Seva Event',
        hukamnamaTitle: "Today's Hukamnama",
    },

    // Keys matching the `code` field on API error responses, plus client-local
    // fallbacks. Unknown codes fall back to `generic`.
    errors: {
        generic: 'Sorry, something went wrong. Please try again.',
        contextLoad: 'Could not load that passage. You can still chat normally.',
        chat_empty: 'Please enter a message.',
        chat_too_long: 'That message is too long. Please shorten it and try again.',
        chat_failed: 'Sorry, something went wrong on our end. Please try again.',
        missing_query: 'Missing query',
        invalid_ang: 'Invalid Ang number',
        source_error: 'Could not reach the Gurbani source. Please try again.',
        hukamnama_unavailable: 'Unable to load the Hukamnama right now.',
    },
};

export type Dictionary = typeof en;
export default en;
