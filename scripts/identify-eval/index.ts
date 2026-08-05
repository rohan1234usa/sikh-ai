// Shabad matching eval: replays fixture transcriptions through the real
// query planner and scorer, and reports whether each resolves to the right Ang.
//
//   npm run eval:identify              replay against the committed cache (offline)
//   npm run eval:identify -- --record  refresh the cache from the live API, then run
//   npm run eval:identify -- --sweep   grid-search the scoring weights
//   npm run eval:identify -- --verbose show every candidate, not just the top
//
// The scoring core is pure by design, so this needs no server, no API key, and
// no audio. What it cannot check is transcription quality — that is Scribe's
// job and needs real recordings.

import {
    corroborate,
    rankCandidates,
    topMatches,
    THRESHOLDS,
    WEIGHTS,
    type Candidate,
} from '@/lib/identify/match';
import { planQueries } from '@/lib/identify/queries';
import { fetchShabad, searchGurbani, type GurbaniVerse } from '@/lib/identify/search';
import { FIXTURES, type Fixture } from './fixtures';
import { loadCache, saveCache, searchKey, shabadKey, CACHE_PATH, type SearchCache } from './cache';

const HELP = `Shabad matching eval — replays fixtures through the scorer

Usage: npm run eval:identify -- [flag]

  (no flag)   Replay against the committed cache; no network
  --record    Refresh the cache from GurbaniNow, then replay
  --sweep     Grid-search scoring weights and report the best combination
  --verbose   Print every candidate rather than just the winner
`;

type Outcome = {
    fixture: Fixture;
    matches: ReturnType<typeof topMatches>;
    pass: boolean;
    reason: string;
};

// In record mode every miss is a live call; in replay mode a miss means the
// fixture changed and the cache is stale, which is a failure worth reporting
// rather than a silent empty result.
async function gather(
    fixture: Fixture,
    cache: SearchCache,
    record: boolean,
    missing: string[],
): Promise<{ verses: GurbaniVerse[]; enrich: (c: Candidate[]) => Promise<Candidate[]> }> {
    const plan = planQueries(fixture.lines, fixture.guessedFirstLine ?? '');
    const verses: GurbaniVerse[] = [];

    for (const query of plan) {
        const key = searchKey(query.text, query.searchtype);
        if (!(key in cache)) {
            if (!record) { missing.push(key); continue; }
            const live = await searchGurbani(query.text, query.searchtype, query.results);
            if (live === null) { missing.push(`${key} (API unreachable)`); continue; }
            cache[key] = live;
        }
        verses.push(...cache[key]);
    }

    const enrich = async (candidates: Candidate[]): Promise<Candidate[]> => {
        if (candidates.length === 0 || fixture.lines.length < 2) return candidates;
        const top = candidates[0];
        const key = shabadKey(top.shabadId);
        if (!(key in cache)) {
            if (!record) return candidates;
            const full = await fetchShabad(top.shabadId);
            if (!full) return candidates;
            cache[key] = full.verses;
        }
        return candidates
            .map(c => (c.shabadId === top.shabadId ? corroborate(c, fixture.lines, cache[key]) : c))
            .sort((a, b) => b.score - a.score || b.matchedLines - a.matchedLines || b.base - a.base);
    };

    return { verses, enrich };
}

function judge(fixture: Fixture, matches: Outcome['matches']): { pass: boolean; reason: string } {
    const top = matches[0];

    if (fixture.expectAng === null) {
        return top
            ? { pass: false, reason: `expected no match, got Ang ${top.ang} at ${top.score}` }
            : { pass: true, reason: 'correctly declined' };
    }
    if (!top) return { pass: false, reason: `expected Ang ${fixture.expectAng}, got no match` };
    if (top.ang !== fixture.expectAng) {
        return { pass: false, reason: `expected Ang ${fixture.expectAng}, got Ang ${top.ang}` };
    }
    // Ambiguity is part of the answer, not a footnote: claiming certainty about
    // a line that lives in several Shabads is the failure this whole design
    // exists to prevent, so a wrong flag fails the case even when the Ang is right.
    if (fixture.expectAmbiguous && !top.ambiguous) {
        return { pass: false, reason: `Ang correct but should have been flagged ambiguous` };
    }
    if (!fixture.expectAmbiguous && top.ambiguous) {
        return { pass: false, reason: `Ang correct but wrongly flagged ambiguous` };
    }
    return { pass: true, reason: `Ang ${top.ang}, ${top.confidence}` };
}

