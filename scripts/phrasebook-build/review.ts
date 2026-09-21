// review.md: what each phrase tap will show, for the fluent review the
// phrasebook is waiting on. Phrases left to the live translator come first,
// with the reason, then every shipped result in phrasebook order.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TranslationResult } from '../../lib/translate/config';
import type { Phrase } from '../../lib/translate/phrasebook';
import type { Assembled } from './assemble';
import type { GeneratedMeta } from './check';

const REVIEW_PATH = resolve(import.meta.dirname, 'review.md');

const flat = (s: string) => s.replace(/\s+/g, ' ').trim();

function headline(r: Pick<TranslationResult, 'gurmukhi' | 'roman' | 'english'>): string {
    return `${r.gurmukhi} · ${r.roman} · ${r.english}`;
}

// The model's own rendering, when it is not simply the curated text: the
// clearest sign that an entry and the house romanization disagree.
function ownRendering(phrase: Phrase, own: TranslationResult | null): string[] {
    if (!own || (own.roman === phrase.roman && own.gurmukhi === phrase.gurmukhi)) return [];
    return [`Model's own rendering: ${own.gurmukhi} · ${own.roman}`, ''];
}

function body(result: TranslationResult): string[] {
    const lines = [`Words: ${result.words.map(w => `${w.roman} (${w.gurmukhi}) ${flat(w.meaning)}`).join(' · ')}`];
    if (result.notes.length) {
        lines.push('', 'Notes:', ...result.notes.map(n => `- ${n.kind} — ${flat(n.title)}: ${flat(n.body)}`));
    }
    if (result.pronunciation.length) {
        lines.push('', 'Pronunciation:', ...result.pronunciation.map(p => `- ${p.gurmukhi} ${p.roman}: ${flat(p.tip)}`));
    }
    return lines;
}

export function writeReview(meta: GeneratedMeta, phrases: Phrase[], assembled: Map<string, Assembled>): string {
    const dropped = phrases.filter(p => !assembled.get(p.id)?.result);
    const lines = [
        '# Phrasebook results: review',
        '',
        `Written by \`npm run build:phrasebook\` from \`${meta.model}\` answers (request \`${meta.fingerprint}\`, ` +
            `newest ${meta.generatedAt.slice(0, 10)}).`,
        '',
        'A tap on a phrasebook entry shows its result below at once, with no request. The Gurmukhi, ' +
            'romanization, and English are the curated entry as written; the word glosses, notes, and ' +
            'pronunciation tips are the model\'s, and they are what needs a fluent eye.',
        '',
        `**${meta.count} of ${phrases.length} shipped.**` +
            (dropped.length
                ? ` ${dropped.length} left to the live translator, which answers them on tap like any other text.`
                : ''),
        '',
    ];

    if (dropped.length) {
        lines.push('## Left to the live translator', '');
        for (const phrase of dropped) {
            const a = assembled.get(phrase.id);
            lines.push(
                `### \`${phrase.id}\` · ${phrase.category}`, '',
                `Phrasebook: ${headline(phrase)}`, '',
                ...ownRendering(phrase, a?.own ?? null),
                ...(a?.problems ?? []).map(p => `- ${p}`), '',
            );
        }
    }

    lines.push('## Shipped', '');
    for (const phrase of phrases) {
        const a = assembled.get(phrase.id);
        if (!a?.result) continue;
        lines.push(
            `### \`${phrase.id}\` · ${phrase.category}`, '',
            headline(a.result), '',
            ...ownRendering(phrase, a.own),
            ...body(a.result), '',
        );
    }

    writeFileSync(REVIEW_PATH, lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', 'utf8');
    return REVIEW_PATH;
}
