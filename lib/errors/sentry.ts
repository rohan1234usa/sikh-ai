// SERVER-ONLY: sends the site's errors to Sentry (#20), when SENTRY_DSN is
// set. There's no Sentry SDK anywhere: a browser's report reaches this site
// first (app/api/error-report, lib/errors/report.ts), and every event is built
// here from what lib/errors/scrub.ts lets through. So Sentry never sees a
// visitor's IP address, cookies, request ID or any header but the browser's
// User-Agent, nor anything they wrote: it sees what failed, where in the
// site's code, on which page, and in which browser (for the server's own
// errors, in which release).
//
// Sent with node:https, not fetch. Next patches fetch: a send while a page
// renders (an error line from a Seva page's Firestore read, say) would make
// that page dynamic, or fail its regeneration. It also keeps sends out of
// Next's data cache, and out of the way of tests that stand in for fetch.
//
// Sentry's free plan takes 5,000 errors a month, and has no per-key rate
// limit (that's on its paid plans), so what each server holds back here is
// the ceiling: the same error at most once in 10 minutes, at most 20 an hour
// and 60 a day (10 and 30 for visitors' reports), and nothing while Sentry
// says to wait. Each running server counts on its own.
//
// A visitor's report can be made up: anyone can post one. So reports have a
// sender of their own, with shares of their own (and, on a paid plan, a key
// of their own, SENTRY_BROWSER_DSN, with Sentry's limit on it), and made-up
// reports can't use up what the site's own errors need.

import { randomUUID } from 'node:crypto';
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { ReadReport } from './report';
import { parseFrameLine, scrubMessage, type ParsedFrame } from './scrub';

const SDK = { name: 'sikhai.relay', version: '1.0.0' };
const TIMEOUT_MS = 3_000;
export const REPEAT_MS = 10 * 60_000;
export const PER_HOUR = 20;
export const PER_DAY = 60;
export const BROWSER_PER_HOUR = 10;
export const BROWSER_PER_DAY = 30;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
// How long to wait when Sentry says to without saying for how long.
const DEFAULT_WAIT_MS = 60_000;
// Errors whose last send is remembered; past that, the oldest is forgotten.
const MAX_REMEMBERED = 500;

type Env = Record<string, string | undefined>;
type Dsn = { endpoint: string; key: string; local: boolean };

// Plain http only for a mock on this machine (README, Getting Started, step 5).
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

// A DSN, https://<key>@<host>[/<path>]/<project>, as the address events are
// posted to and the key that goes with them. Null when it's unset or can't be
// read.
export function parseDsn(dsn: string | undefined): Dsn | null {
    if (!dsn) return null;
    try {
        const url = new URL(dsn);
        const key = decodeURIComponent(url.username);
        const segments = url.pathname.split('/');
        const project = segments.pop() ?? '';
        const local = LOOPBACK.has(url.hostname);
        if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || !key || !/^\d+$/.test(project)) return null;
        return { endpoint: `${url.protocol}//${url.host}${segments.join('/')}/api/${project}/envelope/`, key, local };
    } catch {
        return null;
    }
}

type SentryFrame = { function?: string; filename: string; abs_path?: string; lineno: number; colno: number; in_app?: boolean };

export type SentryEvent = {
    event_id: string;
    timestamp: number;
    platform: 'javascript' | 'node';
    level: 'error';
    environment: string;
    release?: string;
    transaction: string;
    tags: Record<string, string>;
    request?: { url?: string; method?: string; headers?: Record<string, string> };
    exception?: {
        values: {
            type: string;
            value: string;
            mechanism: { type: string; handled: boolean };
            stacktrace?: { frames: SentryFrame[] };
        }[];
    };
    logentry?: { formatted: string };
    fingerprint?: string[];
    sdk: typeof SDK;
};

// An event, and what this server's backstop counts it as: the same error, on
// the same page or route.
export type Outgoing = { event: SentryEvent; key: string };

