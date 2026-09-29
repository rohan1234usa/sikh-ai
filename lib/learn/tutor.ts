// Client-safe, pure: the Punjabi tutor's conversation rules, shared by the
// page (app/components/learn/useTutor.ts) and the route (app/api/learn), and
// tested here. Like the chat, a conversation is a list of exchanges, one
// question with exactly one reply, so an unanswered question can't be
// represented.

export const MAX_TUTOR_MESSAGE_CHARS = 1000;
// Four exchanges ride along with each question: each question at the
// message cap, each reply cut to this.
export const MAX_TUTOR_HISTORY_TURNS = 8;
export const MAX_TUTOR_HISTORY_TURN_CHARS = 4000;
// A reply longer than this stops being shown (the output cap ends it far
// sooner; this only guards against a runaway stream).
export const MAX_TUTOR_REPLY_CHARS = 20_000;
// Exchanges kept in the tab's session; past this the oldest goes first.
export const MAX_TUTOR_EXCHANGES = 20;
// sessionStorage: the conversation lasts as long as the tab.
export const TUTOR_SESSION_KEY = 'sikhai.learn.tutor.v1';

// The route's error codes (errors.learn_* in the dictionaries), plus generic.
export const TUTOR_ERROR_CODES = ['learn_empty', 'learn_too_long', 'learn_failed', 'learn_busy', 'learn_blocked', 'generic'] as const;
export type TutorErrorCode = (typeof TUTOR_ERROR_CODES)[number];
export const isTutorErrorCode = (value: unknown): value is TutorErrorCode =>
    typeof value === 'string' && (TUTOR_ERROR_CODES as readonly string[]).includes(value);

export const TUTOR_STATUSES = ['streaming', 'done', 'interrupted', 'stopped', 'error'] as const;
export type TutorStatus = (typeof TUTOR_STATUSES)[number];

export type TutorReply = { text: string; status: TutorStatus; errorCode?: TutorErrorCode };
export type TutorExchange = { id: string; question: string; reply: TutorReply };
export type TutorSession = { lesson: string | null; exchanges: TutorExchange[] };
export type HistoryTurn = { role: 'user' | 'ai'; text: string };

// Shared, so frozen: nothing changes it in place.
export const EMPTY_SESSION: TutorSession = Object.freeze({ lesson: null, exchanges: Object.freeze([] as TutorExchange[]) as TutorExchange[] });

// A reply the next question can build on: something was actually said.
const answered = (reply: TutorReply) =>
    (reply.status === 'done' || reply.status === 'interrupted') && reply.text.trim() !== '';

// The conversation so far, for the model: the last answered exchanges, each
// turn cut to size. Failed and stopped attempts are left out, so Gemini
// never sees two questions in a row.
export function historyFor(exchanges: readonly TutorExchange[]): HistoryTurn[] {
    return exchanges
        .filter((exchange) => answered(exchange.reply))
        .slice(-(MAX_TUTOR_HISTORY_TURNS / 2))
        .flatMap((exchange): HistoryTurn[] => [
            { role: 'user', text: exchange.question.slice(0, MAX_TUTOR_MESSAGE_CHARS) },
            { role: 'ai', text: exchange.reply.text.slice(0, MAX_TUTOR_HISTORY_TURN_CHARS) },
        ]);
}

// How a stream ended, as the page saw it.
export type StreamOutcome =
    | { kind: 'closed' }                        // the body ended
    | { kind: 'http'; code: TutorErrorCode }    // an error response, before any text
    | { kind: 'failed' }                        // the connection or the stream broke
    | { kind: 'aborted' };                      // Stop, or a new conversation

// Never an empty bubble: a reply with nothing in it is stopped or an error.
export function settleReply(reply: TutorReply, outcome: StreamOutcome): TutorReply {
    const has = reply.text.trim() !== '';
    switch (outcome.kind) {
        case 'closed':
            return has ? { text: reply.text, status: 'done' } : { text: '', status: 'error', errorCode: 'generic' };
        case 'http':
            return { text: '', status: 'error', errorCode: outcome.code };
        case 'failed':
            return has ? { text: reply.text, status: 'interrupted' } : { text: '', status: 'error', errorCode: 'generic' };
        case 'aborted':
            return has ? { text: reply.text, status: 'interrupted' } : { text: '', status: 'stopped' };
    }
}

// The API's own code when it is one; busy for a bare 429 (the host's rate
// limiter answers without our JSON); otherwise generic.
export function tutorErrorCode(status: number, body: unknown): TutorErrorCode {
    const code = body && typeof body === 'object' ? (body as { code?: unknown }).code : undefined;
    if (isTutorErrorCode(code)) return code;
    return status === 429 ? 'learn_busy' : 'generic';
}

// Adds an exchange, letting the oldest go once the session is full.
export function appendExchange(exchanges: readonly TutorExchange[], exchange: TutorExchange): TutorExchange[] {
    return [...exchanges, exchange].slice(-MAX_TUTOR_EXCHANGES);
}

type Obj = Record<string, unknown>;
const isObject = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);

function parseReply(raw: unknown): TutorReply | null {
    if (!isObject(raw) || typeof raw.text !== 'string') return null;
    const status = raw.status;
    if (typeof status !== 'string' || !(TUTOR_STATUSES as readonly string[]).includes(status)) return null;
    const text = raw.text.slice(0, MAX_TUTOR_REPLY_CHARS);
    // Each state is held to what settleReply can produce, so an old or
    // edited copy can't bring back an empty bubble.
    switch (status as TutorStatus) {
        case 'error': return { text: '', status: 'error', errorCode: isTutorErrorCode(raw.errorCode) ? raw.errorCode : 'generic' };
        case 'stopped': return { text: '', status: 'stopped' };
        case 'done': return settleReply({ text, status: 'streaming' }, { kind: 'closed' });
        // A reply saved mid-stream (the tab was reloaded) can't resume.
        case 'streaming':
        case 'interrupted': return settleReply({ text, status: 'streaming' }, { kind: 'aborted' });
    }
}

function parseExchange(raw: unknown): TutorExchange[] {
    if (!isObject(raw) || typeof raw.id !== 'string' || raw.id.length === 0 || raw.id.length > 64) return [];
    if (typeof raw.question !== 'string' || raw.question.trim() === '') return [];
    const reply = parseReply(raw.reply);
    return reply ? [{ id: raw.id, question: raw.question.slice(0, MAX_TUTOR_MESSAGE_CHARS), reply }] : [];
}

// Anything in, a usable session out: junk gives an empty one, and a damaged
// exchange is dropped on its own.
export function parseTutorSession(raw: unknown): TutorSession {
    if (!isObject(raw)) return EMPTY_SESSION;
    const lesson = typeof raw.lesson === 'string' && /^[a-z0-9-]{1,80}$/.test(raw.lesson) ? raw.lesson : null;
    // An id names one exchange: a repeat is dropped.
    const seen = new Set<string>();
    const exchanges = (Array.isArray(raw.exchanges) ? raw.exchanges.flatMap(parseExchange) : [])
        .filter((exchange) => {
            if (seen.has(exchange.id)) return false;
            seen.add(exchange.id);
            return true;
        })
        .slice(-MAX_TUTOR_EXCHANGES);
    return { lesson, exchanges };
}
