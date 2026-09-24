// This browser's chats, in localStorage: one key for the list and one per
// chat, so saving a reply rewrites only that chat. Storage is passed in (the
// tests use a fake with a quota); nothing here touches `window`.
//
// Every write reads the record fresh from storage, changes it by id, then
// writes the record and after it the list. Another tab may have written in
// between, and a crash between the two writes is healed by reconcile() on
// the next start, in either direction, without bringing a deleted chat back.

import type { Citation } from '@/lib/gurbani/citations';
import { MAX_LOCAL_CHATS, sanitizeChatContext, type ChatContext } from '../config';
import { deriveTitle, isChatId, sanitizeMeta, sortChats, type ChatMeta } from '../chatMeta';
import { fromLegacyMessages, normalizeTranscript, toStoredEntry, type Entry, type Exchange, type Reply } from '../transcript';
import { merged, withCitations, withContext, withEntries, withMeta, withReply } from './records';
import { ChatStoreError, type ChatRecord, type ChatState, type ChatStore, type ListState, type MetaPatch } from './types';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export const LOCAL_INDEX_KEY = 'sikhai.chats.v3.index';
export const LOCAL_CHAT_PREFIX = 'sikhai.chats.v3.chat.';
// The single chat the page kept before chats had a list.
export const LEGACY_CHAT_KEYS = ['sikhai.chat.v2', 'sikhai.chat.v1'] as const;

type StoredIndex = { v: 3; chats: ChatMeta[] };
type StoredChat = { v: 3; meta: ChatMeta; context: ChatContext | null; entries: Entry[] };

export type LocalStoreOptions = {
    storage: StorageLike;
    now?: () => number;
    // Changes made by other tabs, by storage key (null: everything changed).
    subscribeExternal?: (onKey: (key: string | null) => void) => () => void;
    // Chats that must never be evicted: open in this tab, or with a reply in flight.
    isProtected?: (chatId: string) => boolean;
    onEvicted?: (chatIds: string[]) => void;
};

const chatKey = (id: string) => `${LOCAL_CHAT_PREFIX}${id}`;

function isQuotaError(e: unknown): boolean {
    if (!(e instanceof DOMException)) return false;
    return e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014;
}

// A stable id for the old chat, so migrating twice never makes two copies.
function fnv1a(s: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
}

export class LocalChatStore implements ChatStore {
    readonly home = 'local' as const;
    readonly checkpointMs = 1000;

    private list: ListState = { status: 'ready', chats: [] };
    private chats = new Map<string, ChatState>();
    private listListeners = new Set<() => void>();
    private chatListeners = new Map<string, Set<() => void>>();

    constructor(private readonly opts: LocalStoreOptions) {
        this.migrateLegacy();
        this.reconcile();
        this.list = { status: 'ready', chats: this.readIndex() };
        opts.subscribeExternal?.((key) => this.onExternal(key));
    }

    private now(): number {
        return this.opts.now?.() ?? Date.now();
    }

    // ── Reading ──────────────────────────────────────────────────────────────

    private readJson(key: string): unknown {
        try {
            const raw = this.opts.storage.getItem(key);
            return raw === null ? null : JSON.parse(raw);
        } catch {
            return null; // corrupt, or storage blocked
        }
    }

    private readIndex(): ChatMeta[] {
        const raw = this.readJson(LOCAL_INDEX_KEY) as Partial<StoredIndex> | null;
        const metas = (Array.isArray(raw?.chats) ? raw.chats : [])
            .map((m) => sanitizeMeta(m))
            .filter((m): m is ChatMeta => m !== null);
        return sortChats([...new Map(metas.map((m) => [m.id, m])).values()]);
    }

    private readChat(id: string): ChatRecord | null {
        const raw = this.readJson(chatKey(id)) as Partial<StoredChat> | null;
        if (!raw) return null;
        const meta = sanitizeMeta(raw.meta, id);
        if (!meta || meta.id !== id) return null;
        return { meta, context: sanitizeChatContext(raw.context), transcript: normalizeTranscript(raw.entries) };
    }

    private storedChatIds(): string[] {
        const ids: string[] = [];
        try {
            for (let i = 0; i < this.opts.storage.length; i++) {
                const key = this.opts.storage.key(i);
                if (key?.startsWith(LOCAL_CHAT_PREFIX)) ids.push(key.slice(LOCAL_CHAT_PREFIX.length));
            }
        } catch { /* storage blocked */ }
        return ids;
    }

    // ── Writing ──────────────────────────────────────────────────────────────

