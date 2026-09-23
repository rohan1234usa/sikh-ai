// Pre-generates the translator's answer for every curated phrase, so a
// phrasebook tap shows a full result at once with no request, and still works
// when Gemini is down (romanized Punjabi has no Cloud Translation fallback).
//
//   npm run build:phrasebook                ask for what is missing, then write the results and review.md
//   npm run build:phrasebook -- --dry-run   the plan and its cost; no API calls
//   npm run build:phrasebook -- --check     is the committed file current? no API calls
//   npm run build:phrasebook -- --redo a,b  ask again for these phrases
//
// Each phrase goes out as the exact request a tap sends (./check.ts). Every
// answer is cached in cache.json, so a rerun only pays for phrases that are
// new, edited, or asked again, and a change to how answers are assembled
// (./assemble.ts) costs nothing. The cache keeps only the answers behind the
// current results.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { geminiModel } from '../../lib/gemini/models';
import type { TranslationResult } from '../../lib/translate/config';
import { PHRASES, type Phrase } from '../../lib/translate/phrasebook';
import { loadEnvLocal } from '../i18n-audit/env';
import { loadCache, pruneCache, runKey, saveCache } from '../translate-eval/cache';
import { generate, pacer } from '../translate-eval/call';
import { assemble } from './assemble';
import {
    checkPhrasebookResults,
    GENERATED_PATH,
    phraseRequest,
    readGenerated,
    requestFingerprint,
    type Generated,
} from './check';
import { writeReview } from './review';

const CACHE_PATH = resolve(import.meta.dirname, 'cache.json');
const DEFAULT_RPM = 30;

const HELP = `Phrasebook pre-generation — every curated phrase through the production translate request

Usage: npm run build:phrasebook -- [flags]

  (no flags)     Ask for any phrase without a cached answer, then write
                 lib/translate/phrasebook-results.generated.json and review.md
  --dry-run      Show the plan and how many requests it would send; no API calls
  --check        Exit 1 if the committed results are stale; no API calls
  --redo a,b     Discard these phrases' cached answers and ask again
  --prune        Afterwards, drop cached answers this build did not use
  --rpm N        Requests per minute (default ${DEFAULT_RPM})
  --help         This message

Every request is billed on a paid key (roughly 0.3 cents each on Flash).
`;

type Options = { dryRun: boolean; check: boolean; redo: string[]; rpm: number; prune: boolean };

