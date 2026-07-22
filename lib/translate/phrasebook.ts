// Curated starter phrasebook: parallel-text content (every entry always
// carries Gurmukhi + roman + English together), NOT UI copy — only the
// category labels live in the i18n dictionaries, keyed by PhraseCategoryId.
//
// AI-drafted phrase content, pending review by a fluent speaker — verify
// Gurmukhi spellings, register, and honorifics before treating as canonical.
// Romanization follows the site's pa-latn conventions: familiar community
// spellings (Waheguru, Sat Sri Akal, Gurdwara, langar), no diacritics or
// apostrophes, one spelling per word held file-wide. Cross-check recurring
// terms against lib/i18n/dictionaries/pa-latn.ts so spellings never drift.
// `note` (one-line cultural/usage note) is English-only in v1 — a known
// limitation, kept to avoid tripling the fluent-review burden.

export const PHRASE_CATEGORIES = ['greetings', 'family', 'gurdwara', 'everyday', 'food'] as const;
export type PhraseCategoryId = (typeof PHRASE_CATEGORIES)[number];

export type Phrase = {
    id: string; // stable slug
    category: PhraseCategoryId;
    gurmukhi: string; // rendered with font-gurmukhi + lang="pa"
    roman: string;    // rendered with lang="pa-Latn"
    english: string;  // meaning / functional gloss
    // One-line cultural or usage note. English-only for now, in every UI
    // language. `npm run audit:i18n -- --localize-notes` machine-translates
    // these to Gurmukhi and writes notes-pa.generated.json; applying it means
    // adding a `notePa?` field here and preferring it when the site language is
    // 'pa' (pa-latn stays English — Cloud Translation cannot romanize Punjabi).
    note?: string;
};

