// SERVER-ONLY: how many requests one visitor makes to the AI routes, quote
// checking, Shabad Search and error reports, in a minute and in a UTC day, on
// this server.
// A backup for the firewall's rate limit (README, Running in production,
// step 3): it holds while that rule is off or only logging, and it counts a
// whole day, which the firewall can't on the Hobby plan.
//
// Best effort, like the GurbaniNow allowances (lib/gurbani/gurbaninow.ts):
// each running server counts on its own, and a restart starts again, so a
// visitor whose requests reach several servers gets each one's allowance.
// The firewall is what counts across them.
//
// A visitor is an IP address, as the host reports it, or for IPv6 the /64
// it's in: one home or phone gets a whole /64 and can move around inside it.
// The address itself is never kept. Each feature counts under a code made
// from it with a secret that's new every UTC day and never leaves memory, so
// a code can't be turned back into an address, or matched across days or
// features.
//
// The address is the one Vercel sets: a client's own never gets through.
// Next fills it in from the connection when it's missing, so under `next
// start` it's whoever connected. Behind a proxy that doesn't set it, every
// visitor would be the proxy, and on a server open to the internet a client
// could name its own, so another host needs visitorOf looked at again. Only
// a request made in-process, as the tests make theirs, has no address, and
// it isn't counted: refusing all of those, or counting them as one visitor,
// would turn a backup into an outage.

import { createHmac, randomBytes } from 'node:crypto';
import { isIPv4, isIPv6 } from 'node:net';
import { logEvent } from '../log';
import { logRefusal } from './refusals';

export const MINUTE_MS = 60_000;
export const DAY_MS = 86_400_000; // epoch days are UTC days
// Visitors one feature keeps counts for on one server; past that, the one
// seen longest ago is forgotten.
export const MAX_VISITORS = 5_000;

export type Limits = { perMinute: number; perDay: number };
export type Window = 'minute' | 'day';
export type Verdict = { ok: true } | { ok: false; window: Window; retryAfter: number };

// Per visitor, per running server.
// - The chat and the tutor: the firewall allows 20 posts a minute from one
//   address, which is about 10 chat turns, since a reply that quotes
//   Gurmukhi is followed by a quote check. 300 a day leaves room for a
//   gurdwara class on one connection; at about $0.0036 an answer, one
//   visitor costs at most about $1.10 a day per server on the chat, and as
//   much again on the tutor (twice that from 2027).
// - The quote check: one per reply at most, and each can make 12 GurbaniNow
//   calls, so 100 spends at most 1,200 of quote checking's 3,000 a day.
// - The translator: short lookups come quicker than questions.
// - The live translator: the lines shown while someone types, one call at
//   each pause. The page holds itself to 10 a minute (LIVE_CALLS_PER_MINUTE
//   in lib/translate/live.ts), so with the firewall's 20 posts a minute
//   there's room left for the Translate button. 500 a day, at about $0.0014
//   a call (measured: 1,600 tokens in, 50 out), is at most about $0.70 per
//   visitor per server (twice that from 2027).
// - Talk's voice translator (/api/translate/voice): one call per clip of up
//   to 15 s, and a person records, waits for the lines and listens before
//   the next, so 10 a minute is more than a conversation gets through, and
//   leaves room under the firewall's 20 for the read-aloud call each
//   exchange can make. At most about 2,000 tokens in (480 of them audio,
//   32 a second; the instruction is most of the rest) and a few hundred out
//   with its thinking (up to about 1,000 thought tokens when it thinks):
//   about $0.003 a call on 3.8 Flash ($0.75 a million in, $3.75 out), at
//   most about $0.006, so 200 a day is at most about $1.20 per visitor per
//   server (twice that from 2027).
// - Talk's read-aloud (/api/translate/speak, Cloud Text-to-Speech): up to
//   400 characters each, 15 a minute so a quick back-and-forth can be heard
//   again. Its day counts characters, as Compare's does (the route passes
//   each line's length as the cost), since what runs out is the server's
//   own 50,000 a day (lib/translate/speak.ts). 12,500 is a quarter of that,
//   so it takes four visitors to use up a server's day; it's a couple of
//   hundred spoken sentences, and at $4 a million characters at most $0.05
//   per visitor per server.
// - Compare with Google Translate: its day counts characters, not requests
//   (the route passes each text's length as the cost), since what runs out
//   is its own 10,000 characters a day (lib/translate/cloud.ts), and one
//   comparison can be 2,000. 2,500 is a quarter of that, so it takes four
//   visitors to use up a server's day; a typical comparison is a phrase.
// - Shabad Search: at most 4 GurbaniNow calls each, so 300 spends at most
//   1,200 of its 5,000. An answer the CDN keeps never reaches the server.
// - Error reports (app/api/error-report): a page sends at most 5
//   (lib/errors/client.ts), so 10 a minute is a crash loop at most. Every
//   post counts, report or not, and the server sends at most 30 visitors'
//   reports a day on to Sentry (lib/errors/sentry.ts), which takes 5,000 a
//   month.
export const VISITOR_LIMITS = {
    chat: { perMinute: 10, perDay: 300 },
    verify: { perMinute: 10, perDay: 100 },
    learn: { perMinute: 10, perDay: 300 },
    translate: { perMinute: 15, perDay: 300 },
    translateLive: { perMinute: 12, perDay: 500 },
    translateVoice: { perMinute: 10, perDay: 200 },
    speak: { perMinute: 15, perDay: 12_500 },
    crosscheck: { perMinute: 5, perDay: 2_500 },
    search: { perMinute: 20, perDay: 300 },
    errorReport: { perMinute: 10, perDay: 100 },
} as const satisfies Record<string, Limits>;
export type Feature = keyof typeof VISITOR_LIMITS;

