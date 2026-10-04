// Pure: the Firestore writes for each change to an account chat, as plain
// operations carried out in batches: by the adapter (firestore.ts), and, when
// the account goes, by lib/account/deletion.ts (planUnlinkShares,
// planErasePage). Kept apart so the paths, the shapes and the ordering are
// tested without Firestore.
//
//   users/{uid}/chats/{chatId}               the chat's meta and passage
//   users/{uid}/chats/{chatId}/entries/{id}  one exchange or notice each
//   users/{uid}/shares/{shareId}             the owner's note of a link: its chat
//   shared_chats/{shareId}                   the link's public copy, naming no one
//
// One document per exchange keeps a long Punjabi chat far from the 1 MiB
// document limit, and a reply can never be stored without its question.

import { MAX_BATCH_OPS, type DocPath, type Op } from '@/lib/firebase/ops';
import type { Citation } from '@/lib/gurbani/citations';
import type { ChatContext } from '../config';
import type { ChatMeta, ShareRef } from '../chatMeta';
import type { ShareDoc } from '../share';
import { normalizeReply, toStoredEntry, type Entry, type Reply } from '../transcript';
import type { MetaPatch } from './types';

// The operations, and the batching, are shared with Seva (lib/firebase/ops.ts).
export { MAX_BATCH_OPS, chunk, type DocPath, type Op } from '@/lib/firebase/ops';

export const META_VERSION = 1;

export const chatPath = (uid: string, chatId: string): DocPath => ['users', uid, 'chats', chatId];
export const entryPath = (uid: string, chatId: string, entryId: string): DocPath => [...chatPath(uid, chatId), 'entries', entryId];
export const sharePath = (shareId: string): DocPath => ['shared_chats', shareId];
export const shareNotePath = (uid: string, shareId: string): DocPath => ['users', uid, 'shares', shareId];

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

// The meta (and its shared links) first: the chat leaves the list at once,
// and a delete cut short between batches leaves only entries nothing points
// to, which no later write can bring back (see planPutEntries).
export function planDelete(uid: string, chatId: string, entryIds: string[], shareIds: readonly string[] = []): Op[] {
    return [
        { type: 'delete', path: chatPath(uid, chatId) },
        ...shareIds.flatMap((id) => planEndLink(uid, id)),
        ...entryIds.map((id): Op => ({ type: 'delete', path: entryPath(uid, chatId, id) })),
    ];
}

// A link's public copy and the owner's note of it, which go together.
function planEndLink(uid: string, shareId: string): Op[] {
    return [
        { type: 'delete', path: sharePath(shareId) },
        { type: 'delete', path: shareNotePath(uid, shareId) },
    ];
}

// Links ended per batch when the account goes (lib/account/deletion.ts): the
// two deletes of each read three documents between them, and a batch may
// read 20.
export const UNLINK_BATCH = 5;

export function planUnlinkShares(uid: string, shareIds: readonly string[]): Op[][] {
    const batches: Op[][] = [];
    for (let i = 0; i < shareIds.length; i += UNLINK_BATCH)
        batches.push(shareIds.slice(i, i + UNLINK_BATCH).flatMap((id) => planEndLink(uid, id)));
    return batches;
}

// Entries erased per batch when the account goes, the chat's meta in the last.
export const ERASE_PAGE = MAX_BATCH_OPS - 1;

// Unlike planDelete, the chat goes last: an erase cut short leaves it in the
// list, with what's left of its entries under it, for the next run to find.
export function planErasePage(uid: string, chatId: string, entryIds: readonly string[], last: boolean): Op[] {
    return [
        ...entryIds.map((id): Op => ({ type: 'delete', path: entryPath(uid, chatId, id) })),
        ...(last ? [{ type: 'delete' as const, path: chatPath(uid, chatId) }] : []),
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

// The chats past an account's cap that go (FirestoreChatStore.makeRoom): all
// of them but pinned ones and those in use here (open, or being answered),
// which stay until a later pass.
export function planEvictions(overflow: ChatMeta[], inUse: (chatId: string) => boolean): ChatMeta[] {
    return overflow.filter((m) => !m.pinned && !inUse(m.id));
}

// A link made or refreshed: the public snapshot, the owner's note of it, and
// the chat's, in one batch, so none exists without the others. A refresh
// writes the owner's note again as it was (the rules allow nothing else), so
// one plan both makes a link and refreshes it, even one ended meanwhile on
// another device.
export function planShare(uid: string, chatId: string, shareId: string, doc: ShareDoc, ref: ShareRef): Op[] {
    return [
        { type: 'set', path: sharePath(shareId), data: { ...doc } },
        { type: 'set', path: shareNotePath(uid, shareId), data: { chatId } },
        { type: 'update', path: chatPath(uid, chatId), data: { share: ref } },
    ];
}

// Every link of the chat ends, not only the one this device knows: one made
// meanwhile on another device stays public otherwise, with nothing left
// naming it.
export function planUnshare(uid: string, chatId: string, shareIds: readonly string[]): Op[] {
    return [
        ...shareIds.flatMap((id) => planEndLink(uid, id)),
        { type: 'update', path: chatPath(uid, chatId), data: { share: null } },
    ];
}
