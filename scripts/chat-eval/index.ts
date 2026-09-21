// Chat model eval: the fixtures in ./fixtures.ts through the production chat
// request (buildChatRequest), streamed as the route streams them, on one or
// more variants (a model, optionally @ a thinking level), then scored with
// cheap checks and the same Gurbani verifier the chat page uses.
//
//   npm run eval:chat -- --dry-run      the plan and its cost; no API calls
//   npm run eval:chat                   every fixture on the production model and its fallback
//   npm run eval:chat -- --models gemini-3.8-flash,gemini-3.7-flash
//   npm run eval:chat -- --set gurbani-first --models gemini-3.8-flash,gemini-3.8-flash@medium --samples 3
//   npm run eval:chat -- --capture      refresh passages.json from the app's own APIs
//
// Every answer is cached in cache.json, keyed by model, full request config
// (prompt, thinking level, cap), contents, and sample number, with its
// citation verdicts, so rerunning or re-reporting is free and editing the
// prompt starts a fresh comparison.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';
import { GET as hukamnamaGET } from '../../app/api/hukamnama/route';
import { GET as shabadGET } from '../../app/api/shabad/route';
import { angContext, hukamnamaContext } from '../../app/components/chat/deepLink';
import type { ChatContext } from '../../lib/chat/config';
import { buildChatRequest } from '../../lib/chat/request';
import { geminiFallbackModel, geminiModel } from '../../lib/gemini/models';
import { hasGurmukhiRun, type Citation } from '../../lib/gurbani/citations';
import { gurbaniNow, type GurbaniClient } from '../../lib/gurbani/gurbaninow';
import { verifyReply } from '../../lib/gurbani/verify';
import { getDictionary } from '../../lib/i18n';
import { loadEnvLocal } from '../i18n-audit/env';
import { loadCache, pruneCache, runKey, saveCache } from '../translate-eval/cache';
import { pacer, withRetries } from '../translate-eval/call';
import { FIXTURES, SETS, type ChatFixture, type Passage, type SetName } from './fixtures';
import type { Reply } from './checks';
import { writeReport, type Answer } from './report';
import { costOf, parseVariant, type ChatRun, type Variant } from './run';

const CACHE_PATH = resolve(import.meta.dirname, 'cache.json');
const PASSAGES_PATH = resolve(import.meta.dirname, 'passages.json');
// A whole Ang as the Shabad page sends it: Kirtan Sohila's opening, 41 lines.
const SHABAD_ANG = 12;
// Fixed so a passage fixture's request, and so its cache key, is stable.
const NONCE = 'evalpass';
const DEFAULT_RPM = 20;

type Passages = { capturedOn: string } & Record<Passage, ChatContext>;

const HELP = `Chat model eval — fixed questions through the production chat request

Usage: npm run eval:chat -- [flags]

  (no flags)        Every fixture on the production model and its fallback
  --dry-run         Show the plan and its estimated cost; no API calls
  --models a,b      Variants to compare, baseline first; model@level sets the
                    thinking level (minimal, low, medium, high; default low)
  --set NAME        ${Object.keys(SETS).join(', ')} (default all)
  --only a,b        Just these fixture ids
  --samples N       Ask each question N times per variant (default 1)
  --rpm N           Requests per minute to each model (default ${DEFAULT_RPM})
  --prune           Afterwards, drop cached answers to earlier prompts
  --reverify        Check every cached answer's Gurbani again (after a verifier change)
  --capture         Refresh passages.json (today's Hukamnama, Ang ${SHABAD_ANG}) and exit
  --help            This message

Every request is billed on a paid key: about half a cent per answer on Flash.
`;

type Options = {
    variants: Variant[]; set: SetName; only: string[]; samples: number; rpm: number;
    dryRun: boolean; prune: boolean; capture: boolean; reverify: boolean;
};

function positive(flag: string, raw: string): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`${flag} needs a positive number, got "${raw}"`);
    return n;
}

