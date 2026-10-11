// What an error report may say (#20): what failed and where in the site's
// code, never what anyone wrote. The browser's reporter (lib/errors/client.ts)
// runs these rules before a report leaves the page, and the server
// (app/api/error-report, lib/errors/sentry.ts) runs them again on whatever
// arrives, and on its own errors, before anything reaches Sentry. Pure, and
// small on purpose: the browser's half ships on every page.
//
// An error's message is mostly an engine's or a library's own English, but
// some quote what they choked on. A SyntaxError quotes the text it failed to
// parse; Firestore names document paths, account IDs and all; an address can
// carry a share link's ID or what was searched for. So a message keeps its
// words and loses anything that could be the visitor's: quoted text that
// isn't a name from code, anything outside ASCII (Gurmukhi), email
// addresses, IDs, and every address's query.

import { redactAnalyticsUrl } from '../analytics';

export const MAX_MESSAGE_CHARS = 300;
export const MAX_FRAMES = 30;
const MAX_FRAME_CHARS = 300;
// Plenty to fill a message's 300 characters once the rules have taken their
// share; the rules read this much at most, so a long message costs no more.
const MAX_SCANNED_CHARS = 1_000;

// What stands in for anything taken out, and for an ID, as lib/analytics.ts
// writes one in an address.
const GONE = '…';
const ID = ':id';

// The site's Firestore collections (firestore.rules; a test holds the two
// equal). In a document path, what follows one is a document's ID: an
// account, a chat, a share link, an event.
export const FIRESTORE_COLLECTIONS = [
    'admins', 'chats', 'entries', 'seva_events', 'seva_hosting', 'seva_reports',
    'seva_signups', 'shared_chats', 'shares', 'users', 'volunteers',
];
const DOCUMENT = new RegExp(`\\b(${FIRESTORE_COLLECTIONS.join('|')})/[^\\s/'"\`()<>,;]+`, 'g');

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const LONG_TOKEN = /[A-Za-z0-9_-]{16,}/g;
// A run of letters split into its words: an acronym, a word, or a lone capital.
const WORDS = /[A-Z]{2,}(?![a-z])|[A-Z]?[a-z]+|[A-Z]/g;

// Whether a long token reads as a name from code or a page's slug
// (getBoundingClientRect, NS_ERROR_FAILURE, popup-closed-by-user,
// rows-3-4-palatal-retroflex) rather than an ID. Between its separators, an ID
// mixes letters and digits, or flips case every letter or two (AbCdEfGhIj…);
// a name is words, of three letters or more on average and none of one, and
// short numbers.
export function readsAsWords(token: string): boolean {
    const words: string[] = [];
    for (const part of token.split(/[-_]+/)) {
        if (part === '' || /^[0-9]{1,4}$/.test(part)) continue;
        if (!/^[A-Za-z]+$/.test(part)) return false;
        words.push(...(part.match(WORDS) ?? []));
    }
    if (words.length === 0 || words.some((word) => word.length < 2)) return false;
    return words.reduce((sum, word) => sum + word.length, 0) / words.length >= 3;
}

function withoutIds(text: string): string {
    return text
        .replace(DOCUMENT, `$1/${ID}`)
        .replace(UUID, ID)
        .replace(LONG_TOKEN, (token) => (readsAsWords(token) ? token : ID));
}

// A path segment no page of the site has: one that isn't plain ASCII, or is
// percent-encoded, which means something typed into the address bar.
const TYPED_SEGMENT = /%|[^\x20-\x7e]/;

// A page's address as a report may give it: the path alone, with a share
// link's or a chat's ID replaced (lib/analytics.ts), and any other ID too, so
// /seva/<event id> is /seva/:id. `base` lets a bare path through, such as
// Next's request path. Null when the address can't be read.
export function scrubPath(url: string, base?: string): string | null {
    let href: string;
    try {
        href = new URL(url, base).href;
    } catch {
        return null;
    }
    const redacted = redactAnalyticsUrl(href);
    if (redacted === null) return null;
    const path = new URL(redacted).pathname
        .split('/')
        .map((segment) => (TYPED_SEGMENT.test(segment) ? GONE : segment))
        .join('/');
    return withoutIds(path);
}

