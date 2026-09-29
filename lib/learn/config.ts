// Client-safe: the Learn Punjabi section's ids and content types. Lesson
// bodies (explanations, examples, quizzes) live in lib/learn/content/ and are
// joined by the server-only lib/learn/curriculum.ts, so a client component
// that imports this file never pulls lesson text into its bundle.
//
// Every Punjabi example is parallel text: Gurmukhi, the house romanization
// (lib/translate/romanization.ts) and English together.
// Explanations are English in every UI language, since the audience reads
// English; the section's own chrome is translated in the dictionaries, keyed
// by the ids below.

export const TRACK_IDS = ['script', 'grammar', 'vocab', 'tutor'] as const;
export type TrackId = (typeof TRACK_IDS)[number];

// The tracks made of lessons, in the order the hub shows them.
export const LESSON_TRACK_IDS = ['script', 'grammar'] as const;
export type LessonTrackId = (typeof LESSON_TRACK_IDS)[number];

export const VOCAB_TOPIC_IDS = [
    'family',
    'greetings',
    'gurdwara',
    'food',
    'home',
    'numbers-time',
    'body-health',
    'feelings',
    'describing',
    'verbs',
] as const;
export type VocabTopicId = (typeof VOCAB_TOPIC_IDS)[number];

export const PARTS_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb', 'number', 'phrase'] as const;
export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];

export const GENDERS = ['m', 'f'] as const;
export type Gender = (typeof GENDERS)[number];

const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
    typeof value === 'string' && (list as readonly string[]).includes(value);

export const isLessonTrack = (value: unknown): value is LessonTrackId => oneOf(LESSON_TRACK_IDS, value);
export const isVocabTopic = (value: unknown): value is VocabTopicId => oneOf(VOCAB_TOPIC_IDS, value);

// One Punjabi word, phrase or sentence in all three renditions.
export type Example = {
    gurmukhi: string;
    roman: string;
    english: string;
    note?: string; // English, one line
};

// One cell of a letter or vowel-sign grid in the script track. `glyph` may
// carry ◌ (U+25CC) as the base of a lone vowel sign: '◌ਾ'.
export type LetterCard = {
    glyph: string;
    name: string;  // the letter's own name, romanized: kakka, kanna
    roman: string; // how the house romanization writes its sound
    sound: string; // English: how to say it, with an anchor word where one helps
};

export type LessonSection = {
    heading: string;
    body: string[]; // English paragraphs; they may quote Gurmukhi or roman inline
    letters?: LetterCard[];
    examples?: Example[];
    tip?: string;   // a one-line callout
};

type QuestionBase = {
    prompt: string;       // English
    promptPa?: string;    // Gurmukhi, shown large under the prompt
    promptRoman?: string; // its romanization, when the question isn't about reading it
    explanation?: string; // shown once the quiz is checked
};

export type ChoiceQuestion = QuestionBase & {
    kind: 'choice';
    choices: string[];              // 2 to 4, all different
    choicesLang?: 'pa' | 'pa-Latn'; // absent: English
    answer: string;                 // exactly one of `choices`
};

// Answered by typing. `answer` is romanized Punjabi in the house style, or
// digits. It is shown as the model answer once checked; lib/learn/quiz.ts
// grades leniently against it and `accept`.
export type TypedQuestion = QuestionBase & {
    kind: 'typed';
    answer: string;
    accept?: string[]; // other spellings families really use: nahin for nahi
};

export type QuizQuestion = ChoiceQuestion | TypedQuestion;

export type LessonBody = {
    sections: LessonSection[];
    quiz: QuizQuestion[];
};

export type VocabWord = {
    id: string;        // unique, prefixed by its topic: 'family-chacha'
    topic: VocabTopicId;
    gurmukhi: string;
    roman: string;     // verbs: the -na infinitive
    english: string;   // unique within its topic
    pos: PartOfSpeech;
    gender?: Gender;   // nouns only, and every noun has one
    accept?: string[]; // other spellings a quiz accepts
    example?: Example; // every verb has one
    note?: string;     // English, one line
};

export type LessonMeta = {
    slug: string;         // its URL segment, unique across tracks
    track: LessonTrackId;
    title: string;        // English, at most 60 characters
    summary: string;      // one English sentence of at most 160; also the page description
};

