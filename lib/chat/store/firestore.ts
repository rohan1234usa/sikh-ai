// The signed-in account's chats, in Firestore (paths and shapes: see
// firestorePlans.ts). Browser-only.
//
// Reads come from listeners, started when a view subscribes and stopped a
// moment after the last one leaves (so React's development double-mount, or
// flicking between two chats, doesn't pay for the reads twice). Writes are
// applied to this tab's cache at once and sent in the background: the chat
// never waits on the network, and Firestore's own listeners bring the saved
// state back. A write the account refuses (signed out, or its rules not yet
// deployed) marks the account unavailable, so new chats go to this browser.

import {
    collection,
    doc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    where,
    writeBatch,
    type Firestore,
    type Unsubscribe,
} from 'firebase/firestore';
import type { Citation } from '@/lib/gurbani/citations';
import { sanitizeChatContext, type ChatContext } from '../config';
import { sanitizeMeta, sortChats, type ChatMeta } from '../chatMeta';
import { normalizeTranscript, toStoredEntry, type Entry, type Reply } from '../transcript';
import { chunk, planCitations, planCreate, planDelete, planImport, planMeta, planPutEntries, planPutReply, type Op } from './firestorePlans';
import { withCitations, withContext, withEntries, withMeta, withReply } from './records';
import { ChatStoreError, type ChatRecord, type ChatState, type ChatStore, type ListState, type MetaPatch, type StoreErrorCode } from './types';

export type AccountHealth = 'ok' | 'unavailable';

// A write the account refused, after this tab had already shown it.
export type WriteFailure = { code: StoreErrorCode; chatId: string; kind: 'create' | 'write'; record?: ChatRecord };

type Watch = {
    listeners: Set<() => void>;
    unsubs: Unsubscribe[];
    stopTimer?: ReturnType<typeof setTimeout>;
    // undefined: not heard yet; null: no such chat
    head?: { meta: ChatMeta; context: ChatContext | null } | null;
    entries?: unknown[];
    entryIds?: string[];
};

const LINGER_MS = 2000;
// Recent chats listed; pinned ones (at most 10) are listed whatever their age.
const LIST_LIMIT = 100;
const LOADING: ChatState = { status: 'loading' };
const MISSING: ChatState = { status: 'missing' };

function codeOf(e: unknown): StoreErrorCode {
    const code = (e as { code?: unknown } | undefined)?.code;
    if (code === 'permission-denied' || code === 'unauthenticated') return 'permission';
    if (code === 'not-found') return 'gone';
    return 'unavailable';
}

const metaOf = (id: string, data: Record<string, unknown>) => sanitizeMeta({ ...data, id });

export class FirestoreChatStore implements ChatStore {
    readonly home = 'account' as const;
    // A checkpoint is a write (and a read for every other device listening),
    // so a streaming reply is saved less often than in this browser.
    readonly checkpointMs = 5000;

    private list: ListState = { status: 'loading', chats: [] };
    private listListeners = new Set<() => void>();
    private listUnsubs: Unsubscribe[] = [];
    private listStopTimer?: ReturnType<typeof setTimeout>;
    private recent: ChatMeta[] | null = null;
    private pinned: ChatMeta[] | null = null;

    private chats = new Map<string, ChatState>();
    private watches = new Map<string, Watch>();

    private health: AccountHealth = 'ok';
    private healthListeners = new Set<() => void>();

    constructor(
        private readonly db: Firestore,
        readonly uid: string,
        private readonly onWriteFailed?: (failure: WriteFailure) => void,
    ) {}

    // ── Health ───────────────────────────────────────────────────────────────

    subscribeHealth = (onChange: () => void): (() => void) => {
        this.healthListeners.add(onChange);
        return () => { this.healthListeners.delete(onChange); };
    };

    getHealth = (): AccountHealth => this.health;

    private refused(code: StoreErrorCode) {
        if (code !== 'permission' || this.health === 'unavailable') return;
        this.health = 'unavailable';
        for (const cb of [...this.healthListeners]) cb();
    }

    // ── The list ─────────────────────────────────────────────────────────────

    subscribeList = (onChange: () => void): (() => void) => {
        this.listListeners.add(onChange);
        clearTimeout(this.listStopTimer);
        if (this.listUnsubs.length === 0) this.startList();
        return () => {
            this.listListeners.delete(onChange);
            if (this.listListeners.size === 0) this.listStopTimer = setTimeout(() => this.stopList(), LINGER_MS);
        };
    };

