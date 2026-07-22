// Dependency-free string similarity for comparing a back-translation against
// the original English. Dice over Jaccard: it is kinder to the length
// asymmetry between terse UI strings and machine-translated output.

// The Fateh appears verbatim inside every lens greeting. Its Gurmukhi
// back-translation never token-matches the romanized English form, which would
// drag every greeting to the bottom of the report for a reason that is not a
// translation defect. Stripped from both sides before scoring.
const NOISE_PHRASES = [
    'waheguru ji ka khalsa',
    'waheguru ji ki fateh',
];

export function normalize(input: string): Set<string> {
    let s = input.toLowerCase();
    s = s.replace(/\{[a-z_]+\}/gi, ' ');        // fmt() placeholders
    for (const phrase of NOISE_PHRASES) s = s.split(phrase).join(' ');
    s = s.replace(/[\p{P}\p{S}]/gu, ' ');        // punctuation + symbols
    return new Set(s.split(/\s+/).filter(Boolean));
}

// 2·|A∩B| / (|A|+|B|). Two empty strings count as identical.
export function dice(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 1;
    if (a.size === 0 || b.size === 0) return 0;
    let overlap = 0;
    for (const token of a) if (b.has(token)) overlap++;
    return (2 * overlap) / (a.size + b.size);
}

export function similarity(a: string, b: string): number {
    return dice(normalize(a), normalize(b));
}

export type Bucket = 'review' | 'skim' | 'ok';

export function bucket(score: number): Bucket {
    if (score < 0.35) return 'review';
    if (score < 0.55) return 'skim';
    return 'ok';
}