// What a refused visitor is told: the busy code past the minute's limit
// (try again in a minute), the limit code past the day's. The English is the
// dictionary's for the same code (lib/i18n/dictionaries/en.ts), or for Talk's
// two routes its page's own (lib/i18n/talk/en.ts); a test holds them equal.
// It's for the logs and for a page loaded before a code existed. The
// quote check, Compare and error reports don't show their errors, so theirs
// are for logs.
export const REFUSALS: Record<Feature, Record<Window, { code: string; error: string }>> = {
    chat: {
        minute: { code: 'chat_busy', error: 'SikhAI is very busy right now. Please wait a minute and try again.' },
        day: { code: 'chat_limit', error: "Your connection has reached today's limit for SikhAI. Please come back later." },
    },
    verify: {
        minute: { code: 'verify_busy', error: 'Too many quote checks. Please wait a minute.' },
        day: { code: 'verify_limit', error: "Today's limit for quote checks is reached." },
    },
    learn: {
        minute: { code: 'learn_busy', error: 'The tutor is very busy right now. Please wait a minute and try again.' },
        day: { code: 'learn_limit', error: "Your connection has reached today's limit for the tutor. Please come back later." },
    },
    translate: {
        minute: { code: 'translate_busy', error: 'The translator is busy right now. Please wait a moment and try again.' },
        day: { code: 'translate_limit', error: "Your connection has reached today's limit for the translator. Please come back later." },
    },
    // The page doesn't show these: past either, live lines pause for the
    // Retry-After seconds, and the Translate button still works.
    translateLive: {
        minute: { code: 'translate_live_busy', error: 'Too many live translations. Please wait a minute.' },
        day: { code: 'translate_live_limit', error: "Today's limit for live translation is reached." },
    },
    translateVoice: {
        minute: { code: 'translate_voice_busy', error: 'The voice translator is busy right now. Please wait a minute and try again.' },
        day: { code: 'translate_voice_limit', error: "Your connection has reached today's limit for the voice translator. Please come back later." },
    },
    speak: {
        minute: { code: 'speak_busy', error: 'Reading aloud is busy right now. Please wait a minute.' },
        day: { code: 'speak_limit', error: "Your connection has reached today's limit for reading aloud. Please come back later." },
    },
    crosscheck: {
        minute: { code: 'crosscheck_busy', error: 'Too many comparisons. Please wait a minute.' },
        day: { code: 'crosscheck_limit', error: "Today's limit for comparisons is reached." },
    },
    search: {
        minute: { code: 'search_busy', error: 'Shabad Search is very busy right now. Please try again in a minute.' },
        day: { code: 'search_limit', error: "Your connection has reached today's limit for Shabad Search. Please come back later." },
    },
    errorReport: {
        minute: { code: 'error_report_busy', error: 'Too many error reports. Please wait a minute.' },
        day: { code: 'error_report_limit', error: "Today's limit for error reports is reached." },
    },
};

// A valid IPv6 address's eight groups, as numbers: `::` filled in, and a
// trailing IPv4 part (64:ff9b::192.0.2.1) read as the two groups it is.
function groupsOf(ip: string): number[] {
    const [head, tail] = ip.split('::');
    const parts = (s: string | undefined) => (s ? s.split(':') : []).flatMap((g) => {
        if (!g.includes('.')) return [parseInt(g, 16)];
        const [a, b, c, d] = g.split('.').map(Number);
        return [(a << 8) | b, (c << 8) | d];
    });
    const left = parts(head);
    const right = parts(tail);
    return tail === undefined ? left : [...left, ...Array(8 - left.length - right.length).fill(0), ...right];
}

// Who's asking: the first x-forwarded-for address, which Vercel sets itself
// (a client's own value never gets through), else x-real-ip, the same
// address. An IPv4 address carried in IPv6 is that IPv4 address, however
// it's written (::ffff:192.0.2.1, or ::ffff:c000:201 once a URL parser has
// had it); any other IPv6 address stands for its /64. Null when there's none.
export function visitorOf(headers: Headers): string | null {
    for (const raw of [headers.get('x-forwarded-for')?.split(',')[0], headers.get('x-real-ip')]) {
        const ip = (raw ?? '').trim().split('%')[0]; // a zone (%eth0) belongs to the local network only
        if (isIPv4(ip)) return ip;
        if (!isIPv6(ip)) continue;
        const g = groupsOf(ip);
        if (g.slice(0, 5).every((n) => n === 0) && g[5] === 0xffff) return [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255].join('.');
        return `${g.slice(0, 4).map((n) => n.toString(16)).join(':')}::/64`;
    }
    return null;
}

