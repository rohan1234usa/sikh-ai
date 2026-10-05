// SERVER-ONLY: how many requests one visitor makes to the AI routes, quote
// checking and Shabad Search, in a minute and in a UTC day, on this server.
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
// features. A request with no address (a test, the app run locally behind
// something else, another host) isn't counted: refusing all of them, or
// counting them as one visitor, would turn a backup into an outage.

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
//   visitor costs at most about $1.10 a day per server (twice that from 2027).
// - The quote check: one per reply at most, and each can make 12 GurbaniNow
//   calls, so 100 spends at most 1,200 of quote checking's 3,000 a day.
// - The translator: short lookups come quicker than questions.
// - Compare with Google Translate: up to 2,000 characters each, from its own
//   10,000 a day (lib/translate/cloud.ts).
// - Shabad Search: at most 4 GurbaniNow calls each, so 300 spends at most
//   1,200 of its 5,000. An answer the CDN keeps never reaches the server.
export const VISITOR_LIMITS = {
    chat: { perMinute: 10, perDay: 300 },
    verify: { perMinute: 10, perDay: 100 },
    learn: { perMinute: 10, perDay: 300 },
    translate: { perMinute: 15, perDay: 300 },
    crosscheck: { perMinute: 5, perDay: 50 },
    search: { perMinute: 20, perDay: 300 },
} as const satisfies Record<string, Limits>;
export type Feature = keyof typeof VISITOR_LIMITS;

// What a refused visitor is told: the busy code past the minute's limit
// (try again in a minute), the limit code past the day's. The English is the
// dictionary's for the same code (lib/i18n/dictionaries/en.ts; a test holds
// them equal), for the logs and for a page loaded before a code existed. The
// quote check and Compare don't show their errors, so theirs are for logs.
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
    crosscheck: {
        minute: { code: 'crosscheck_busy', error: 'Too many comparisons. Please wait a minute.' },
        day: { code: 'crosscheck_limit', error: "Today's limit for comparisons is reached." },
    },
    search: {
        minute: { code: 'search_busy', error: 'Shabad Search is very busy right now. Please try again in a minute.' },
        day: { code: 'search_limit', error: "Your connection has reached today's limit for Shabad Search. Please come back later." },
    },
};

// An IPv6 address's first four groups, written out: the /64 it's in.
function prefix64(ip: string): string {
    const [head, tail] = ip.split('::');
    const parts = (s: string | undefined) => (s ? s.split(':') : []);
    // A trailing IPv4 part (64:ff9b::192.0.2.1) takes the room of two groups.
    const width = (groups: string[]) => groups.reduce((n, g) => n + (g.includes('.') ? 2 : 1), 0);
    const left = parts(head);
    const right = parts(tail);
    const groups = tail === undefined ? left : [...left, ...Array(8 - width(left) - width(right)).fill('0'), ...right];
    return `${groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(':')}::/64`;
}

// Who's asking: the first x-forwarded-for address, which Vercel sets itself
// (a client's own value never gets through), else x-real-ip, the same
// address. An IPv4 address carried in IPv6 (::ffff:192.0.2.1) is that IPv4
// address; any other IPv6 address stands for its /64. Null when there's none.
export function visitorOf(headers: Headers): string | null {
    for (const raw of [headers.get('x-forwarded-for')?.split(',')[0], headers.get('x-real-ip')]) {
        const ip = (raw ?? '').trim().split('%')[0]; // a zone (%eth0) belongs to the local network only
        if (isIPv4(ip)) return ip;
        if (!isIPv6(ip)) continue;
        const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
        return mapped && isIPv4(mapped[1]) ? mapped[1] : prefix64(ip);
    }
    return null;
}

export type Allowance = { take(visitor: string, now?: number): Verdict; size(): number };

// One feature's counts. take() counts a request, or says which limit it's
// past and how many seconds until that limit's window ends. A refused
// request doesn't count. Both windows are fixed: the clock minute, and the
// UTC day, like dailyMeter's.
export function visitorAllowance({ perMinute, perDay }: Limits, maxVisitors = MAX_VISITORS): Allowance {
    let day = -1;
    let secret = randomBytes(32);
    // Each visitor is moved to the end when seen, so the first is the one
    // seen longest ago.
    const counts = new Map<string, { minute: number; inMinute: number; inDay: number }>();
    return {
        take(visitor, now = Date.now()) {
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
            let verdict: Verdict = { ok: true };
            if (mine.inDay >= perDay) {
                verdict = { ok: false, window: 'day', retryAfter: Math.ceil(((today + 1) * DAY_MS - now) / 1000) };
            } else if (mine.inMinute >= perMinute) {
                verdict = { ok: false, window: 'minute', retryAfter: Math.ceil(((minute + 1) * MINUTE_MS - now) / 1000) };
            } else {
                mine.inMinute++;
                mine.inDay++;
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
    crosscheck: visitorAllowance(VISITOR_LIMITS.crosscheck),
    search: visitorAllowance(VISITOR_LIMITS.search),
};

let unaddressed = false;

// Counts a request against its visitor's allowance for `feature`: the
// refusal to send back, or null to go on. A route calls it once the request
// has passed its own checks, just before it would cost anything, so a
// request refused for what it is, or answered for free, isn't counted.
export function limitVisitor(req: Request, feature: Feature, now = Date.now()): Response | null {
    const visitor = visitorOf(req.headers);
    if (visitor === null) {
        // Never on Vercel. Said once, so a change there shows in the logs.
        if (!unaddressed) logEvent('limit_skipped', { why: 'no_address' }, 'warn');
        unaddressed = true;
        return null;
    }
    const verdict = allowances[feature].take(visitor, now);
    if (verdict.ok) return null;
    const limit = verdict.window === 'day' ? VISITOR_LIMITS[feature].perDay : VISITOR_LIMITS[feature].perMinute;
    logRefusal('visitor_limited', `${feature} ${verdict.window}`, { window: verdict.window, limit }, now);
    const { code, error } = REFUSALS[feature][verdict.window];
    return Response.json(
        { error, code },
        { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(verdict.retryAfter) } },
    );
}
