// Search-quality eval: the searches in ./cases.ts through the real verse
// search (lib/gurbani/search.ts) against the live GurbaniNow API, Sri Guru
// Granth Sahib Ji only, as /api/shabad/search runs it. It reports how often
// the right line comes first or in the top three, whether what should find
// nothing does, what each search costs in lookups, and how long it takes.
//
//   npm run eval:search -- --dry-run   each case's reading and lookups; no network
//   npm run eval:search                every case, live (answers cached)
//   npm run eval:search -- --offline   every case from the cache alone
//   npm run eval:search -- --sweep     the romanized thresholds, offline
//
// Every GurbaniNow answer is cached in cache.json (not committed: it is
// large, and the source is free), so a rerun after a ranking change costs
// nothing. Calls are paced a second apart and tried twice, since GurbaniNow
// turns away bursts. The report is report.md.

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SGGS_SOURCE_ID } from '../../lib/gurbani/citations';
import { dailyMeter, gurbaniNowClient, type GurbaniClient, type GurbaniLine } from '../../lib/gurbani/gurbaninow';
import { classifyQuery, isSearchable, type ShabadQuery } from '../../lib/gurbani/query';
import { TUNING, type Tuning } from '../../lib/gurbani/roman';
import { lineKeys, looseKey } from '../../lib/gurbani/score';
import { planSearch, searchVerses, type VerseSearch } from '../../lib/gurbani/search';
import { angKey, searchKey } from '../../tests/gurbani/keys';
import { makeInput } from '../../tests/gurbani/search-fixtures';
import { pacedCalls } from '../gurbani-fixtures/pace';
import { CASES, type EvalCase, type Tag } from './cases';
import { writeReport, type Outcome } from './report';

const CACHE_PATH = resolve(import.meta.dirname, 'cache.json');
const PACE_MS = 1000;
const RETRY_MS = 5000;

const HELP = `Search-quality eval — the verse search against the live GurbaniNow API

Usage: npm run eval:search -- [flags]

  (no flags)     Every case, live; answers are cached
  --dry-run      Each case's reading and planned lookups; no network
  --offline      Every case from the cache alone (fails on a lookup it lacks)
  --sweep        Score the romanized thresholds over a range, offline
  --only a,b     Just these case ids
  --tag t        Just one tag (${[...new Set(CASES.map(c => c.tag))].join(', ')})
  --verbose      Print each case's top hits as it runs
  --help         This message
`;

type Options = { dryRun: boolean; offline: boolean; sweep: boolean; only: string[]; tag?: Tag; verbose: boolean };

function parseArgs(argv: string[]): Options {
    const opts: Options = { dryRun: false, offline: false, sweep: false, only: [], verbose: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--help') { console.log(HELP); process.exit(0); }
        else if (arg === '--dry-run') opts.dryRun = true;
        else if (arg === '--offline') opts.offline = true;
        else if (arg === '--sweep') opts.sweep = opts.offline = true;
        else if (arg === '--verbose') opts.verbose = true;
        else if (arg === '--only') opts.only = (argv[++i] ?? '').split(',').filter(Boolean);
        else if (arg === '--tag') opts.tag = argv[++i] as Tag;
        else throw new Error(`unknown flag ${arg}\n\n${HELP}`);
    }
    return opts;
}

// --- The cache and the live client -----------------------------------------

type Cache = { version: 1; entries: Record<string, GurbaniLine[]> };

function loadCache(): Cache {
    if (!existsSync(CACHE_PATH)) return { version: 1, entries: {} };
    const parsed = JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as Cache;
    if (parsed?.version !== 1 || !parsed.entries) throw new Error(`${CACHE_PATH} has an unexpected shape; delete it to start over`);
    return parsed;
}

function saveCache(cache: Cache): void {
    const tmp = `${CACHE_PATH}.tmp`;
    writeFileSync(tmp, JSON.stringify(cache) + '\n', 'utf8');
    renameSync(tmp, CACHE_PATH);
}

// GurbaniNow through the cache. Live calls are paced (../gurbani-fixtures/
// pace.ts); an unanswered call is not cached, so the next run asks again.
function cachedClients(cache: Cache, offline: boolean): { search: GurbaniClient; angs: GurbaniClient; live: () => number; times: number[] } {
    let liveCalls = 0;
    // How long GurbaniNow took to answer each live lookup, the pacing aside.
    const times: number[] = [];
    const pace = pacedCalls({ gapMs: PACE_MS, retryMs: RETRY_MS });
    const paced = (lookup: () => Promise<GurbaniLine[] | null>) => pace(async () => {
        liveCalls++;
        const started = performance.now();
        const lines = await lookup();
        if (lines !== null) times.push(performance.now() - started);
        return lines;
    });
    const through = (key: string, lookup: () => Promise<GurbaniLine[] | null>): Promise<GurbaniLine[] | null> => {
        if (key in cache.entries) return Promise.resolve(cache.entries[key]);
        if (offline) throw new Error(`not in the cache: ${key} (run without --offline)`);
        return paced(lookup).then(lines => {
            if (lines !== null) {
                cache.entries[key] = lines;
                saveCache(cache);
            }
            return lines;
        });
    };
    const meter = dailyMeter(Infinity);
    const sggs = gurbaniNowClient({ meter, source: SGGS_SOURCE_ID });
    const any = gurbaniNowClient({ meter });
    const search: GurbaniClient = {
        fetchAng: () => Promise.reject(new Error('a verse search reads no Angs')),
        searchLines: (query, type, results, signal) =>
            through(searchKey(query, type, results, SGGS_SOURCE_ID), () => sggs.searchLines(query, type, results, signal)),
    };
    const angs: GurbaniClient = {
        fetchAng: (ang, signal) => through(angKey(ang), () => any.fetchAng(ang, signal)),
        searchLines: () => Promise.reject(new Error('Angs only')),
    };
    return { search, angs, live: () => liveCalls, times };
}