// What every event has. The release is the server's: right for its own
// errors, but a page left open from an earlier deploy reports to the new one,
// so a browser's report goes without one (it would read as a regression).
function basics(env: Env, now: number, { release = true } = {}) {
    return {
        event_id: randomUUID().replace(/-/g, ''),
        timestamp: now / 1000,
        level: 'error' as const,
        environment: env.VERCEL_ENV ?? 'local',
        ...(release && env.VERCEL_GIT_COMMIT_SHA ? { release: env.VERCEL_GIT_COMMIT_SHA } : {}),
        sdk: SDK,
    };
}

// A browser's report, already read (lib/errors/report.ts). A frame in one of
// the site's scripts keeps its full address, which Sentry fetches with its
// source map; Sentry groups these itself, on the frames once mapped. The
// browser's User-Agent goes too, so Sentry can tell browsers apart and leave
// out old browsers' and crawlers' errors (its inbound filters).
export function browserEvent(
    report: ReadReport,
    ctx: { origin: string; userAgent?: string | null },
    now = Date.now(),
    env: Env = process.env,
): Outgoing {
    const frames = report.frames.map((f): SentryFrame => ({
        ...(f.fn ? { function: f.fn } : {}),
        filename: f.file,
        ...(/^https?:\/\//.test(f.file) ? { abs_path: f.file } : {}),
        lineno: f.line,
        colno: f.column,
    }));
    const top = report.frames[0];
    return {
        event: {
            ...basics(env, now, { release: false }),
            platform: 'javascript',
            transaction: report.page,
            tags: { kind: report.kind, runtime: 'browser' },
            request: {
                url: `${ctx.origin}${report.page}`,
                ...(ctx.userAgent ? { headers: { 'User-Agent': ctx.userAgent.slice(0, 300) } } : {}),
            },
            exception: {
                values: [{
                    type: report.name,
                    value: report.message,
                    // An error page caught it; otherwise nothing did.
                    mechanism: { type: report.kind, handled: report.kind === 'page' || report.kind === 'root' },
                    stacktrace: { frames: frames.reverse() }, // Sentry's order: the oldest call first
                }],
            },
        },
        key: [report.kind, report.page, report.name, report.message.slice(0, 80), top ? `${top.file}:${top.line}:${top.column}` : ''].join('|'),
    };
}

// The fields of a log line that become tags: short words and numbers. A log
// line holds no user text (lib/log.ts); everything else in it stays in the
// log. Its request ID stays too: it names the visitor's nearest Vercel region
// and finds their IP address in Vercel's request log, and /privacy says a
// report can't be traced back to anyone.
const TAG_FIELDS = [
    'route', 'routePath', 'routeType', 'renderSource', 'revalidateReason', 'method',
    'feature', 'model', 'status', 'upstream', 'op', 'missing', 'outcome', 'digest',
];
// Of those, what tells one error from another, beside the line's event name
// and the error's type and message. Never a frame: the server's code is
// minified, so its function names, lines and columns change with every
// deploy.
const GROUPED_BY = ['route', 'routePath', 'feature', 'model', 'status', 'upstream', 'op', 'missing'];

// A message as it groups: its start, with every number the same, so the
// failure of Ang 1 and of Ang 1430 is one issue.
const groupedMessage = (message: string) => message.slice(0, 80).replace(/\d+/g, '0');

// Where a server frame's file is, from the deployment's root: the path
// before .next/ or node_modules/ says only where the server keeps it.
function serverFrame(frame: ParsedFrame): SentryFrame {
    const file = frame.file.replace(/^file:\/\//, '');
    const at = file.search(/\/(?:\.next|node_modules)\//);
    return {
        ...(frame.fn ? { function: frame.fn } : {}),
        filename: at === -1 ? file : file.slice(at + 1),
        lineno: frame.line,
        colno: frame.column,
        in_app: !/node_modules|^node:/.test(file),
    };
}

// An error-level log line (lib/log.ts), as an event: an exception when it
// names an error (`error: "TypeError: …"`, as describeError writes it, with
// `stack` frames from the server's code), otherwise a message.
export function logLineEvent(evt: string, fields: Record<string, unknown>, now = Date.now(), env: Env = process.env): Outgoing {
    const tags: Record<string, string> = { evt, runtime: 'server' };
    for (const name of TAG_FIELDS) {
        const value = fields[name];
        if ((typeof value === 'string' && value !== '') || typeof value === 'number') tags[name] = String(value).slice(0, 200);
    }
    const error = typeof fields.error === 'string' ? fields.error : '';
    const named = /^([A-Za-z_$][\w$]*)(?:: ([\s\S]*))?$/.exec(error);
    const frames = (Array.isArray(fields.stack) ? fields.stack : [])
        .map((line) => (typeof line === 'string' ? parseFrameLine(line) : null))
        .filter((f): f is ParsedFrame => f !== null)
        .map(serverFrame);
    const type = named?.[1];
    const message = scrubMessage(type ?? 'Error', named ? (named[2] ?? '') : error);
    const grouped = GROUPED_BY.flatMap((name) => (tags[name] ? [`${name}=${tags[name]}`] : []));
    const fingerprint = [evt, ...grouped, ...(type ? [type] : []), ...(message ? [groupedMessage(message)] : [])];
    const event: SentryEvent = {
        ...basics(env, now),
        platform: 'node',
        transaction: tags.route ?? tags.routePath ?? evt,
        tags,
        ...(typeof fields.path === 'string' ? { request: { url: fields.path, ...(tags.method ? { method: tags.method } : {}) } } : {}),
        fingerprint,
    };
    if (type && (frames.length > 0 || named?.[2] !== undefined)) {
        event.exception = {
            values: [{
                type,
                value: message,
                // A route that catches its own error answers for it; Next's
                // onRequestError (request_error) sees what nothing caught.
                mechanism: { type: evt, handled: evt !== 'request_error' },
                ...(frames.length > 0 ? { stacktrace: { frames: frames.reverse() } } : {}),
            }],
        };
    } else {
        // The issue's title in Sentry, and its alert's subject: what failed,
        // and where (gemini_call: API key not valid. (feature=chat, status=400)).
        const where = grouped.length > 0 ? ` (${grouped.join(', ')})` : '';
        event.logentry = { formatted: `${evt}${message ? `: ${message}` : ''}${where}` };
    }
    return { event, key: fingerprint.join('|') };
}

// The envelope Sentry takes: a header line, an item header, the event.
export function envelope(event: SentryEvent, now = Date.now()): string {
    const header = { event_id: event.event_id, sent_at: new Date(now).toISOString(), sdk: SDK };
    return `${JSON.stringify(header)}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(event)}\n`;
}

type Answer = { status: number; headers: IncomingHttpHeaders };

function post(dsn: Dsn, body: string, timeoutMs: number): Promise<Answer> {
    return new Promise((resolve, reject) => {
        const url = new URL(dsn.endpoint);
        const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
        const req = request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-sentry-envelope',
                'Content-Length': Buffer.byteLength(body),
                'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${dsn.key}, sentry_client=${SDK.name}/${SDK.version}`,
            },
        }, (res) => {
            clearTimeout(timer);
            res.resume(); // the answer's body isn't needed
            resolve({ status: res.statusCode ?? 0, headers: res.headers });
        });
        const timer = setTimeout(() => req.destroy(new Error('timed out')), timeoutMs);
        req.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
        req.end(body);
    });
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// How long Sentry asks this server to wait, in ms (0 for not at all): what
// X-Sentry-Rate-Limits says for errors, on any answer; otherwise a 429's
// Retry-After, or a minute.
export function waitFrom({ status, headers }: Answer): number {
    const limits = one(headers['x-sentry-rate-limits']);
    if (limits) {
        let wait = 0;
        for (const limit of limits.split(',')) {
            const [seconds, categories = ''] = limit.trim().split(':');
            const forErrors = categories === '' || categories.split(';').some((c) => c === 'error' || c === 'default');
            if (forErrors && Number.isFinite(Number(seconds))) wait = Math.max(wait, Number(seconds) * 1000);
        }
        return wait;
    }
    if (status !== 429) return 0;
    const seconds = Number(one(headers['retry-after']));
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_WAIT_MS;
}

// What came of a send: sent, held back (nowhere to send it, the same error
// sent recently, the hour's share used up, or Sentry asked to wait), or
// failed, with Sentry's status when it answered.
export type SendResult = { result: 'sent' | 'skipped' } | { result: 'failed'; status?: number };

export type Sender = {
    // Never throws, and never retries.
    send(outgoing: Outgoing, now?: number): Promise<SendResult>;
    // Resolves once every send started so far has finished: for tests.
    settled(): Promise<void>;
};

type SenderOptions = {
    timeoutMs?: number;
    perHour?: number;
    perDay?: number;
    // Which DSN it sends to, read for every send.
    dsn?: (env: Env) => string | undefined;
};

export function createSender(
    env: Env = process.env,
    { timeoutMs = TIMEOUT_MS, perHour = PER_HOUR, perDay = PER_DAY, dsn: dsnOf = (e) => e.SENTRY_DSN }: SenderOptions = {},
): Sender {
    let waitUntil = 0;
    let hourStarted = -Infinity;
    let sentThisHour = 0;
    let dayStarted = -Infinity;
    let sentToday = 0;
    const lastSent = new Map<string, number>(); // in the order last sent
    const inFlight = new Set<Promise<unknown>>();

    function admit(key: string, now: number): boolean {
        if (now < waitUntil) return false;
        const last = lastSent.get(key);
        if (last !== undefined && now - last < REPEAT_MS) return false;
        if (now - hourStarted >= HOUR_MS) {
            hourStarted = now;
            sentThisHour = 0;
        }
        if (now - dayStarted >= DAY_MS) {
            dayStarted = now;
            sentToday = 0;
        }
        if (sentThisHour >= perHour || sentToday >= perDay) return false;
        sentThisHour++;
        sentToday++;
        lastSent.delete(key);
        lastSent.set(key, now);
        if (lastSent.size > MAX_REMEMBERED) lastSent.delete(lastSent.keys().next().value as string);
        return true;
    }

    return {
        send({ event, key }, now = Date.now()) {
            const dsn = parseDsn(dsnOf(env));
            // Not while the site builds (an error line from a page prerendered
            // at build time), and from tests only to a mock on this machine,
            // whatever DSN the shell running them has set.
            const away = env.NEXT_PHASE === 'phase-production-build' || (env.NODE_TEST_CONTEXT !== undefined && !dsn?.local);
            if (!dsn || away || !admit(key, now)) return Promise.resolve({ result: 'skipped' });
            const sending = post(dsn, envelope(event, now), timeoutMs).then(
                (answer): SendResult => {
                    waitUntil = Math.max(waitUntil, now + waitFrom(answer));
                    return answer.status >= 200 && answer.status < 300
                        ? { result: 'sent' }
                        : { result: 'failed', status: answer.status };
                },
                (): SendResult => ({ result: 'failed' }),
            );
            inFlight.add(sending);
            void sending.finally(() => inFlight.delete(sending));
            return sending;
        },
        settled: () => Promise.allSettled([...inFlight]).then(() => undefined),
    };
}

// One sender of each kind per process, however many copies of this module
// Next bundles (for pages, for routes, for instrumentation.ts), so each
// backstop counts for the whole server.
const SENDERS = Symbol.for('sikhai.errors.senders');
const senders = ((globalThis as { [SENDERS]?: { site: Sender; browser: Sender } })[SENDERS] ??= {
    site: createSender(),
    browser: createSender(process.env, {
        perHour: BROWSER_PER_HOUR,
        perDay: BROWSER_PER_DAY,
        dsn: (env) => env.SENTRY_BROWSER_DSN || env.SENTRY_DSN,
    }),
});

// The site's own errors (lib/log.ts).
export const sentry = senders.site;
// Its visitors' reports (app/api/error-report).
export const browserSentry = senders.browser;
