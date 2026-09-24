// Client-safe: a conversation as a list of exchanges. An exchange is one
// question and exactly one reply, and the reply always has a state — so a
// question can never sit in the history without one, which is how the old
// flat message list ended up showing the same unanswered question twice.
// Lens-switch notices are entries of their own.
//
// Everything that reads a transcript from storage (either store, a shared
// snapshot, the old single-chat format) goes through normalizeTranscript,
// which treats the input as untrusted and repairs what it can.

import { sanitizeCitations, type Citation } from '@/lib/gurbani/citations';
import {
    MAX_EXCHANGES_PER_CHAT,
    MAX_MESSAGE_CHARS,
    MAX_REPLY_CHARS,
    isLanguageId,
    isLensId,
    isModeId,
    isScript,
    type LanguageId,
    type LensId,
    type ModeId,
    type Script,
} from './config';

// Keys of t.errors a reply can fail with (a test holds them to the
// dictionary). Stored as the key, not the text, so a failed reply follows
// a language switch like everything else on the page.
export const REPLY_ERROR_CODES = ['generic', 'chat_busy', 'chat_blocked', 'chat_failed', 'chat_too_long', 'chat_empty'] as const;
export type ReplyErrorCode = (typeof REPLY_ERROR_CODES)[number];
export const isReplyErrorCode = (v: unknown): v is ReplyErrorCode => REPLY_ERROR_CODES.includes(v as ReplyErrorCode);

// streaming: still arriving (memory only; saved as interrupted or stopped)
// done:        finished on its own terms
// interrupted: cut short with some text (Stop, a dropped stream, the cap)
// stopped:     ended before any text arrived
// error:       the request failed; errorCode says how
export const REPLY_STATUSES = ['streaming', 'done', 'interrupted', 'stopped', 'error'] as const;
export type ReplyStatus = (typeof REPLY_STATUSES)[number];

// What the reply was asked for, as sent: its label reads from this.
export type ReplySettings = { lensId: LensId; modeId: ModeId; languageId: LanguageId; script?: Script };

export type Reply = {
    id: string;              // new for every attempt, so a late write from an old one can be refused
    status: ReplyStatus;
    text: string;            // '' when stopped or error
    errorCode?: ReplyErrorCode;
    settings?: ReplySettings; // absent on replies from before labels, which then show none
    citations?: Citation[];
    startedAt: number;
    finishedAt?: number;
};

export type Exchange = {
    kind: 'exchange';
    id: string;
    order: number;
    question: { text: string; createdAt: number };
    reply: Reply;
};

// "Now answering through the lens of …". Stores the lens and is worded at
// render time; `text` only on notices carried over from the old format.
export type Notice = {
    kind: 'notice';
    id: string;
    order: number;
    createdAt: number;
    lensId: LensId | null;
    text?: string;
};

export type Entry = Exchange | Notice;
export type Transcript = Entry[];

const MAX_ID_CHARS = 100;
const MAX_NOTICE_CHARS = 300;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const idOf = (v: unknown): string | null =>
    typeof v === 'string' && v.length > 0 && v.length <= MAX_ID_CHARS ? v : null;

export function hasText(s: string): boolean {
    return s.trim() !== '';
}

// Same question, typed again: case, spacing and Unicode composition aside.
export function sameQuestion(a: string, b: string): boolean {
    const norm = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
    return norm(a) === norm(b);
}

export function sanitizeSettings(raw: unknown): ReplySettings | undefined {
    if (!isObj(raw)) return undefined;
    const { lensId, modeId, languageId, script } = raw;
    if (!isLensId(lensId) || !isModeId(modeId) || !isLanguageId(languageId)) return undefined;
    if (script !== undefined && !isScript(script)) return undefined;
    return { lensId, modeId, languageId, ...(script ? { script } : {}) };
}

// Status and text have to agree; where they don't, the text decides.
function reconcile(status: ReplyStatus, text: string, allowStreaming: boolean): { status: ReplyStatus; text: string; generic?: true } {
    const has = hasText(text);
    switch (status) {
        case 'streaming':
            if (allowStreaming) return { status, text };
            return has ? { status: 'interrupted', text } : { status: 'stopped', text: '' };
        case 'done':
            return has ? { status, text } : { status: 'error', text: '', generic: true };
        case 'interrupted':
            return has ? { status, text } : { status: 'stopped', text: '' };
        case 'stopped':
            return has ? { status: 'interrupted', text } : { status, text: '' };
        case 'error':
            return { status, text: '' };
    }
}

