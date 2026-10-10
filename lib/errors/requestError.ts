// SERVER-ONLY: what instrumentation.ts's onRequestError writes down. Next calls
// it for a server error nothing else caught: a page or layout that failed to
// render (the Seva and Shabad pages throw on purpose while their source is
// down, so an outage isn't cached), a route without its own try/catch
// (seva/ics, shabad), a server action. Next has already printed the raw error
// itself; this is the line the logs can be searched by, and it goes to Sentry
// as an error line does (lib/log.ts, #20).
//
// Of the request, only its method, its path (scrubbed: Next's path includes
// the query) and Vercel's ID for it are read. Its other headers, cookies
// among them, are never touched.

import type { Instrumentation } from 'next';
import { describeError, logError, stackFrames } from '../log';
import { scrubPath } from './scrub';

type OnRequestError = Instrumentation.onRequestError;
type RequestInfo = Parameters<OnRequestError>[1];
type ErrorContext = Parameters<OnRequestError>[2];

// Vercel's ID for the request, the one its request log shows. Outside a
// route's withRequestLog (lib/log.ts), which isn't running here, it has to be
// read from the header.
function requestIdOf(headers: RequestInfo['headers']): string | undefined {
    const id = headers['x-vercel-id'];
    const value = Array.isArray(id) ? id[0] : id;
    return value ? value.slice(0, 120) : undefined;
}

// A server error's digest, which the error page's browser also gets, so the
// two can be matched up.
function digestOf(error: unknown): string | undefined {
    const digest = typeof error === 'object' && error !== null ? (error as { digest?: unknown }).digest : undefined;
    return typeof digest === 'string' ? digest.slice(0, 64) : undefined;
}

// Resolves once its line is written and its send is done; Next doesn't wait
// for this while a page renders, so the send is also handed to after().
export function logRequestError(error: unknown, request: RequestInfo, context: ErrorContext): Promise<void> {
    const requestId = requestIdOf(request.headers);
    return logError('request_error', {
        ...(requestId ? { requestId } : {}),
        path: scrubPath(request.path, 'http://request.invalid') ?? 'unknown',
        method: request.method,
        routePath: context.routePath,
        routeType: context.routeType,
        renderSource: context.renderSource,
        revalidateReason: context.revalidateReason,
        digest: digestOf(error),
        error: describeError(error),
        stack: stackFrames(error),
    });
}
