// Automated signals for one model answer. None is a verdict: the phrasebook
// they compare against is itself AI-drafted and awaiting fluent review. They
// exist to put the disagreements at the top of the report, where a reviewer
// reads first.

import type { DetectedInput, TranslationResult } from '../../lib/translate/config';
import { parseTranslationResult } from '../../lib/translate/parse';
import { scanValue } from '../i18n-audit/free-checks';
import { dice } from '../i18n-audit/similarity';
import type { Direction, Fixture } from './fixtures';

export type Score = {
    result: TranslationResult | null; // what the user would have seen; null = unusable
    detectedOk: boolean;
    converted: number | null; // the rendition the model had to produce, vs the phrasebook
    kept: number | null;      // the rendition it had to echo, vs the input (should be ~1)
    issues: string[];         // romanization-rule and script breaks
};

const EXPECTED: Record<Direction, DetectedInput> = {
    gurmukhi: 'punjabi-gurmukhi',
    roman: 'punjabi-latin',
};

function romanTokens(s: string): Set<string> {
    return new Set(s.toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').split(/\s+/).filter(Boolean));
}

// Nuktas are dropped before comparing: writers use them inconsistently (ਖ਼ vs
// ਖ), and one missing dot is not worth a whole-token mismatch. NFC first, so
// precomposed and combining forms agree.
function gurmukhiTokens(s: string): Set<string> {
    return new Set(
        s.normalize('NFC').replace(/਼/g, '').replace(/[\p{P}\p{S}]/gu, ' ').split(/\s+/).filter(Boolean),
    );
}

// The prompt's romanization contract: no diacritics, no apostrophes, and the
// community spellings the rest of the site uses.
function romanIssues(label: string, value: string): string[] {
    const issues: string[] = [];
    const nonAscii = [...new Set(value.match(/[^\x00-\x7F]/g) ?? [])];
    if (nonAscii.length) issues.push(`${label}: non-ASCII ${nonAscii.join(' ')} in "${value}"`);
    if (/['`]/.test(value)) issues.push(`${label}: apostrophe in "${value}"`);
    for (const finding of scanValue(label, value)) issues.push(`${label}: ${finding.detail}`);
    return issues;
}

// Any letter or vowel sign from outside the Gurmukhi block — Latin, but also
// the neighbouring Indic scripts (Bengali ঠ, Telugu ా, Devanagari ि) that a
// model can slip into a Gurmukhi word, where a learner cannot spot them.
function scriptIssues(label: string, value: string): string[] {
    const foreign = [...new Set([...value].filter(ch => /[\p{L}\p{M}]/u.test(ch) && !/[਀-੿]/.test(ch)))];
    return foreign.length ? [`${label}: non-Gurmukhi ${foreign.join(' ')} in "${value}"`] : [];
}

export function score(fixture: Fixture, rawText: string): Score {
    const expected = EXPECTED[fixture.direction];
    const result = parseTranslationResult(rawText, expected);
    if (!result) return { result: null, detectedOk: false, converted: null, kept: null, issues: [] };

    // Detection is read from the raw JSON: the parser substitutes the fallback
    // for an invalid value, which would hide exactly the miss checked here.
    const detected = (JSON.parse(rawText) as { detectedInput?: unknown }).detectedInput;

    const fromGurmukhi = fixture.direction === 'gurmukhi';
    const { phrase } = fixture;
    return {
        result,
        detectedOk: detected === expected,
        converted: fromGurmukhi
            ? dice(romanTokens(result.roman), romanTokens(phrase.roman))
            : dice(gurmukhiTokens(result.gurmukhi), gurmukhiTokens(phrase.gurmukhi)),
        kept: fromGurmukhi
            ? dice(gurmukhiTokens(result.gurmukhi), gurmukhiTokens(fixture.input))
            : dice(romanTokens(result.roman), romanTokens(fixture.input)),
        issues: [
            ...romanIssues('roman', result.roman),
            ...result.words.flatMap((w, i) => romanIssues(`words[${i}].roman`, w.roman)),
            ...result.pronunciation.flatMap((p, i) => romanIssues(`pronunciation[${i}].roman`, p.roman)),
            ...scriptIssues('gurmukhi', result.gurmukhi),
            ...result.words.flatMap((w, i) => scriptIssues(`words[${i}].gurmukhi`, w.gurmukhi)),
            ...result.pronunciation.flatMap((p, i) => scriptIssues(`pronunciation[${i}].gurmukhi`, p.gurmukhi)),
        ],
    };
}
