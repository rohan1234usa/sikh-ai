// Enumerates every user-visible string in the three dictionaries plus the
// phrasebook. The dictionaries import only *types* from the app, so tsx erases
// those imports and the modules execute standalone — but the `@/*` alias is a
// Next-bundler feature, so everything here must use relative paths.

import en from '../../lib/i18n/dictionaries/en';
import pa from '../../lib/i18n/dictionaries/pa';
import paLatn from '../../lib/i18n/dictionaries/pa-latn';
import { PHRASES } from '../../lib/translate/phrasebook';

export { en, pa, paLatn, PHRASES };

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
]);

// A value carrying no letters at all (pure placeholders, digits, punctuation)
// is not translatable content — e.g. '{n} / {max}'.
export function hasLetters(value: string): boolean {
    return /\p{L}/u.test(value.replace(/\{[a-z_]+\}/gi, ''));
}

export function isMtEligible(leaf: Leaf): boolean {
    return !MT_SKIP_PATHS.has(leaf.path) && hasLetters(leaf.value);
}