// Every lesson, in curriculum order: a track's lessons in the order they're
// taken. Titles live here rather than beside each body so the tutor page can
// name the lesson it was opened from without loading any lesson text.
export const LESSON_META = [
    {
        track: 'script',
        slug: 'how-gurmukhi-works',
        title: 'How Gurmukhi works',
        summary: 'Why every letter already says “a”, how vowels attach to letters, and the first two rows of the alphabet.',
    },
    {
        track: 'script',
        slug: 'rows-3-4-palatal-retroflex',
        title: 'Rows three and four: ਚ to ਣ',
        summary: 'The ch and j sounds, and the letters English doesn’t have: ਟ ਠ ਡ ਢ ਣ, said with the tongue curled back.',
    },
    {
        track: 'script',
        slug: 'rows-5-7-dental-labial-last',
        title: 'Rows five to seven: ਤ to ੜ',
        summary: 'The t and d said against the teeth, the lip sounds p, b and m, and the last row: y, r, l, v and the flapped ੜ.',
    },
    {
        track: 'script',
        slug: 'nukta-letters-and-digits',
        title: 'Dotted letters and Gurmukhi digits',
        summary: 'The six letters with a dot underneath for sounds like z, f and sh, and the digits you’ll see on every Ang.',
    },
    {
        track: 'script',
        slug: 'vowel-signs-1-muharni',
        title: 'Vowel signs, part 1: a, i and u',
        summary: 'Kanna, sihari, bihari, aunkar and dulainkar: the marks for aa, i, ee, u and oo, and how the romanization spells them.',
    },
    {
        track: 'script',
        slug: 'vowel-signs-2-and-carriers',
        title: 'Vowel signs, part 2, and the vowel carriers',
        summary: 'Lavan, dulavan, hora and kanaura, the whole muharni, and how ੳ ਅ ੲ carry a vowel at the start of a word.',
    },
    {
        track: 'script',
        slug: 'bindi-tippi-addak-subjoined',
        title: 'Nasal marks, doubled letters, letters underneath',
        summary: 'Bindi and tippi for nasal vowels, addak for doubled consonants, and the half letters tucked under another letter.',
    },
    {
        track: 'script',
        slug: 'tones',
        title: 'Tones: what ਘ ਝ ਢ ਧ ਭ and ਹ really do',
        summary: 'Punjabi has tones. Here is how five letters and ਹ turn into a low or a high pitch, and why you already hear them.',
    },
    {
        track: 'script',
        slug: 'reading-drills',
        title: 'Reading practice: words you already know',
        summary: 'Put it all together on words from the Gurdwara, the kitchen and the family, then on short sentences.',
    },
    {
        track: 'grammar',
        slug: 'sentence-order-and-copulas',
        title: 'Word order, pronouns and “to be”',
        summary: 'Punjabi puts the verb last. The order of a sentence, the words for I, you and they, and haan, hai, ho and han.',
    },
    {
        track: 'grammar',
        slug: 'gender-number-and-agreement',
        title: 'Gender, plurals and agreement',
        summary: 'Every noun is masculine or feminine, and adjectives and verbs change to match: changa munda, changi kurhi.',
    },
    {
        track: 'grammar',
        slug: 'possession-da-di-de',
        title: 'Whose is it? da, di, de',
        summary: 'Possession with da, di and de, and my, your, our: mera, tuhada, saada. They agree with the thing owned.',
    },
    {
        track: 'grammar',
        slug: 'postpositions-and-oblique',
        title: 'Little words after nouns: nu, ton, vich, naal',
        summary: 'Punjabi puts its prepositions after the noun, and the noun changes shape before them: kamra, but kamre vich.',
    },
    {
        track: 'grammar',
        slug: 'present-habitual-and-continuous',
        title: 'The present: I do, I am doing',
        summary: 'Say what you usually do (main karda haan), what you are doing now (main kar riha haan), and that you don’t.',
    },
    {
        track: 'grammar',
        slug: 'past-and-the-ergative-ne',
        title: 'The past, and why it’s kita and not kiti',
        summary: 'Past verbs agree with the person when nothing is done to anything, and with the thing when something is.',
    },
    {
        track: 'grammar',
        slug: 'future',
        title: 'The future: will, and let’s',
        summary: 'Make the future with -ga: main javanga, fer milange. Plus the everyday ways to suggest a plan.',
    },
    {
        track: 'grammar',
        slug: 'commands-and-requests',
        title: 'Asking and telling: kar, karo, karna ji',
        summary: 'Commands at three levels of politeness, the helper verbs that soften them, and how to say don’t.',
    },
    {
        track: 'grammar',
        slug: 'questions-and-negation',
        title: 'Questions, and saying no',
        summary: 'Question words (ki, kaun, kithe, kadon, kiven, kyon) and the ways to say no: nahi, na and nahi si.',
    },
    {
        track: 'grammar',
        slug: 'honorifics-and-respect',
        title: 'Respect: tusi, ji and the plural',
        summary: 'How Punjabi shows respect: tusi for one person, ji after names, and plural verbs for an elder.',
    },
    {
        track: 'grammar',
        slug: 'dative-subjects',
        title: 'Mainu: when things happen to you',
        summary: 'Hunger, liking, knowing and needing happen to you in Punjabi: mainu bhukh lagi hai, mainu chaa pasand hai.',
    },
    {
        track: 'grammar',
        slug: 'compound-verbs-and-modals',
        title: 'Helper verbs: can, already, should',
        summary: 'Verb pairs like ho gaya and dass deo, and the helpers for can, already, having done, and should.',
    },
] as const satisfies readonly LessonMeta[];

// One lesson's metadata, with its slug and track as literal types.
export type LessonEntry = (typeof LESSON_META)[number];
export type LessonSlug = LessonEntry['slug'];
export type Lesson = LessonEntry & LessonBody;

export const isLessonSlug = (value: unknown): value is LessonSlug =>
    typeof value === 'string' && LESSON_META.some((meta) => meta.slug === value);

export function lessonMeta(slug: LessonSlug): LessonEntry {
    return LESSON_META.find((meta) => meta.slug === slug)!;
}

export function lessonsFor(track: LessonTrackId): LessonEntry[] {
    return LESSON_META.filter((meta) => meta.track === track);
}

export const lessonPath = (meta: Pick<LessonMeta, 'track' | 'slug'>): string => `/learn/${meta.track}/${meta.slug}`;
export const topicPath = (topic: VocabTopicId): string => `/learn/vocab/${topic}`;

// Every page of the section, for the sitemap.
export function learnPaths(): string[] {
    return [
        '/learn',
        ...LESSON_TRACK_IDS.map((track) => `/learn/${track}`),
        ...LESSON_META.map(lessonPath),
        '/learn/vocab',
        ...VOCAB_TOPIC_IDS.map(topicPath),
        '/learn/tutor',
    ];
}