export type Allowance = { take(visitor: string, now?: number, cost?: number): Verdict; size(): number };

// One feature's counts. take() counts a request, or says which limit it's
// past and how many seconds until that limit's window ends. A refused
// request doesn't count. Both windows are fixed: the clock minute, and the
// UTC day, like dailyMeter's. The minute counts requests; `cost` is what a
// request spends of the day, 1 unless the feature's day is in other units
// (Compare's and read-aloud's characters). A request that costs more than is
// left of a day not yet spent waits only for the minute's end: a smaller one
// may still fit, and a page that waits out Retry-After (Talk's) mustn't stop
// reading aloud until midnight over one long line.
export function visitorAllowance({ perMinute, perDay }: Limits, maxVisitors = MAX_VISITORS): Allowance {
    let day = -1;
    let secret = randomBytes(32);
    // Each visitor is moved to the end when seen, so the first is the one
    // seen longest ago.
    const counts = new Map<string, { minute: number; inMinute: number; inDay: number }>();
    return {
        take(visitor, now = Date.now(), cost = 1) {
            const today = Math.floor(now / DAY_MS);
            if (today !== day) {
                // A new day: every count starts again, under a new secret.
                day = today;
                secret = randomBytes(32);
                counts.clear();
            }
            const code = createHmac('sha256', secret).update(visitor).digest('base64url').slice(0, 16);
            const minute = Math.floor(now / MINUTE_MS);
            const mine = counts.get(code) ?? { minute, inMinute: 0, inDay: 0 };
            counts.delete(code);
            if (mine.minute !== minute) {
                mine.minute = minute;
                mine.inMinute = 0;
            }
            const toMinuteEnd = Math.ceil(((minute + 1) * MINUTE_MS - now) / 1000);
            let verdict: Verdict = { ok: true };
            if (mine.inDay + cost > perDay) {
                const spent = mine.inDay >= perDay;
                verdict = { ok: false, window: 'day', retryAfter: spent ? Math.ceil(((today + 1) * DAY_MS - now) / 1000) : toMinuteEnd };
            } else if (mine.inMinute >= perMinute) {
                verdict = { ok: false, window: 'minute', retryAfter: toMinuteEnd };
            } else {
                mine.inMinute++;
                mine.inDay += cost;
            }
            counts.set(code, mine);
            if (counts.size > maxVisitors) {
                const oldest = counts.keys().next().value;
                if (oldest !== undefined) counts.delete(oldest);
            }
            return verdict;
        },
        size: () => counts.size,
    };
}

export const allowances: Record<Feature, Allowance> = {
    chat: visitorAllowance(VISITOR_LIMITS.chat),
    verify: visitorAllowance(VISITOR_LIMITS.verify),
    learn: visitorAllowance(VISITOR_LIMITS.learn),
    translate: visitorAllowance(VISITOR_LIMITS.translate),
    translateLive: visitorAllowance(VISITOR_LIMITS.translateLive),
    translateVoice: visitorAllowance(VISITOR_LIMITS.translateVoice),
    speak: visitorAllowance(VISITOR_LIMITS.speak),
    crosscheck: visitorAllowance(VISITOR_LIMITS.crosscheck),
    search: visitorAllowance(VISITOR_LIMITS.search),
    errorReport: visitorAllowance(VISITOR_LIMITS.errorReport),
};

let unaddressed = false;

// Counts a request against its visitor's allowance for `feature`: the
// refusal to send back, or null to go on. A route calls it once the request
// has passed its own checks, just before it would cost anything, so a
// request refused for what it is, or answered for free, isn't counted.
// Error reports are the exception: anyone can post one, so that route
// counts every post before reading it (app/api/error-report). `cost` is the
// request's share of the day (Compare and read-aloud pass their text's
// length).
export function limitVisitor(
    req: Request,
    feature: Feature,
    { now = Date.now(), cost = 1 }: { now?: number; cost?: number } = {},
): Response | null {
    const visitor = visitorOf(req.headers);
    if (visitor === null) {
        // Never on Vercel. Said once, so a change there shows in the logs.
        if (!unaddressed) logEvent('limit_skipped', { why: 'no_address' }, 'warn');
        unaddressed = true;
        return null;
    }
    const verdict = allowances[feature].take(visitor, now, cost);
    if (verdict.ok) return null;
    const limit = verdict.window === 'day' ? VISITOR_LIMITS[feature].perDay : VISITOR_LIMITS[feature].perMinute;
    logRefusal('visitor_limited', `${feature} ${verdict.window}`, { window: verdict.window, limit }, now);
    const { code, error } = REFUSALS[feature][verdict.window];
    return Response.json(
        { error, code },
        { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(verdict.retryAfter) } },
    );
}
