// Test cases for the Shabad matching engine.
//
// Each case is what the transcription stage produced — after Scribe heard the
// audio and Gemini cleaned it up — paired with the Ang it should resolve to.
// The noise in these lines is deliberate and modelled on how the pipeline
// actually fails: colloquial spellings where scripture keeps archaic ones,
// dropped final vowels, a swapped consonant, a half-caught line.
//
// `expectAng: null` means the correct answer is "no match". Those cases matter
// more than the positive ones: a matcher that always answers is worse than one
// that admits it does not know.

import type { HeardLine } from '@/lib/identify/config';

export type Fixture = {
    name: string;
    // Why this case exists — printed alongside a failure so the report explains
    // itself without a trip back to this file.
    rationale: string;
    lines: HeardLine[];
    guessedFirstLine?: string;
    expectAng: number | null;
    // Set when several Shabads legitimately contain this line and the honest
    // answer is to say so.
    expectAmbiguous?: boolean;
};

const line = (gurmukhi: string, confidence: HeardLine['confidence'] = 'high'): HeardLine =>
    ({ gurmukhi, roman: '', confidence });

export const FIXTURES: Fixture[] = [
    {
        name: 'clean-single-line',
        rationale: 'Baseline: a perfectly transcribed line must resolve exactly.',
        lines: [line('ਧੰਧਾ ਧਾਵਤ ਰਹਿ ਗਏ ਲਾਗਾ ਸਾਚਿ ਪਿਆਰੁ')],
        expectAng: 34,
    },
    {
        name: 'colloquial-spelling',
        rationale:
            'Scribe writes everyday Punjabi: ਧੰਦਾ for ਧੰਧਾ, dropped final ਸਿਹਾਰੀ and ਔਂਕੜ. First letters survive all of it.',
        lines: [line('ਧੰਦਾ ਧਾਵਤ ਰਹਿ ਗਏ ਲਾਗਾ ਸਾਚ ਪਿਆਰ', 'medium')],
        expectAng: 34,
    },
    {
        name: 'two-lines-corroborating',
        rationale:
            'Two lines of the same Shabad. Coverage is the strongest signal there is — this is the case that earns high confidence.',
        lines: [
            line('ਜਿਨੀ ਪੁਰਖੀ ਸਤਗੁਰੁ ਨ ਸੇਵਿਓ ਸੇ ਦੁਖੀਏ ਜੁਗ ਚਾਰਿ'),
            line('ਘਰਿ ਹੋਦਾ ਪੁਰਖੁ ਨ ਪਛਾਣਿਆ ਅਭਿਮਾਨਿ ਮੁਠੇ ਅਹੰਕਾਰਿ', 'medium'),
        ],
        expectAng: 34,
    },
    {
        name: 'so-dar-ambiguous',
        rationale:
            'So Dar appears in Japji, Rehras, and Raag Asa, differing by a single word. Picking one confidently would be a lie.',
        lines: [line('ਸੋ ਦਰੁ ਕੇਹਾ ਸੋ ਘਰੁ ਕੇਹਾ ਜਿਤੁ ਬਹਿ ਸਰਬ ਸਮਾਲੇ')],
        expectAng: 6,
        expectAmbiguous: true,
    },
    {
        name: 'mool-mantar',
        rationale: 'The most recited lines in Sikhi — the case a user is most likely to try first.',
        lines: [line('ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ')],
        expectAng: 1,
        expectAmbiguous: true,
    },
    {
        name: 'partial-line-fragment',
        rationale:
            'Recording started mid-tuk, so only the back half was caught. Anywhere-matching exists for exactly this.',
        lines: [line('ਲਾਗਾ ਸਾਚਿ ਪਿਆਰੁ', 'medium')],
        expectAng: 34,
    },
    {
        name: 'wrong-guess-ignored',
        rationale:
            'The model mis-recognised the Shabad. Its guess seeds a query, but scoring against the heard line must still land on the truth.',
        lines: [line('ਧੰਧਾ ਧਾਵਤ ਰਹਿ ਗਏ ਲਾਗਾ ਸਾਚਿ ਪਿਆਰੁ')],
        guessedFirstLine: 'ਸੋ ਦਰੁ ਕੇਹਾ ਸੋ ਘਰੁ ਕੇਹਾ',
        expectAng: 34,
    },
    {
        name: 'negative-modern-punjabi',
        rationale:
            'Ordinary conversation transcribed into Gurmukhi. Nothing in scripture should clear the floor.',
        lines: [line('ਕਲਮ ਟੇਬਲ ਕੰਪਿਊਟਰ ਸਕੂਲ ਬੱਸ ਦਵਾਈ', 'low')],
        expectAng: null,
    },
    {
        name: 'negative-short-garbage',
        rationale:
            'A two-word fragment of noise. Too little signal to search on, and inventing an answer from it would be the worst failure mode.',
        lines: [line('ਹਾਂ ਜੀ', 'low')],
        expectAng: null,
    },
];
