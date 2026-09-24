// Replies in flight, owned outside React. A reply keeps streaming when the
// user switches chat, starts a new one, or leaves the chat page for another
// part of the site, and is saved to its own chat when it ends. Only Stop,
// deleting its chat, or signing out end it early. Closing or reloading the
// tab ends it too; the last checkpoint (ChatStore.checkpointMs, and a flush
// on pagehide) keeps what had arrived.
//
// Framework-free, with fetch and the clock passed in, so the tests drive it
// with a fake stream.

import { hasGurmukhiRun, MAX_VERIFY_CHARS, sanitizeCitations, type Citation } from '@/lib/gurbani/citations';
import { MAX_REPLY_CHARS, type ChatContext, type LanguageId, type LensId, type ModeId, type Script } from './config';
import { errorCodeFromResponse, settleReply, type HistoryTurn, type StreamOutcome } from './exchange';
import { hasText, type Reply } from './transcript';
import { storeErrorCode, type ChatStore } from './store/types';

// Exactly what POST /api/chat reads.
export type ChatRequestBody = {
    message: string;
    history: HistoryTurn[];
    lensId: LensId;
    modeId: ModeId;
    languageId: LanguageId;
    script?: Script;
    context?: Pick<ChatContext, 'type' | 'title' | 'text'>;
};

export type ReplyJob = {
    store: ChatStore;
    chatId: string;
    exchangeId: string;
    reply: Reply; // status 'streaming', no text yet
    body: ChatRequestBody;
};

// unsaved: finished, but the store refused it (storage full); shown for this visit.
export type InflightReply = { chatId: string; exchangeId: string; reply: Reply; unsaved?: true };

export type RuntimeDeps = {
    fetch: typeof fetch;
    now: () => number;
    // The Gurbani check of a finished reply; best effort, [] on any failure.
    verify: (text: string, signal: AbortSignal) => Promise<Citation[]>;
    // Called when a finished reply could not be saved (storage full, account
    // refused). The reply stays on screen for this visit.
    onSaveFailed?: (job: InflightReply, error: unknown) => void;
};

type Job = ReplyJob & {
    controller: AbortController;
    stoppedBy?: 'user' | 'signout' | 'discard';
};

export class ReplyRuntime {
    // By reply id: a retry is a new attempt with a new id, so an old stream
    // finishing late can never clear the new one's state.
    private jobs = new Map<string, Job>();
    // By chat id, for the view; a new Map on every change (useSyncExternalStore).
    private snapshot: ReadonlyMap<string, InflightReply> = new Map();
    // Final replies whose save failed: still shown, by chat id.
    private unsaved = new Map<string, InflightReply>();
    private listeners = new Set<() => void>();
    private verifications = new Map<string, AbortController>();

    constructor(private readonly deps: RuntimeDeps) {}

    // Arrow properties: handed to useSyncExternalStore unbound.
    subscribe = (onChange: () => void): (() => void) => {
        this.listeners.add(onChange);
        return () => { this.listeners.delete(onChange); };
    };

    getSnapshot = (): ReadonlyMap<string, InflightReply> => this.snapshot;

    isBusy(chatId: string): boolean {
        return [...this.jobs.values()].some((j) => j.chatId === chatId);
    }

    private publish() {
        const next = new Map<string, InflightReply>(this.unsaved);
        for (const j of this.jobs.values()) next.set(j.chatId, { chatId: j.chatId, exchangeId: j.exchangeId, reply: j.reply });
        this.snapshot = next;
        for (const cb of [...this.listeners]) cb();
    }

    start(job: ReplyJob): void {
        const full: Job = { ...job, controller: new AbortController() };
        this.unsaved.delete(job.chatId);
        // A new attempt at this exchange: a check still running for the one it
        // replaces must not attach its cards to this one. (Checks for other
        // exchanges carry on: the next question doesn't cancel the last's.)
        this.abortChecks(`${job.chatId}/${job.exchangeId}/`);
        this.jobs.set(job.reply.id, full);
        this.publish();
        void this.run(full);
    }

    // Stop: the reply keeps what arrived (interrupted), or is marked stopped.
    stop(replyId: string): void {
        const job = this.jobs.get(replyId);
        if (!job) return;
        job.stoppedBy ??= 'user';
        job.controller.abort();
    }

    // The chat is being deleted: end its reply and write nothing.
    discardChat(chatId: string): void {
        this.unsaved.delete(chatId);
        for (const job of this.jobs.values()) {
            if (job.chatId !== chatId) continue;
            job.stoppedBy = 'discard';
            job.controller.abort();
        }
        this.abortChecks(`${chatId}/`);
        this.publish();
    }

