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

import { ApiError, GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { geminiModel } from '../../lib/gemini/models';
import { detectScript } from '../../lib/translate/detect';
import { PHRASES } from '../../lib/translate/phrasebook';
import { buildTranslateRequest } from '../../lib/translate/prompts';
import { loadEnvLocal } from '../i18n-audit/env';
import { loadCache, runKey, saveCache, type CachedRun } from './cache';
import { buildFixtures, type Fixture } from './fixtures';
import { writeReport, type Answer, type Row } from './report';
import { score } from './score';

// The cheaper model on trial against production. It has its own per-model
// quota, which is the point: on the free tier, moving the translator there
// takes it out of the bucket the chat draws from.
const CANDIDATE = 'gemini-3.5-flash-lite';
const DEFAULT_LIMIT = 10;
const DEFAULT_RPM = 5; // the free tier's reported Flash pace; raise it on a paid key

const HELP = `Translator model eval — phrasebook entries through the production translate request

Usage: npm run eval:translate -- [flags]

  (no flags)     First ${DEFAULT_LIMIT} fixtures on the production model and ${CANDIDATE}
  --dry-run      Show the plan and how many requests it would send; no API calls
  --limit N      Run the first N fixtures; cached answers cost nothing
  --all          All fixtures (every phrase, as both Gurmukhi and romanized input)
  --models a,b   Models to compare, baseline first
  --rpm N        Requests per minute to each model (default ${DEFAULT_RPM})
  --help         This message

On the free tier every request counts against that model's daily quota for the
whole project, the same bucket the live app uses. AI Studio shows your limits.
`;

type Options = { models: string[]; limit: number | 'all'; rpm: number; dryRun: boolean };

type Outcome = { run: CachedRun } | { stop: string } | { skip: string };

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function positive(flag: string, raw: string): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`${flag} needs a positive number, got "${raw}"`);
    return n;
}

function parseArgs(argv: string[]): Options {
    const opts: Options = { models: [], limit: DEFAULT_LIMIT, rpm: DEFAULT_RPM, dryRun: false };
    for (let i = 0; i < argv.length; i++) {
        const flag = argv[i];
        const value = () => {
            const next = argv[++i];
            if (next === undefined) throw new Error(`${flag} needs a value`);
            return next;
        };
        if (flag === '--dry-run') opts.dryRun = true;
        else if (flag === '--all') opts.limit = 'all';
        else if (flag === '--limit') opts.limit = Math.floor(positive(flag, value()));
        else if (flag === '--rpm') opts.rpm = positive(flag, value());
        else if (flag === '--models') opts.models = [...new Set(value().split(',').map(m => m.trim()).filter(Boolean))];
        else throw new Error(`Unknown flag ${flag}\n\n${HELP}`);
    }
    return opts;
}

// The API's error message is the JSON error body; pull out its human part.
function brief(message: string): string {
    try {
        const text = (JSON.parse(message) as { error?: { message?: string } }).error?.message;
        if (text) return text.slice(0, 200);
    } catch { /* not JSON — use it as is */ }
    return message.slice(0, 200);
}

function retryDelayMs(message: string): number {
    const match = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(message);
    return (match ? Number(match[1]) : 60) * 1000 + 1000;
}

function toRun(model: string, res: GenerateContentResponse, latencyMs: number): CachedRun {
    return {
        model,
        modelVersion: res.modelVersion,
        text: res.text ?? '',
        finishReason: res.candidates?.[0]?.finishReason,
        blockReason: res.promptFeedback?.blockReason,
        usage: {
            prompt: res.usageMetadata?.promptTokenCount,
            output: res.usageMetadata?.candidatesTokenCount,
            thoughts: res.usageMetadata?.thoughtsTokenCount,
        },
        latencyMs: Math.round(latencyMs),
        at: new Date().toISOString(),
    };
}

async function ask(
    ai: GoogleGenAI,
    model: string,
    fixture: Fixture,
    pace: () => Promise<void>,
): Promise<Outcome> {
    for (let attempt = 1; ; attempt++) {
        await pace();
        const started = performance.now();
        try {
            const res = await ai.models.generateContent(buildTranslateRequest(model, fixture.input, {
                sourceHint: 'auto',
                detectedScript: detectScript(fixture.input),
            }));
            return { run: toRun(model, res, performance.now() - started) };
        } catch (err) {
            if (!(err instanceof ApiError)) throw err;
            if (err.status === 429) {
                // The daily quota resets at midnight Pacific; a per-minute limit
                // clears after the delay the API suggests, so wait once.
                if (/PerDay/i.test(err.message)) return { stop: 'daily quota reached; rerun after midnight Pacific to continue' };
                if (attempt === 1) {
                    await sleep(retryDelayMs(err.message));
                    continue;
                }
                return { stop: `still rate-limited after waiting: ${brief(err.message)}` };
            }
            // A bad model name, an unsupported setting, or a rejected key fails
            // every request the same way, so stop this model rather than repeat it.
            if ([400, 401, 403, 404].includes(err.status)) return { stop: `${err.status}: ${brief(err.message)}` };
            return { skip: `${err.status}: ${brief(err.message)}` };
        }
    }
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
    const keyFor = (model: string, fixture: Fixture) => runKey(
        model,
        buildTranslateRequest(model, fixture.input, { sourceHint: 'auto', detectedScript: detectScript(fixture.input) }).config,
        fixture.input,
    );

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
            `\n${calls} requests. On the free tier each one counts against that model's daily quota\n` +
            `for the whole project — the same bucket the live app draws from.`,
        );
    }
    if (opts.dryRun) return;

    const apiKey = process.env.GEMINI_API_KEY;
    if (calls > 0 && !apiKey) throw new Error('GEMINI_API_KEY is not set (environment or .env.local).');

    const ai = new GoogleGenAI({ apiKey });
    const gap = 60_000 / opts.rpm;
    const lastCall = new Map<string, number>();
    const pace = (model: string) => async () => {
        const wait = (lastCall.get(model) ?? -Infinity) + gap - Date.now();
        if (wait > 0) await sleep(wait);
        lastCall.set(model, Date.now());
    };

    const stopped = new Map<string, string>();
    let done = 0;
    // Fixture-major, so the models alternate and each one's pacing overlaps
    // the other's wait instead of adding to it.
    for (const fixture of fixtures) {
        for (const model of models) {
            if (stopped.has(model) || keyFor(model, fixture) in cache.entries) continue;
            const outcome = await ask(ai, model, fixture, pace(model));
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

    // A config problem (bad model name, rejected key) is worth an exit code;
    // running out of quota is not — the rest resumes from cache tomorrow.
    if ([...stopped.values()].some(reason => /^4\d\d:/.test(reason))) process.exitCode = 1;
}

main().catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
