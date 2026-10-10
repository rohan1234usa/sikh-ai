// A browser's error report (#20): what lib/errors/client.ts posts to
// app/api/error-report, and how the server reads one. The browser scrubs a
// report before it leaves the page (lib/errors/scrub.ts), and the server
// scrubs it again here, since anyone can post anything.

import { frameLines, parseFrameLine, scrubMessage, scrubName, scrubPath, type ParsedFrame } from './scrub';

export const ERROR_REPORT_PATH = '/api/error-report';

// Where the browser caught it: the window's error or unhandledrejection
// event, or a page's error boundary (app/[lang]/error.tsx) or the root's
// (app/global-error.tsx).
export const ERROR_KINDS = ['uncaught', 'rejection', 'page', 'root'] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

// As posted.
export type ClientReport = { kind: ErrorKind; name: string; message: string; frames: string[]; page: string };

// As read: frames on this site only, each with its file as a report may
// give it.
export type ReadReport = Omit<ClientReport, 'frames'> & { frames: ParsedFrame[] };

// Where Next serves the site's scripts. A frame there keeps its full
// address, which is what Sentry fetches to find the source (source maps,
// next.config.ts); a frame anywhere else is an inline script, and its file is
// the page, so it gets the page's treatment.
const SCRIPTS = '/_next/static/';

function readFrame(line: string, origin: string): ParsedFrame | null {
    const frame = parseFrameLine(line);
    if (!frame) return null;
    let url: URL;
    try {
        url = new URL(frame.file);
    } catch {
        return null;
    }
    if (url.origin !== origin) return null;
    const file = url.pathname.startsWith(SCRIPTS) ? `${url.origin}${url.pathname}` : scrubPath(url.href);
    return file === null ? null : { ...frame, file };
}

// A posted report, read field by field and scrubbed again: null for anything
// that isn't one, or that has no frame on this site (a browser extension's
// error, or another site's script's, which reaches a page as "Script
// error."). Fields it doesn't know are ignored.
export function readClientReport(body: unknown, origin: string): ReadReport | null {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    const { kind, name, message, frames, page } = body as Record<string, unknown>;
    if (!ERROR_KINDS.includes(kind as ErrorKind) || typeof page !== 'string' || !Array.isArray(frames)) return null;
    const path = scrubPath(page, origin);
    const lines = frameLines(frames.filter((f): f is string => typeof f === 'string').join('\n'), '');
    const read = lines.map((line) => readFrame(line, origin)).filter((f): f is ParsedFrame => f !== null);
    if (path === null || read.length === 0) return null;
    const type = scrubName(name);
    return { kind: kind as ErrorKind, name: type, message: scrubMessage(type, message), frames: read, page: path };
}
