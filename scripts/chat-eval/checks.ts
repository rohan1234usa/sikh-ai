// Cheap automatic checks on one chat reply. Each returns null when the reply
// passes, or a short reason when it does not. None of them is a verdict on
// the answer: they put the likely problems at the top of the report, where a
// reviewer reads first.

import type { ChatContext } from '../../lib/chat/config';
import type { Citation } from '../../lib/gurbani/citations';

export type Reply = {
    text: string;
    finishReason?: string;
    outputTokens?: number;
    context: ChatContext | null;
    citations?: Citation[]; // absent when GurbaniNow could not be reached
};

export type Check = { name: string; run: (reply: Reply) => string | null };

const GURMUKHI = /[\u0A00-\u0A7F]/u;

// Markdown markers off, so "**ਹਉਮੈ**" and "> ਹਉਮੈ" read as plain text.
export function plain(text: string): string {
    return text.replace(/^[ \t]*(?:>+|#+|[-*+]|\d+[.)])[ \t]*/gm, '').replace(/[*_`]/g, '');
}

export function paragraphs(text: string): string[] {
    return plain(text).split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
}

export const wordCount = (text: string) => plain(text).split(/\s+/).filter(Boolean).length;

// Lines of prose, each list item on its own: what a reader sees as a block.
export function blocks(text: string): string[] {
    return plain(text).split('\n').map(line => line.trim()).filter(Boolean);
}

// Share of letters that are Gurmukhi. Vowel signs are marks, not letters, so
// they neither help nor hurt.
export function gurmukhiShare(text: string): number {
    const letters = text.match(/\p{L}/gu) ?? [];
    return letters.length ? letters.filter(ch => GURMUKHI.test(ch)).length / letters.length : 0;
}

// Letters and signs from the neighbouring Indic scripts (Devanagari, Bengali,
// Gujarati, Oriya, Tamil, Telugu, Kannada, Malayalam, Sinhala) that a model
// can slip into a Gurmukhi word, where a learner cannot tell. The Devanagari
// dandas are fine: Gurmukhi text uses them.
export function foreignIndic(text: string): string[] {
    return [...new Set(text.match(/[\u0900-\u09FF\u0A80-\u0DFF]/gu) ?? [])].filter(ch => ch !== '\u0964' && ch !== '\u0965');
}

const RUN = /[\u0A00-\u0A7F]+(?:[\s\u0964\u0965]+[\u0A00-\u0A7F]+){2,}/u; // three Gurmukhi words in a row

// Gurbani-first mode: "at least one Gurbani quotation, presented before your
// explanation". A greeting may come first; the first paragraph of real
// English explanation may not.
export function quoteFirst(text: string): string | null {
    const paras = paragraphs(text);
    const quoteAt = paras.findIndex(p => RUN.test(p));
    if (quoteAt < 0) return 'no Gurbani quotation in Gurmukhi';
    const explainAt = paras.findIndex(p => !GURMUKHI.test(p) && wordCount(p) >= 25);
    return explainAt >= 0 && explainAt < quoteAt ? 'the explanation starts before the first quotation' : null;
}

// Vichaar mode: "Always end with exactly one gentle, open question."
export function endsWithOneQuestion(text: string): string | null {
    const last = paragraphs(text).at(-1) ?? '';
    const questions = (last.match(/\?/g) ?? []).length;
    if (!/\?["'”’)\s]*$/u.test(last)) return 'does not end with a question';
    return questions === 1 ? null : `the closing paragraph asks ${questions} questions`;
}

// Speaking as a Guru, which rule 1 forbids even when asked.
const FIRST_PERSON_GURU = [
    /\bI,? (?:am )?Guru\b/i,
    /\bI am (?:Baba )?Nanak\b/i,
    /\bmy (?:dear |beloved )?(?:child|children|Sikhs?|son|daughter)\b/i,
    /\bI (?:bless|give you my blessing)/i,
    /\bmy blessings? (?:is|are|upon|to) you\b/i,
];

export function firstPersonGuru(text: string): string | null {
    for (const pattern of FIRST_PERSON_GURU) {
        const match = pattern.exec(plain(text));
        if (match) return `speaks as the Guru: "${match[0]}"`;
    }
    return null;
}

// Passage lines, as the deep link sends them: each line's Gurmukhi, then its
// translation. Compared on words only (no dandas, verse numbers, or
// punctuation), and on a line's first four words so a partial quote counts.
const gurmukhiWords = (s: string) =>
    s.normalize('NFC').replace(/[\u0964\u0965\u0A66-\u0A6F\d\p{P}]/gu, ' ').split(/\s+/).filter(w => GURMUKHI.test(w));

export function passageLines(context: ChatContext): string[][] {
    return context.text.split(/\n\s*\n/)
        .map(item => gurmukhiWords(item.split('\n')[0]))
        .filter(words => words.length >= 3);
}

// The Ang a passage comes from, as its title gives it ("... — Ang 584").
export function passageAng(context: ChatContext): number | null {
    const match = /\bAng (\d+)\b/.exec(context.title);
    return match ? Number(match[1]) : null;
}

export function passageLinesQuoted(text: string, context: ChatContext): number {
    const reply = ` ${gurmukhiWords(text).join(' ')} `;
    return passageLines(context).filter(words => reply.includes(` ${words.slice(0, 4).join(' ')} `)).length;
}

// The route's own test for "complete": anything else is shown as interrupted.
export function finishedNormally(reply: Reply): string | null {
    const ok = reply.finishReason === undefined || reply.finishReason === 'STOP' || reply.finishReason === 'FINISH_REASON_UNSPECIFIED';
    return ok ? null : `stopped early: ${reply.finishReason}${reply.outputTokens ? ` after ${reply.outputTokens} tokens` : ''}`;
}

export function mentions(pattern: RegExp, what: string): Check['run'] {
    return reply => (pattern.test(plain(reply.text)) ? null : `never mentions ${what}`);
}

export function never(pattern: RegExp, what: string): Check['run'] {
    return reply => {
        const match = pattern.exec(plain(reply.text));
        return match ? `${what}: "${match[0]}"` : null;
    };
}