export function normalizeReply(raw: unknown, fallback: { id: string; startedAt: number }, allowStreaming = false): Reply {
    const o = isObj(raw) ? raw : {};
    const rawStatus = REPLY_STATUSES.includes(o.status as ReplyStatus) ? (o.status as ReplyStatus) : 'stopped';
    const rawText = typeof o.text === 'string' ? o.text.slice(0, MAX_REPLY_CHARS) : '';
    const { status, text, generic } = reconcile(rawStatus, rawText, allowStreaming);
    const settings = sanitizeSettings(o.settings);
    const citations = status === 'error' || status === 'stopped' ? [] : sanitizeCitations(o.citations);
    return {
        id: idOf(o.id) ?? fallback.id,
        status,
        text,
        ...(status === 'error' ? { errorCode: !generic && isReplyErrorCode(o.errorCode) ? o.errorCode : 'generic' } : {}),
        ...(settings ? { settings } : {}),
        ...(citations.length ? { citations } : {}),
        startedAt: isNum(o.startedAt) ? o.startedAt : fallback.startedAt,
        ...(isNum(o.finishedAt) ? { finishedAt: o.finishedAt } : {}),
    };
}

function parseEntry(raw: unknown, allowStreaming: boolean): Entry | null {
    if (!isObj(raw)) return null;
    const id = idOf(raw.id);
    if (!id || !isNum(raw.order)) return null;
    const order = raw.order;
    if (raw.kind === 'exchange') {
        const q = isObj(raw.question) ? raw.question : null;
        const text = typeof q?.text === 'string' ? q.text.slice(0, MAX_MESSAGE_CHARS) : '';
        if (!hasText(text)) return null;
        const createdAt = isNum(q?.createdAt) ? q.createdAt : order;
        return {
            kind: 'exchange',
            id,
            order,
            question: { text, createdAt },
            reply: normalizeReply(raw.reply, { id: `${id}:reply`, startedAt: createdAt }, allowStreaming),
        };
    }
    if (raw.kind === 'notice') {
        const lensId = isLensId(raw.lensId) ? raw.lensId : null;
        const text = typeof raw.text === 'string' && hasText(raw.text) ? raw.text.slice(0, MAX_NOTICE_CHARS) : undefined;
        if (!lensId && !text) return null;
        return {
            kind: 'notice',
            id,
            order,
            createdAt: isNum(raw.createdAt) ? raw.createdAt : order,
            lensId,
            ...(text && !lensId ? { text } : {}),
        };
    }
    return null;
}

const retryable = (r: Reply) => r.status === 'error' || r.status === 'stopped';

// The one path from storage into memory. Drops what can't be read, fixes what
// can be, and repairs the history the old format could produce:
//  - an exchange that failed or was stopped, followed by the same question
//    asked again, is dropped: it was a retry, not a second question
//  - a notice counts only once an exchange follows it; of several in a row
//    only the last one stands
//  - at most MAX_EXCHANGES_PER_CHAT exchanges, the latest, always whole.
// Normalizing twice changes nothing.
export function normalizeTranscript(raw: unknown, opts: { allowStreaming?: boolean } = {}): Transcript {
    const parsed = (Array.isArray(raw) ? raw : [])
        .map((e) => parseEntry(e, opts.allowStreaming ?? false))
        .filter((e): e is Entry => e !== null);

    // One entry per id, the later one winning; then a stable sort by order.
    const byId = new Map<string, Entry>();
    for (const e of parsed) {
        byId.delete(e.id);
        byId.set(e.id, e);
    }
    const sorted = [...byId.values()].sort((a, b) => a.order - b.order);

    // Retries of a failed question: keep only the last attempt.
    const kept: Entry[] = [];
    for (let i = 0; i < sorted.length; i++) {
        const e = sorted[i];
        if (e.kind === 'exchange' && retryable(e.reply)) {
            const next = sorted.slice(i + 1).find((x): x is Exchange => x.kind === 'exchange');
            if (next && sameQuestion(next.question.text, e.question.text)) continue;
        }
        kept.push(e);
    }

    // Notices: only directly before an exchange, and only the last of a run.
    const tidy: Entry[] = [];
    for (let i = 0; i < kept.length; i++) {
        const e = kept[i];
        if (e.kind === 'notice' && kept[i + 1]?.kind !== 'exchange') continue;
        tidy.push(e);
    }
    // A notice before the very first exchange says nothing the greeting doesn't.
    while (tidy[0]?.kind === 'notice') tidy.shift();

    // The latest exchanges, whole, with the notices between them.
    const exchanges = tidy.filter((e) => e.kind === 'exchange');
    if (exchanges.length <= MAX_EXCHANGES_PER_CHAT) return tidy;
    const firstKept = exchanges[exchanges.length - MAX_EXCHANGES_PER_CHAT];
    return tidy.slice(tidy.indexOf(firstKept));
}

