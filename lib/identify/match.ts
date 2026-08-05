// Pure scoring and aggregation: how a noisy transcription becomes a ranked
// list of Shabads. No network, no environment — scripts/identify-eval replays
// this whole module against captured search responses and sweeps the weights.
//
// The job is not "find the closest string". It is to answer honestly, which
// means two things the naive version gets wrong:
//
//   - The transcription may have been snapped to the wrong famous Shabad. So
//     nothing scores against the model's opinion; candidates only ever score
//     against verses the Gurbani source actually returned.
//   - A line can belong to twenty Shabads (refrains, mangals). Down-ranking
//     those would punish the right answer too, so instead they are flagged as
//     ambiguous and the user gets the options.

import { MAX_MATCHES, type HeardLine, type Level, type ShabadMatch } from './config';
import { firstLetters, foldToken, skeletonToken, tokens } from './gurmukhi';
import type { GurbaniVerse } from './search';

// Tunable constants. Exported so scripts/identify-eval can sweep them without
// editing this file; the defaults come from the reasoning in each comment.
export const WEIGHTS = {
    // First letters lead: only the opening consonant of each word has to
    // survive transcription, so this channel tolerates the most error.
    firstLetters: 0.45,
    // Whole words (light fold) confirm the match is real and not a first-letter
    // coincidence.
    words: 0.35,
    // Consonant skeletons rescue sung vowel mangling, but collide more often,
    // so they only break ties.
    skeleton: 0.20,
};

export const THRESHOLDS = {
    // A heard line counts as matching a verse at or above this.
    lineMatch: 0.55,
    // Per corroborating line beyond the first, capped at two.
    coverageStep: 0.12,
    maxCoverageBonus: 2,
    // Below this a candidate is dropped rather than shown as a weak guess.
    candidateFloor: 0.45,
    high: 0.78,
    medium: 0.60,
    // A single matched line can only reach "high" if it is long and near-exact.
    soloHighScore: 0.85,
    soloHighLetters: 6,
    // Candidates this close to the top, whose best verses are this similar,
    // are the same line living in different Shabads. The gap is generous
    // because the verse-similarity check is the real discriminator: So Dar
    // appears in Japji, Rehras, and Raag Asa differing by a single word, and a
    // transcription that drops that word must not read as proof of one of them.
    ambiguityScoreGap: 0.10,
    ambiguityVerseSimilarity: 0.90,
    // Enrichment only bothers when the top two are near enough to swap.
    enrichmentGap: 0.08,
};

// --- Similarity primitives ------------------------------------------------

// Sørensen-Dice over token sets, the same formula as
// scripts/i18n-audit/similarity.ts. Kinder than Jaccard to the length gap
// between a fragment heard on a phone and a full verse.
export function dice(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 1;
    if (a.size === 0 || b.size === 0) return 0;
    let overlap = 0;
    for (const token of a) if (b.has(token)) overlap++;
    return (2 * overlap) / (a.size + b.size);
}

