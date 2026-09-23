// Pure: finds the Gurbani a chat reply quotes, and the Ang it cites for each.
//
// What counts as a quote:
// - In an English or bilingual reply, any run of 3+ Gurmukhi words — the
//   Gurmukhi *is* the quote there. One not closed by a danda gets a card only
//   if it verifies, since the reply never presented it as a verse.
// - In a Punjabi reply everything is Gurmukhi, so only segments closed by ॥
//   (Gurbani's verse marker) count; a single । is ordinary punctuation.
// - Never greetings or titles (the Fateh, Sat Sri Akal, "Sri Guru Granth
//   Sahib Ji"), and never a raag heading such as "ਆਸਾ ਮਹਲਾ ੫".
//
// Letters from other scripts inside a Gurmukhi word stay part of it, so a
// corrupted quote is checked as written and simply fails to verify.

import { MAX_ANG, MAX_CITATIONS, MAX_VERIFY_CHARS } from './citations';
import { gurmukhiLetterShare, tokens } from './gurmukhi';
import { looseKey } from './score';

export type ExtractedQuote = {
    quote: string;     // as written, with its closing danda
    angHint?: number;  // the Ang the reply cites for it
    hasDanda: boolean; // presented as a verse line
    index: number;     // offset in the reply, for document order
};

export function isPunjabiReply(text: string): boolean {
    return gurmukhiLetterShare(text) >= 0.5;
}