    // The least recently used chat that can go: not pinned, not the one being
    // written, not open here and not replying.
    private pickVictim(keep: string): string | null {
        const candidates = this.readIndex()
            .filter((m) => !m.pinned && m.id !== keep && !this.opts.isProtected?.(m.id))
            .sort((a, b) => a.updatedAt - b.updatedAt);
        return candidates[0]?.id ?? null;
    }

    private dropChat(id: string) {
        try { this.opts.storage.removeItem(chatKey(id)); } catch { /* ignore */ }
        this.writeIndex(this.readIndex().filter((m) => m.id !== id), id, []);
    }

    // setItem, making room by evicting old chats when storage is full. Never
    // trims the chat being written: if nothing can go, the write fails.
    private setWithRoom(key: string, value: string, keep: string, evicted: string[]) {
        for (;;) {
            try {
                this.opts.storage.setItem(key, value);
                return;
            } catch (e) {
                if (!isQuotaError(e)) throw new ChatStoreError('unavailable', String(e));
                const victim = this.pickVictim(keep);
                if (!victim) throw new ChatStoreError('quota');
                this.dropChat(victim);
                evicted.push(victim);
            }
        }
    }

    private writeIndex(metas: ChatMeta[], keep: string, evicted: string[]) {
        const payload: StoredIndex = { v: 3, chats: sortChats(metas) };
        this.setWithRoom(LOCAL_INDEX_KEY, JSON.stringify(payload), keep, evicted);
    }

    // Record first, then the list; then the snapshots and the listeners.
    private save(record: ChatRecord, evicted: string[] = []) {
        const { meta } = record;
        const payload: StoredChat = {
            v: 3,
            meta,
            context: record.context,
            entries: record.transcript.map(toStoredEntry),
        };
        this.setWithRoom(chatKey(meta.id), JSON.stringify(payload), meta.id, evicted);
        this.writeIndex([...this.readIndex().filter((m) => m.id !== meta.id), meta], meta.id, evicted);
        this.chats.set(meta.id, { status: 'ready', record: this.readChat(meta.id) ?? record });
        this.refreshList();
        this.notifyChat(meta.id);
        this.afterEviction(evicted);
    }

    private afterEviction(evicted: string[]) {
        if (evicted.length === 0) return;
        for (const id of evicted) {
            this.chats.delete(id);
            this.notifyChat(id);
        }
        this.refreshList();
        this.opts.onEvicted?.(evicted);
    }

    private mustRead(id: string): ChatRecord {
        const record = this.readChat(id);
        if (!record) throw new ChatStoreError('gone');
        return record;
    }

    private refreshList() {
        this.list = { status: 'ready', chats: this.readIndex() };
        for (const cb of [...this.listListeners]) cb();
    }

    private notifyChat(id: string) {
        for (const cb of [...(this.chatListeners.get(id) ?? [])]) cb();
    }

    // ── Repair and migration ─────────────────────────────────────────────────

    // Make the list and the chat records agree: a record the list lost is
    // listed again from its own meta; a list entry with no record goes.
    private reconcile() {
        const index = this.readIndex();
        const stored = this.storedChatIds();
        const listed = new Set(index.map((m) => m.id));
        const found = new Set(stored);
        const keep = index.filter((m) => found.has(m.id));
        for (const id of stored) {
            if (listed.has(id)) continue;
            const record = this.readChat(id);
            if (record) keep.push(record.meta);
            else try { this.opts.storage.removeItem(chatKey(id)); } catch { /* ignore */ }
        }
        if (keep.length !== index.length || stored.some((id) => !listed.has(id))) {
            try { this.writeIndex(keep, '', []); } catch { /* read-only storage: nothing to repair */ }
        }
    }

    // The one chat the page kept before chats had a list becomes the first
    // entry in it, repaired (lib/chat/transcript.ts), under an id derived from
    // it, so running this twice (another tab still on the old code wrote it
    // again) merges instead of copying.
    private migrateLegacy() {
        for (const key of LEGACY_CHAT_KEYS) {
            const parsed = this.readJson(key) as { messages?: unknown; context?: unknown; updatedAt?: unknown } | null;
            let raw: string | null = null;
            try { raw = this.opts.storage.getItem(key); } catch { return; }
            if (raw === null) continue;
            const transcript = fromLegacyMessages(parsed?.messages);
            const first = transcript.find((e): e is Exchange => e.kind === 'exchange');
            if (first) {
                const candidate = `legacy-${first.id}`;
                const id = isChatId(candidate) ? candidate : `legacy-${fnv1a(`${first.question.text}|${first.order}`)}`;
                const last = transcript[transcript.length - 1];
                const updatedAt = typeof parsed?.updatedAt === 'number' ? parsed.updatedAt : last.order;
                const existing = this.readChat(id);
                try {
                    this.save({
                        meta: existing?.meta ?? {
                            id,
                            title: deriveTitle(first.question.text),
                            titleSource: 'auto',
                            createdAt: first.question.createdAt,
                            updatedAt,
                            pinned: false,
                            share: null,
                        },
                        context: existing?.context ?? sanitizeChatContext(parsed?.context),
                        // What this app wrote since wins over the old copy.
                        transcript: normalizeTranscript([...transcript, ...(existing?.transcript ?? []).map(toStoredEntry)]),
                    });
                } catch {
                    continue; // storage full or blocked: keep the old key for another try
                }
            }
            try { this.opts.storage.removeItem(key); } catch { /* ignore */ }
        }
    }