export const PHRASES: Phrase[] = [
    // ——— Greetings & Respect ———
    {
        id: 'sat-sri-akal',
        category: 'greetings',
        gurmukhi: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ',
        roman: 'Sat Sri Akal',
        english: 'The timeless God is truth — the universal Punjabi greeting',
        note: 'Works for both hello and goodbye; with elders, say it with folded hands.',
    },
    {
        id: 'waheguru-ji-ka-khalsa',
        category: 'greetings',
        gurmukhi: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ, ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਹਿ',
        roman: 'Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh',
        english: 'The Khalsa belongs to Waheguru; victory belongs to Waheguru',
        note: 'The formal Sikh greeting, spoken as one continuous phrase — the reply is the same phrase back.',
    },
    {
        id: 'ki-haal-hai',
        category: 'greetings',
        gurmukhi: 'ਕੀ ਹਾਲ ਹੈ?',
        roman: 'Ki haal hai?',
        english: 'How are you?',
        note: 'Casual. With elders, soften it: "Tuhada ki haal hai ji?"',
    },
    {
        id: 'main-theek-haan',
        category: 'greetings',
        gurmukhi: 'ਮੈਂ ਠੀਕ ਹਾਂ, ਤੁਸੀਂ ਦੱਸੋ',
        roman: 'Main theek haan, tusi dasso',
        english: "I'm fine — you tell me (how you are)",
        note: 'Adding "tusi dasso" politely returns the question, the way the aunties expect.',
    },
    {
        id: 'tuhada-naam-ki-hai',
        category: 'greetings',
        gurmukhi: 'ਤੁਹਾਡਾ ਨਾਂ ਕੀ ਹੈ?',
        roman: 'Tuhada naam ki hai?',
        english: 'What is your name?',
        note: '"Tuhada" is the respectful your; "tera" is for close friends and kids.',
    },
    {
        id: 'mil-ke-khushi-hoyi',
        category: 'greetings',
        gurmukhi: 'ਤੁਹਾਨੂੰ ਮਿਲ ਕੇ ਬਹੁਤ ਖ਼ੁਸ਼ੀ ਹੋਈ',
        roman: 'Tuhanu mil ke bahut khushi hoyi',
        english: 'Very pleased to meet you',
    },
    {
        id: 'dhanvaad',
        category: 'greetings',
        gurmukhi: 'ਧੰਨਵਾਦ ਜੀ',
        roman: 'Dhanvaad ji',
        english: 'Thank you',
        note: 'Punjabi often shows thanks through action rather than words — "meharbani" is a warmer, older alternative.',
    },
    {
        id: 'maaf-karna',
        category: 'greetings',
        gurmukhi: 'ਮਾਫ਼ ਕਰਨਾ ਜੀ',
        roman: 'Maaf karna ji',
        english: "Excuse me / I'm sorry",
        note: 'The "ji" softens it; use it to get attention politely, too.',
    },
    {
        id: 'fer-milange',
        category: 'greetings',
        gurmukhi: 'ਫੇਰ ਮਿਲਾਂਗੇ',
        roman: 'Fer milange',
        english: "We'll meet again — see you later",
    },
    {
        id: 'ji-aayan-nu',
        category: 'greetings',
        gurmukhi: 'ਜੀ ਆਇਆਂ ਨੂੰ',
        roman: 'Ji aayan nu',
        english: 'Welcome (to those who have come)',
        note: 'Seen on gurdwara doorways and wedding banners across Punjab and the diaspora.',
    },

    // ——— Family & Kinship ———
    {
        id: 'chacha-ji',
        category: 'family',
        gurmukhi: 'ਚਾਚਾ ਜੀ',
        roman: 'Chacha ji',
        english: "Father's younger brother",
        note: "Punjabi kinship is precise: chacha (dad's younger brother), taya (dad's older brother), mama (mom's brother), masi (mom's sister), bhua (dad's sister).",
    },
    {
        id: 'taya-ji',
        category: 'family',
        gurmukhi: 'ਤਾਇਆ ਜੀ',
        roman: 'Taya ji',
        english: "Father's older brother",
        note: "Taya ji's wife is tayi ji — every uncle-aunt pair has its own matched title.",
    },
    {
        id: 'mama-ji',
        category: 'family',
        gurmukhi: 'ਮਾਮਾ ਜੀ',
        roman: 'Mama ji',
        english: "Mother's brother",
        note: 'A classic false friend: "mama" never means mom in Punjabi — mom is "mummy", "bebe", or "mata ji".',
    },
    {
        id: 'masi-ji',
        category: 'family',
        gurmukhi: 'ਮਾਸੀ ਜੀ',
        roman: 'Masi ji',
        english: "Mother's sister",
        note: 'Folk etymology reads masi as "maa si" — like a mother.',
    },
    {
        id: 'bhua-ji',
        category: 'family',
        gurmukhi: 'ਭੂਆ ਜੀ',
        roman: 'Bhua ji',
        english: "Father's sister",
        note: "Bhua ji's husband is phuphar ji.",
    },
    {
        id: 'nana-nani',
        category: 'family',
        gurmukhi: 'ਨਾਨਾ ਨਾਨੀ',
        roman: 'Nana nani',
        english: 'Maternal grandparents',
        note: 'Nanke — your mom\'s side of the family — is a beloved word in Punjabi songs; summers at nanke are a whole genre of childhood memory.',
    },
    {
        id: 'dada-dadi',
        category: 'family',
        gurmukhi: 'ਦਾਦਾ ਦਾਦੀ',
        roman: 'Dada dadi',
        english: 'Paternal grandparents',
        note: "Dadke is your dad's side; Punjabi never leaves you guessing which grandparents you mean.",
    },
    {
        id: 'veer-ji',
        category: 'family',
        gurmukhi: 'ਵੀਰ ਜੀ',
        roman: 'Veer ji',
        english: 'Respected brother',
        note: 'Used for actual brothers and for any man you respect like one — you will hear it constantly at the gurdwara.',
    },
    {
        id: 'bhain-ji',
        category: 'family',
        gurmukhi: 'ਭੈਣ ਜੀ',
        roman: 'Bhain ji',
        english: 'Respected sister',
        note: 'The affectionate everyday form is "penji".',
    },
    {
        id: 'eh-mera-parivaar',
        category: 'family',
        gurmukhi: 'ਇਹ ਮੇਰਾ ਪਰਿਵਾਰ ਹੈ',
        roman: 'Ih mera parivaar hai',
        english: 'This is my family',
    },

    // ——— Gurdwara & Faith ———
    {
        id: 'langar-chhako',
        category: 'gurdwara',
        gurmukhi: 'ਲੰਗਰ ਛਕ ਲਵੋ ਜੀ',
        roman: 'Langar chhak lavo ji',
        english: 'Please partake in langar (the community meal)',
        note: '"Chhakna" is the respectful verb used for langar and parshad — not the everyday word for eating.',
    },
    {
        id: 'seva-kar-sakda',
        category: 'gurdwara',
        gurmukhi: 'ਕੀ ਮੈਂ ਸੇਵਾ ਕਰ ਸਕਦਾ ਹਾਂ?',
        roman: 'Ki main seva kar sakda haan?',
        english: 'May I help with seva (selfless service)?',
        note: 'Verbs agree with the speaker: sakda for men, sakdi for women.',
    },
    {
        id: 'matha-tekna',
        category: 'gurdwara',
        gurmukhi: 'ਮੱਥਾ ਟੇਕਣਾ',
        roman: 'Matha tekna',
        english: 'To bow before Sri Guru Granth Sahib Ji',
        note: 'Literally "to rest the forehead" — knees down, forehead to the floor, an offering of the ego.',
    },
    {
        id: 'parshad-lai-lavo',
        category: 'gurdwara',
        gurmukhi: 'ਪ੍ਰਸ਼ਾਦ ਲੈ ਲਵੋ ਜੀ',
        roman: 'Parshad lai lavo ji',
        english: 'Please take parshad (the blessed offering)',
        note: 'Receive karah parshad with both hands cupped together.',
    },
    {
        id: 'ardaas-ho-rahi-hai',
        category: 'gurdwara',
        gurmukhi: 'ਅਰਦਾਸ ਹੋ ਰਹੀ ਹੈ',
        roman: 'Ardaas ho rahi hai',
        english: 'The ardaas (congregational prayer) is being offered',
        note: 'Everyone stands with folded hands for ardaas — pause at the doorway until it finishes.',
    },
    {
        id: 'ajj-da-hukamnama',
        category: 'gurdwara',
        gurmukhi: 'ਅੱਜ ਦਾ ਹੁਕਮਨਾਮਾ ਕੀ ਹੈ?',
        roman: 'Ajj da Hukamnama ki hai?',
        english: "What is today's Hukamnama (the Guru's command)?",
    },
    {
        id: 'kirtan-sohna-si',
        category: 'gurdwara',
        gurmukhi: 'ਕੀਰਤਨ ਬਹੁਤ ਸੋਹਣਾ ਸੀ',
        roman: 'Kirtan bahut sohna si',
        english: 'The kirtan (sung Gurbani) was beautiful',
    },
    {
        id: 'sadh-sangat-ji',
        category: 'gurdwara',
        gurmukhi: 'ਸਾਧ ਸੰਗਤ ਜੀ',
        roman: 'Sadh Sangat ji',
        english: 'Respected congregation',
        note: 'How nearly every speech and announcement at the gurdwara begins.',
    },
    {
        id: 'sir-dhak-lavo',
        category: 'gurdwara',
        gurmukhi: 'ਸਿਰ ਢੱਕ ਲਵੋ ਜੀ',
        roman: 'Sir dhak lavo ji',
        english: 'Please cover your head',
        note: 'Required in the darbar hall — rumaals (head coverings) are kept in baskets by the entrance.',
    },
    {
        id: 'jorhe-laah-deo',
        category: 'gurdwara',
        gurmukhi: 'ਜੋੜੇ ਇੱਥੇ ਲਾਹ ਦਿਓ ਜੀ',
        roman: 'Jorhe ithe laah deo ji',
        english: 'Take your shoes off here',
        note: "Jorha ghar is the shoe room — and cleaning the sangat's shoes there is one of the most honored sevas.",
    },

    // ——— Everyday Talk ———
    {
        id: 'haanji',
        category: 'everyday',
        gurmukhi: 'ਹਾਂਜੀ',
        roman: 'Haanji',
        english: 'Yes (respectfully)',
        note: 'A plain "haan" can feel curt to elders — haanji is the default safe yes.',
    },
    {
        id: 'achha',
        category: 'everyday',
        gurmukhi: 'ਅੱਛਾ',
        roman: 'Achha',
        english: 'Okay / I see / really?',
        note: 'Tone changes everything: agreement, surprise, or gentle skepticism — all in one word.',
    },
    {
        id: 'thorhi-punjabi',
        category: 'everyday',
        gurmukhi: 'ਮੈਨੂੰ ਥੋੜ੍ਹੀ ਪੰਜਾਬੀ ਆਉਂਦੀ ਹੈ',
        roman: 'Mainu thorhi Punjabi aundi hai',
        english: 'I know a little Punjabi',
        note: "The learner's most useful sentence — it instantly earns encouragement (and more Punjabi).",
    },
    {
        id: 'hauli-hauli-bolo',
        category: 'everyday',
        gurmukhi: 'ਹੌਲੀ ਹੌਲੀ ਬੋਲੋ ਜੀ',
        roman: 'Hauli hauli bolo ji',
        english: 'Please speak slowly',
    },
    {
        id: 'ki-matlab',
        category: 'everyday',
        gurmukhi: 'ਇਸ ਦਾ ਕੀ ਮਤਲਬ ਹੈ?',
        roman: 'Is da ki matlab hai?',
        english: 'What does this mean?',
    },
    {
        id: 'punjabi-vich-ki-kehnde',
        category: 'everyday',
        gurmukhi: 'ਇਸ ਨੂੰ ਪੰਜਾਬੀ ਵਿੱਚ ਕੀ ਕਹਿੰਦੇ ਹਨ?',
        roman: 'Is nu Punjabi vich ki kehnde han?',
        english: 'How do you say this in Punjabi?',
    },
    {
        id: 'chalo',
        category: 'everyday',
        gurmukhi: 'ਚਲੋ',
        roman: 'Chalo',
        english: "Let's go / come on / fine then",
        note: 'An all-purpose word: invitation, encouragement, resignation, or "moving on" — context decides.',
    },
    {
        id: 'koi-gal-nahi',
        category: 'everyday',
        gurmukhi: 'ਕੋਈ ਗੱਲ ਨਹੀਂ',
        roman: 'Koi gall nahi',
        english: "No worries / it's nothing",
    },
    {
        id: 'bahut-vadiya',
        category: 'everyday',
        gurmukhi: 'ਬਹੁਤ ਵਧੀਆ',
        roman: 'Bahut vadhia',
        english: 'Very good / excellent',
    },
    {
        id: 'samajh-nahi-aayi',
        category: 'everyday',
        gurmukhi: 'ਮੈਨੂੰ ਸਮਝ ਨਹੀਂ ਆਈ',
        roman: 'Mainu samajh nahi aayi',
        english: "I didn't understand",
        note: 'Literally "understanding did not come to me" — Punjabi loves this construction (hunger, sleep, and anger all "come to you" too).',
    },

    // ——— Food & Home ———
    {
        id: 'roti-kha-layi',
        category: 'food',
        gurmukhi: 'ਰੋਟੀ ਖਾ ਲਈ?',
        roman: 'Roti kha layi?',
        english: 'Have you eaten?',
        note: 'The classic Punjabi way of saying "I care about you."',
    },
    {
        id: 'hor-lavo',
        category: 'food',
        gurmukhi: 'ਹੋਰ ਲਵੋ ਜੀ',
        roman: 'Hor lavo ji',
        english: 'Have some more',
        note: 'Refusing outright at a Punjabi table is nearly impossible — expect seconds regardless.',
    },
    {
        id: 'rajj-gaya',
        category: 'food',
        gurmukhi: 'ਬੱਸ ਜੀ, ਮੈਂ ਰੱਜ ਗਿਆ',
        roman: 'Bass ji, main rajj gaya',
        english: "That's enough — I'm full",
        note: 'Rajj gaya for men, rajj gayi for women; "rajjna" means to be fully satisfied, not merely full.',
    },
    {
        id: 'bahut-suaad',
        category: 'food',
        gurmukhi: 'ਬਹੁਤ ਸੁਆਦ ਹੈ',
        roman: 'Bahut suaad hai',
        english: "It's delicious",
        note: 'The highest compliment to the cook — say it early and often.',
    },
    {
        id: 'chaa-peeoge',
        category: 'food',
        gurmukhi: 'ਚਾਹ ਪੀਓਗੇ?',
        roman: 'Chaa peeoge?',
        english: 'Will you have tea?',
        note: 'Chaa is hospitality itself; a polite refusal takes at least three rounds.',
    },
    {
        id: 'bhukh-lagi-hai',
        category: 'food',
        gurmukhi: 'ਮੈਨੂੰ ਭੁੱਖ ਲੱਗੀ ਹੈ',
        roman: 'Mainu bhukh lagi hai',
        english: "I'm hungry",
        note: 'Literally "hunger has attached to me".',
    },
    {
        id: 'pani-mil-sakda',
        category: 'food',
        gurmukhi: 'ਪਾਣੀ ਮਿਲ ਸਕਦਾ ਹੈ ਜੀ?',
        roman: 'Pani mil sakda hai ji?',
        english: 'Could I get some water?',
    },
    {
        id: 'tarhka',
        category: 'food',
        gurmukhi: 'ਤੜਕਾ',
        roman: 'Tarhka',
        english: 'The sizzling spice base of a dish',
        note: 'Onions, garlic, and spices bloomed in hot ghee — the sound and smell that mean dinner is close.',
    },
    {
        id: 'saag-te-roti',
        category: 'food',
        gurmukhi: 'ਮੱਕੀ ਦੀ ਰੋਟੀ ਤੇ ਸਰ੍ਹੋਂ ਦਾ ਸਾਗ',
        roman: 'Makki di roti te sarhon da saag',
        english: 'Corn flatbread with mustard greens',
        note: 'The iconic Punjabi winter meal — best with white makkhan (butter) on top.',
    },
    {
        id: 'ghar-di-roti',
        category: 'food',
        gurmukhi: 'ਘਰ ਦੀ ਰੋਟੀ ਵਰਗੀ ਕੋਈ ਚੀਜ਼ ਨਹੀਂ',
        roman: 'Ghar di roti vargi koi cheez nahi',
        english: 'Nothing compares to home-cooked food',
    },
];

// Case-insensitive filter across all three renditions + the note. A search
// query spans every category; the category filter applies only when no query
// is active (the Phrasebook component clears pills while searching).
export function searchPhrases(query: string, category?: PhraseCategoryId): Phrase[] {
    const q = query.trim().toLowerCase();
    if (!q) {
        return category ? PHRASES.filter(p => p.category === category) : PHRASES;
    }
    return PHRASES.filter(p =>
        p.gurmukhi.toLowerCase().includes(q) ||
        p.roman.toLowerCase().includes(q) ||
        p.english.toLowerCase().includes(q) ||
        (p.note?.toLowerCase().includes(q) ?? false)
    );
}
