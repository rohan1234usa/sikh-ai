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