function parseArgs(argv: string[]): Options {
    const opts: Options = { dryRun: false, check: false, redo: [], rpm: DEFAULT_RPM, prune: false };
    for (let i = 0; i < argv.length; i++) {
        const flag = argv[i];
        const value = () => {
            const next = argv[++i];
            if (next === undefined) throw new Error(`${flag} needs a value`);
            return next;
        };
        if (flag === '--dry-run') opts.dryRun = true;
        else if (flag === '--prune') opts.prune = true;
        else if (flag === '--check') opts.check = true;
        else if (flag === '--redo') opts.redo = value().split(',').map(id => id.trim()).filter(Boolean);
        else if (flag === '--rpm') {
            const raw = value();
            opts.rpm = Number(raw);
            if (!Number.isFinite(opts.rpm) || opts.rpm <= 0) throw new Error(`--rpm needs a positive number, got "${raw}"`);
        } else throw new Error(`Unknown flag ${flag}\n\n${HELP}`);
    }
    return opts;
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2);
    if (argv.includes('--help') || argv.includes('-h')) {
        console.log(HELP);
        return;
    }
    // Like Next, .env.local fills in whatever the real environment leaves
    // unset, so GEMINI_API_KEY and GEMINI_TRANSLATE_MODEL behave as in the app.
    for (const [key, value] of Object.entries(loadEnvLocal())) process.env[key] ??= value;
    const opts = parseArgs(argv);
    const model = geminiModel('translate');

    if (opts.check) {
        const problems = checkPhrasebookResults(readGenerated(), PHRASES, model);
        if (!problems.length) {
            console.log(`Phrasebook results are current (${model}).`);
            return;
        }
        console.error(`Phrasebook results are stale; run npm run build:phrasebook.\n${problems.map(p => `  - ${p}`).join('\n')}`);
        process.exitCode = 1;
        return;
    }

    const byId = new Map(PHRASES.map(p => [p.id, p]));
    const unknown = opts.redo.filter(id => !byId.has(id));
    if (unknown.length) throw new Error(`--redo: no phrase with id ${unknown.join(', ')}`);

    // The config never varies with the phrase (only the fenced user turn does),
    // so model + config + phrase identifies an answer.
    const keyFor = (phrase: Phrase) => runKey(model, phraseRequest(model, phrase).config, phrase.roman);
    const cache = loadCache(CACHE_PATH);
    for (const id of opts.redo) delete cache.entries[keyFor(byId.get(id)!)];
    const pending = PHRASES.filter(p => !(keyFor(p) in cache.entries));

    console.log(`Plan: ${PHRASES.length} phrases on ${model}: ${pending.length} to ask, ${PHRASES.length - pending.length} cached`);
    if (pending.length) console.log(`${pending.length} requests, billed on a paid key (roughly 0.3 cents each on Flash).`);
    if (opts.dryRun) return;

    const apiKey = process.env.GEMINI_API_KEY;
    if (pending.length && !apiKey) throw new Error('GEMINI_API_KEY is not set (environment or .env.local).');
    const ai = new GoogleGenAI({ apiKey });
    const pace = pacer(opts.rpm)(model);
    for (const [i, phrase] of pending.entries()) {
        const outcome = await generate(ai, phraseRequest(model, phrase), pace);
        const tag = `[${i + 1}/${pending.length}] ${phrase.id}`;
        if ('run' in outcome) {
            cache.entries[keyFor(phrase)] = outcome.run;
            saveCache(cache, CACHE_PATH);
            console.log(`  ${tag} · ${(outcome.run.latencyMs / 1000).toFixed(1)} s`);
        } else if ('skip' in outcome) {
            console.warn(`  ${tag} · skipped (${outcome.skip})`);
        } else {
            console.warn(`  ${tag} · stopping: ${outcome.stop}`);
            break;
        }
    }

    // All or nothing: a partial file would silently send some taps back to
    // the live translator, and the committed file stays valid until then.
    const missing = PHRASES.filter(p => !(keyFor(p) in cache.entries));
    if (missing.length) {
        console.error(`\n${missing.length} phrases still have no answer (${missing.map(p => p.id).join(', ')}). Rerun to finish; nothing was written.`);
        process.exitCode = 1;
        return;
    }

    const runs = PHRASES.map(phrase => ({ phrase, run: cache.entries[keyFor(phrase)] }));
    const assembled = new Map(runs.map(({ phrase, run }) => [phrase.id, assemble(phrase, run.text)]));
    const results: Record<string, TranslationResult> = {};
    const dropped: Record<string, string> = {};
    for (const { phrase } of runs) {
        const { result, problems } = assembled.get(phrase.id)!;
        if (result) results[phrase.id] = result;
        else dropped[phrase.id] = problems[0] + (problems.length > 1 ? ` (+${problems.length - 1} more)` : '');
    }
    const generated: Generated = {
        _meta: {
            model,
            fingerprint: requestFingerprint(model),
            // The newest answer, not the clock: rebuilding from the cache
            // rewrites the file byte for byte.
            generatedAt: runs.map(({ run }) => run.at).sort().at(-1)!,
            count: Object.keys(results).length,
            dropped,
        },
        results,
    };

    const problems = checkPhrasebookResults(generated, PHRASES, model);
    if (problems.length) throw new Error(`The results just assembled fail their own check:\n${problems.join('\n')}`);
    writeFileSync(GENERATED_PATH, JSON.stringify(generated, null, 2) + '\n', 'utf8');
    const reviewPath = writeReview(generated._meta!, PHRASES, assembled);
    // Opt-in, as in the evals: keys carry the model, so an exploratory run
    // under GEMINI_TRANSLATE_MODEL would otherwise throw away every answer
    // already paid for on the pinned one.
    if (opts.prune) {
        const removed = pruneCache(cache, new Set(PHRASES.map(keyFor)));
        if (removed) {
            saveCache(cache, CACHE_PATH);
            console.log(`Pruned ${removed} cached answers this build did not use.`);
        }
    }

    console.log(`\n${generated._meta!.count} of ${PHRASES.length} phrases shipped.`);
    for (const [id, reason] of Object.entries(dropped)) console.log(`  left to the live translator: ${id}: ${reason}`);
    console.log(`Results: ${GENERATED_PATH}\nReview:  ${reviewPath}`);
}

main().catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
