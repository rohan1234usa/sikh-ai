// Pure: how each change to a chat reshapes its record. The local store
// applies these to what it reads from storage; the account store applies them
// to its cache at once, so this tab sees its own writes without waiting for
// Firestore to echo them back.

import { sanitizeCitations, type Citation } from '@/lib/gurbani/citations';
import { sanitizeChatContext, type ChatContext } from '../config';
import { shouldReplaceReply } from '../exchange';
import { normalizeTranscript, toStoredEntry, type Entry, type Exchange, type Reply } from '../transcript';
import type { ChatRecord, MetaPatch } from './types';

// A question sent or asked again: its entries written by id, the notices it
// makes stale removed, and the chat's last activity moved forward.
export function withEntries(record: ChatRecord, entries: Entry[], touch: number, removeIds: string[] = []): ChatRecord {
    const replaced = new Set([...removeIds, ...entries.map((e) => e.id)]);
    return {
        ...record,
        meta: { ...record.meta, updatedAt: Math.max(touch, record.meta.updatedAt) },
        transcript: normalizeTranscript([
            ...record.transcript.filter((e) => !replaced.has(e.id)),
            ...entries.map(toStoredEntry),
        ]),
    };
}

// null: the exchange is gone. The record back unchanged: a newer attempt
// holds the exchange, so the write is refused.
export function withExchange(record: ChatRecord, exchangeId: string, change: (e: Exchange) => Exchange | null): ChatRecord | null {
    const index = record.transcript.findIndex((e) => e.kind === 'exchange' && e.id === exchangeId);
    if (index === -1) return null;
    const next = change(record.transcript[index] as Exchange);
    if (!next) return record;
    const transcript = [...record.transcript];
    transcript[index] = toStoredEntry(next);
    return { ...record, transcript: normalizeTranscript(transcript) };
}

export const withReply = (record: ChatRecord, exchangeId: string, reply: Reply) =>
    withExchange(record, exchangeId, (e) => (shouldReplaceReply(e.reply, reply) ? { ...e, reply } : null));

export function withCitations(record: ChatRecord, exchangeId: string, replyId: string, citations: Citation[]) {
    const clean = sanitizeCitations(citations);
    return withExchange(record, exchangeId, (e) =>
        e.reply.id === replyId && clean.length ? { ...e, reply: { ...e.reply, citations: clean } } : null);
}

export const withMeta = (record: ChatRecord, patch: MetaPatch): ChatRecord => ({ ...record, meta: { ...record.meta, ...patch } });

export const withContext = (record: ChatRecord, context: ChatContext | null): ChatRecord =>
    ({ ...record, context: sanitizeChatContext(context) });

// Two copies of one chat merged by entry id; `mine` wins where both hold one.
export function merged(theirs: ChatRecord, mine: ChatRecord): ChatRecord {
    return {
        ...mine,
        transcript: normalizeTranscript([...theirs.transcript.map(toStoredEntry), ...mine.transcript.map(toStoredEntry)]),
    };
}