    getList = (): ListState => this.list;

    private emitList() {
        for (const cb of [...this.listListeners]) cb();
    }

    private startList() {
        const chats = collection(this.db, 'users', this.uid, 'chats');
        const failed = (e: unknown) => {
            const code = codeOf(e);
            this.refused(code);
            this.list = { status: 'error', chats: [], error: code };
            this.emitList();
        };
        const metas = (docs: { id: string; data(): Record<string, unknown> }[]) =>
            docs.map((d) => metaOf(d.id, d.data())).filter((m): m is ChatMeta => m !== null);
        this.listUnsubs = [
            onSnapshot(query(chats, orderBy('updatedAt', 'desc'), limit(LIST_LIMIT)), (snap) => {
                this.recent = metas(snap.docs);
                this.rebuildList();
            }, failed),
            onSnapshot(query(chats, where('pinned', '==', true)), (snap) => {
                this.pinned = metas(snap.docs);
                this.rebuildList();
            }, failed),
        ];
    }

    private stopList() {
        if (this.listListeners.size > 0) return;
        for (const unsub of this.listUnsubs) unsub();
        this.listUnsubs = [];
        this.recent = this.pinned = null;
        this.list = { status: 'loading', chats: [] };
    }

    private rebuildList() {
        if (this.recent === null || this.pinned === null) return;
        const byId = new Map<string, ChatMeta>();
        for (const m of [...this.recent, ...this.pinned]) byId.set(m.id, m);
        this.list = { status: 'ready', chats: sortChats([...byId.values()]) };
        this.emitList();
    }

    // ── One chat ─────────────────────────────────────────────────────────────

    subscribeChat = (chatId: string, onChange: () => void): (() => void) => {
        let watch = this.watches.get(chatId);
        if (!watch) {
            watch = { listeners: new Set(), unsubs: [] };
            this.watches.set(chatId, watch);
        }
        const w = watch;
        clearTimeout(w.stopTimer);
        w.listeners.add(onChange);
        if (w.unsubs.length === 0) this.startChat(chatId, w);
        return () => {
            w.listeners.delete(onChange);
            if (w.listeners.size === 0) w.stopTimer = setTimeout(() => this.stopChat(chatId), LINGER_MS);
        };
    };

    getChat = (chatId: string): ChatState => this.chats.get(chatId) ?? LOADING;

    private setChat(chatId: string, state: ChatState) {
        this.chats.set(chatId, state);
        for (const cb of [...(this.watches.get(chatId)?.listeners ?? [])]) cb();
    }

    private startChat(chatId: string, w: Watch) {
        const chatRef = doc(this.db, 'users', this.uid, 'chats', chatId);
        const failed = (e: unknown) => {
            const code = codeOf(e);
            this.refused(code);
            this.setChat(chatId, { status: 'error', error: code });
        };
        const combine = () => {
            if (w.head === undefined) return;
            if (w.head === null) return this.setChat(chatId, MISSING);
            if (w.entries === undefined) return;
            this.setChat(chatId, { status: 'ready', record: { ...w.head, transcript: normalizeTranscript(w.entries) } });
        };
        w.unsubs = [
            onSnapshot(chatRef, (snap) => {
                const data = snap.exists() ? snap.data() : null;
                const meta = data ? metaOf(snap.id, data) : null;
                w.head = meta && data ? { meta, context: sanitizeChatContext(data.context) } : null;
                combine();
            }, failed),
            onSnapshot(query(collection(chatRef, 'entries'), orderBy('order')), (snap) => {
                w.entryIds = snap.docs.map((d) => d.id);
                w.entries = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
                combine();
            }, failed),
        ];
    }

    private stopChat(chatId: string) {
        const w = this.watches.get(chatId);
        if (!w || w.listeners.size > 0) return;
        for (const unsub of w.unsubs) unsub();
        this.watches.delete(chatId);
    }

    // Everything this store listens to, on sign-out.
    dispose() {
        for (const id of [...this.watches.keys()]) {
            const w = this.watches.get(id)!;
            clearTimeout(w.stopTimer);
            w.listeners.clear();
            this.stopChat(id);
        }
        clearTimeout(this.listStopTimer);
        this.listListeners.clear();
        this.stopList();
    }

    // ── Writing ──────────────────────────────────────────────────────────────

