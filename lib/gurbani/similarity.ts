// Similarity primitives, lifted unchanged from the Shabad-identification
// branch (lib/identify/match.ts) so both features share one implementation.

// Longest common contiguous substring. Contiguity is the point: a run of
// correct first letters is strong evidence, scattered agreement is not.
export function longestCommonSubstring(a: string, b: string): number {
    if (!a || !b) return 0;
    let best = 0;
    let previous = new Array<number>(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i++) {
        const current = new Array<number>(b.length + 1).fill(0);
        for (let j = 1; j <= b.length; j++) {
            if (a[i - 1] === b[j - 1]) {
                current[j] = previous[j - 1] + 1;
                if (current[j] > best) best = current[j];
            }
        }
        previous = current;
    }
    return best;
}

// Levenshtein distance on two short strings (a romanized word, a run of first
// letters), with one rolling row.
export function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(
                current[j - 1] + 1,      // insertion
                previous[j] + 1,         // deletion
                previous[j - 1] + cost,  // substitution
            );
        }
        previous = current;
    }
    return previous[b.length];
}

// 1 for the same string, 0 for nothing in common: the share of the longer
// string that survives the edits.
export function editSimilarity(a: string, b: string): number {
    const longest = Math.max(a.length, b.length);
    if (longest === 0) return 1;
    return 1 - levenshtein(a, b) / longest;
}