async function run(cache: SearchCache, record: boolean, missing: string[]): Promise<Outcome[]> {
    const outcomes: Outcome[] = [];
    for (const fixture of FIXTURES) {
        const { verses, enrich } = await gather(fixture, cache, record, missing);
        const candidates = await enrich(rankCandidates(fixture.lines, verses));
        const matches = topMatches(candidates);
        outcomes.push({ fixture, matches, ...judge(fixture, matches) });
    }
    return outcomes;
}

function report(outcomes: Outcome[], verbose: boolean): number {
    let passed = 0;
    for (const { fixture, matches, pass, reason } of outcomes) {
        console.log(`${pass ? '  PASS' : '  FAIL'}  ${fixture.name.padEnd(26)} ${reason}`);
        if (pass) passed++;
        else console.log(`        why it matters: ${fixture.rationale}`);
        if (verbose || !pass) {
            for (const [i, m] of matches.entries()) {
                console.log(
                    `          ${i + 1}. Ang ${String(m.ang).padEnd(5)} score=${m.score.toFixed(2)} ` +
                    `${m.confidence.padEnd(6)} lines=${m.matchedLines}${m.ambiguous ? ' ambiguous' : ''} :: ${m.verse.gurmukhi.slice(0, 40)}`,
                );
            }
            if (matches.length === 0) console.log('          (no candidates cleared the floor)');
        }
    }
    console.log(`\n  ${passed}/${outcomes.length} fixtures passed`);
    return passed;
}

// The scoring constants are plain exported objects, so a tuning script can
// assign to them directly rather than threading an options bag through every
// function on the request path. Script-only: nothing at runtime mutates these.
async function sweep(cache: SearchCache): Promise<void> {
    const original = { ...WEIGHTS };
    const steps = [0.30, 0.35, 0.40, 0.45, 0.50, 0.55];
    const results: { weights: string; passed: number }[] = [];

    for (const fl of steps) {
        for (const words of steps) {
            const skeleton = Math.round((1 - fl - words) * 100) / 100;
            if (skeleton < 0.05 || skeleton > 0.4) continue;
            WEIGHTS.firstLetters = fl;
            WEIGHTS.words = words;
            WEIGHTS.skeleton = skeleton;
            const outcomes = await run(cache, false, []);
            results.push({
                weights: `fl=${fl.toFixed(2)} words=${words.toFixed(2)} skel=${skeleton.toFixed(2)}`,
                passed: outcomes.filter(o => o.pass).length,
            });
        }
    }
    Object.assign(WEIGHTS, original);

    results.sort((a, b) => b.passed - a.passed);
    console.log('\n  Weight sweep (best first):\n');
    for (const r of results.slice(0, 12)) {
        console.log(`    ${String(r.passed).padStart(2)}/${FIXTURES.length}  ${r.weights}`);
    }
    console.log(`\n  Current: fl=${original.firstLetters} words=${original.words} skel=${original.skeleton}`);
    console.log('  A tie at the top means the fixtures do not separate those weights — add cases before retuning.');
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) { console.log(HELP); return; }

    const record = args.includes('--record');
    const cache = loadCache();

    if (args.includes('--sweep')) {
        console.log('\nShabad matching eval — weight sweep\n');
        await sweep(cache);
        return;
    }

    console.log(`\nShabad matching eval — ${record ? 'recording from GurbaniNow' : 'replaying cache'}\n`);
    const missing: string[] = [];
    const outcomes = await run(cache, record, missing);

    if (record) {
        saveCache(cache);
        console.log(`  cache written to ${CACHE_PATH}\n`);
    }

    const passed = report(outcomes, args.includes('--verbose'));

    if (missing.length > 0) {
        console.log(`\n  ${missing.length} queries had no cached response:`);
        for (const key of missing.slice(0, 10)) console.log(`    ${key}`);
        if (!record) console.log('  Rerun with --record to fetch them.');
    }

    console.log('');
    console.log('  Thresholds: floor=' + THRESHOLDS.candidateFloor +
        ' medium=' + THRESHOLDS.medium + ' high=' + THRESHOLDS.high);
    console.log('');

    // Non-zero exit so this can gate a commit if it is ever wired into CI.
    if (passed < outcomes.length) process.exitCode = 1;
}

main().catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
