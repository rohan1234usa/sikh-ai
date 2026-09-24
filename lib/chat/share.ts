// Client-safe, pure: a chat's public, read-only snapshot, as stored in
// shared_chats/{shareId} and read back by anyone holding the link.
//
// The snapshot is taken when the link is made (or updated); what the chat
// says afterwards stays private until the owner updates the link. It holds
// the answered exchanges and nothing about who shared it.

import { sanitizeChatContext, type ChatContext } from './config';
import { sanitizeTitle, type ChatMeta, type ShareRef } from './chatMeta';
import { hasText, normalizeTranscript, toStoredEntry, type Entry, type Exchange, type Notice, type Transcript } from './transcript';
import type { ChatRecord } from './store/types';

export const SHARE_VERSION = 1;
// Firestore holds at most 1 MiB per document. Measured in UTF-8, where a
// Gurmukhi letter takes 3 bytes, and kept well clear of the limit.
export const MAX_SHARE_BYTES = 900_000;

export type ShareDoc = {
    v: number;
    ownerUid: string;
    chatId: string;
    title: string;
    // JSON of SharePayload: one string field keeps the document (and its
    // rules) simple however long the chat is.
    payload: string;
    createdAt: number;
    updatedAt: number;
};

type SharePayload = { context: ChatContext | null; entries: Entry[]; truncated: boolean };

export type Snapshot = { payload: string; lastOrder: number; count: number; truncated: boolean };

export type SharedChat = {
    title: string;
    createdAt: number;
    updatedAt: number;
    context: ChatContext | null;
    transcript: Transcript;
    truncated: boolean;
};

const answered = (e: Exchange) => (e.reply.status === 'done' || e.reply.status === 'interrupted') && hasText(e.reply.text);
const utf8 = (s: string) => new TextEncoder().encode(s).length;

// The answered exchanges, each lens notice kept only where an answer
// follows it. Failed and stopped attempts have nothing to show a reader.
function shareable(t: Transcript): Entry[] {
    const out: Entry[] = [];
    let notice: Notice | null = null;
    for (const e of t) {
        if (e.kind === 'notice') {
            notice = e;
        } else if (answered(e)) {
            if (notice) out.push(notice);
            notice = null;
            out.push(toStoredEntry(e));
        }
    }
    return out;
}

// Too long to share whole: the citation cards of the oldest answers go first,
// then the oldest exchanges themselves, and the snapshot says it's partial.
export function buildShareSnapshot(record: ChatRecord, maxBytes = MAX_SHARE_BYTES): Snapshot | null {
    let entries = shareable(record.transcript);
    if (!entries.some((e) => e.kind === 'exchange')) return null;
    let truncated = false;
    const encode = () => JSON.stringify({ context: record.context, entries, truncated } satisfies SharePayload);
    let payload = encode();

    for (let i = 0; utf8(payload) > maxBytes && i < entries.length; i++) {
        const e = entries[i];
        if (e.kind !== 'exchange' || !e.reply.citations) continue;
        const { citations: _dropped, ...reply } = e.reply;
        entries = entries.map((x, j) => (j === i ? { ...e, reply } : x));
        payload = encode();
    }
    while (utf8(payload) > maxBytes && entries.filter((e) => e.kind === 'exchange').length > 1) {
        truncated = true;
        const firstExchange = entries.findIndex((e) => e.kind === 'exchange');
        entries = entries.slice(firstExchange + 1);
        while (entries[0]?.kind === 'notice') entries = entries.slice(1);
        payload = encode();
    }
    if (utf8(payload) > maxBytes) return null; // one answer alone is too long

    const exchanges = entries.filter((e): e is Exchange => e.kind === 'exchange');
    return { payload, lastOrder: Math.max(...exchanges.map((e) => e.order)), count: exchanges.length, truncated };
}

// Answered exchanges the chat has gained since its link was made or updated.
export function newSinceShared(record: ChatRecord, share: ShareRef): number {
    return record.transcript.filter((e) => e.kind === 'exchange' && answered(e) && e.order > share.lastOrder).length;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// A share document read by anyone: untrusted, rebuilt like anything else
// loaded (normalizeTranscript re-checks every entry and citation).
export function parseShareDoc(raw: unknown): SharedChat | null {
    if (!raw || typeof raw !== 'object') return null;
    const d = raw as Record<string, unknown>;
    if (typeof d.payload !== 'string' || d.payload.length > MAX_SHARE_BYTES) return null;
    let payload: Partial<SharePayload>;
    try {
        payload = JSON.parse(d.payload) as Partial<SharePayload>;
    } catch {
        return null;
    }
    const transcript = normalizeTranscript(payload.entries);
    if (!transcript.some((e) => e.kind === 'exchange')) return null;
    return {
        title: typeof d.title === 'string' ? sanitizeTitle(d.title) : '',
        createdAt: num(d.createdAt),
        updatedAt: num(d.updatedAt),
        context: sanitizeChatContext(payload.context),
        transcript,
        truncated: payload.truncated === true,
    };
}

// "Continue this conversation": the shared chat as a new chat of the
// reader's own, with fresh ids throughout, so it never collides with (or
// writes over) the original, and orders ending now.
export function shareToRecord(shared: SharedChat, opts: { now: number; newId: () => string }): ChatRecord {
    const base = opts.now - shared.transcript.length;
    const transcript = shared.transcript.map((e, i): Entry => (e.kind === 'notice'
        ? { ...e, id: opts.newId(), order: base + i }
        : { ...e, id: opts.newId(), order: base + i, reply: { ...e.reply, id: opts.newId() } }));
    const meta: ChatMeta = {
        id: opts.newId(),
        title: shared.title,
        titleSource: 'auto',
        createdAt: opts.now,
        updatedAt: opts.now,
        pinned: false,
        share: null,
    };
    return { meta, context: shared.context, transcript: normalizeTranscript(transcript) };
}