    // Checks are keyed chat/exchange/reply; this ends those under a prefix.
    private abortChecks(prefix: string) {
        for (const [key, c] of this.verifications) if (key.startsWith(prefix)) c.abort();
    }

    // Signing out: stop every reply bound for that account. Their partial
    // text is saved if the store still accepts it; there is no citation check.
    stopFor(store: ChatStore): void {
        for (const job of this.jobs.values()) {
            if (job.store !== store) continue;
            job.stoppedBy = 'signout';
            job.controller.abort();
        }
    }

    // The account refused a new chat and its copy now lives in this browser:
    // the reply already running for it saves there instead.
    retarget(chatId: string, store: ChatStore): void {
        for (const job of this.jobs.values()) if (job.chatId === chatId) job.store = store;
    }

    // pagehide: save what every reply has so far, as the page may be gone
    // before the next checkpoint. The local store writes synchronously.
    flush(): void {
        for (const job of this.jobs.values()) void job.store.putReply(job.chatId, job.exchangeId, job.reply).catch(() => {});
    }

    private async run(job: Job) {
        let lastCheckpoint = this.deps.now();
        let outcome: StreamOutcome;
        try {
            const res = await this.deps.fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(job.body),
                signal: job.controller.signal,
            });
            if (!res.ok || !res.body) {
                const data = res.headers.get('content-type')?.includes('json') ? await res.json().catch(() => null) : null;
                outcome = { kind: 'http', code: errorCodeFromResponse(res.status, data) };
            } else {
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    if (!chunk) continue;
                    job.reply = { ...job.reply, text: (job.reply.text + chunk).slice(0, MAX_REPLY_CHARS) };
                    this.publish();
                    // job.store, read each time: it can be retargeted mid-reply.
                    if (this.deps.now() - lastCheckpoint >= job.store.checkpointMs) {
                        lastCheckpoint = this.deps.now();
                        void job.store.putReply(job.chatId, job.exchangeId, job.reply).catch(() => {});
                    }
                }
                outcome = { kind: 'closed' };
            }
        } catch {
            outcome = job.controller.signal.aborted ? { kind: 'aborted' } : { kind: 'failed' };
        }

        if (job.stoppedBy === 'discard') {
            this.jobs.delete(job.reply.id);
            this.publish();
            return;
        }

        // The view keeps showing this final state until the store has it, so
        // handing over from the live reply to the saved one never flickers.
        job.reply = settleReply(job.reply, outcome, this.deps.now());
        this.publish();
        let saved = true;
        try {
            await job.store.putReply(job.chatId, job.exchangeId, job.reply);
        } catch (error) {
            saved = false;
            if (storeErrorCode(error) !== 'gone') {
                const inflight: InflightReply = { chatId: job.chatId, exchangeId: job.exchangeId, reply: job.reply, unsaved: true };
                this.unsaved.set(job.chatId, inflight);
                this.deps.onSaveFailed?.(inflight, error);
            }
        }
        this.jobs.delete(job.reply.id);
        this.publish();

        // Quotes are checked once the reply has stopped moving: also after a
        // Stop (what arrived is on screen), but not after a sign-out.
        const checkable = hasText(job.reply.text) && (outcome.kind !== 'aborted' || job.stoppedBy === 'user');
        if (saved && checkable) void this.check(job);
    }

    private async check(job: Job) {
        const { text, id: replyId } = job.reply;
        if (!hasGurmukhiRun(text)) return;
        const key = `${job.chatId}/${job.exchangeId}/${replyId}`;
        const controller = new AbortController();
        this.verifications.set(key, controller);
        try {
            const citations = sanitizeCitations(await this.deps.verify(text.slice(0, MAX_VERIFY_CHARS), controller.signal));
            if (citations.length && !controller.signal.aborted) {
                await job.store.setCitations(job.chatId, job.exchangeId, replyId, citations);
            }
        } catch {
            // Offline, aborted, or the chat is gone: no cards.
        } finally {
            if (this.verifications.get(key) === controller) this.verifications.delete(key);
        }
    }
}

// The browser's citation check: POST /api/chat/verify (lib/gurbani/verify.ts).
export async function verifyOverHttp(text: string, signal: AbortSignal): Promise<Citation[]> {
    const res = await fetch('/api/chat/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal,
    });
    if (!res.ok) return [];
    return sanitizeCitations((await res.json().catch(() => null))?.citations);
}
