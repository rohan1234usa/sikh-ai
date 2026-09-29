// Grading and building quizzes. Pure and deterministic: a quiz's order comes
// from a seed, never Math.random(), so the server's HTML and the browser's
// first render agree.

import { fmt } from '@/lib/i18n/fmt';
import type { ChoiceQuestion, QuizQuestion, TypedQuestion, VocabWord } from './config';

export type QuizScore = { correct: number; total: number };

// The comparison form of a typed answer. Romanized Punjabi has no single
// spelling, so grading ignores what families write differently: case,
// spaces, punctuation, accents, w or v, ph or f, and how length is shown (ee
// or i, oo or u, a letter doubled or not: haal/hal, rajj/raj, achha/acha).
// That would let a misread vowel or addak through (deel folds to dil, pata to
// patta), so a strict question, one where reading them is the point, keeps
// them. No consonant is ever folded into another: t and th, d and dh, n and
// nh stay different, and there is no "close enough". The house spelling is
// always shown once checked, so the leniency never teaches a wrong one.
// Gurmukhi letters and digits count as nothing, so a question that shows
// Gurmukhi digits can't be answered by copying them.
export function foldRoman(input: string, strict = false): string {
    const plain = input
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/w/g, 'v')
        .replace(/ph/g, 'f');
    if (strict) return plain;
    return plain
        .replace(/ee/g, 'i')
        .replace(/oo/g, 'u')
        .replace(/([a-z])\1+/g, '$1');
}

export function typedMatches(input: string, question: Pick<TypedQuestion, 'answer' | 'accept' | 'strict'>): boolean {
    const given = foldRoman(input, question.strict);
    if (given === '') return false;
    return [question.answer, ...(question.accept ?? [])].some((answer) => foldRoman(answer, question.strict) === given);
}

export function choiceMatches(choice: string | null, question: Pick<ChoiceQuestion, 'answer'>): boolean {
    return choice === question.answer;
}

export function isCorrect(question: QuizQuestion, answer: string | null): boolean {
    if (answer === null) return false;
    return question.kind === 'typed' ? typedMatches(answer, question) : choiceMatches(answer, question);
}

// One result per question, in order; a missing or null answer is wrong.
export function scoreQuiz(
    questions: readonly QuizQuestion[],
    answers: readonly (string | null | undefined)[],
): { score: QuizScore; results: boolean[] } {
    const results = questions.map((question, i) => isCorrect(question, answers[i] ?? null));
    return { score: { correct: results.filter(Boolean).length, total: questions.length }, results };
}

// FNV-1a: a string seed to 32 bits.
function hashSeed(seed: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

// mulberry32: small and fast, and plenty for shuffling quiz choices.
function mulberry32(state: number): () => number {
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Fisher–Yates driven by the seed: the same seed always gives the same order.
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
    const out = [...items];
    const random = mulberry32(hashSeed(seed));
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

export type VocabQuizPrompts = {
    meaning: string; // "What does this mean?"
    say: string;     // "How do you say “{english}” in Punjabi?"
};

// The core meanings of a gloss: each ";" part, up to any "(". "hello;
// goodbye" means hello and goodbye; "thank you (warmer); kindness" means
// thank you and kindness.
const senses = (english: string) => english.split(';').map((part) => part.split('(')[0].trim().toLowerCase());

// Two words mean the same when they share a core meaning, or when the data
// says so where the glosses don't show it (mom and mother).
function sameMeaning(a: VocabWord, b: VocabWord): boolean {
    if (a.sameAs?.includes(b.id) || b.sameAs?.includes(a.id)) return true;
    const theirs = senses(b.english);
    return senses(a.english).some((sense) => theirs.includes(sense));
}

// A topic's quiz: `count` of its words, alternating "what does this mean?"
// (four English meanings to choose from, the wrong ones from the same topic,
// and never two that mean the same, like "mom" and "mother (formal)") and
// "how do you say it?" (type the romanization; a word from the topic that
// means exactly what was asked is right too). The same words and seed always
// give the same quiz; a new seed gives a new one. The quiz shuffles the
// choices when it shows them.
export function buildVocabQuiz(
    words: readonly VocabWord[],
    seed: string,
    prompts: VocabQuizPrompts,
    count = 10,
): QuizQuestion[] {
    return seededShuffle(words, seed)
        .slice(0, count)
        .map((word, i): QuizQuestion => {
            if (i % 2 === 1) {
                // "brother" takes veer as well as bhra; "brother (affectionate)"
                // takes only veer.
                const asked = word.english.trim().toLowerCase();
                const synonyms = words.filter((w) => w !== word && senses(w.english).includes(asked));
                const accept = [...(word.accept ?? []), ...synonyms.flatMap((w) => [w.roman, ...(w.accept ?? [])])];
                return {
                    kind: 'typed',
                    prompt: fmt(prompts.say, { english: word.english }),
                    answer: word.roman,
                    ...(accept.length ? { accept } : {}),
                };
            }
            const wrong = seededShuffle(words.filter((w) => w !== word && !sameMeaning(w, word)), `${seed}:${word.id}`)
                .filter((w, j, all) => all.findIndex((other) => sameMeaning(other, w)) === j)
                .slice(0, 3)
                .map((w) => w.english);
            return {
                kind: 'choice',
                prompt: prompts.meaning,
                promptPa: word.gurmukhi,
                promptRoman: word.roman,
                choices: [word.english, ...wrong],
                answer: word.english,
            };
        });
}
