// Pure: the Firestore writes for each change to an account chat, as plain
// operations the adapter (firestore.ts) carries out in batches. Kept apart so
// the paths, the shapes and the ordering are tested without Firestore.
//
//   users/{uid}/chats/{chatId}               the chat's meta and passage
//   users/{uid}/chats/{chatId}/entries/{id}  one exchange or notice each
//
// One document per exchange keeps a long Punjabi chat far from the 1 MiB
// document limit, and a reply can never be stored without its question.

import type { Citation } from '@/lib/gurbani/citations';
import type { ChatContext } from '../config';
import type { ChatMeta, ShareRef } from '../chatMeta';
import type { ShareDoc } from '../share';
import { normalizeReply, toStoredEntry, type Entry, type Reply } from '../transcript';
import type { MetaPatch } from './types';

export type DocPath = string[];
export type Op =
    | { type: 'set'; path: DocPath; data: Record<string, unknown> }
    | { type: 'update'; path: DocPath; data: Record<string, unknown> }
    | { type: 'delete'; path: DocPath };

// Well under Firestore's 500 writes per batch (and its 10 MiB request).
export const MAX_BATCH_OPS = 400;
export const META_VERSION = 1;

export const chatPath = (uid: string, chatId: string): DocPath => ['users', uid, 'chats', chatId];
export const entryPath = (uid: string, chatId: string, entryId: string): DocPath => [...chatPath(uid, chatId), 'entries', entryId];
export const sharePath = (shareId: string): DocPath => ['shared_chats', shareId];

export function metaDoc(meta: ChatMeta, context: ChatContext | null): Record<string, unknown> {
    return {
        v: META_VERSION,
        title: meta.title,
        titleSource: meta.titleSource,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        pinned: meta.pinned,
        context,
        share: meta.share,
    };
}

// The id is the document's; everything else is stored as it would be locally.
export function entryDoc(e: Entry): Record<string, unknown> {
    const { id: _id, ...rest } = toStoredEntry(e);
    return rest;
}

// A reply as stored: one still streaming saved as it would stand now, and no
// undefined fields, which Firestore rejects.
export const storedReply = (reply: Reply) => normalizeReply(reply, { id: reply.id, startedAt: reply.startedAt });

export function planCreate(uid: string, meta: ChatMeta, context: ChatContext | null, entries: Entry[]): Op[] {
    return [
        { type: 'set', path: chatPath(uid, meta.id), data: metaDoc(meta, context) },
        ...entries.map((e): Op => ({ type: 'set', path: entryPath(uid, meta.id, e.id), data: entryDoc(e) })),
    ];
}

// The meta update goes in the same batch as every entry it sets: if the chat
// was deleted meanwhile (another device), the update fails and takes the
// batch with it, instead of leaving entries under a chat that is gone.
export function planPutEntries(uid: string, chatId: string, entries: Entry[], touch: number, removeIds: string[] = []): Op[] {
    return [
        { type: 'update', path: chatPath(uid, chatId), data: { updatedAt: touch } },
        ...entries.map((e): Op => ({ type: 'set', path: entryPath(uid, chatId, e.id), data: entryDoc(e) })),
        ...removeIds.map((id): Op => ({ type: 'delete', path: entryPath(uid, chatId, id) })),
    ];
}

// An update, not a set: a reply for an exchange that no longer exists fails.
export function planPutReply(uid: string, chatId: string, exchangeId: string, reply: Reply): Op[] {
    return [{ type: 'update', path: entryPath(uid, chatId, exchangeId), data: { reply: storedReply(reply) } }];
}

export function planCitations(uid: string, chatId: string, exchangeId: string, citations: Citation[]): Op[] {
    return [{ type: 'update', path: entryPath(uid, chatId, exchangeId), data: { 'reply.citations': citations } }];
}

export function planMeta(uid: string, chatId: string, patch: MetaPatch & { context?: ChatContext | null }): Op[] {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) data[k] = v;
    return [{ type: 'update', path: chatPath(uid, chatId), data }];
}

// The meta (and a shared link) first: the chat leaves the list at once, and a
// delete cut short between batches leaves only entries nothing points to,
// which no later write can bring back (see planPutEntries).
export function planDelete(uid: string, chatId: string, entryIds: string[], shareId?: string | null): Op[] {
    return [
        { type: 'delete', path: chatPath(uid, chatId) },
        ...(shareId ? [{ type: 'delete' as const, path: sharePath(shareId) }] : []),
        ...entryIds.map((id): Op => ({ type: 'delete', path: entryPath(uid, chatId, id) })),
    ];
}

// A whole chat, e.g. moved from this browser: entries in as many batches as
// they need, the meta in the last one, so it shows in the list only once
// everything it holds has arrived. Rerunning it rewrites the same documents.
export function planImport(uid: string, meta: ChatMeta, context: ChatContext | null, entries: Entry[]): Op[][] {
    const writes = entries.map((e): Op => ({ type: 'set', path: entryPath(uid, meta.id, e.id), data: entryDoc(e) }));
    const batches: Op[][] = [];
    for (let i = 0; i < writes.length; i += MAX_BATCH_OPS) batches.push(writes.slice(i, i + MAX_BATCH_OPS));
    const metaOp: Op = { type: 'set', path: chatPath(uid, meta.id), data: metaDoc(meta, context) };
    if (batches.length === 0 || batches[batches.length - 1].length >= MAX_BATCH_OPS) batches.push([metaOp]);
    else batches[batches.length - 1].push(metaOp);
    return batches;
}

// Splits any list of operations into batches Firestore accepts.
export function chunk(ops: Op[]): Op[][] {
    const out: Op[][] = [];
    for (let i = 0; i < ops.length; i += MAX_BATCH_OPS) out.push(ops.slice(i, i + MAX_BATCH_OPS));
    return out;
}

// A link made or refreshed: the public snapshot, and the chat's note of it,
// in one batch, so neither exists without the other.
export function planShare(uid: string, chatId: string, shareId: string, doc: ShareDoc, ref: ShareRef): Op[] {
    return [
        { type: 'set', path: sharePath(shareId), data: { ...doc } },
        { type: 'update', path: chatPath(uid, chatId), data: { share: ref } },
    ];
}

export function planUnshare(uid: string, chatId: string, shareId: string): Op[] {
    return [
        { type: 'delete', path: sharePath(shareId) },
        { type: 'update', path: chatPath(uid, chatId), data: { share: null } },
    ];
}
