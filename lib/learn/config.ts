// Client-safe: the Learn Punjabi section's ids and content types. Lesson
// bodies (explanations, examples, quizzes) live in lib/learn/content/ and are
// joined by the server-only lib/learn/curriculum.ts, so a client component
// that imports this file never pulls lesson text into its bundle.
//
// Every Punjabi example is parallel text: Gurmukhi, the house romanization
// (ROMANIZATION in lib/translate/prompts.ts) and English together.
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
