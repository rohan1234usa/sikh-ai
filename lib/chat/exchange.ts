// Client-safe, pure: every decision about sending, retrying and settling a
// reply, so the rules are tested here and the React side only carries them out.

import { MAX_EXCHANGES_PER_CHAT, MAX_MESSAGE_CHARS, type LensId } from './config';
import {
    hasText,
    isReplyErrorCode,
    sameQuestion,
    type Entry,
    type Exchange,
    type Notice,
    type Reply,
    type ReplyErrorCode,
    type ReplySettings,
    type Transcript,
} from './transcript';

// How many past exchanges ride along with a question. The server keeps the
// last 10 turns (lib/chat/request.ts); five whole exchanges is exactly that,
// and always starts on a question.
export const MAX_HISTORY_EXCHANGES = 5;

export type HistoryTurn = { role: 'user' | 'ai'; text: string };

export const exchangesOf = (t: Transcript): Exchange[] => t.filter((e): e is Exchange => e.kind === 'exchange');

export function lastExchange(t: Transcript): Exchange | undefined {
    for (let i = t.length - 1; i >= 0; i--) {
        const e = t[i];
        if (e.kind === 'exchange') return e;
    }
    return undefined;
}

// A reply the next question can build on: something was actually said.
const answered = (r: Reply) => (r.status === 'done' || r.status === 'interrupted') && hasText(r.text);

// The conversation so far, for the model: whole exchanges that were answered,
// the most recent first to go. Failed and stopped attempts are left out, so
// Gemini never sees two questions in a row.
export function buildHistory(t: Transcript, beforeExchangeId?: string): HistoryTurn[] {
    const all = exchangesOf(t);
    const end = beforeExchangeId ? all.findIndex((e) => e.id === beforeExchangeId) : -1;
    return (end === -1 ? all : all.slice(0, end))
        .filter((e) => answered(e.reply))
        .slice(-MAX_HISTORY_EXCHANGES)
        .flatMap((e): HistoryTurn[] => [
            { role: 'user', text: e.question.text.slice(0, MAX_MESSAGE_CHARS) },
            { role: 'ai', text: e.reply.text.slice(0, MAX_MESSAGE_CHARS) },
        ]);
}

// Order is a timestamp that never goes backwards within a chat, so a device
// with a slow clock can't slip a new question in above an older one.
export function nextOrder(t: Transcript, now: number): number {
    const max = t.reduce((m, e) => Math.max(m, e.order), -Infinity);
    return Math.max(Math.floor(now), max + 1);
}

export type SendContext = { now: number; newId: () => string; settings: ReplySettings };

export type SendPlan = {
    // The exchange to write: new, or the last one again with a fresh reply.
    exchange: Exchange;
    // Written before the exchange when the lens changed since the last answer.
    notice?: Notice;
    // Notices between the previous exchange and this one that no longer apply.
    removeNoticeIds: string[];
    // The attempt being replaced; its late writes are refused (shouldReplaceReply).
    replacedReplyId?: string;
    isNew: boolean;
};

export type SendResult = { kind: 'send'; plan: SendPlan } | { kind: 'empty' | 'busy' | 'full' };

// The lens of the latest reply that said something, before the given
// exchange. A notice marks where that changes; a failed reply had nothing to
// say in any lens, so it doesn't count.
function lensBefore(t: Transcript, exchangeId?: string): LensId | undefined {
    const all = exchangesOf(t);
    const end = exchangeId ? all.findIndex((e) => e.id === exchangeId) : all.length;
    for (let i = (end === -1 ? all.length : end) - 1; i >= 0; i--) {
        const r = all[i].reply;
        if (answered(r) && r.settings) return r.settings.lensId;
    }
    return undefined;
}

function newReply(ctx: SendContext): Reply {
    return { id: ctx.newId(), status: 'streaming', text: '', settings: ctx.settings, startedAt: ctx.now };
}

// Places `exchange` (last in the chat) after a lens notice when one is due,
// dropping notices left between it and the exchange before it.
function place(t: Transcript, exchange: Exchange, ctx: SendContext, isNew: boolean, replacedReplyId?: string): SendPlan {
    const exchangeIdx = isNew ? t.length : t.findIndex((e) => e.id === exchange.id);
    let prevIdx = exchangeIdx - 1;
    while (prevIdx >= 0 && t[prevIdx].kind !== 'exchange') prevIdx--;
    const between = [...t.slice(prevIdx + 1, exchangeIdx), ...(isNew ? [] : t.slice(exchangeIdx + 1))]
        .filter((e): e is Notice => e.kind === 'notice');

    const previousLens = lensBefore(t, isNew ? undefined : exchange.id);
    const order = nextOrder(t, ctx.now);
    const needsNotice = previousLens !== undefined && previousLens !== ctx.settings.lensId;
    // A retry under the same lens keeps the notice it already has.
    const reused = needsNotice ? between.find((n) => n.lensId === ctx.settings.lensId) : undefined;
    const notice: Notice | undefined = !needsNotice
        ? undefined
        : reused
            ? { ...reused, order }
            : { kind: 'notice', id: ctx.newId(), order, createdAt: ctx.now, lensId: ctx.settings.lensId };
    return {
        exchange: { ...exchange, order: needsNotice ? order + 1 : order },
        ...(notice ? { notice } : {}),
        removeNoticeIds: between.filter((n) => n !== reused).map((n) => n.id),
        ...(replacedReplyId ? { replacedReplyId } : {}),
        isNew,
    };
}