function parseArgs(argv: string[]): Options {
    const opts: Options = { variants: [], set: 'all', only: [], samples: 1, rpm: DEFAULT_RPM, dryRun: false, prune: false, capture: false, reverify: false };
    for (let i = 0; i < argv.length; i++) {
        const flag = argv[i];
        const value = () => {
            const next = argv[++i];
            if (next === undefined) throw new Error(`${flag} needs a value`);
            return next;
        };
        const list = () => [...new Set(value().split(',').map(s => s.trim()).filter(Boolean))];
        if (flag === '--dry-run') opts.dryRun = true;
        else if (flag === '--prune') opts.prune = true;
        else if (flag === '--capture') opts.capture = true;
        else if (flag === '--reverify') opts.reverify = true;
        else if (flag === '--models') opts.variants = list().map(parseVariant);
        else if (flag === '--only') opts.only = list();
        else if (flag === '--samples') opts.samples = Math.floor(positive(flag, value()));
        else if (flag === '--rpm') opts.rpm = positive(flag, value());
        else if (flag === '--set') {
            const name = value();
            if (!(name in SETS)) throw new Error(`--set: unknown set "${name}" (use ${Object.keys(SETS).join(', ')})`);
            opts.set = name as SetName;
        } else throw new Error(`Unknown flag ${flag}\n\n${HELP}`);
    }
    return opts;
}

// The passages a deep link would attach, built by the chat page's own code
// from the app's own API routes, run in-process. The Hukamnama changes daily,
// so a capture also changes that fixture's request and starts it afresh.
async function capturePassages(): Promise<Passages> {
    const t = getDictionary('en');
    const hukamnama = hukamnamaContext(await (await hukamnamaGET()).json(), t);
    const shabadRes = await shabadGET(new Request(`http://localhost/api/shabad?query=${SHABAD_ANG}`));
    const shabad = angContext(SHABAD_ANG, await shabadRes.json(), t);
    return { capturedOn: new Date().toISOString().slice(0, 10), hukamnama, shabad };
}

function loadPassages(): Passages {
    try {
        return JSON.parse(readFileSync(PASSAGES_PATH, 'utf8')) as Passages;
    } catch {
        throw new Error(`${PASSAGES_PATH} is missing or unreadable; run npm run eval:chat -- --capture`);
    }
}

function requestFor(fixture: ChatFixture, variant: Variant, passages: Passages): GenerateContentParameters {
    return buildChatRequest(variant.model, {
        message: fixture.message,
        history: [],
        lensId: fixture.lensId,
        modeId: fixture.modeId,
        languageId: fixture.languageId,
        script: fixture.script,
        context: fixture.passage ? passages[fixture.passage] : null,
    }, { thinkingLevel: variant.thinkingLevel, nonce: NONCE });
}

async function streamOnce(ai: GoogleGenAI, request: GenerateContentParameters): Promise<Omit<ChatRun, 'fixture' | 'variant' | 'sample'>> {
    const started = performance.now();
    let ttft: number | null = null;
    let text = '';
    let last: GenerateContentResponse | undefined;
    for await (const chunk of await ai.models.generateContentStream(request)) {
        const piece = chunk.text;
        if (piece) {
            ttft ??= performance.now() - started;
            text += piece;
        }
        last = chunk;
    }
    return {
        model: request.model,
        modelVersion: last?.modelVersion,
        text,
        finishReason: last?.candidates?.[0]?.finishReason,
        blockReason: last?.promptFeedback?.blockReason,
        usage: {
            prompt: last?.usageMetadata?.promptTokenCount,
            output: last?.usageMetadata?.candidatesTokenCount,
            thoughts: last?.usageMetadata?.thoughtsTokenCount,
        },
        ttftMs: ttft === null ? null : Math.round(ttft),
        latencyMs: Math.round(performance.now() - started),
        at: new Date().toISOString(),
    };
}

