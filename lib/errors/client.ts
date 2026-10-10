// The browser's half of error reports (#20). What instrumentation-client.ts
// catches on any page (anything uncaught) and what the error pages catch
// (app/[lang]/error.tsx, app/global-error.tsx) is scrubbed here
// (lib/errors/scrub.ts) and posted to this site (app/api/error-report), whose
// server checks it again and sends it on to Sentry. The browser itself never
// talks to Sentry.
//
// Nothing is sent from a browser that switched counting off on /privacy or
// that sends Global Privacy Control (lib/analytics.ts), nor from a
// development build, which shows its errors on screen. Every page loads this
// before it's interactive, so it stays small and never throws.

import { analyticsState } from '../analytics';
import { ERROR_REPORT_PATH, type ClientReport, type ErrorKind } from './report';
import { frameLines, scrubMessage, scrubName, scrubPath } from './scrub';

// Reports from one page load, at most: a loop that keeps failing says all it
// has to in its first few.
export const MAX_REPORTS_PER_PAGE = 5;

export type ReporterDeps = {
    enabled: boolean;
    counted: () => boolean; // the visitor's choice, read for every report
    href: () => string;
    origin: () => string;
    post: (body: string) => void;
};

export function errorReporter({ enabled, counted, href, origin, post }: ReporterDeps) {
    const seen = new Set<string>();
    return (error: unknown, kind: ErrorKind): void => {
        try {
            if (!enabled || !(error instanceof Error) || seen.size >= MAX_REPORTS_PER_PAGE) return;
            // A server error reaches an error page with a digest and a stand-in
            // message; the server reported it already (lib/errors/requestError.ts).
            if (typeof (error as { digest?: unknown }).digest === 'string') return;
            // A request the page cancelled, and a browser's notice about resize
            // observers, are no one's error.
            if (error.name === 'AbortError' || /ResizeObserver loop/.test(error.message)) return;
            if (!counted()) return;
            const name = scrubName(error.name);
            const frames = frameLines(error.stack, error.message);
            // No frame from this site: a browser extension's error, which the
            // server would drop anyway.
            if (!frames.some((frame) => frame.includes(origin()))) return;
            const report: ClientReport = {
                kind,
                name,
                message: scrubMessage(name, error.message),
                frames,
                page: scrubPath(href()) ?? '/',
            };
            const key = `${report.name}|${report.message}|${frames[0]}`;
            if (seen.has(key)) return;
            seen.add(key);
            post(JSON.stringify(report));
        } catch {
            // A report that can't be made is no reason to fail again.
        }
    };
}

// Sent without cookies or the page's address as Referer, and kept alive so a
// report made as the page closes still goes.
function post(body: string): void {
    void fetch(ERROR_REPORT_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
    }).catch(() => {});
}

// Not reportError, the browser's own (window.reportError), which Next calls.
export const sendErrorReport = errorReporter({
    enabled: process.env.NODE_ENV === 'production',
    counted: () => analyticsState() === 'on',
    href: () => location.href,
    origin: () => location.origin,
    post,
});
