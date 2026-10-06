// Checks, from outside, that production turns away and limits what it
// should (README, Running in production, step 3). Nothing it sends costs
// anything: each chat request has an empty message, which the route answers
// with a 400 before Gemini is called, and the rest are quote checks and
// searches, whose source is free, and CSP reports.
//
//   npm run check:limits                   the refusals (lib/api/guard.ts): four requests
//   npm run check:limits -- --bursts       the limits too: about seven minutes
//   npm run check:limits -- --base <url>   another public deployment
//
// --bursts runs your own address into the limits, so the site answers you
// 429 for up to a minute after each burst:
// - 12 quote checks: the route's own limit (lib/api/allowance.ts) has to stop
//   the 11th, which also proves the routes see each visitor's address.
// - 45 empty chat posts, 45 searches for an Ang number (the routes turn both
//   away without counting them) and 45 CSP reports, four a second, each
//   burst at least a minute after the last: the firewall has to answer the
//   first two with 429 and leave the reports alone.
// Each burst starts about three seconds into a minute by the site's clock,
// so the routes' per-minute count, and a firewall window if it keeps the
// clock's, doesn't split it. It exits 1 when a check fails.

import { setTimeout as sleep } from 'node:timers/promises';
import { VISITOR_LIMITS } from '../../lib/api/allowance';
import {
    codeOf,
    edgeOf,
    judgeAnswer,
    judgeLeftOut,
    judgeRateLimited,
    judgeVisitorLimit,
    nextStart,
    type Answer,
    type Verdict,
} from './verdicts';

const DEFAULT_BASE = 'https://sikhai.vercel.app';
// A line that cites its Ang, so each quote check is one lookup, cached after the first.
const QUOTE = 'ਸੋ ਪੁਰਖੁ ਨਿਰੰਜਨੁ ਹਰਿ ਪੁਰਖੁ ਨਿਰੰਜਨੁ ਹਰਿ ਅਗਮਾ ਅਗਮ ਅਪਾਰਾ ॥ (Ang 10)';
const EMPTY_CHAT = JSON.stringify({ message: '' });
// The firewall rule's limit per address in a 60-second window (README step 3).
const FIREWALL_LIMIT = 20;
// Past the limit even when a burst straddles two windows.
const BURST = 45;
// Four a second: the firewall's counts lag real traffic by a few seconds.
const PACE_MS = 250;
// Long enough for any window an earlier burst ran into to end.
const GAP_MS = 60_000;
// Past the slowest route's own deadline (/api/chat/verify gives up at 15 s).
const TIMEOUT_MS = 30_000;
const JSON_TYPE = { 'content-type': 'application/json' };
const CROSS_SITE = { 'sec-fetch-site': 'cross-site' };

const HELP = `Limits check — production's refusals and rate limits, from outside

Usage: npm run check:limits -- [flags]

  (no flags)     The refusals: four requests
  --bursts       The per-visitor limit and the firewall's rule too: about
                 seven minutes, and the site answers this address 429 for up
                 to a minute after each burst
  --base <url>   Another public deployment (default ${DEFAULT_BASE})
  --help         This message
`;

type Options = { base: string; bursts: boolean };

// A deployment's origin, from any URL on it.
function baseOf(url: string | undefined): string {
    const parsed = URL.canParse(url ?? '') ? new URL(url ?? '') : null;
    if (parsed?.protocol !== 'https:' && parsed?.protocol !== 'http:') throw new Error(`--base needs an http(s) URL\n\n${HELP}`);
    return parsed.origin;
}

function parseArgs(argv: string[]): Options {
    const opts: Options = { base: DEFAULT_BASE, bursts: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--help') { console.log(HELP); process.exit(0); }
        else if (arg === '--bursts') opts.bursts = true;
        else if (arg === '--base') opts.base = baseOf(argv[++i]);
        else throw new Error(`unknown flag ${arg}\n\n${HELP}`);
    }
    return opts;
}

type Probe = { method: 'GET' | 'POST'; path: string; headers?: Record<string, string>; body?: string };
type Burst = { answers: Answer[]; from: number; to: number };

// The site's clock minus this one's, from the last Date header: it's rounded
// down to the second, so the middle of that second is the best guess.
let offsetMs = 0;