// What goes to storage: a reply still streaming is saved as it would stand if
// the page went away now, so a reload shows a reply that can be retried. Built
// the way a load builds it, so it holds no undefined values (which Firestore
// rejects) and reads back unchanged.
export function toStoredEntry(e: Entry): Entry {
    const stored = parseEntry(e, false);
    if (!stored) throw new Error(`Chat entry ${e.id} is not storable`);
    return stored;
}

// ── The old format (sikhai.chat.v1 / v2) ───────────────────────────────────

type LegacyMessage = {
    id: string;
    role: 'user' | 'ai' | 'notice';
    text: string;
    createdAt: number;
    isError?: boolean;
    interrupted?: boolean;
    citations?: unknown;
};

function parseLegacy(raw: unknown): LegacyMessage | null {
    if (!isObj(raw)) return null;
    const id = idOf(raw.id);
    if (!id || typeof raw.text !== 'string') return null;
    if (raw.role !== 'user' && raw.role !== 'ai' && raw.role !== 'notice') return null;
    return {
        id,
        role: raw.role,
        text: raw.text,
        createdAt: isNum(raw.createdAt) ? raw.createdAt : 0,
        isError: raw.isError === true,
        interrupted: raw.interrupted === true,
        citations: raw.citations,
    };
}

// The old flat list: user and AI messages, lens notices, and a hard-coded
// greeting. A question with no reply after it gets a stopped one, which the
// repair in normalizeTranscript then drops if the question was asked again.
export function fromLegacyMessages(raw: unknown): Transcript {
    const messages = (Array.isArray(raw) ? raw : []).map(parseLegacy).filter((m): m is LegacyMessage => m !== null);
    const out: Entry[] = [];
    let open: { id: string; question: Exchange['question'] } | null = null;
    // A notice written while a reply was still coming goes after that reply.
    let held: Notice[] = [];

    const close = (reply: Reply) => {
        if (!open) return;
        out.push({ kind: 'exchange', id: open.id, order: 0, question: open.question, reply }, ...held);
        open = null;
        held = [];
    };
    const stopped = (): Reply =>
        ({ id: `${open!.id}:none`, status: 'stopped', text: '', startedAt: open!.question.createdAt });

    for (const m of messages) {
        if (m.id === 'greeting') continue;
        if (m.role === 'user') {
            if (open) close(stopped());
            open = { id: m.id, question: { text: m.text, createdAt: m.createdAt } };
        } else if (m.role === 'ai') {
            if (!open) continue; // an answer to nothing, like the greeting
            close(normalizeReply(
                m.isError
                    ? { id: m.id, status: 'error', errorCode: 'generic', text: '' }
                    // An empty one was a reply cut off before it began: stopped.
                    : { id: m.id, status: m.interrupted || !hasText(m.text) ? 'interrupted' : 'done', text: m.text, citations: m.citations },
                { id: m.id, startedAt: m.createdAt },
            ));
        } else if (hasText(m.text)) {
            const notice: Notice = { kind: 'notice', id: m.id, order: 0, createdAt: m.createdAt, lensId: null, text: m.text };
            if (open) held.push(notice);
            else out.push(notice);
        }
    }
    if (open) close(stopped());

    // Orders follow the list, rising strictly even where timestamps collide.
    let last = -Infinity;
    for (const e of out) {
        e.order = last = Math.max(e.kind === 'exchange' ? e.question.createdAt : e.createdAt, last + 1);
    }
    return normalizeTranscript(out);
}
