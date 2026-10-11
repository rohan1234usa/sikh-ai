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
// a name is words, of four letters or more on average and none of one, and
// short numbers. A shape can't tell every ID from a name (about 1 random
// 20-character ID in 1,400 passes), so where IDs are known to be (an
// address's ID segment, a Firestore path) they go by position instead.
export function readsAsWords(token: string): boolean {
    const words: string[] = [];
    for (const part of token.split(/[-_]+/)) {
        if (part === '' || /^[0-9]{1,4}$/.test(part)) continue;
        if (!/^[A-Za-z]+$/.test(part)) return false;
        words.push(...(part.match(WORDS) ?? []));
    }
    if (words.length === 0 || words.some((word) => word.length < 2)) return false;
    return words.reduce((sum, word) => sum + word.length, 0) / words.length >= 4;
}

// Text cut to at most `max` characters, without half a word at the end: an
// email or an ID cut short no longer looks like one to the rules that take
// them out, so its first part would go out whole.
export function cutWords(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max - GONE.length);
    return (/\S$/.test(cut) && /^\S/.test(text.slice(cut.length)) ? cut.replace(/\S+$/, '') : cut) + GONE;
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
// Pages whose next segment is an ID, besides the share and chat pages that
// lib/analytics.ts takes care of: a Seva event's, though not the board's own
// pages.
const ID_AFTER = new Map([['seva', new Set(['create', 'admin'])]]);

// A page's address as a report may give it: the path alone, with a share
// link's, a chat's or a Seva event's ID replaced (/seva/<event id> is
// /seva/:id), and anything else that looks like an ID. `base` lets a bare path
// through, such as Next's request path. Null when the address can't be read.
export function scrubPath(url: string, base?: string): string | null {
    let href: string;
    try {
        href = new URL(url, base).href;
    } catch {
        return null;
    }
    const redacted = redactAnalyticsUrl(href);
    if (redacted === null) return null;
    const segments = new URL(redacted).pathname.split('/');
    const path = segments.map((segment, i) => {
        if (TYPED_SEGMENT.test(segment)) return GONE;
        const pages = ID_AFTER.get(segments[i - 1]?.toLowerCase() ?? '');
        return pages && segment !== '' && !pages.has(segment.toLowerCase()) ? ID : segment;
    }).join('/');
    return withoutIds(path);
}

// An address in a message: its origin and scrubbed path, nothing else. Only
// http and https addresses keep anything, and one of the site's scripts keeps
// its name, which says which chunk failed to load.
const ADDRESS = /\b[a-z][a-z0-9+.-]*:\/\/[^\s'"`<>()]+/gi;
function scrubAddress(href: string): string {
    try {
        const url = new URL(href);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return `${url.protocol}//${GONE}`;
        if (url.pathname.startsWith('/_next/static/')) return `${url.origin}${url.pathname}`;
        return `${url.origin}${scrubPath(href) ?? `/${GONE}`}`;
    } catch {
        return GONE;
    }
}

// An email address, whatever its letters (an accented name, a domain in
// Gurmukhi) or its encoding (%40): anything either side of an @.
const EMAIL = /[^\s@'"`<>()[\]{}]+(?:@|%40)[^\s@'"`<>()[\]{}]+/gi;
// The site's own script addresses, whose names (hashes and all) the ID rule
// leaves alone: they're the same for every visitor.
const SCRIPT_ADDRESS = /\bhttps?:\/\/[^\s'"`<>()/]+\/_next\/static\/[^\s'"`<>()]*/g;
function exceptScripts(text: string, rule: (part: string) => string): string {
    let out = '';
    let last = 0;
    for (const match of text.matchAll(SCRIPT_ADDRESS)) {
        out += rule(text.slice(last, match.index)) + match[0];
        last = match.index + match[0].length;
    }
    return out + rule(text.slice(last));
}
// A query or fragment after a path, absolute or not (/api/shabad/search?q=…),
// up to the next space: parentheses and all, which an address can hold.
const QUERY = /([\w/.~-])[?#][^\s'"`<>]*/g;
// Engine messages that quote a value without quote marks around it: the
// value goes.
const ECHOES: [RegExp, string][] = [
    [/^(Cannot use 'in' operator to search for '[^']*' in )[\s\S]+$/, `$1${GONE}`],
    [/^(Promise resolver )[\s\S]+( is not a function)$/, `$1${GONE}$2`],
    [/^(Iterator value )[\s\S]+( is not an entry object)$/, `$1${GONE}$2`],
    [/^(URL constructor: )[\s\S]+( is not a valid URL\.?)$/, `$1${GONE}$2`],
];
// Where a payload starts: JSON, which an SDK's error can carry whole, model
// output included.
const PAYLOAD = /[{[]\s*["'{[]/;
// A quoted stretch, its quote marks matched and its first mark not inside a
// word (can't opens nothing).
const QUOTED = /(^|[^A-Za-z0-9])(["'`])([^"'`]*?)\2(?![A-Za-z0-9])/g;
// What may stay quoted: a name from code, such as 'map', 'a.b', '0',
// '#<Object>' or 'auth/popup-closed-by-user'.
const CODE_NAME = /^(?:\d{1,6}|[A-Za-z_$#@.:/[\]<>-][\w$#@.:/[\]<>-]{0,63})$/;
// A quote mark that opens something: not one inside a word (can't), and not
// one already closed (those are blanked out before this looks).
const OPENING_MARK = /(^|[^A-Za-z0-9])["'`]|["`]/;

// An error's message, as a report may give it. A SyntaxError's says only that
// it was one: its message quotes the text it couldn't parse.
export function scrubMessage(name: string, message: unknown): string {
    if (name === 'SyntaxError' || typeof message !== 'string') return '';
    let text = cutWords(message, MAX_SCANNED_CHARS);
    for (const [echo, keep] of ECHOES) text = text.replace(echo, keep);
    // Curly quotes count as quotes, and a quote mark escaped inside a quoted
    // string (as JSON writes one) doesn't end it.
    text = text.replace(/[\u201c\u201d\u201e\u00ab\u00bb]/g, '"').replace(/[\u2018\u2019\u201a]/g, "'").replace(/\\(["'`])/g, '');
    const payload = PAYLOAD.exec(text);
    if (payload) text = text.slice(0, payload.index) + GONE;
    text = exceptScripts(text.replace(QUERY, '$1').replace(ADDRESS, scrubAddress).replace(EMAIL, '[email]'), withoutIds)
        .replace(/[^\x00-\x7f]+/g, GONE)
        .replace(QUOTED, (_, before: string, mark: string, inner: string) =>
            before + mark + (CODE_NAME.test(inner) ? inner : GONE) + mark);
    // A quote mark left open would run on into whatever follows it, so the
    // message ends there.
    const closedBlanked = text.replace(QUOTED, (whole, before: string) => before + '_'.repeat(whole.length - before.length));
    const open = OPENING_MARK.exec(closedBlanked);
    if (open) text = text.slice(0, open.index + open[0].length - 1) + GONE;
    return cutWords(text.replace(/\s+/g, ' ').replace(/…(?: ?…)+/g, GONE).trim(), MAX_MESSAGE_CHARS);
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
