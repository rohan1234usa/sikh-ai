// The contract both chat stores keep: this browser's (local.ts) and the
// signed-in account's (firestore.ts).
//
// Reads are synchronous snapshots for useSyncExternalStore, each a stable
// object until something changes. Writes are addressed by id — a chat, an
// entry, a reply attempt — so nothing ever writes back a whole list the view
// happened to be holding, the way the old single-chat storage did.

import type { Citation } from '@/lib/gurbani/citations';
import type { ChatContext } from '../config';
import type { ChatHome, ChatMeta } from '../chatMeta';
import type { Entry, Reply, Transcript } from '../transcript';

export type ChatRecord = { meta: ChatMeta; context: ChatContext | null; transcript: Transcript };

// gone: the chat (or entry) no longer exists, e.g. deleted in another tab
// permission: the account refused (signed out, or its rules aren't deployed)
// quota: this browser's storage is full and nothing could be cleared
// cap: the account keeps only its most recent chats, and this one is older
//      than all of them (it would be removed the moment it arrived)
// unavailable: anything else; worth trying again later
export type StoreErrorCode = 'gone' | 'permission' | 'quota' | 'cap' | 'unavailable';

export class ChatStoreError extends Error {
    constructor(readonly code: StoreErrorCode, message: string = code) {
        super(message);
        this.name = 'ChatStoreError';
    }
}

export const storeErrorCode = (e: unknown): StoreErrorCode => (e instanceof ChatStoreError ? e.code : 'unavailable');

export type ListState = { status: 'loading' | 'ready' | 'error'; chats: ChatMeta[]; error?: StoreErrorCode };

export type ChatState =
    | { status: 'loading' }
    | { status: 'missing' }
    | { status: 'error'; error: StoreErrorCode }
    | { status: 'ready'; record: ChatRecord };

export type MetaPatch = Partial<Pick<ChatMeta, 'title' | 'titleSource' | 'pinned' | 'share'>>;

export interface ChatStore {
    readonly home: ChatHome;
    // How often a reply still streaming is saved, so leaving mid-answer loses
    // at most this much of it.
    readonly checkpointMs: number;

    subscribeList(onChange: () => void): () => void;
    getList(): ListState;
    subscribeChat(chatId: string, onChange: () => void): () => void;
    getChat(chatId: string): ChatState;

    // A chat is created by its first question: nothing is saved for a blank one.
    createChat(meta: ChatMeta, context: ChatContext | null, entries: Entry[]): Promise<void>;
    // A question sent or asked again: its entries written, stale notices
    // removed, and the chat's last activity moved to `touch`.
    putEntries(chatId: string, entries: Entry[], opts: { touch: number; removeIds?: string[] }): Promise<void>;
    // A reply's latest state. Refused if a newer attempt has replaced it.
    putReply(chatId: string, exchangeId: string, reply: Reply): Promise<void>;
    // The Gurbani check of a reply, if that attempt is still the current one.
    setCitations(chatId: string, exchangeId: string, replyId: string, citations: Citation[]): Promise<void>;
    setContext(chatId: string, context: ChatContext | null): Promise<void>;
    updateMeta(chatId: string, patch: MetaPatch): Promise<void>;
    deleteChat(chatId: string): Promise<void>;
    // A whole chat from elsewhere (moving to the account, continuing a shared
    // one). Idempotent by ids.
    importChat(record: ChatRecord): Promise<void>;
}