// Production's verifier and budget. undefined when any lookup went
// unanswered, so the verdicts are retried on the next run rather than cached
// incomplete.
async function verify(text: string): Promise<Citation[] | undefined> {
    if (!hasGurmukhiRun(text)) return [];
    let unanswered = false;
    const watch = <T>(pending: Promise<T | null>) => pending.then(result => {
        if (result === null) unanswered = true;
        return result;
    });
    const client: GurbaniClient = {
        fetchAng: (ang, signal) => watch(gurbaniNow.fetchAng(ang, signal)),
        searchLines: (query, type, results, signal) => watch(gurbaniNow.searchLines(query, type, results, signal)),
    };
    const citations = await verifyReply(text, { client });
    return unanswered ? undefined : citations;
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2);
    if (argv.includes('--help') || argv.includes('-h')) {
        console.log(HELP);
        return;
    }
    // Like Next, .env.local fills in whatever the real environment leaves
    // unset, so GEMINI_API_KEY and GEMINI_CHAT_MODEL behave as in the app.
    for (const [key, value] of Object.entries(loadEnvLocal())) process.env[key] ??= value;
    const opts = parseArgs(argv);

    if (opts.capture) {
        const passages = await capturePassages();
        writeFileSync(PASSAGES_PATH, JSON.stringify(passages, null, 2) + '\n', 'utf8');
        console.log(`Captured ${passages.hukamnama.title} and ${passages.shabad.title} (${PASSAGES_PATH}).`);
        return;
    }

    const passages = loadPassages();
    // By default, the two models a user can be answered by.
    const variants = opts.variants.length
        ? opts.variants
        : [geminiModel('chat'), geminiFallbackModel('chat')].filter((m): m is string => m !== null).map(parseVariant);
    const unknown = opts.only.filter(id => !FIXTURES.some(f => f.id === id));
    if (unknown.length) throw new Error(`--only: no fixture with id ${unknown.join(', ')}`);
    const fixtures = SETS[opts.set]().filter(f => !opts.only.length || opts.only.includes(f.id));
    const samples = Array.from({ length: opts.samples }, (_, i) => i + 1);

    const keyFor = (fixture: ChatFixture, variant: Variant, sample: number) => {
        const request = requestFor(fixture, variant, passages);
        return runKey(variant.model, request.config, `${JSON.stringify(request.contents)}\n#${sample}`);
    };
    const cache = loadCache<ChatRun>(CACHE_PATH);
    const jobs = fixtures.flatMap(fixture => variants.flatMap(variant => samples.map(sample => ({
        fixture, variant, sample, key: keyFor(fixture, variant, sample),
    }))));
    const pending = jobs.filter(job => !(job.key in cache.entries));

    // Priced from cached answers to the same question where there are any.
    const estimate = pending.reduce((sum, job) => {
        const seen = Object.values(cache.entries).filter(run => run.fixture === job.fixture.id && run.model === job.variant.model);
        const cost = seen.length ? seen.map(costOf).filter((c): c is number => c !== null)[0] : null;
        return sum + (cost ?? costOf({ model: job.variant.model, usage: { prompt: 2000, output: 1000 } }) ?? 0.005);
    }, 0);

    console.log(`Plan: ${fixtures.length} fixtures (${opts.set}) × ${variants.length} variants × ${samples.length} samples; baseline ${variants[0].label}`);
    for (const variant of variants) {
        const own = jobs.filter(job => job.variant === variant);
        console.log(`  ${variant.label.padEnd(30)} ${own.filter(job => pending.includes(job)).length} to run, ${own.filter(job => !pending.includes(job)).length} cached`);
    }
    if (pending.length) console.log(`\n${pending.length} requests, about $${estimate.toFixed(2)} on a paid key.`);
    if (opts.dryRun) return;

    const apiKey = process.env.GEMINI_API_KEY;
    if (pending.length && !apiKey) throw new Error('GEMINI_API_KEY is not set (environment or .env.local).');
    const ai = new GoogleGenAI({ apiKey });
    const pace = pacer(opts.rpm);
    const stopped = new Map<string, string>();

    let done = 0;
    for (const job of pending) {
        if (stopped.has(job.variant.model)) continue;
        const tag = `[${++done}/${pending.length}] ${job.variant.label} ${job.fixture.id}${samples.length > 1 ? ` #${job.sample}` : ''}`;
        let outcome;
        try {
            outcome = await withRetries(() => streamOnce(ai, requestFor(job.fixture, job.variant, passages)), pace(job.variant.model));
        } catch (err) {
            outcome = { skip: err instanceof Error ? err.message.slice(0, 200) : String(err) }; // a dropped stream
        }
        if ('run' in outcome) {
            const run: ChatRun = { fixture: job.fixture.id, variant: job.variant.label, sample: job.sample, ...outcome.run };
            run.citations = await verify(run.text);
            cache.entries[job.key] = run;
            saveCache(cache, CACHE_PATH);
            const seconds = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`);
            console.log(`  ${tag} · first text ${seconds(run.ttftMs)}, total ${seconds(run.latencyMs)}${run.citations === undefined ? ' · GurbaniNow unreachable' : ''}`);
        } else if ('skip' in outcome) {
            console.warn(`  ${tag} · skipped (${outcome.skip})`);
        } else {
            stopped.set(job.variant.model, outcome.stop);
            console.warn(`  ${tag} · stopping ${job.variant.model}: ${outcome.stop}`);
        }
    }

    // Verdicts that could not be had earlier (GurbaniNow was down) are retried,
    // and with --reverify, every verdict is redone.
    let reverified = 0;
    for (const job of jobs) {
        const run = cache.entries[job.key];
        if (run && (run.citations === undefined || opts.reverify)) {
            reverified++;
            run.citations = await verify(run.text);
            if (run.citations !== undefined) saveCache(cache, CACHE_PATH);
        }
    }
    if (opts.reverify) console.log(`Checked the Gurbani in ${reverified} cached answers again.`);

    const rows = fixtures.map(fixture => ({
        fixture,
        answers: jobs.filter(job => job.fixture === fixture).flatMap((job): Answer[] => {
            const run = cache.entries[job.key];
            if (!run) return [];
            const context = fixture.passage ? passages[fixture.passage] : null;
            const reply: Reply = { text: run.text, finishReason: run.finishReason, outputTokens: run.usage.output, context, citations: run.citations };
            const failures = fixture.checks.flatMap(check => {
                const reason = check.run(reply);
                return reason ? [{ check: check.name, reason }] : [];
            });
            return [{ variant: job.variant.label, sample: job.sample, run, failures, cost: costOf(run) }];
        }),
    }));
    // Every question's settings on the baseline: any prompt or passage edit changes it.
    const fingerprint = runKey(variants[0].model, fixtures.map(f => requestFor(f, variants[0], passages).config), '').slice(0, 12);
    const path = writeReport({ variants: variants.map(v => v.label), rows, set: opts.set, samples: samples.length, passages, fingerprint });

    console.log('');
    for (const variant of variants) {
        const answers = rows.flatMap(row => row.answers.filter(a => a.variant === variant.label));
        const failed = answers.reduce((n, a) => n + a.failures.length, 0);
        const citations = answers.flatMap(a => a.run.citations ?? []);
        const verified = citations.filter(c => c.status === 'verified').length;
        console.log(`${variant.label}: ${answers.length}/${fixtures.length * samples.length} answered · ${failed} checks failed · ${verified}/${citations.length} quotes verified`);
        const reason = stopped.get(variant.model);
        if (reason) console.log(`  stopped early: ${reason}`);
    }
    console.log(`Report: ${path}`);

    if (opts.prune) {
        // Every variant that has answers, not just this run's, so a run on one
        // variant keeps the others' answers to the current prompt.
        const keep = new Set(Object.values(cache.entries).flatMap(run => {
            const fixture = FIXTURES.find(f => f.id === run.fixture);
            return fixture ? [keyFor(fixture, parseVariant(run.variant), run.sample)] : [];
        }));
        const removed = pruneCache(cache, keep);
        saveCache(cache, CACHE_PATH);
        console.log(`Pruned ${removed} cached answers to earlier prompts; ${Object.keys(cache.entries).length} remain.`);
    }

    if ([...stopped.values()].some(reason => /^4\d\d:/.test(reason))) process.exitCode = 1;
}

main().catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
