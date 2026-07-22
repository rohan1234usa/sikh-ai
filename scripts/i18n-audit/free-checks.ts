// Layer 1: checks that cost nothing. These run on every invocation, including
// --dry-run, and catch the failure modes machine translation cannot see —
// broken interpolation, untranslated leftovers, and spelling drift.

import { extractPlaceholders } from '../../lib/i18n/fmt';
import {
    LATIN_OK_PATHS,
    hasLetters,
    type Leaf,
} from './walk';
import type { Phrase } from '../../lib/translate/phrasebook';

export type Severity = 'error' | 'warn' | 'info';

export type Finding = {
    check: string;
    severity: Severity;
    path: string;
    detail: string;
};

const GURMUKHI = /[਀-੿]/;

// ── 1. Placeholder parity ───────────────────────────────────────────────────
// The only check that fails the run: a missing {token} means fmt() renders a
// literal placeholder (or drops data) at runtime.
//
// Uses fmt()'s own extractor rather than a lookalike regex — matching is
// case-sensitive and digit-aware there, so {Name} and {n2} must be treated
// exactly as the runtime treats them.
const placeholders = extractPlaceholders;

export function checkPlaceholderParity(
    enMap: Map<string, string>,
    paMap: Map<string, string>,
    latnMap: Map<string, string>,
): Finding[] {
    const findings: Finding[] = [];
    for (const [path, enValue] of enMap) {
        const expected = placeholders(enValue);
        for (const [label, map] of [['pa', paMap], ['pa-latn', latnMap]] as const) {
            const value = map.get(path);
            if (value === undefined) {
                findings.push({
                    check: 'placeholder-parity',
                    severity: 'error',
                    path,
                    detail: `missing from ${label}.ts entirely`,
                });
                continue;
            }
            const actual = placeholders(value);
            if (expected.join(',') !== actual.join(',')) {
                findings.push({
                    check: 'placeholder-parity',
                    severity: 'error',
                    path,
                    detail: `${label}: expected ${expected.length ? expected.join(' ') : '(none)'}, found ${actual.length ? actual.join(' ') : '(none)'}`,
                });
            }
        }
    }
    return findings;
}

// ── 2. Script sanity ────────────────────────────────────────────────────────
// Reuses the app's own detectScript so the audit and the runtime agree on what
// "Gurmukhi" means.

export function checkScriptSanity(paLeaves: Leaf[], latnLeaves: Leaf[]): Finding[] {
    const findings: Finding[] = [];

    for (const leaf of paLeaves) {
        if (!hasLetters(leaf.value) || LATIN_OK_PATHS.has(leaf.path)) continue;
        // Deliberately *not* detectScript() here: its 30%-of-letters threshold
        // is tuned for routing user input, and strings that mix an untranslated
        // brand with Gurmukhi ("SikhAI ਚੈਟ") fall below it despite being fully
        // translated. What this check actually wants is the absence of any
        // Gurmukhi at all, which is unambiguous.
        if (!GURMUKHI.test(leaf.value)) {
            findings.push({
                check: 'script-sanity',
                severity: 'warn',
                path: leaf.path,
                detail: `pa.ts value has no Gurmukhi — likely untranslated: "${leaf.value.slice(0, 70)}"`,
            });
        }
    }

    for (const leaf of latnLeaves) {
        if (GURMUKHI.test(leaf.value)) {
            findings.push({
                check: 'script-sanity',
                severity: 'warn',
                path: leaf.path,
                detail: `pa-latn.ts value contains Gurmukhi — script bleed: "${leaf.value.slice(0, 70)}"`,
            });
        }
    }

    return findings;
}

// ── 3. Length-ratio outliers ────────────────────────────────────────────────
// Corpus-wide ratios sit near 1.0, so this only surfaces genuine truncation or
// padding. Short strings are skipped — their ratios are meaninglessly noisy.

const MIN_LEN = 20;
const LOW = 0.4;
const HIGH = 2.2;

export function checkLengthRatios(
    enMap: Map<string, string>,
    paMap: Map<string, string>,
    latnMap: Map<string, string>,
): Finding[] {
    const findings: Finding[] = [];
    for (const [path, enValue] of enMap) {
        if ([...enValue].length < MIN_LEN || !hasLetters(enValue)) continue;
        const enLen = [...enValue].length;
        for (const [label, map] of [['pa', paMap], ['pa-latn', latnMap]] as const) {
            const value = map.get(path);
            if (!value) continue;
            const ratio = [...value].length / enLen;
            if (ratio < LOW || ratio > HIGH) {
                findings.push({
                    check: 'length-ratio',
                    severity: 'info',
                    path,
                    detail: `${label}/en length ratio ${ratio.toFixed(2)} (en ${enLen} chars, ${label} ${[...value].length})`,
                });
            }
        }
    }
    return findings;
}

// ── 4. Community-spelling drift ─────────────────────────────────────────────
// Enforces the "one spelling per word, file-wide" rule that lib/translate/
// phrasebook.ts and the pa-latn header both promise.

const VARIANTS: { canonical: string; pattern: RegExp }[] = [
    { canonical: 'Waheguru', pattern: /\b[vw]ah?i?[- ]?guru\b/gi },
    { canonical: 'Gurdwara', pattern: /\bguru?d[uw]?ara\b/gi },
    { canonical: 'Sat Sri Akal', pattern: /\bsat\s+s[ir]{1,2}i?\s+akaa?l\b/gi },
    { canonical: 'langar', pattern: /\blang[aeu]r\b/gi },
    { canonical: 'seva', pattern: /\bse[vw]a\b/gi },
    { canonical: 'Hukamnama', pattern: /\bhukam[- ]?naa?ma\b/gi },
];

function scanValue(path: string, value: string): Finding[] {
    const findings: Finding[] = [];
    for (const { canonical, pattern } of VARIANTS) {
        pattern.lastIndex = 0;
        for (const match of value.matchAll(pattern)) {
            const found = match[0];
            // Case-insensitive comparison: sentence-initial capitals are fine,
            // a genuinely different spelling is not.
            if (found.toLowerCase() !== canonical.toLowerCase()) {
                findings.push({
                    check: 'spelling-drift',
                    severity: 'warn',
                    path,
                    detail: `"${found}" should be "${canonical}"`,
                });
            }
        }
    }
    return findings;
}

// English copy is scanned too: these terms are borrowed into the English UI
// (a "Gurdwara" field label), so the same one-spelling rule applies there —
// and en.ts drifting from pa-latn.ts on the same key is user-visible.
export function checkSpellingDrift(enLeaves: Leaf[], latnLeaves: Leaf[], phrases: Phrase[]): Finding[] {
    const findings: Finding[] = [];
    for (const leaf of enLeaves) findings.push(...scanValue(leaf.path, leaf.value));
    for (const leaf of latnLeaves) findings.push(...scanValue(leaf.path, leaf.value));
    for (const p of phrases) {
        findings.push(...scanValue(`phrasebook.${p.id}.roman`, p.roman));
        if (p.note) findings.push(...scanValue(`phrasebook.${p.id}.note`, p.note));
        findings.push(...scanValue(`phrasebook.${p.id}.english`, p.english));
    }
    return findings;
}
