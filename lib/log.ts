// SERVER-ONLY: structured logs, one JSON line per event, so the host's runtime
// logs can be searched by field. Never user text: no messages, replies,
// translations or query strings.
//
// Every line written while an API route handles a request carries that
// request's ID and route, however deep in the code it's written (the Gemini
// client, GurbaniNow, Cloud Translation). The ID is Vercel's own x-vercel-id,
// the same one Vercel's request log and the response's x-vercel-id header
// show, so a line leads straight to its request. Elsewhere it's a new UUID.
//
// An error line is one the owner has to act on, so it goes to Sentry too
// (lib/errors/sentry.ts, #20), when SENTRY_DSN is set: a route's unexpected
// failure, a missing key, a Firestore query that needs an index, a Gemini call
// that waiting won't fix, a page that failed to render (instrumentation.ts).
// What passes on its own is a warning, and stays in the logs.

import { AsyncLocalStorage } from 'node:async_hooks';
import { logLineEvent, sentry, type Outgoing } from './errors/sentry';
import { frameLines } from './errors/scrub';

type RequestContext = { requestId: string; route: string };
const requests = new AsyncLocalStorage<RequestContext>();

function requestIdOf(req: Request): string {
    return req.headers.get('x-vercel-id')?.slice(0, 120) || crypto.randomUUID();
}

// The ID of the request this is running for, inside withRequestLog.
export const currentRequestId = (): string | undefined => requests.getStore()?.requestId;

// Wraps an API route's handler, so its log lines carry the request's ID.
export function withRequestLog<Req extends Request, Res>(route: string, handler: (req: Req) => Promise<Res>) {
    return (req: Req): Promise<Res> => requests.run({ requestId: requestIdOf(req), route }, () => handler(req));
}

// Tests run the routes in-process; they switch logging off so their output
// stays readable.
const silenced = () => process.env.APP_LOG === 'off';

type Level = 'info' | 'warn' | 'error';

// Writes a line: the line as written, or null with logging off.
function write(evt: string, fields: object, level: Level): Record<string, unknown> | null {
    if (silenced()) return null;
    const line = { evt, ...requests.getStore(), ...fields };
    const text = JSON.stringify(line);
    if (level === 'error') console.error(text);
    else if (level === 'warn') console.warn(text);
    else console.log(text);
    return line;
}

export function logEvent(evt: string, fields: object, level: Level = 'info'): void {
    if (level === 'error') void logError(evt, fields);
    else write(evt, fields, level);
}

// An error line, which goes on to Sentry (sendInBackground). instrumentation.ts
// waits for what this returns.
export function logError(evt: string, fields: object): Promise<void> {
    const line = write(evt, fields, 'error');
    return line ? sendInBackground(logLineEvent(evt, line)) : Promise.resolve();
}

// A send that failed: said once in five minutes at most, and as a warning,
// since an error line would try to send again.
const FAILED_SEND_NOTE_MS = 5 * 60_000;
let failedSendNoted = -Infinity;

// The platform's way to keep a function running after its response (Vercel's
// waitUntil), found where Next's own after() finds it (the after() docs,
// "supporting after for serverless platforms"). Unlike after(), it's there
// for the whole of a request, onRequestError included, which Next awaits
// before it sends a failed route's 500 (instrumentation.ts).
type PlatformContext = { get(): { waitUntil?: (promise: Promise<unknown>) => void } | undefined };
const PLATFORM_CONTEXT = Symbol.for('@next/request-context');
const platformWaitUntil = () => (globalThis as { [PLATFORM_CONTEXT]?: PlatformContext })[PLATFORM_CONTEXT]?.get()?.waitUntil;

// Sends an event to Sentry without holding up the response: the send goes to
// the platform, which lets it finish after the response has gone, and this
// resolves at once. With no platform (a test, a script, a server run by
// hand), it resolves when the send is done, for a caller that waits. Never
// rejects.
export function sendInBackground(outgoing: Outgoing): Promise<void> {
    const sending = sentry.send(outgoing).then((sent) => {
        const now = Date.now();
        if (sent.result !== 'failed' || now - failedSendNoted < FAILED_SEND_NOTE_MS) return;
        failedSendNoted = now;
        write('error_report_failed', sent.status === undefined ? {} : { status: sent.status }, 'warn');
    });
    const waitUntil = platformWaitUntil();
    if (!waitUntil) return sending;
    waitUntil(sending);
    return Promise.resolve();
}

// An error, for a log line: its name and message. A SyntaxError's message can
// quote the text it failed to parse, which may be the user's, so only its name
// is kept.
export function describeError(error: unknown): string {
    if (!(error instanceof Error)) return typeof error;
    if (error instanceof SyntaxError) return error.name;
    return `${error.name}: ${error.message}`.slice(0, 300);
}

// Where an error was thrown: the top of its stack, frames only, read as error
// reports read a browser's (lib/errors/scrub.ts). A frame names a function and
// a file. The stack opens with the message, which may quote user text and run
// over several lines, so frames are read from below it.
export function stackFrames(error: unknown, max = 6): string[] | undefined {
    if (!(error instanceof Error)) return undefined;
    const frames = frameLines(error.stack, error.message).slice(0, max);
    return frames.length ? frames : undefined;
}

// An API route's unexpected failure: what went wrong and where.
export function logRouteError(error: unknown): void {
    logEvent('route_error', { error: describeError(error), stack: stackFrames(error) }, 'error');
}