// An address in a message: its origin and scrubbed path, nothing else. Only
// http and https addresses keep anything.
const ADDRESS = /\b[a-z][a-z0-9+.-]*:\/\/[^\s'"`<>()]+/gi;
function scrubAddress(href: string): string {
    try {
        const url = new URL(href);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return `${url.protocol}//${GONE}`;
        return `${url.origin}${scrubPath(href) ?? `/${GONE}`}`;
    } catch {
        return GONE;
    }
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Where a payload starts: JSON, which an SDK's error can carry whole, model
// output included.
const PAYLOAD = /[{[]\s*["'{[]/;
// A quoted stretch, its quote marks matched and its first mark not inside a
// word (can't opens nothing).
const QUOTED = /(^|[^A-Za-z0-9])(["'`])([^"'`]*?)\2(?![A-Za-z0-9])/g;
// What may stay quoted: a name from code, such as 'map', 'a.b' or
// 'auth/popup-closed-by-user'.
const CODE_NAME = /^[A-Za-z_$#@.:/[\]-][\w$#@.:/[\]-]{0,63}$/;
// A quote mark that opens something: not one inside a word (can't), and not
// one already closed (those are blanked out before this looks).
const OPENING_MARK = /(^|[^A-Za-z0-9])["'`]|["`]/;

// An error's message, as a report may give it. A SyntaxError's says only that
// it was one: its message quotes the text it couldn't parse.
export function scrubMessage(name: string, message: unknown): string {
    if (name === 'SyntaxError' || typeof message !== 'string') return '';
    let text = message.slice(0, MAX_SCANNED_CHARS);
    const payload = PAYLOAD.exec(text);
    if (payload) text = text.slice(0, payload.index) + GONE;
    text = withoutIds(text.replace(ADDRESS, scrubAddress).replace(EMAIL, '[email]'))
        .replace(/[^\x00-\x7f]+/g, GONE)
        .replace(QUOTED, (_, before: string, mark: string, inner: string) =>
            before + mark + (CODE_NAME.test(inner) ? inner : GONE) + mark);
    // A quote mark left open would run on into whatever follows it, so the
    // message ends there.
    const closedBlanked = text.replace(QUOTED, (whole, before: string) => before + '_'.repeat(whole.length - before.length));
    const open = OPENING_MARK.exec(closedBlanked);
    if (open) text = text.slice(0, open.index + open[0].length - 1) + GONE;
    return text.replace(/\s+/g, ' ').replace(/…(?: ?…)+/g, GONE).trim().slice(0, MAX_MESSAGE_CHARS);
}

// An error's name, if it reads as one (TypeError, FirebaseError); otherwise
// just Error, since a thrown object can call itself anything.
export const scrubName = (name: unknown): string =>
    typeof name === 'string' && /^[A-Za-z_$][\w$]{0,63}$/.test(name) ? name : 'Error';

// One stack frame: V8's `    at fn (url:line:col)` or `    at url:line:col`,
// or Firefox's and Safari's `fn@url:line:col`. Firefox names what led to an
// async frame before a star: `async*fn@…`, `promise callback*fn@…`.
const V8_FRAME = /^\s*at (?:async )?(?:(.*?) \()?(.+?):(\d+):(\d+)\)?\s*$/;
const AT_FRAME = /^\s*(?:[^@*]*\*)?([^@\s]*(?: code)?)@(.+?):(\d+):(\d+)\s*$/;
// A frame's address loses its query and fragment (?dpl=… on Vercel), its
// line and column kept.
const FRAME_QUERY = /[?#][^\s:()]*(?=:\d+:\d+\)?\s*$)/;

// A stack's line as a frame, without its query; null if it isn't one. Its
// length is checked before any pattern runs: a report's lines come from
// anyone, and FRAME_QUERY slows down on a long run of '?' (a 16 KB line took
// over a second). A real frame's query is short.
export function frameLine(raw: string): string | null {
    const trimmed = raw.trim();
    if (trimmed.length > 2 * MAX_FRAME_CHARS) return null;
    const line = trimmed.replace(FRAME_QUERY, '');
    return line.length <= MAX_FRAME_CHARS && (V8_FRAME.test(line) || AT_FRAME.test(line)) ? line : null;
}

// The frames of a stack, as text, top first. V8 opens its stack with the
// message, which can quote user text over several lines, so its lines are
// read only from below the message. Firefox and Safari give frames alone,
// and their stack opens with one: there the message isn't looked for, since
// a short one ('x') can turn up inside a frame's address.
export function frameLines(stack: unknown, message: unknown): string[] {
    if (typeof stack !== 'string') return [];
    const text = typeof message === 'string' ? message : '';
    const at = text && frameLine(stack.split('\n', 1)[0]) === null ? stack.indexOf(text) : -1;
    const below = at === -1 ? stack : stack.slice(at + text.length);
    const frames: string[] = [];
    for (const raw of below.split('\n')) {
        const line = frameLine(raw);
        if (line) frames.push(line);
        if (frames.length === MAX_FRAMES) break;
    }
    return frames;
}

export type ParsedFrame = { fn?: string; file: string; line: number; column: number };

// What may name a frame's function: a name from code, as an engine writes it
// (Array.map, fn/<, new Foo, async fn, global code). Anything else, which
// could only have come from a forged stack, is left out.
const FUNCTION_NAME = /^(?:(?:new|async) )?[\w$.<>/[\]*-]{1,100}$|^(?:global|eval|module) code$/;

// A frame line read back into its parts, or null if it isn't one.
export function parseFrameLine(line: string): ParsedFrame | null {
    const m = V8_FRAME.exec(line) ?? AT_FRAME.exec(line);
    if (!m) return null;
    const [, fn, file, lineNo, column] = m;
    return {
        ...(fn && FUNCTION_NAME.test(fn) ? { fn } : {}),
        file,
        line: Number(lineNo),
        column: Number(column),
    };
}