const replaceable = (r: Reply) => r.status === 'error' || r.status === 'stopped' || r.status === 'interrupted';

// A new question. Asking again the question whose reply just failed, was
// stopped or was cut short replaces that attempt rather than adding a second
// copy of the question underneath it.
export function planSend(t: Transcript, text: string, ctx: SendContext): SendResult {
    const question = text.trim();
    if (!question) return { kind: 'empty' };
    const last = lastExchange(t);
    if (last?.reply.status === 'streaming') return { kind: 'busy' };

    if (last && replaceable(last.reply) && sameQuestion(last.question.text, question)) {
        const again: Exchange = { ...last, question: { text: question, createdAt: ctx.now }, reply: newReply(ctx) };
        return { kind: 'send', plan: place(t, again, ctx, false, last.reply.id) };
    }
    if (exchangesOf(t).length >= MAX_EXCHANGES_PER_CHAT) return { kind: 'full' };
    const exchange: Exchange = {
        kind: 'exchange',
        id: ctx.newId(),
        order: 0,
        question: { text: question, createdAt: ctx.now },
        reply: newReply(ctx),
    };
    return { kind: 'send', plan: place(t, exchange, ctx, true) };
}

// Retry (a failed or stopped reply) and Regenerate (any other) both ask the
// last question again, with the settings chosen now. Only the last: a reply
// in the middle was what the rest of the conversation built on.
export function planRetry(t: Transcript, ctx: SendContext): SendPlan | null {
    const last = lastExchange(t);
    if (!last || last.reply.status === 'streaming') return null;
    const again: Exchange = { ...last, reply: newReply(ctx) };
    return place(t, again, ctx, false, last.reply.id);
}

// How a stream ended, as the runtime saw it.
export type StreamOutcome =
    | { kind: 'closed' }                        // the body ended
    | { kind: 'http'; code: ReplyErrorCode }    // an error response, before any text
    | { kind: 'failed' }                        // the connection or stream broke
    | { kind: 'aborted' };                      // Stop, sign-out, or a deleted chat

// Never an empty bubble: a reply with nothing in it is stopped or an error.
export function settleReply(r: Reply, outcome: StreamOutcome, now: number): Reply {
    const has = hasText(r.text);
    const base = { ...r, finishedAt: now };
    switch (outcome.kind) {
        case 'closed':
            return has ? { ...base, status: 'done' } : { ...base, status: 'error', errorCode: 'generic', text: '' };
        case 'http':
            return { ...base, status: 'error', errorCode: outcome.code, text: '' };
        case 'failed':
            return has ? { ...base, status: 'interrupted' } : { ...base, status: 'error', errorCode: 'generic', text: '' };
        case 'aborted':
            return has ? { ...base, status: 'interrupted' } : { ...base, status: 'stopped', text: '' };
    }
}

// The API's own code when it's one a reply can show; failing that, busy for a
// bare 429 (the host's rate limiter answers without our JSON), else generic.
export function errorCodeFromResponse(status: number, body: unknown): ReplyErrorCode {
    const code = body && typeof body === 'object' ? (body as { code?: unknown }).code : undefined;
    if (isReplyErrorCode(code)) return code;
    return status === 429 ? 'chat_busy' : 'generic';
}

// A write of `next` over `current` for the same exchange goes through only if
// it is the same attempt or a newer one: a slow write from an attempt that a
// retry already replaced must not bring the old reply back.
export function shouldReplaceReply(current: Reply | undefined, next: Reply): boolean {
    if (!current || current.id === next.id) return true;
    return next.startedAt >= current.startedAt;
}

export type DisplayItem =
    | { kind: 'notice'; notice: Notice }
    | { kind: 'question'; exchange: Exchange }
    | { kind: 'reply'; exchange: Exchange; isLast: boolean; canRetry: boolean; canRegenerate: boolean };

// What the view draws, and which reply offers what. Retry is for a reply that
// failed or stopped before saying anything; Regenerate for one that said
// something. Either only on the last exchange, and not while it streams.
export function toDisplayItems(t: Transcript): DisplayItem[] {
    const last = lastExchange(t);
    return t.flatMap((e: Entry): DisplayItem[] => {
        if (e.kind === 'notice') return [{ kind: 'notice', notice: e }];
        const isLast = e === last;
        const s = e.reply.status;
        return [
            { kind: 'question', exchange: e },
            {
                kind: 'reply',
                exchange: e,
                isLast,
                canRetry: isLast && (s === 'error' || s === 'stopped'),
                canRegenerate: isLast && (s === 'done' || s === 'interrupted'),
            },
        ];
    });
}
