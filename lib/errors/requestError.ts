// SERVER-ONLY: what instrumentation.ts's onRequestError writes down. Next calls
// it for a server error nothing else caught: a page or layout that failed to
// render, a route without its own try/catch (seva/ics, shabad), a server
// action. Next has already printed the raw error itself; this is the line the
// logs can be searched by, and it goes to Sentry as an error line does
// (lib/log.ts, #20). The Seva and Shabad pages also throw on purpose while
// their source is down, so an outage isn't cached (SourceUnavailable): that
// passes on its own, so it's a warning, and isn't sent.
//
// Of the request, only its method, its path (scrubbed: Next's path includes
// the query) and Vercel's ID for it are read. Its other headers, cookies
// among them, are never touched.

import type { Instrumentation } from 'next';
import { describeError, logError, logEvent, stackFrames, vercelRequestId } from '../log';
import { scrubPath } from './scrub';

type OnRequestError = Instrumentation.onRequestError;
type RequestInfo = Parameters<OnRequestError>[1];
type ErrorContext = Parameters<OnRequestError>[2];

// A server error's digest, which the error page's browser also gets, so the
// two can be matched up.
function digestOf(error: unknown): string | undefined {
    const digest = typeof error === 'object' && error !== null ? (error as { digest?: unknown }).digest : undefined;
    return typeof digest === 'string' ? digest.slice(0, 64) : undefined;
}

// Next can report one failure twice, under two names: the render reports
// /[lang]/seva/[id], and when the error stops the page altogether (an ISR
// page's render), the page's handler reports it again as
// /[lang]/seva/[id]/page; a route handler's name ends in /route. One name
// makes the two one issue, and the sender holds the second back as a repeat.
const routeOf = (routePath: string) => routePath.replace(/\/(?:page|route)$/, '') || '/';

// Resolves once its line is written and its send is handed to the platform
// (lib/log.ts, sendInBackground). Next awaits this hook before it sends a
// failed route's 500, so the send must not be waited for here.
export function logRequestError(error: unknown, request: RequestInfo, context: ErrorContext): Promise<void> {
    // Vercel's ID for the request: outside a route's withRequestLog
    // (lib/log.ts), which isn't running here, it's read from the header.
    const requestId = vercelRequestId(request.headers['x-vercel-id']);
    const fields = {
        ...(requestId ? { requestId } : {}),
        path: scrubPath(request.path, 'http://request.invalid') ?? 'unknown',
        method: request.method,
        routePath: routeOf(context.routePath),
        routeType: context.routeType,
        renderSource: context.renderSource,
        revalidateReason: context.revalidateReason,
        digest: digestOf(error),
        error: describeError(error),
        stack: stackFrames(error),
    };
    if (error instanceof Error && error.name === 'SourceUnavailable') {
        logEvent('request_error', fields, 'warn');
        return Promise.resolve();
    }
    return logError('request_error', fields);
}
