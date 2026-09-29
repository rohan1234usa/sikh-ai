// Grading and building quizzes. Pure and deterministic: a quiz's order comes
// from a seed, never Math.random(), so the server's HTML and the browser's
// first render agree.

import { fmt } from '@/lib/i18n/fmt';
import type { ChoiceQuestion, QuizQuestion, TypedQuestion, VocabWord } from './config';

export type QuizScore = { correct: number; total: number };

const GURMUKHI_DIGITS = /[੦-੯]/g;

// The comparison form of a typed answer. Romanized Punjabi has no single
// spelling, so grading ignores what a learner can't be expected to know:
// case, spaces, punctuation, accents, and the choices every family makes
// differently (w or v, ph or f, ee or i, oo or u, and whether a letter is
// doubled: haal/hal, rajj/raj, achha/acha). Nothing that changes a sound is
// folded: t and th, d and dh, n and nh stay different, and there is no
// "close enough". The house spelling is always shown once checked, so the
// leniency never teaches a wrong one. Gurmukhi digits count as digits.
export function foldRoman(input: string): string {
    return input
        .replace(GURMUKHI_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0a66))
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/w/g, 'v')
        .replace(/ph/g, 'f')
        .replace(/ee/g, 'i')
        .replace(/oo/g, 'u')
        .replace(/([a-z])\1+/g, '$1');
}

export function typedMatches(input: string, question: Pick<TypedQuestion, 'answer' | 'accept'>): boolean {
    const given = foldRoman(input);
    if (given === '') return false;
    return [question.answer, ...(question.accept ?? [])].some((answer) => foldRoman(answer) === given);
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

// A topic's quiz: `count` of its words, alternating "what does this mean?"
// (four English meanings to choose from, the wrong ones from the same topic)
// and "how do you say it?" (type the romanization). The same words and seed
// always give the same quiz; a new seed gives a new one.
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
                return {
                    kind: 'typed',
                    prompt: fmt(prompts.say, { english: word.english }),
                    answer: word.roman,
                    ...(word.accept ? { accept: word.accept } : {}),
                };
            }
            const wrong = seededShuffle(words.filter((w) => w.english !== word.english), `${seed}:${word.id}`)
                .map((w) => w.english)
                .filter((english, j, all) => all.indexOf(english) === j)
                .slice(0, 3);
            return {
                kind: 'choice',
                prompt: prompts.meaning,
                promptPa: word.gurmukhi,
                promptRoman: word.roman,
                choices: seededShuffle([word.english, ...wrong], `${seed}:${word.id}:choices`),
                answer: word.english,
            };
        });
}
