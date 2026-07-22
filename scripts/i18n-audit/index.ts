// i18n audit: cross-checks the AI-drafted Punjabi dictionaries and phrasebook.
//
//   npm run audit:i18n -- --dry-run         free checks + cost estimate, no API calls
//   npm run audit:i18n -- --probe           one tiny call to verify the API key
//   npm run audit:i18n                      full audit (cached; reruns are ~free)
//   npm run audit:i18n -- --localize-notes  one-time MT of phrasebook notes → Gurmukhi
//   npm run audit:i18n -- --prune           drop cache entries no live string maps to
//
// Everything the API returns is cached in cache.json (committed), so a rerun
// pays only for strings that changed.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireApiKey } from './env';
import {
    en, pa, paLatn, PHRASES,
    collectLeaves, leafMap, isMtEligible,
    LATIN_OK_PATHS, MT_SKIP_PATHS,
} from './walk';
import {
    checkPlaceholderParity,
    checkScriptSanity,
    checkLengthRatios,
    checkSpellingDrift,
    type Finding,
} from './free-checks';
import { loadCache, saveCache, cacheKey, pruneCache } from './cache';
import { translateAll, estimateUncachedChars, type TranslateRequest } from './translate';
import { similarity } from './similarity';
import { writeReport, type MtRow } from './report';

const HELP = `i18n audit — cross-checks AI-drafted Punjabi content

Usage: npm run audit:i18n -- [flag]

  (no flag)          Full audit: free checks + cached back-translation
  --dry-run          Free checks only; prints what a full run would cost
  --probe            One ~5-char call to verify the API key works
  --localize-notes   Machine-translate phrasebook notes to Gurmukhi
  --prune            Remove cache entries no current string maps to
  --help             This message
`;

async function probe(): Promise<void> {
    const apiKey = requireApiKey();
    const cache = loadCache();
    console.log('Probing Cloud Translation with a 3-character request…');
    try {
        const { stats } = await translateAll(
            [{ source: 'pa', target: 'en', text: 'ਸਤਿ' }],
            cache,
            apiKey,
        );
        console.log(`OK — key works. Billed ${stats.billedChars} chars.`);
    } catch (err) {
        console.error(String(err instanceof Error ? err.message : err));
        process.exit(1);
    }
}

