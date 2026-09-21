// Translator model eval: runs phrasebook entries through the production
// translate request on two or more models and writes a side-by-side report for
// a fluent reviewer.
//
//   npm run eval:translate -- --dry-run   the plan and its quota use; no API calls
//   npm run eval:translate                the first 10 fixtures on each model
//   npm run eval:translate -- --limit 30  more fixtures (cached answers are free)
//   npm run eval:translate -- --all       all 100 (50 phrases × 2 input scripts)
//
// Requests come from the same buildTranslateRequest() the route uses, so a
// trial measures exactly what production would send. Every answer is cached in
// cache.json, so a rerun only calls the API for what it has not already seen
// under the current prompt.

import { GoogleGenAI } from '@google/genai';
import { geminiModel } from '../../lib/gemini/models';
import { detectScript } from '../../lib/translate/detect';
import { PHRASES } from '../../lib/translate/phrasebook';
import { buildTranslateRequest } from '../../lib/translate/prompts';
import { loadEnvLocal } from '../i18n-audit/env';
import { loadCache, pruneCache, runKey, saveCache } from './cache';
import { generate, pacer } from './call';
import { buildFixtures, type Fixture } from './fixtures';
import { writeReport, type Answer, type Row } from './report';
import { score } from './score';

// The cheaper model on trial against production. It has its own per-model
// quota, which is the point on the free tier: moving the translator there
// takes it out of the bucket the chat draws from.
const CANDIDATE = 'gemini-3.5-flash-lite';
const DEFAULT_LIMIT = 10;
// Comfortable on a paid key. On the free tier (~5 a minute) the per-minute
// 429s are waited out once each, so a run still completes, just slower.
const DEFAULT_RPM = 30;

const HELP = `Translator model eval — phrasebook entries through the production translate request

Usage: npm run eval:translate -- [flags]

  (no flags)     First ${DEFAULT_LIMIT} fixtures on the production model and ${CANDIDATE}
  --dry-run      Show the plan and how many requests it would send; no API calls
  --limit N      Run the first N fixtures; cached answers cost nothing
  --all          All fixtures (every phrase, as both Gurmukhi and romanized input)
  --models a,b   Models to compare, baseline first
  --rpm N        Requests per minute to each model (default ${DEFAULT_RPM})
  --prune        Afterwards, drop cached answers to earlier prompts (git
                 history keeps them) so cache.json only holds what the report shows
  --help         This message

Every request is billed on a paid key. On the free tier it instead counts
against that model's daily quota for the whole project — the same bucket the
live app uses. AI Studio shows your limits.
`;

type Options = { models: string[]; limit: number | 'all'; rpm: number; dryRun: boolean; prune: boolean };

function positive(flag: string, raw: string): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`${flag} needs a positive number, got "${raw}"`);
    return n;
}