// Levenshtein on two short first-letter strings, rolling row.
function levenshtein(a: string, b: string): number {
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

export function editSimilarity(a: string, b: string): number {
    const longest = Math.max(a.length, b.length);
    if (longest === 0) return 1;
    return 1 - levenshtein(a, b) / longest;
}

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

// --- Line scoring ---------------------------------------------------------

type Profile = {
    firstLetters: string;
    words: Set<string>;
    skeletons: Set<string>;
};

export function profile(line: string): Profile {
    const parts = tokens(line);
    return {
        firstLetters: firstLetters(line),
        words: new Set(parts.map(foldToken)),
        skeletons: new Set(parts.map(skeletonToken)),
    };
}

function firstLetterSimilarity(heard: string, verse: string): number {
    if (heard.length < 3 || verse.length < 1) return 0;
    const shortest = Math.min(heard.length, verse.length);

    // A contiguous run, scaled by how much there was to match. Without the
    // dampener a three-letter fragment scores 1.0 on coincidence, and across
    // six queries × 20 results coincidence gets plenty of chances.
    const run = (longestCommonSubstring(heard, verse) / shortest) * Math.min(1, shortest / 5);
    // Global closeness catches the case where lengths agree but one letter in
    // the middle is wrong — which breaks the run but should not break the score.
    const edit = editSimilarity(heard, verse);

    return Math.max(run, edit);
}

export function lineVerseScore(heard: Profile, verse: Profile): number {
    return (
        WEIGHTS.firstLetters * firstLetterSimilarity(heard.firstLetters, verse.firstLetters) +
        WEIGHTS.words * dice(heard.words, verse.words) +
        WEIGHTS.skeleton * dice(heard.skeletons, verse.skeletons)
    );
}

// --- Aggregation ----------------------------------------------------------

export type Candidate = {
    shabadId: string;
    base: number;        // best single line-verse score
    score: number;       // base plus the coverage bonus
    matchedLines: number;
    ambiguous: boolean;
    bestVerse: GurbaniVerse;
    bestVerseProfile: Profile;
};

// How many distinct heard lines this Shabad accounts for. Distinct on both
// sides: a refrain sung twice must not corroborate itself, and one heard line
// matching two variant verses is still one line of evidence.
function countMatchedLines(
    heardProfiles: Profile[],
    verseProfiles: { verse: GurbaniVerse; profile: Profile }[],
): number {
    const usedVerses = new Set<string>();
    let matched = 0;
    for (const heard of heardProfiles) {
        let bestVerseId: string | null = null;
        let bestScore = 0;
        for (const { verse, profile: verseProfile } of verseProfiles) {
            if (usedVerses.has(verse.verseId)) continue;
            const score = lineVerseScore(heard, verseProfile);
            if (score >= THRESHOLDS.lineMatch && score > bestScore) {
                bestScore = score;
                bestVerseId = verse.verseId;
            }
        }
        if (bestVerseId) {
            usedVerses.add(bestVerseId);
            matched++;
        }
    }
    return matched;
}

function coverageBonus(matchedLines: number): number {
    const extra = Math.min(Math.max(matchedLines - 1, 0), THRESHOLDS.maxCoverageBonus);
    return THRESHOLDS.coverageStep * extra;
}

export function rankCandidates(heardLines: HeardLine[], verses: GurbaniVerse[]): Candidate[] {
    const heardProfiles = heardLines.map(line => profile(line.gurmukhi));
    if (heardProfiles.length === 0) return [];

    // Dedupe: the same verse legitimately comes back from several queries.
    const uniqueVerses = new Map<string, GurbaniVerse>();
    for (const verse of verses) {
        if (!uniqueVerses.has(verse.verseId)) uniqueVerses.set(verse.verseId, verse);
    }

    const byShabad = new Map<string, { verse: GurbaniVerse; profile: Profile }[]>();
    for (const verse of uniqueVerses.values()) {
        const entry = { verse, profile: profile(verse.gurmukhi) };
        const group = byShabad.get(verse.shabadId);
        if (group) group.push(entry);
        else byShabad.set(verse.shabadId, [entry]);
    }

    const candidates: Candidate[] = [];
    for (const [shabadId, group] of byShabad) {
        let base = 0;
        let best = group[0];
        for (const entry of group) {
            for (const heard of heardProfiles) {
                const score = lineVerseScore(heard, entry.profile);
                if (score > base) {
                    base = score;
                    best = entry;
                }
            }
        }

        const matchedLines = countMatchedLines(heardProfiles, group);
        const score = Math.min(1, base + coverageBonus(matchedLines));
        if (score < THRESHOLDS.candidateFloor) continue;

        candidates.push({
            shabadId,
            base,
            score,
            matchedLines,
            ambiguous: false,
            bestVerse: best.verse,
            bestVerseProfile: best.profile,
        });
    }

    candidates.sort(
        (a, b) => b.score - a.score || b.matchedLines - a.matchedLines || b.base - a.base,
    );
    return markAmbiguity(candidates);
}

// A near-tie between Shabads whose best verses are near-identical text is a
// refrain, not a ranking problem. Flag the whole cluster: the honest answer is
// "this line appears in several Shabads", not a coin flip presented as a result.
function markAmbiguity(candidates: Candidate[]): Candidate[] {
    if (candidates.length < 2) return candidates;
    const top = candidates[0];
    const cluster = candidates.filter(
        (c, i) =>
            i > 0 &&
            top.score - c.score < THRESHOLDS.ambiguityScoreGap &&
            dice(top.bestVerseProfile.words, c.bestVerseProfile.words) >=
                THRESHOLDS.ambiguityVerseSimilarity,
    );
    if (cluster.length === 0) return candidates;

    const ambiguousIds = new Set([top.shabadId, ...cluster.map(c => c.shabadId)]);
    return candidates.map(c =>
        ambiguousIds.has(c.shabadId) ? { ...c, ambiguous: true } : c,
    );
}

// --- Confidence and presentation -----------------------------------------

// `rank` is the candidate's position in the ranked list. It matters because
// confidence is a claim about the whole answer, not about one row: a recording
// has one true Shabad, so several rows all badged "strong match" would be a
// contradiction the user has to resolve. Only the leader can make that claim.
export function confidenceOf(candidate: Candidate, rank = 0): Level {
    const corroborated =
        candidate.matchedLines >= 2 ||
        (candidate.base >= THRESHOLDS.soloHighScore &&
            candidate.bestVerseProfile.firstLetters.length >= THRESHOLDS.soloHighLetters);

    // An ambiguous candidate can never be "strong" either: the score may be
    // perfect and still describe the wrong Shabad.
    if (rank === 0 && candidate.score >= THRESHOLDS.high && corroborated && !candidate.ambiguous) {
        return 'high';
    }
    if (candidate.score >= THRESHOLDS.medium) return 'medium';
    return 'low';
}

export function toMatch(candidate: Candidate, rank = 0): ShabadMatch {
    return {
        shabadId: candidate.shabadId,
        score: Math.round(candidate.score * 100) / 100,
        confidence: confidenceOf(candidate, rank),
        ambiguous: candidate.ambiguous,
        matchedLines: candidate.matchedLines,
        verse: {
            gurmukhi: candidate.bestVerse.gurmukhi,
            transliteration: candidate.bestVerse.transliteration,
            translation: candidate.bestVerse.translation,
        },
        ang: candidate.bestVerse.ang,
        lineNo: candidate.bestVerse.lineNo,
        source: candidate.bestVerse.source,
        writer: candidate.bestVerse.writer,
        raag: candidate.bestVerse.raag,
    };
}

export function topMatches(candidates: Candidate[]): ShabadMatch[] {
    return candidates.slice(0, MAX_MATCHES).map((candidate, rank) => toMatch(candidate, rank));
}

// --- Enrichment -----------------------------------------------------------

// Re-score a candidate against every line of its full Shabad, not just the
// lines a search happened to return. This is what separates the true Shabad
// from an impostor that shares only the opening words: the impostor gains
// nothing from its other lines, the real one usually gains a second match.
export function corroborate(
    candidate: Candidate,
    heardLines: HeardLine[],
    shabadVerses: GurbaniVerse[],
): Candidate {
    if (shabadVerses.length === 0) return candidate;
    const heardProfiles = heardLines.map(line => profile(line.gurmukhi));
    const verseProfiles = shabadVerses.map(verse => ({ verse, profile: profile(verse.gurmukhi) }));

    let base = candidate.base;
    let bestVerse = candidate.bestVerse;
    let bestVerseProfile = candidate.bestVerseProfile;
    for (const entry of verseProfiles) {
        for (const heard of heardProfiles) {
            const score = lineVerseScore(heard, entry.profile);
            if (score > base) {
                base = score;
                bestVerse = entry.verse;
                bestVerseProfile = entry.profile;
            }
        }
    }

    const matchedLines = Math.max(
        candidate.matchedLines,
        countMatchedLines(heardProfiles, verseProfiles),
    );
    return {
        ...candidate,
        base,
        bestVerse,
        bestVerseProfile,
        matchedLines,
        score: Math.min(1, base + coverageBonus(matchedLines)),
    };
}
