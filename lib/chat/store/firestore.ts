// The signed-in account's chats, in Firestore (paths and shapes: see
// firestorePlans.ts). Browser-only.
//
// Reads come from listeners, started when a view subscribes and stopped a
// moment after the last one leaves (so React's development double-mount, or
// flicking between two chats, doesn't pay for the reads twice). Writes are
// applied to this tab's cache at once and sent in the background: the chat
// never waits on the network, and Firestore's own listeners bring the saved
// state back. When the account refuses to list chats or to create one (its
// rules not deployed, most likely), it is marked unavailable and new chats go
// to this browser. Any other refused write concerns that chat alone — say, one
// deleted meanwhile on another device — and never hides the rest.

import {
    collection,
    doc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    startAfter,
    where,
    writeBatch,
    type Firestore,
    type QueryDocumentSnapshot,
    type Unsubscribe,
} from 'firebase/firestore';
import type { Citation } from '@/lib/gurbani/citations';
import { MAX_ACCOUNT_CHATS, sanitizeChatContext, type ChatContext } from '../config';
import { sanitizeMeta, sortChats, type ChatMeta, type ShareRef } from '../chatMeta';
import { SHARE_VERSION, type ShareDoc, type Snapshot } from '../share';
import { normalizeTranscript, toStoredEntry, type Entry, type Reply } from '../transcript';
import {
    chunk,
    planCitations,
    planCreate,
    planDelete,
    planEvictions,
    planImport,
    planMeta,
    planPutEntries,
    planPutReply,
    planShare,
    planUnshare,
    type Op,
} from './firestorePlans';
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
// Recent chats listed: all an account keeps, bar pinned ones older than
// those, which are listed whatever their age.
const LIST_LIMIT = MAX_ACCOUNT_CHATS;
// How long after a chat arrives the account makes room: long enough for the
// list to hold it, and for a move of many chats to be tidied up in one pass.
const ROOM_DELAY_MS = 2000;
// Chats past the cap removed per pass; a later new chat takes the rest.
const OVERFLOW_BATCH = 50;
const LOADING: ChatState = { status: 'loading' };
const MISSING: ChatState = { status: 'missing' };

function codeOf(e: unknown): StoreErrorCode {
    const code = (e as { code?: unknown } | undefined)?.code;
    if (code === 'permission-denied' || code === 'unauthenticated') return 'permission';
    if (code === 'not-found') return 'gone';
    return 'unavailable';
}

const metaOf = (id: string, data: Record<string, unknown>) => sanitizeMeta({ ...data, id });
const metas = (docs: { id: string; data(): Record<string, unknown> }[]) =>
    docs.map((d) => metaOf(d.id, d.data())).filter((m): m is ChatMeta => m !== null);

