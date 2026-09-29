// SERVER-ONLY: structured logs, one JSON line per event, so the host's runtime
// logs can be searched by field. Never user text: no messages, replies,
// translations or query strings.
//
// Every line written while an API route handles a request carries that
// request's ID and route, however deep in the code it's written (the Gemini
// client, GurbaniNow, Cloud Translation). The ID is Vercel's own x-vercel-id,
// the same one Vercel's request log and the response's x-vercel-id header
// show, so a line leads straight to its request. Elsewhere it's a new UUID.

import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContext = { requestId: string; route: string };
const requests = new AsyncLocalStorage<RequestContext>();

function requestIdOf(req: Request): string {
    return req.headers.get('x-vercel-id')?.slice(0, 120) || crypto.randomUUID();
}

// Wraps an API route's handler, so its log lines carry the request's ID.
export function withRequestLog<Req extends Request, Res>(route: string, handler: (req: Req) => Promise<Res>) {
    return (req: Req): Promise<Res> => requests.run({ requestId: requestIdOf(req), route }, () => handler(req));
}

// Tests run the routes in-process; they switch logging off so their output
// stays readable.
const silenced = () => process.env.APP_LOG === 'off';

export function logEvent(evt: string, fields: object, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (silenced()) return;
    const line = JSON.stringify({ evt, ...requests.getStore(), ...fields });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
}

// An error, for a log line: its name and message. A SyntaxError's message can
// quote the text it failed to parse, which may be the user's, so only its name
// is kept.
export function describeError(error: unknown): string {
    if (!(error instanceof Error)) return typeof error;
    if (error instanceof SyntaxError) return error.name;
    return `${error.name}: ${error.message}`.slice(0, 300);
}

// Where an error was thrown: the top of its stack, frames only. A frame names
// a function and a file. The stack opens with the message, which may quote
// user text and run over several lines, so frames are read from below it.
function stackFrames(error: unknown, max = 6): string[] | undefined {
    if (!(error instanceof Error) || typeof error.stack !== 'string') return undefined;
    const at = error.message ? error.stack.indexOf(error.message) : -1;
    const below = at === -1 ? error.stack : error.stack.slice(at + error.message.length);
    const frames = below.split('\n').filter((line) => /^\s+at /.test(line));
    return frames.length ? frames.slice(0, max).map((frame) => frame.trim().slice(0, 200)) : undefined;
}

// An API route's unexpected failure: what went wrong and where.
export function logRouteError(error: unknown): void {
    logEvent('route_error', { error: describeError(error), stack: stackFrames(error) }, 'error');
}