    // The change as this tab should see it now; Firestore confirms it later.
    private apply(chatId: string, change: (record: ChatRecord) => ChatRecord | null) {
        const state = this.chats.get(chatId);
        if (state?.status !== 'ready') return;
        const next = change(state.record);
        if (next && next !== state.record) this.setChat(chatId, { status: 'ready', record: next });
    }

    private batches(batches: Op[][]) {
        return batches.map((ops) => {
            const batch = writeBatch(this.db);
            for (const op of ops) {
                const ref = doc(this.db, op.path.join('/'));
                if (op.type === 'set') batch.set(ref, op.data);
                else if (op.type === 'update') batch.update(ref, op.data);
                else batch.delete(ref);
            }
            return batch;
        });
    }

    // Built now (a malformed write throws here), sent in the background.
    private send(batches: Op[][], failure: Omit<WriteFailure, 'code'>): Promise<void> {
        const prepared = this.batches(batches);
        void (async () => {
            try {
                for (const batch of prepared) await batch.commit();
            } catch (e) {
                const code = codeOf(e);
                this.refused(code);
                this.onWriteFailed?.({ ...failure, code });
            }
        })();
        return Promise.resolve();
    }

    // Sent and waited for: for a move, whose local copy is deleted only once
    // the account has the chat.
    private async sendAndWait(batches: Op[][]) {
        try {
            for (const batch of this.batches(batches)) await batch.commit();
        } catch (e) {
            const code = codeOf(e);
            this.refused(code);
            throw new ChatStoreError(code, String(e));
        }
    }

    async createChat(meta: ChatMeta, context: ChatContext | null, entries: Entry[]): Promise<void> {
        const record: ChatRecord = { meta, context, transcript: normalizeTranscript(entries.map(toStoredEntry)) };
        this.setChat(meta.id, { status: 'ready', record });
        return this.send([planCreate(this.uid, meta, context, entries)], { chatId: meta.id, kind: 'create', record });
    }

    async putEntries(chatId: string, entries: Entry[], opts: { touch: number; removeIds?: string[] }): Promise<void> {
        this.apply(chatId, (r) => withEntries(r, entries, opts.touch, opts.removeIds));
        return this.send(chunk(planPutEntries(this.uid, chatId, entries, opts.touch, opts.removeIds)), { chatId, kind: 'write' });
    }

    async putReply(chatId: string, exchangeId: string, reply: Reply): Promise<void> {
        this.apply(chatId, (r) => withReply(r, exchangeId, reply));
        return this.send([planPutReply(this.uid, chatId, exchangeId, reply)], { chatId, kind: 'write' });
    }

    async setCitations(chatId: string, exchangeId: string, replyId: string, citations: Citation[]): Promise<void> {
        // Only onto the attempt they were checked for, when this tab can tell.
        const state = this.chats.get(chatId);
        const current = state?.status === 'ready'
            ? state.record.transcript.find((e) => e.kind === 'exchange' && e.id === exchangeId)
            : undefined;
        if (current?.kind === 'exchange' && current.reply.id !== replyId) return;
        this.apply(chatId, (r) => withCitations(r, exchangeId, replyId, citations));
        return this.send([planCitations(this.uid, chatId, exchangeId, citations)], { chatId, kind: 'write' });
    }

    async setContext(chatId: string, context: ChatContext | null): Promise<void> {
        this.apply(chatId, (r) => withContext(r, context));
        return this.send([planMeta(this.uid, chatId, { context: sanitizeChatContext(context) })], { chatId, kind: 'write' });
    }

    async updateMeta(chatId: string, patch: MetaPatch): Promise<void> {
        this.apply(chatId, (r) => withMeta(r, patch));
        return this.send([planMeta(this.uid, chatId, patch)], { chatId, kind: 'write' });
    }

    async deleteChat(chatId: string): Promise<void> {
        // Every entry document, including any the transcript repair set aside.
        const w = this.watches.get(chatId);
        const entryIds = w?.entryIds
            ?? (await getDocs(collection(this.db, 'users', this.uid, 'chats', chatId, 'entries'))).docs.map((d) => d.id);
        const state = this.chats.get(chatId);
        const shareId = (state?.status === 'ready' ? state.record.meta.share : this.list.chats.find((c) => c.id === chatId)?.share)?.id;
        this.setChat(chatId, MISSING);
        return this.send(chunk(planDelete(this.uid, chatId, entryIds, shareId)), { chatId, kind: 'write' });
    }

    async importChat(record: ChatRecord): Promise<void> {
        await this.sendAndWait(planImport(this.uid, record.meta, record.context, record.transcript));
    }
}