    private onExternal(key: string | null) {
        if (key === null) {
            this.chats.clear();
            this.refreshList();
            for (const id of this.chatListeners.keys()) this.notifyChat(id);
            return;
        }
        if ((LEGACY_CHAT_KEYS as readonly string[]).includes(key)) {
            this.migrateLegacy();
            return;
        }
        if (key === LOCAL_INDEX_KEY) {
            this.refreshList();
            return;
        }
        if (key.startsWith(LOCAL_CHAT_PREFIX)) {
            const id = key.slice(LOCAL_CHAT_PREFIX.length);
            this.chats.delete(id);
            this.notifyChat(id);
        }
    }

    // ── ChatStore ────────────────────────────────────────────────────────────

    subscribeList(onChange: () => void): () => void {
        this.listListeners.add(onChange);
        return () => { this.listListeners.delete(onChange); };
    }

    getList(): ListState {
        return this.list;
    }

    subscribeChat(chatId: string, onChange: () => void): () => void {
        const set = this.chatListeners.get(chatId) ?? new Set();
        set.add(onChange);
        this.chatListeners.set(chatId, set);
        return () => {
            set.delete(onChange);
            if (set.size === 0) this.chatListeners.delete(chatId);
        };
    }

    getChat(chatId: string): ChatState {
        let state = this.chats.get(chatId);
        if (!state) {
            const record = this.readChat(chatId);
            state = record ? { status: 'ready', record } : { status: 'missing' };
            this.chats.set(chatId, state);
        }
        return state;
    }

    async createChat(meta: ChatMeta, context: ChatContext | null, entries: Entry[]): Promise<void> {
        const evicted: string[] = [];
        // At the cap, the oldest chat that can go makes room first.
        const count = this.readIndex().filter((m) => m.id !== meta.id).length;
        if (count >= MAX_LOCAL_CHATS) {
            const victim = this.pickVictim(meta.id);
            if (victim) {
                this.dropChat(victim);
                evicted.push(victim);
            }
        }
        this.save({ meta, context, transcript: normalizeTranscript(entries.map(toStoredEntry)) }, evicted);
    }

    async putEntries(chatId: string, entries: Entry[], opts: { touch: number; removeIds?: string[] }): Promise<void> {
        this.save(withEntries(this.mustRead(chatId), entries, opts.touch, opts.removeIds));
    }

    // Saved only when something changed: a refused write rewrites nothing.
    private saveChanged(before: ChatRecord, after: ChatRecord | null) {
        if (!after) throw new ChatStoreError('gone');
        if (after !== before) this.save(after);
    }

    async putReply(chatId: string, exchangeId: string, reply: Reply): Promise<void> {
        const record = this.mustRead(chatId);
        this.saveChanged(record, withReply(record, exchangeId, reply));
    }

    async setCitations(chatId: string, exchangeId: string, replyId: string, citations: Citation[]): Promise<void> {
        const record = this.mustRead(chatId);
        this.saveChanged(record, withCitations(record, exchangeId, replyId, citations));
    }

    async setContext(chatId: string, context: ChatContext | null): Promise<void> {
        this.save(withContext(this.mustRead(chatId), context));
    }

    async updateMeta(chatId: string, patch: MetaPatch): Promise<void> {
        this.save(withMeta(this.mustRead(chatId), patch));
    }

    async deleteChat(chatId: string): Promise<void> {
        try { this.opts.storage.removeItem(chatKey(chatId)); } catch { /* ignore */ }
        try {
            this.writeIndex(this.readIndex().filter((m) => m.id !== chatId), chatId, []);
        } catch { /* reconcile() drops the orphaned list entry next time */ }
        this.chats.set(chatId, { status: 'missing' });
        this.refreshList();
        this.notifyChat(chatId);
    }

    // What this browser already holds of the chat wins over the copy.
    async importChat(record: ChatRecord): Promise<void> {
        const existing = this.readChat(record.meta.id);
        const chat = existing ? merged(record, existing) : record;
        await this.createChat(chat.meta, chat.context, chat.transcript);
    }
}