const BLANK = /^\s*(?:>\s*)*(?:[-*_]{3,})?\s*$/;
const HEADING = /^\s*(?:>\s*)*#{1,6}\s/;
const LIST_START = /^\s*(?:>\s*)*(?:\d{1,2}[.)]|[-*+])\s+/;
const RUN = /\p{Script=Gurmukhi}(?:[\p{Script=Gurmukhi}\p{M}।॥​-‍﻿0-9 \t ,;]|(?!\p{Script=Latin})\p{L})*/gu;
const HEADER = /(?:ਮਹਲਾ|ਮਃ|ਮਹਲੁ)\s*[੦-੯0-9]/; // ਮਹਲਾ / ਮਃ / ਮਹਲੁ + number
const ANG_EN = /\b(?:Ang|Ank|Panna)\b\.?\s*(?:No\.?|Number)?\s*[:#]?\s*(\d{1,4})\b(?!\s*[-–—]\s*\d)/giu;
const ANG_PA = /(?:ਅੰਗ|ਪੰਨਾ|ਪੰਨੇ)\s*(?:ਨੰ[:.]?|ਨੰਬਰ)?\s*[:#]?\s*([੦-੯0-9]{1,4})(?![੦-੯0-9])(?!\s*[-–—]\s*[੦-੯0-9])/gu; // ਅੰਗ / ਪੰਨਾ / ਪੰਨੇ
// A lead-in never runs past the end of a sentence (. ! ? or a danda then a
// space): "... on Ang 12. Elsewhere Guru Ji writes:" gives no Ang to the quote.
const LEAD_IN = /^(?:(?![.!?।]\s)[^\n]){0,80}:\s*(?:\n\s*(?:>\s*)*)?["“'‘>\s]*$/;

// Words that make up greetings and titles; a segment made only of these is
// never checked. Compared as loose keys so every spelling variant counts.
const GREETING_KEYS = new Set([
    'ਵਾਹਿਗੁਰੂ', 'ਜੀ', 'ਕਾ', 'ਕੀ', 'ਖਾਲਸਾ', 'ਫਤਿਹ', 'ਫਤਹਿ', 'ਫਤੇ', 'ਸਤਿ', 'ਸ੍ਰੀ', 'ਸਿਰੀ', 'ਅਕਾਲ',
    'ਜੋ', 'ਬੋਲੇ', 'ਸੋ', 'ਨਿਹਾਲ', 'ੴ', 'ਸਤਿਗੁਰ', 'ਪ੍ਰਸਾਦਿ', 'ਗੁਰੂ', 'ਗ੍ਰੰਥ', 'ਸਾਹਿਬ', 'ਮਹਾਰਾਜ',
].map(looseKey));

function toAng(digits: string): number | null {
    const ascii = digits.replace(/[੦-੯]/g, d => String(d.charCodeAt(0) - 0x0A66));
    const n = Number(ascii);
    return Number.isInteger(n) && n >= 1 && n <= MAX_ANG ? n : null;
}

type Line = { text: string; block: number; listStart: boolean; heading: boolean };
type Mention = { ang: number; at: number; end: number; line: number; block: number; boundTo?: Quote };
type Quote = ExtractedQuote & { end: number; line: number; block: number; key: string };

// `limit` defaults to the cards the chat shows; the eval lifts it.
export function extractQuotes(text: string, opts: { punjabiReply?: boolean; limit?: number } = {}): ExtractedQuote[] {
    const punjabiReply = opts.punjabiReply ?? isPunjabiReply(text);
    const source = text.normalize('NFC').replace(/\r\n?/g, '\n').slice(0, MAX_VERIFY_CHARS);

    // Lines, cleaned of emphasis markup, with their paragraph ("block") number.
    const lines: Line[] = [];
    let block = 0;
    for (const raw of source.split('\n')) {
        const blank = BLANK.test(raw);
        const heading = HEADING.test(raw);
        if (blank || heading) block++;
        lines.push({
            text: raw.replace(/[*_`]/g, ''),
            block,
            listStart: LIST_START.test(raw),
            heading: blank || heading,
        });
        if (heading) block++;
    }
    const flat = lines.map(l => l.text).join('\n');
    const lineStarts: number[] = [];
    let acc = 0;
    for (const l of lines) { lineStarts.push(acc); acc += l.text.length + 1; }

    const quotes: Quote[] = [];
    const mentions: Mention[] = [];

    lines.forEach((line, n) => {
        if (line.heading) return;
        const base = lineStarts[n];
        for (const pattern of [ANG_EN, ANG_PA]) {
            pattern.lastIndex = 0;
            for (const m of line.text.matchAll(pattern)) {
                const ang = toAng(m[1]);
                if (ang) mentions.push({ ang, at: base + m.index!, end: base + m.index! + m[0].length, line: n, block: line.block });
            }
        }
        RUN.lastIndex = 0;
        for (const run of line.text.matchAll(RUN)) {
            const parts = run[0].split(/([।॥]+)/);
            let pos = base + run.index!;
            for (let i = 0; i < parts.length; i += 2) {
                const segment = parts[i];
                const danda = parts[i + 1] ?? '';
                const segStart = pos + (segment.length - segment.trimStart().length);
                pos += segment.length + danda.length;
                const words = tokens(segment).filter(t => /[਀-੿]/.test(t));
                if (words.length < 3 || words.length > 40) continue;
                const loose = words.map(looseKey);
                if (loose.reduce((sum, k) => sum + [...k].length, 0) < 7) continue;
                if (HEADER.test(segment)) continue;
                if (loose.every(k => GREETING_KEYS.has(k))) continue;
                const closedByVerse = danda.includes('॥');
                if (punjabiReply && !closedByVerse) continue;
                const trimmed = segment.trim();
                quotes.push({
                    quote: danda ? `${trimmed} ${danda[0]}` : trimmed,
                    // Only ॥ marks a verse. A single । ends an ordinary Punjabi
                    // sentence, and a reply's own prose must never earn a card
                    // saying it was not found in Gurbani.
                    hasDanda: closedByVerse,
                    index: segStart,
                    end: segStart + trimmed.length + danda.length,
                    line: n,
                    block: line.block,
                    key: loose.join(''),
                });
            }
        }
    });

    quotes.sort((a, b) => a.index - b.index);
    mentions.sort((a, b) => a.at - b.at);

    // Lead-in: "On Ang 394, Guru Arjan Dev Ji says:" binds that Ang to the
    // quote that follows, and to no other. Markdown normally puts a blank line
    // between the lead-in and the blockquote, which starts a new block, so one
    // block of distance counts as "next" — but no more, since a hint carried
    // across a paragraph could accuse the reply of an Ang it never cited.
    const NEAR = 1;
    for (const mention of mentions) {
        const next = quotes.find(q => q.index >= mention.end && q.block - mention.block <= NEAR);
        if (next && next.angHint === undefined && LEAD_IN.test(flat.slice(mention.end, next.index))) {
            next.angHint = mention.ang;
            mention.boundTo = next;
        }
    }

    // Otherwise a quote takes the first Ang cited after it — the attribution
    // line under a blockquote is the common shape — within six lines, at most
    // one block away, and not past the start of another list item. An Ang
    // cited after a quote on its own line belongs to that line: a 3.8 Flash
    // answer quoted two lines from Ang 624, then a Sukhmani line ending
    // "(Ang 268)" on the next, and all four took 268. There is no backward
    // rule: a wrong hint would accuse the reply of a wrong Ang, while a missing
    // one only costs a search.
    for (const quote of quotes) {
        if (quote.angHint !== undefined) continue;
        const mention = mentions.find(m => m.at >= quote.end && m.block - quote.block <= NEAR);
        if (!mention || mention.line - quote.line > 6) continue;
        const crossesItem = lines.slice(quote.line + 1, mention.line + 1).some(l => l.listStart);
        const citesItsOwnLine = mention.line !== quote.line
            && quotes.some(q => q.line === mention.line && q.index < mention.at);
        if (crossesItem || citesItsOwnLine || (mention.boundTo && mention.boundTo !== quote)) continue;
        quote.angHint = mention.ang;
    }

    // One entry per line quoted; a repeat can still supply the Ang.
    const byKey = new Map<string, Quote>();
    for (const quote of quotes) {
        const seen = byKey.get(quote.key);
        if (!seen) byKey.set(quote.key, quote);
        else if (seen.angHint === undefined && quote.angHint !== undefined) seen.angHint = quote.angHint;
    }

    return [...byKey.values()].slice(0, opts.limit ?? MAX_CITATIONS).map(q => ({
        quote: q.quote,
        hasDanda: q.hasDanda,
        index: q.index,
        ...(q.angHint !== undefined ? { angHint: q.angHint } : {}),
    }));
}
