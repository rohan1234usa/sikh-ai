// What the limits check (./index.ts) makes of production's answers, kept
// apart from the network so tests/api/limits-check.test.ts can try every
// case: the README's (Running in production, step 3) and the ways it fails.

const MINUTE_MS = 60_000;

// One answer, as the check keeps it.
// - code: the JSON body's top-level `code`. The routes' own refusals and
//   limits carry one; the firewall's 429 has no body.
// - edge: x-vercel-id without its request id: the regions that served it.
//   The firewall counts in each region on its own.
// - mitigated: x-vercel-mitigated, which names a challenge.
export type Answer = {
    n: number;
    status: number;
    code: string | null;
    retryAfter: string | null;
    cacheControl: string | null;
    mitigated: string | null;
    edge: string | null;
};

// ok: true passed, false failed, null can't tell (the detail says why).
export type Verdict = { ok: boolean | null; detail: string };

// What a request gets before any limit: a status, and the route's own code
// for it when it has one.
export type Expected = { status: number; code?: string };

const matches = (a: Answer, want: Expected) => a.status === want.status && (want.code === undefined || a.code === want.code);
const label = (status: number, code?: string | null) => (code ? `${status} ${code}` : String(status));
const labelOf = (a: Answer) => label(a.status, a.code);

// The route's own limit (lib/api/allowance.ts): `<feature>_busy` past the
// minute's count, `<feature>_limit` past the day's.
export const isRouteLimit = (a: Answer) => a.status === 429 && /_(busy|limit)$/.test(a.code ?? '');

// The firewall's rate limit: any other 429, unless Vercel says it's a challenge.
export const isFirewallLimit = (a: Answer) => a.status === 429 && !isRouteLimit(a) && a.mitigated !== 'challenge';

// The JSON body's top-level `code`, or null.
export function codeOf(body: string): string | null {
    try {
        const parsed: unknown = JSON.parse(body);
        const code = parsed !== null && typeof parsed === 'object' ? (parsed as { code?: unknown }).code : undefined;
        return typeof code === 'string' ? code : null;
    } catch {
        return null;
    }
}

// "sfo1::iad1::abcd1-1791233894519-ffd9f8c8e384" → "sfo1::iad1".
export function edgeOf(id: string | null): string | null {
    const parts = id?.split('::') ?? [];
    return parts.length > 1 ? parts.slice(0, -1).join('::') : null;
}

// "10 × 200, 2 × 429 verify_busy", in the order each first came.
export function tally(answers: Answer[]): string {
    const counts = new Map<string, number>();
    for (const a of answers) counts.set(labelOf(a), (counts.get(labelOf(a)) ?? 0) + 1);
    return [...counts].map(([what, n]) => `${n} × ${what}`).join(', ');
}

// When a burst starts, by the site's clock: `second` seconds into a minute,
// the first such moment no earlier than now or `notBefore`. Starting just
// after the minute turns keeps a short burst inside one minute, which is how
// the routes count (lib/api/allowance.ts) and maybe the firewall's window.
export function nextStart(now: number, notBefore: number, second = 3): number {
    const from = Math.max(now, notBefore);
    const start = Math.floor(from / MINUTE_MS) * MINUTE_MS + second * 1000;
    return start >= from ? start : start + MINUTE_MS;
}

// One request: its status and, for a refusal, no-store, so the CDN never
// hands it to anyone else.
export function judgeAnswer(a: Answer, want: Expected, noStore: boolean): Verdict {
    if (!matches(a, want)) return { ok: false, detail: `got ${labelOf(a)}, wanted ${label(want.status, want.code)}` };
    if (noStore && !/\bno-store\b/.test(a.cacheControl ?? '')) {
        return { ok: false, detail: `${labelOf(a)}, but cache-control is ${a.cacheControl ?? 'missing'}, not no-store` };
    }
    return { ok: true, detail: noStore ? `${labelOf(a)}, no-store` : labelOf(a) };
}

// A burst whose first answer is already a refusal ran into a limit left over
// from before it, an earlier burst or run: it shows nothing.
function leftOver(answers: Answer[]): Verdict | null {
    const first = answers[0];
    if (!first) return { ok: false, detail: 'no answers' };
    if (first.status !== 429 && first.status !== 403) return null;
    return { ok: null, detail: `the first answer was already ${labelOf(first)}, a limit left over from before: wait a minute and run it again` };
}

// The routes' own per-visitor limit: past it, a 429 with `<feature>_busy`
// (or `_limit` once the day's is spent) and a Retry-After. A route can only
// count a visitor whose address the host passes on, so this is also the
// proof that it does: without one, the route counts no one.
export function judgeVisitorLimit(answers: Answer[], feature: string): Verdict {
    const early = leftOver(answers);
    if (early) return early;
    const stop = answers.find((a) => a.status !== 200);
    if (!stop) {
        return { ok: false, detail: `${tally(answers)}: never limited, so the route isn't counting (a limit_skipped log line means it gets no address)` };
    }
    if (isRouteLimit(stop) && stop.code?.startsWith(`${feature}_`) && stop.retryAfter) {
        return { ok: true, detail: `${tally(answers)}: ${stop.code} from #${stop.n}, Retry-After ${stop.retryAfter}` };
    }
    if (isFirewallLimit(stop)) {
        return { ok: false, detail: `${tally(answers)}: the firewall's 429 came first, at #${stop.n}, so its limit is below the route's` };
    }
    return { ok: false, detail: `${tally(answers)}: ${labelOf(stop)} at #${stop.n}` };
}

// The firewall's rate limit on requests the routes turn away without
// counting: they get `want` until the firewall's 429 cuts in. A burst that
// straddles two of its fixed windows can get twice `limit` through, and its
// counts lag a few seconds, so the 429 may come well after `limit`.
export function judgeRateLimited(answers: Answer[], want: Expected, limit: number): Verdict {
    const early = leftOver(answers);
    if (early) return early;
    const stop = answers.find((a) => !matches(a, want));
    if (!stop) {
        return { ok: false, detail: `${tally(answers)}: no 429 in ${answers.length}, so the rule is missing, unpublished, set above ${answers.length} a minute, or only logging` };
    }
    if (isFirewallLimit(stop)) {
        const soon = stop.n <= limit ? `, sooner than the ${limit} a minute it should allow` : '';
        return { ok: true, detail: `${tally(answers)}: the firewall's 429 from #${stop.n}${soon}` };
    }
    if (stop.status === 403 && !stop.code) {
        return { ok: false, detail: `${tally(answers)}: a 403 from #${stop.n}, so the rule denies past the limit instead of answering 429` };
    }
    if (stop.status === 429 && stop.mitigated === 'challenge') {
        return { ok: null, detail: `${tally(answers)}: a challenge at #${stop.n}, not the rate limit` };
    }
    return { ok: false, detail: `${tally(answers)}: ${labelOf(stop)} at #${stop.n}` };
}

// A path the rule has to leave out (/api/csp-report): never a 429.
export function judgeLeftOut(answers: Answer[], want: Expected): Verdict {
    const early = leftOver(answers);
    if (early) return early;
    const stop = answers.find((a) => !matches(a, want));
    if (!stop) return { ok: true, detail: `${tally(answers)}: never limited` };
    if (stop.status === 429) return { ok: false, detail: `${tally(answers)}: a 429 from #${stop.n}, so the rule counts this path` };
    return { ok: false, detail: `${tally(answers)}: ${labelOf(stop)} at #${stop.n}` };
}