async function localizeNotes(): Promise<void> {
    const apiKey = requireApiKey();
    const cache = loadCache();
    const withNotes = PHRASES.filter(p => p.note);
    const requests: TranslateRequest[] = withNotes.map(p => ({
        source: 'en', target: 'pa', text: p.note as string,
    }));

    console.log(`Translating ${withNotes.length} phrasebook notes → Gurmukhi`);
    console.log(`Uncached: ${estimateUncachedChars(requests, cache)} chars`);

    const { results, stats } = await translateAll(requests, cache, apiKey);

    const out: Record<string, string> = {
        _meta: 'AI-drafted via Google Cloud Translation v2 — pending review by a fluent speaker.',
    };
    for (const p of withNotes) {
        const key = cacheKey('en', 'pa', p.note as string);
        const value = results.get(key);
        if (value) out[p.id] = value;
    }

    const path = resolve(import.meta.dirname, 'notes-pa.generated.json');
    writeFileSync(path, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log(`Wrote ${Object.keys(out).length - 1} notes to ${path}`);
    console.log(`Billed ${stats.billedChars} chars (${stats.cacheHits} from cache).`);
}

async function audit(dryRun: boolean, prune: boolean): Promise<void> {
    const enLeaves = collectLeaves(en);
    const paLeaves = collectLeaves(pa);
    const latnLeaves = collectLeaves(paLatn);
    const enMap = leafMap(en);
    const paMap = leafMap(pa);
    const latnMap = leafMap(paLatn);

    // ── Free checks ─────────────────────────────────────────────────────────
    const findings: Finding[] = [
        ...checkPlaceholderParity(enMap, paMap, latnMap),
        ...checkScriptSanity(paLeaves, latnLeaves),
        ...checkSpellingDrift(latnLeaves, PHRASES),
        ...checkLengthRatios(enMap, paMap, latnMap),
    ];

    // ── Back-translation requests ───────────────────────────────────────────
    const dictTargets = paLeaves.filter(leaf => isMtEligible(leaf) && enMap.has(leaf.path));
    const requests: TranslateRequest[] = [
        ...dictTargets.map(leaf => ({ source: 'pa' as const, target: 'en' as const, text: leaf.value })),
        ...PHRASES.map(p => ({ source: 'pa' as const, target: 'en' as const, text: p.gurmukhi })),
    ];

    const cache = loadCache();
    const estimated = estimateUncachedChars(requests, cache);

    let dictRows: MtRow[] = [];
    let phraseRows: MtRow[] = [];
    let billedChars = 0;
    let cacheHits = 0;

    if (!dryRun) {
        const apiKey = requireApiKey();
        console.log(`Back-translating ${requests.length} strings (${estimated} chars uncached)…`);
        const { results, stats } = await translateAll(requests, cache, apiKey);
        billedChars = stats.billedChars;
        cacheHits = stats.cacheHits;

        dictRows = dictTargets.map(leaf => {
            const back = results.get(cacheKey('pa', 'en', leaf.value)) ?? '';
            const original = enMap.get(leaf.path) ?? '';
            return { key: leaf.path, original, translated: leaf.value, back, score: similarity(original, back) };
        });

        phraseRows = PHRASES.map(p => {
            const back = results.get(cacheKey('pa', 'en', p.gurmukhi)) ?? '';
            return { key: p.id, original: p.english, translated: p.gurmukhi, back, score: similarity(p.english, back) };
        });
    }

    if (prune) {
        const live = new Set(requests.map(r => cacheKey(r.source, r.target, r.text)));
        for (const p of PHRASES) if (p.note) live.add(cacheKey('en', 'pa', p.note));
        const removed = pruneCache(cache, live);
        saveCache(cache);
        console.log(`Pruned ${removed} stale cache entries.`);
    }

    const path = writeReport({
        generatedAt: new Date().toISOString(),
        counts: { en: enLeaves.length, pa: paLeaves.length, paLatn: latnLeaves.length, phrases: PHRASES.length },
        findings,
        dictRows,
        phraseRows,
        mtSkipped: dryRun,
        estimatedChars: estimated,
        billedChars,
        cacheHits,
        totalCharsBilled: cache.meta.totalCharsBilled,
        cacheEntries: Object.keys(cache.entries).length,
        skipLists: { mt: [...MT_SKIP_PATHS], latinOk: [...LATIN_OK_PATHS] },
    });

    // ── Console summary ─────────────────────────────────────────────────────
    const errors = findings.filter(f => f.severity === 'error');
    const warns = findings.filter(f => f.severity === 'warn');
    const infos = findings.filter(f => f.severity === 'info');
    console.log('');
    console.log(`Strings: ${enLeaves.length} en · ${paLeaves.length} pa · ${latnLeaves.length} pa-latn · ${PHRASES.length} phrases`);
    console.log(`Findings: ${errors.length} error, ${warns.length} warn, ${infos.length} info`);
    if (dryRun) {
        console.log(`Dry run — a full audit would bill about ${estimated} characters.`);
    } else {
        console.log(`Billed ${billedChars} chars this run (${cacheHits} served from cache).`);
    }
    console.log(`Report: ${path}`);

    for (const f of errors) console.error(`  ERROR ${f.path}: ${f.detail}`);

    // Placeholder mismatches break fmt() at runtime — the one failure worth an
    // exit code, so this can gate a commit if it is ever wired into CI.
    if (errors.length > 0) process.exitCode = 1;
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        console.log(HELP);
        return;
    }
    if (args.includes('--probe')) return probe();
    if (args.includes('--localize-notes')) return localizeNotes();
    return audit(args.includes('--dry-run'), args.includes('--prune'));
}

main().catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