async function send(base: string, probe: Probe, n: number): Promise<Answer> {
    const res = await fetch(new URL(probe.path, base), {
        method: probe.method,
        headers: probe.headers,
        body: probe.body,
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.text();
    const date = Date.parse(res.headers.get('date') ?? '');
    if (!Number.isNaN(date)) offsetMs = date + 500 - Date.now();
    // An empty message can only be refused. Anything else means the chat
    // answered, so stop before another request could cost something.
    if (probe.path === '/api/chat' && res.ok) throw new Error(`/api/chat answered ${res.status} to an empty message: stopping`);
    return {
        n,
        status: res.status,
        code: codeOf(body),
        retryAfter: res.headers.get('retry-after'),
        cacheControl: res.headers.get('cache-control'),
        mitigated: res.headers.get('x-vercel-mitigated'),
        edge: edgeOf(res.headers.get('x-vercel-id')),
    };
}

// `count` requests, one after another, starting at most one every `paceMs`.
async function burst(base: string, probe: Probe, count: number, paceMs: number): Promise<Burst> {
    const from = Date.now();
    const answers: Answer[] = [];
    for (let n = 1; n <= count; n++) {
        const wait = from + (n - 1) * paceMs - Date.now();
        if (wait > 0) await sleep(wait);
        answers.push(await send(base, probe, n));
    }
    return { answers, from, to: Date.now() };
}

const utc = (ms: number) => new Date(ms).toISOString().slice(11, 19);

// Waits for the next start (verdicts.ts nextStart) by the site's clock, no
// earlier than `notBefore` by this one's.
async function startAt(notBefore: number): Promise<void> {
    const at = nextStart(Date.now() + offsetMs, notBefore + offsetMs) - offsetMs;
    console.log(`       waiting ${Math.round((at - Date.now()) / 1000)} s, for ${utc(at + offsetMs)} UTC by the site's clock`);
    await sleep(Math.max(0, at - Date.now()));
}

const verdicts: Verdict[] = [];

function report(name: string, verdict: Verdict, run?: Burst): Verdict {
    verdicts.push(verdict);
    const mark = verdict.ok === true ? 'pass' : verdict.ok === false ? 'FAIL' : 'unsure';
    let where = '';
    if (run) {
        const edges = [...new Set(run.answers.map((a) => a.edge ?? 'no x-vercel-id'))];
        // The firewall counts each region on its own, so a split burst can pass unlimited.
        const split = edges.length > 1 ? '; more than one region, so run it again' : '';
        where = ` [${utc(run.from + offsetMs)}–${utc(run.to + offsetMs)} UTC, ${edges.join(' + ')}${split}]`;
    }
    console.log(`${mark.padEnd(6)} ${name}: ${verdict.detail}${where}`);
    return verdict;
}

async function main(): Promise<void> {
    const { base, bursts } = parseArgs(process.argv.slice(2));
    console.log(`Checking ${base}${bursts ? ', with bursts' : ''}`);

    // The search carries a parameter the route ignores, so no copy the CDN
    // kept from someone's earlier search can answer it: only the route.
    const search = `/api/shabad/search?q=so+purakh+niranjan&check=${Date.now()}`;
    const chat = (headers: Record<string, string>): Probe => ({ method: 'POST', path: '/api/chat', headers, body: EMPTY_CHAT });
    report('cross-site search', judgeAnswer(await send(base, { method: 'GET', path: search, headers: CROSS_SITE }, 1), { status: 403 }, true));
    report('the same search', judgeAnswer(await send(base, { method: 'GET', path: search }, 1), { status: 200 }, false));
    report('chat as text/plain', judgeAnswer(await send(base, chat({ 'content-type': 'text/plain' }), 1), { status: 415 }, true));
    report('cross-site chat', judgeAnswer(await send(base, chat({ ...JSON_TYPE, ...CROSS_SITE }), 1), { status: 403 }, true));

    if (bursts) {
        console.log('Bursts: the site answers this address 429 for up to a minute after each.');
        const quote: Probe = { method: 'POST', path: '/api/chat/verify', headers: JSON_TYPE, body: JSON.stringify({ text: QUOTE }) };
        await startAt(Date.now());
        let run = await burst(base, quote, VISITOR_LIMITS.verify.perMinute + 2, 0);
        report('per-visitor limit (quote checks)', judgeVisitorLimit(run.answers, 'verify'), run);

        await startAt(run.to + GAP_MS);
        run = await burst(base, chat(JSON_TYPE), BURST, PACE_MS);
        const posts = report('firewall, POST /api/chat', judgeRateLimited(run.answers, { status: 400, code: 'chat_empty' }, FIREWALL_LIMIT), run);

        await startAt(run.to + GAP_MS);
        run = await burst(base, { method: 'GET', path: '/api/shabad/search?q=10' }, BURST, PACE_MS);
        report('firewall, GET /api/shabad/search', judgeRateLimited(run.answers, { status: 400, code: 'invalid_query' }, FIREWALL_LIMIT), run);

        // "Never limited" only means the reports are left out once the rule
        // has been seen limiting.
        if (posts.ok) {
            await startAt(run.to + GAP_MS);
            const cspReport: Probe = { method: 'POST', path: '/api/csp-report', headers: { 'content-type': 'application/reports+json' }, body: '[]' };
            run = await burst(base, cspReport, BURST, PACE_MS);
            report('firewall leaves out /api/csp-report', judgeLeftOut(run.answers, { status: 204 }), run);
        } else {
            report('firewall leaves out /api/csp-report', { ok: null, detail: 'skipped: it shows something only once the rule is seen limiting the posts' });
        }
    }

    const failed = verdicts.filter((v) => v.ok === false).length;
    const unsure = verdicts.filter((v) => v.ok === null).length;
    console.log(failed ? `${failed} failed` : unsure ? `none failed, ${unsure} unsure` : 'all passed');
    if (failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
