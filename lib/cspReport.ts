// What a browser's CSP violation report says, reduced to what the log needs:
// the directive, where the blocked thing came from (an origin, or a keyword
// such as inline or eval), and the page's path. Never a full URL (a query
// string can hold user text) and never the code sample.
//
// Two formats arrive: report-uri's { "csp-report": {…} } and the Reporting
// API's [{ type: "csp-violation", body: {…} }].

export type CspViolation = { directive: string; blocked: string; page: string };

// More than enough for one page's worth; the rest of a flood is dropped.
export const MAX_REPORTS_PER_REQUEST = 20;

const KEYWORD = /^[a-z-]{1,40}$/; // inline, eval, wasm-eval, data, blob, self, …

function origin(value: unknown): string {
    if (typeof value !== 'string' || value === '') return 'none';
    if (KEYWORD.test(value)) return value;
    try {
        const url = new URL(value);
        // data:, blob: and friends have no origin worth logging.
        return url.origin === 'null' ? url.protocol.replace(/:$/, '') : url.origin;
    } catch {
        return 'unknown';
    }
}

function path(value: unknown): string {
    if (typeof value !== 'string') return 'unknown';
    try {
        return new URL(value).pathname.slice(0, 120);
    } catch {
        return 'unknown';
    }
}

function directive(value: unknown): string {
    return typeof value === 'string' && KEYWORD.test(value) ? value : 'unknown';
}

type Fields = Record<string, unknown>;
const asFields = (v: unknown): Fields | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Fields) : null);

export function summarizeCspReports(body: unknown): CspViolation[] {
    const raw: Fields[] = [];
    if (Array.isArray(body)) {
        for (const report of body) {
            const r = asFields(report);
            const b = r?.type === 'csp-violation' ? asFields(r.body) : null;
            if (b) raw.push({ directive: b.effectiveDirective, blocked: b.blockedURL, page: b.documentURL });
        }
    } else {
        const b = asFields(asFields(body)?.['csp-report']);
        if (b) raw.push({ directive: b['effective-directive'] ?? b['violated-directive'], blocked: b['blocked-uri'], page: b['document-uri'] });
    }
    return raw.slice(0, MAX_REPORTS_PER_REQUEST).map((r) => ({
        directive: directive(r.directive),
        blocked: origin(r.blocked),
        page: path(r.page),
    }));
}