function parseArgs(argv: string[]): Options {
    const opts: Options = { models: [], limit: DEFAULT_LIMIT, rpm: DEFAULT_RPM, dryRun: false, prune: false };
    for (let i = 0; i < argv.length; i++) {
        const flag = argv[i];
        const value = () => {
            const next = argv[++i];
            if (next === undefined) throw new Error(`${flag} needs a value`);
            return next;
        };
        if (flag === '--dry-run') opts.dryRun = true;
        else if (flag === '--all') opts.limit = 'all';
        else if (flag === '--prune') opts.prune = true;
        else if (flag === '--limit') opts.limit = Math.floor(positive(flag, value()));
        else if (flag === '--rpm') opts.rpm = positive(flag, value());
        else if (flag === '--models') opts.models = [...new Set(value().split(',').map(m => m.trim()).filter(Boolean))];
        else throw new Error(`Unknown flag ${flag}\n\n${HELP}`);
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
    const models = opts.models.length ? opts.models : [...new Set([geminiModel('translate'), CANDIDATE])];
    const all = buildFixtures(PHRASES);
    const fixtures = opts.limit === 'all' ? all : all.slice(0, opts.limit);

    // The request config is deterministic per model and input (only the
    // fence nonce in the user turn varies), which is what makes it a cache key.
    const requestFor = (model: string, fixture: Fixture) => buildTranslateRequest(model, fixture.input, {
        sourceHint: 'auto',
        detectedScript: detectScript(fixture.input),
    });
    const keyFor = (model: string, fixture: Fixture) => runKey(model, requestFor(model, fixture).config, fixture.input);

    const cache = loadCache();
    const pending = models.map(model => ({
        model,
        fixtures: fixtures.filter(f => !(keyFor(model, f) in cache.entries)),
    }));
    const calls = pending.reduce((n, p) => n + p.fixtures.length, 0);

    console.log(`Plan: ${fixtures.length} of ${all.length} fixtures × ${models.length} models (baseline ${models[0]})`);
    for (const p of pending) {
        console.log(`  ${p.model.padEnd(26)} ${p.fixtures.length} to run, ${fixtures.length - p.fixtures.length} cached`);
    }
    if (calls > 0) {
        console.log(
            `\n${calls} requests, billed on a paid key (roughly 0.3 cents each on Flash). On the free\n` +
            `tier each one instead counts against that model's daily quota — the live app's bucket.`,
        );
    }
    if (opts.dryRun) return;

    const apiKey = process.env.GEMINI_API_KEY;
    if (calls > 0 && !apiKey) throw new Error('GEMINI_API_KEY is not set (environment or .env.local).');

    const ai = new GoogleGenAI({ apiKey });
    const pace = pacer(opts.rpm);

    const stopped = new Map<string, string>();
    let done = 0;
    // Fixture-major, so the models alternate and each one's pacing overlaps
    // the other's wait instead of adding to it.
    for (const fixture of fixtures) {
        for (const model of models) {
            if (stopped.has(model) || keyFor(model, fixture) in cache.entries) continue;
            const outcome = await generate(ai, requestFor(model, fixture), pace(model));
            done++;
            const tag = `[${done}/${calls}] ${model} ${fixture.key}`;
            if ('run' in outcome) {
                cache.entries[keyFor(model, fixture)] = outcome.run;
                saveCache(cache);
                console.log(`  ${tag} · ${(outcome.run.latencyMs / 1000).toFixed(1)} s`);
            } else if ('skip' in outcome) {
                console.warn(`  ${tag} · skipped (${outcome.skip})`);
            } else {
                stopped.set(model, outcome.stop);
                console.warn(`  ${tag} · stopping ${model}: ${outcome.stop}`);
            }
        }
    }

    const rows: Row[] = fixtures.map(fixture => ({
        fixture,
        answers: new Map(models.flatMap((model): [string, Answer][] => {
            const run = cache.entries[keyFor(model, fixture)];
            return run ? [[model, { run, score: score(fixture, run.text) }]] : [];
        })),
    }));
    const fingerprint = runKey('', buildTranslateRequest('', '', { sourceHint: 'auto', detectedScript: 'latin' }).config, '').slice(0, 12);
    const path = writeReport({ models, rows, totalFixtures: all.length, fingerprint });

    console.log('');
    for (const model of models) {
        const answers = rows.flatMap(r => r.answers.get(model) ?? []);
        const usable = answers.filter(a => a.score.result);
        const matches = usable.map(a => a.score.converted ?? 0);
        const mean = matches.length ? (matches.reduce((a, b) => a + b, 0) / matches.length).toFixed(2) : '—';
        console.log(`${model}: ${answers.length}/${rows.length} answered · ${usable.length} usable · mean converted match ${mean}`);
        const reason = stopped.get(model);
        if (reason) console.log(`  stopped early: ${reason}`);
    }
    console.log(`Report: ${path}`);

    if (opts.prune) {
        // Every model that has answers, not just this run's, so a run limited
        // to one model keeps the others' answers to the current prompt.
        const cachedModels = new Set(Object.values(cache.entries).map(run => run.model));
        const keep = new Set([...cachedModels].flatMap(model => all.map(fixture => keyFor(model, fixture))));
        const removed = pruneCache(cache, keep);
        saveCache(cache);
        console.log(`Pruned ${removed} cached answers to earlier prompts; ${Object.keys(cache.entries).length} remain.`);
    }

    // A config problem (bad model name, rejected key) is worth an exit code;
    // running out of quota is not — the rest resumes from cache tomorrow.
    if ([...stopped.values()].some(reason => /^4\d\d:/.test(reason))) process.exitCode = 1;
}

main().catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