export type AccountStoreOptions = {
    onWriteFailed?: (failure: WriteFailure) => void;
    // Chats in use here (open, or being answered): never removed to make room.
    inUse?: (chatId: string) => boolean;
    onEvicted?: (chatIds: string[]) => void;
};

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
    // The last chat the list holds, when it's full: whatever is older is past the cap.
    private listEnd: QueryDocumentSnapshot | null = null;
    private roomTimer?: ReturnType<typeof setTimeout>;

    private chats = new Map<string, ChatState>();
    private watches = new Map<string, Watch>();

    private health: AccountHealth = 'ok';
    private healthListeners = new Set<() => void>();

    constructor(
        private readonly db: Firestore,
        readonly uid: string,
        private readonly opts: AccountStoreOptions = {},
    ) {}

    // ── Health ───────────────────────────────────────────────────────────────

    subscribeHealth = (onChange: () => void): (() => void) => {
        this.healthListeners.add(onChange);
        return () => { this.healthListeners.delete(onChange); };
    };

    getHealth = (): AccountHealth => this.health;

    // Only for refusals that say the account can't hold chats at all.
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
        this.listUnsubs = [
            onSnapshot(query(chats, orderBy('updatedAt', 'desc'), limit(LIST_LIMIT)), (snap) => {
                this.recent = metas(snap.docs);
                this.listEnd = snap.docs.length === LIST_LIMIT ? snap.docs[snap.docs.length - 1] : null;
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
        this.listEnd = null;
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
        const failed = (e: unknown) => this.setChat(chatId, { status: 'error', error: codeOf(e) });
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

    // What was cached stops being current the moment nothing listens: it
    // goes too, so no later read takes an old copy (a stale link, say) as fact.
    private stopChat(chatId: string) {
        const w = this.watches.get(chatId);
        if (!w || w.listeners.size > 0) return;
        for (const unsub of w.unsubs) unsub();
        this.watches.delete(chatId);
        this.chats.delete(chatId);
    }

    // Everything this store listens to, on sign-out.
    dispose() {
        clearTimeout(this.roomTimer);
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
                if (failure.kind === 'create') this.refused(code);
                this.opts.onWriteFailed?.({ ...failure, code });
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
            throw new ChatStoreError(codeOf(e), String(e));
        }
    }

    async createChat(meta: ChatMeta, context: ChatContext | null, entries: Entry[]): Promise<void> {
        const record: ChatRecord = { meta, context, transcript: normalizeTranscript(entries.map(toStoredEntry)) };
        this.setChat(meta.id, { status: 'ready', record });
        const sent = this.send([planCreate(this.uid, meta, context, entries)], { chatId: meta.id, kind: 'create', record });
        this.scheduleRoom();
        return sent;
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
        // The link from what is being listened to now: the open chat, else the list.
        const state = this.watches.has(chatId) ? this.chats.get(chatId) : undefined;
        const shareId = (state?.status === 'ready' ? state.record.meta.share : this.list.chats.find((c) => c.id === chatId)?.share)?.id;
        return this.remove(chatId, shareId);
    }

    private async remove(chatId: string, shareId: string | null | undefined): Promise<void> {
        // Every entry document, including any the transcript repair set aside.
        const entryIds = this.watches.get(chatId)?.entryIds
            ?? (await getDocs(collection(this.db, 'users', this.uid, 'chats', chatId, 'entries'))).docs.map((d) => d.id);
        this.setChat(chatId, MISSING);
        return this.send(chunk(planDelete(this.uid, chatId, entryIds, shareId)), { chatId, kind: 'write' });
    }

    async importChat(record: ChatRecord): Promise<void> {
        await this.sendAndWait(planImport(this.uid, record.meta, record.context, record.transcript));
        this.scheduleRoom();
    }

    // ── The cap ──────────────────────────────────────────────────────────────

    // A chat arrived: once the list holds it, see whether the account is over.
    private scheduleRoom() {
        clearTimeout(this.roomTimer);
        this.roomTimer = setTimeout(() => void this.makeRoom(), ROOM_DELAY_MS);
    }

    // An account keeps its MAX_ACCOUNT_CHATS most recently used chats, as this
    // browser keeps MAX_LOCAL_CHATS: the unpinned ones that fall past the end
    // of the list go, so every chat kept is one the list shows. Only a full
    // list costs a read here, and a list that isn't being read (the chat
    // screen is closed) is left for the next new chat to tidy.
    private async makeRoom() {
        const end = this.listEnd;
        if (!end) return;
        try {
            const chats = collection(this.db, 'users', this.uid, 'chats');
            const past = await getDocs(query(chats, orderBy('updatedAt', 'desc'), startAfter(end), limit(OVERFLOW_BATCH)));
            const victims = planEvictions(metas(past.docs), (id) => this.opts.inUse?.(id) ?? false);
            for (const meta of victims) await this.remove(meta.id, meta.share?.id);
            if (victims.length > 0) this.opts.onEvicted?.(victims.map((m) => m.id));
        } catch {
            // Offline or refused: the next new chat tries again.
        }
    }

    // ── Shared links ─────────────────────────────────────────────────────────

    // Publishes the snapshot (or refreshes it, under the same link) and waits:
    // a link is handed out only once it works.
    async share(record: ChatRecord, snapshot: Snapshot): Promise<ShareRef> {
        const now = Date.now();
        const existing = record.meta.share;
        const id = existing?.id ?? doc(collection(this.db, 'shared_chats')).id;
        const createdAt = existing?.createdAt ?? now;
        const shared: ShareDoc = {
            v: SHARE_VERSION,
            ownerUid: this.uid,
            chatId: record.meta.id,
            title: record.meta.title,
            payload: snapshot.payload,
            createdAt,
            updatedAt: now,
        };
        const ref: ShareRef = { id, createdAt, updatedAt: now, lastOrder: snapshot.lastOrder };
        await this.sendAndWait([planShare(this.uid, record.meta.id, id, shared, ref)]);
        this.apply(record.meta.id, (r) => withMeta(r, { share: ref }));
        return ref;
    }

    // The link stops working at once: its snapshot is deleted, not hidden.
    async unshare(chatId: string, shareId: string): Promise<void> {
        await this.sendAndWait([planUnshare(this.uid, chatId, shareId)]);
        this.apply(chatId, (r) => withMeta(r, { share: null }));
    }
}
