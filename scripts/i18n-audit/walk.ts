// Enumerates every user-visible string in the three dictionaries plus the
// phrasebook. The dictionaries import only *types* from the app, so tsx erases
// those imports and the modules execute standalone — but the `@/*` alias is a
// Next-bundler feature, so everything here must use relative paths.

import enDictionary from '../../lib/i18n/dictionaries/en';
import paDictionary from '../../lib/i18n/dictionaries/pa';
import paLatnDictionary from '../../lib/i18n/dictionaries/pa-latn';
import enPolicy from '../../lib/i18n/policy/en';
import paPolicy from '../../lib/i18n/policy/pa';
import paLatnPolicy from '../../lib/i18n/policy/pa-latn';
import enSeva from '../../lib/i18n/seva/en';
import paSeva from '../../lib/i18n/seva/pa';
import paLatnSeva from '../../lib/i18n/seva/pa-latn';
import { PHRASES } from '../../lib/translate/phrasebook';

// The words of /privacy and /terms, and of the Seva pages, live apart from the
// dictionaries, so only those pages ship them (lib/i18n/policy,
// lib/i18n/seva); they're audited as one with the rest, under `policy.` and
// `seva.`
export const en = { ...enDictionary, policy: enPolicy, seva: enSeva };
export const pa = { ...paDictionary, policy: paPolicy, seva: paSeva };
export const paLatn = { ...paLatnDictionary, policy: paLatnPolicy, seva: paLatnSeva };
export { PHRASES };

export type Leaf = { path: string; value: string };

export function collectLeaves(node: unknown, prefix = ''): Leaf[] {
    if (typeof node === 'string') return [{ path: prefix, value: node }];
    if (Array.isArray(node)) {
        return node.flatMap((item, i) => collectLeaves(item, `${prefix}[${i}]`));
    }
    if (node && typeof node === 'object') {
        return Object.entries(node).flatMap(([key, value]) =>
            collectLeaves(value, prefix ? `${prefix}.${key}` : key)
        );
    }
    return [];
}

export function leafMap(node: unknown): Map<string, string> {
    return new Map(collectLeaves(node).map(l => [l.path, l.value]));
}

// ── Skip-lists ──────────────────────────────────────────────────────────────

// Excluded from machine back-translation only (free checks still apply).
// The Fateh is a fixed liturgical formula; round-tripping it produces noise,
// not signal, and it is already embedded in every lens greeting.
export const MT_SKIP_PATHS = new Set(['fateh']);

// pa.ts values that carry no Gurmukhi at all and are nonetheless correct:
// brand names and proper nouns the repo never translates. Keep this list
// minimal — the report prints it, and a stale entry hides a real gap.
export const LATIN_OK_PATHS = new Set([
    'chat.config.lenses.sikhai.name', // 'SikhAI'
    'about.bio1School',               // 'UC Irvine'
    'meta.titleTemplate',             // '%s | SikhAI'
    'translate.crosscheckLabel',      // 'Google Translate' — product name
    'seva.event.googleCalendar',      // 'Google Calendar' — product name
]);

// A value carrying no letters at all (pure placeholders, digits, punctuation)
// is not translatable content — e.g. '{n} / {max}'.
export function hasLetters(value: string): boolean {
    // \w+ inside the braces, matching fmt(): otherwise a numbered placeholder
    // like '{n1} / {max}' reads as translatable text and gets billed to Cloud.
    return /\p{L}/u.test(value.replace(/\{\w+\}/g, ''));
}

export function isMtEligible(leaf: Leaf): boolean {
    return !MT_SKIP_PATHS.has(leaf.path) && hasLetters(leaf.value);
}