// --- Inputs -----------------------------------------------------------------

async function inputOf(c: EvalCase, angs: GurbaniClient): Promise<{ input: string; source?: GurbaniLine }> {
    if (c.input !== undefined) return { input: c.input };
    const { ang, lineId, make: rule } = c.from!;
    const lines = await angs.fetchAng(ang);
    const source = lines?.find(l => l.id === lineId);
    if (!source) throw new Error(`${c.id}: line ${lineId} is not on Ang ${ang} (or the Ang went unanswered)`);
    return { input: makeInput(source, rule), source };
}

// --- Scoring ----------------------------------------------------------------

const sameText = (a: string, b: string) => lineKeys(a).raw.map(looseKey).join(' ') === lineKeys(b).raw.map(looseKey).join(' ');

// Where the right line came: 1 for first, 0 for not in the list.
function rankOf(c: EvalCase, found: VerseSearch | null, source?: GurbaniLine): number {
    if (!found) return 0;
    const i = found.hits.findIndex(hit =>
        hit.lineId === c.expect.lineId
        || (source !== undefined && sameText(hit.gurmukhi, source.gurmukhi))
        || (c.expect.lineId === undefined && hit.ang === c.expect.ang));
    return i + 1;
}

async function runCase(c: EvalCase, clients: ReturnType<typeof cachedClients>, tuning: Tuning, verbose: boolean): Promise<Outcome> {
    const { input, source } = await inputOf(c, clients.angs);
    const query: ShabadQuery = classifyQuery(input);
    const base = { case: c, input, kind: query.kind };
    if (c.tag === 'ang') return { ...base, correct: query.kind === 'ang' && query.ang === c.expect.angPage, rank: 0, calls: 0, hits: [] };
    if (!isSearchable(query)) {
        return { ...base, reason: query.kind === 'invalid' ? query.reason : 'ang', correct: c.expect.none === true, rank: 0, calls: 0, hits: [] };
    }
    const found = await searchVerses(query, { client: clients.search, tuning });
    const rank = rankOf(c, found, source);
    const hits = found?.hits ?? [];
    const correct = c.expect.none ? found !== null && hits.length === 0 : rank === 1;
    if (verbose) {
        console.log(`${correct ? '✓' : '✗'} ${c.id}: ${JSON.stringify(input)} (${query.kind}) — rank ${rank || '—'}, ${found?.calls ?? 0} lookups`);
        for (const hit of hits.slice(0, 3)) console.log(`     ${hit.match}  Ang ${hit.ang}  ${hit.lineId}  ${hit.gurmukhi}`);
    }
    return { ...base, correct, rank, calls: found?.calls ?? 0, hits, unanswered: found === null, complete: found?.complete, truncated: found?.truncated };
}

async function main(): Promise<void> {
    const opts = parseArgs(process.argv.slice(2));
    const cases = CASES.filter(c => (opts.only.length === 0 || opts.only.includes(c.id)) && (!opts.tag || c.tag === opts.tag));
    if (cases.length === 0) throw new Error('no cases match');
    const cache = loadCache();
    const clients = cachedClients(cache, opts.offline);

    if (opts.dryRun) {
        for (const c of cases) {
            const input = c.input ?? `(from Ang ${c.from!.ang}, line ${c.from!.lineId}, ${c.from!.make})`;
            const query = c.input !== undefined ? classifyQuery(c.input) : null;
            const plan = query && isSearchable(query) ? planSearch(query).map(wave => wave.map(l => `${l.type}:${l.results}:${l.query}`).join(' + ')).join('  then  ') : '';
            console.log(`${c.id} [${c.tag}] ${JSON.stringify(input)} → ${query?.kind ?? 'cut from the live line'}${plan ? `\n     ${plan}` : ''}`);
        }
        return;
    }

    if (opts.sweep) {
        const rows: string[] = [];
        for (const minCoverage of [0.55, 0.6, 0.65, 0.7, 0.75]) {
            for (const minCoverageShort of [0.7, 0.8]) {
                const tuning: Tuning = { ...TUNING, minCoverage, minCoverageShort };
                const outcomes: Outcome[] = [];
                for (const c of cases.filter(x => x.tag.startsWith('roman') || x.tag === 'negative')) outcomes.push(await runCase(c, clients, tuning, false));
                const roman = outcomes.filter(o => o.case.tag.startsWith('roman'));
                const negatives = outcomes.filter(o => o.case.tag === 'negative');
                const top3 = roman.filter(o => o.rank >= 1 && o.rank <= 3).length;
                rows.push(`coverage ${minCoverage} / short ${minCoverageShort}: top-3 ${top3}/${roman.length}, negatives declined ${negatives.filter(o => o.correct).length}/${negatives.length}`);
            }
        }
        console.log(rows.join('\n'));
        return;
    }

    const outcomes: Outcome[] = [];
    for (const c of cases) outcomes.push(await runCase(c, clients, TUNING, opts.verbose));
    const path = writeReport(outcomes, { live: clients.live(), times: clients.times, full: cases.length === CASES.length });
    const failed = outcomes.filter(o => !o.correct && o.case.tag !== 'ang');
    console.log(`\n${outcomes.filter(o => o.correct).length}/${outcomes.length} right; ${clients.live()} live lookups. Report: ${path}`);
    if (failed.length) console.log(`Not right: ${failed.map(o => o.case.id).join(', ')}`);
}

main().catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
