// What "current" means for the pre-generated phrasebook results. Shared by
// `npm run build:phrasebook` (which writes them), its --check flag, and the
// unit test that runs the same check on the committed file, so a prompt edit,
// a model change, or a phrasebook edit fails `npm test` until the results are
// rebuilt.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { TranslationResult } from '../../lib/translate/config';
import { detectScript } from '../../lib/translate/detect';
import { parseTranslationResult } from '../../lib/translate/parse';
import type { Phrase } from '../../lib/translate/phrasebook';
import { buildTranslateRequest } from '../../lib/translate/prompts';
import { runKey } from '../translate-eval/cache';

export type GeneratedMeta = {
    model: string;
    fingerprint: string;             // of the model and request settings every answer came from
    generatedAt: string;             // when the newest answer used was received
    count: number;                   // results shipped
    dropped: Record<string, string>; // phrase id → why a tap asks the live translator instead
};

export type Generated = {
    _meta: GeneratedMeta | null; // null until the first build
    results: Record<string, TranslationResult>;
};

export const GENERATED_PATH = resolve(import.meta.dirname, '../../lib/translate/phrasebook-results.generated.json');

export function readGenerated(): Generated {
    return JSON.parse(readFileSync(GENERATED_PATH, 'utf8')) as Generated;
}

// The request a phrase tap sends: app/translate/page.tsx posts the romanized
// phrase with the punjabi-latin hint, and the route builds exactly this.
export function phraseRequest(model: string, phrase: Phrase) {
    return buildTranslateRequest(model, phrase.roman, {
        sourceHint: 'punjabi-latin',
        detectedScript: detectScript(phrase.roman),
    });
}

// Everything that shapes an answer except the phrase itself: a new prompt,
// schema, thinking level, or model changes it.
export function requestFingerprint(model: string): string {
    const { config } = buildTranslateRequest(model, '', { sourceHint: 'punjabi-latin', detectedScript: 'latin' });
    return runKey(model, config, '').slice(0, 12);
}

const CURATED = ['gurmukhi', 'roman', 'english'] as const;

export function checkPhrasebookResults(generated: Generated, phrases: Phrase[], model: string): string[] {
    const meta = generated._meta;
    if (!meta) return ['never generated'];

    const problems: string[] = [];
    if (meta.model !== model) problems.push(`generated with ${meta.model}, but the translator now uses ${model}`);
    else if (meta.fingerprint !== requestFingerprint(model)) problems.push('the translate prompt or request settings changed since generation');

    const shipped = Object.keys(generated.results);
    if (meta.count !== shipped.length) problems.push(`_meta.count is ${meta.count}, but there are ${shipped.length} results`);

    const ids = new Set(phrases.map(p => p.id));
    for (const id of [...shipped, ...Object.keys(meta.dropped)]) {
        if (!ids.has(id)) problems.push(`${id}: no longer in the phrasebook`);
    }
    for (const phrase of phrases) {
        const result = generated.results[phrase.id];
        if (!result) {
            if (!(phrase.id in meta.dropped)) problems.push(`${phrase.id}: no result (added since generation?)`);
            continue;
        }
        const edited = CURATED.filter(field => result[field] !== phrase[field]);
        if (edited.length) problems.push(`${phrase.id}: ${edited.join(', ')} edited in the phrasebook since generation`);
        // The client re-validates every stored result (loadPhraseResult), so
        // anything the parser would trim or discard would show differently.
        if (!isDeepStrictEqual(parseTranslationResult(JSON.stringify(result), 'punjabi-latin'), result)) {
            problems.push(`${phrase.id}: the client parser would not show this result as stored`);
        }
    }
    return problems;
}
