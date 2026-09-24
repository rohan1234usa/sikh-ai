import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRetry, planSend, type SendPlan } from '@/lib/chat/exchange';
import { ReplyRuntime, type ChatRequestBody, type RuntimeDeps } from '@/lib/chat/runtime';
import { LocalChatStore } from '@/lib/chat/store/local';
import type { ChatState } from '@/lib/chat/store/types';
import type { Exchange, Transcript } from '@/lib/chat/transcript';
import type { Citation } from '@/lib/gurbani/citations';
import { SIKHAI, ids } from './helpers';
import { FakeStorage, UUID, meta, settle } from './store-helpers';

// One /api/chat call the test controls: push text, end it, break it.
type Call = {
    body: ChatRequestBody;
    push(text: string): void;
    end(): void;
    fail(): void;
    respond(status: number, json?: unknown): void;
};

function fakeFetch() {
    const calls: Call[] = [];
    const fetch = ((_url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
        let stream!: ReadableStreamDefaultController<Uint8Array>;
        const body = new ReadableStream<Uint8Array>({ start: (c) => { stream = c; } });
        let responded = false;
        const encoder = new TextEncoder();
        const answer = () => {
            if (!responded) resolve(new Response(body, { headers: { 'content-type': 'text/plain' } }));
            responded = true;
        };
        init.signal?.addEventListener('abort', () => {
            const e = new DOMException('The operation was aborted.', 'AbortError');
            if (responded) stream.error(e);
            else reject(e);
        });
        calls.push({
            body: JSON.parse(String(init.body)),
            push: (text) => { answer(); stream.enqueue(encoder.encode(text)); },
            end: () => { answer(); stream.close(); },
            fail: () => { answer(); stream.error(new TypeError('network error')); },
            respond: (status, json) => {
                responded = true;
                resolve(json === undefined
                    ? new Response('Too Many Requests', { status })
                    : new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } }));
            },
        });
    })) as typeof globalThis.fetch;
    return { fetch, calls };
}

function setup(over: Partial<RuntimeDeps> = {}) {
    const { fetch, calls } = fakeFetch();
    let clock = 1_000;
    const verified: string[] = [];
    const citation: Citation = { quote: 'ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ', status: 'unverified' };
    const storage = new FakeStorage();
    const store = new LocalChatStore({ storage, now: () => clock });
    const runtime = new ReplyRuntime({
        fetch,
        now: () => clock,
        verify: async (text) => { verified.push(text); return [citation]; },
        ...over,
    });
    const newId = ids('x');
    return {
        store, runtime, calls, storage, verified,
        tick: (ms: number) => { clock += ms; },
        // What the chat page does to send: plan, write, start.
        async send(chatId: string, text: string): Promise<SendPlan> {
            const state = store.getChat(chatId);
            const transcript: Transcript = state.status === 'ready' ? state.record.transcript : [];
            const result = planSend(transcript, text, { now: clock, newId, settings: SIKHAI });
            assert.equal(result.kind, 'send');
            const { plan } = result as { plan: SendPlan };
            const entries = plan.notice ? [plan.notice, plan.exchange] : [plan.exchange];
            if (state.status === 'ready') await store.putEntries(chatId, entries, { touch: clock, removeIds: plan.removeNoticeIds });
            else await store.createChat(meta(0, { id: chatId }), null, entries);
            runtime.start({
                store, chatId, exchangeId: plan.exchange.id, reply: plan.exchange.reply,
                body: { message: text, history: [], ...SIKHAI },
            });
            await settle();
            return plan;
        },
    };
}

const exchangesIn = (s: ChatState): Exchange[] =>
    s.status === 'ready' ? s.record.transcript.filter((e): e is Exchange => e.kind === 'exchange') : [];

test('a reply streams into the view, is saved when it ends, and its Gurbani is checked', async () => {
    const t = setup();
    const plan = await t.send(UUID(1), 'What is Naam?');
    const call = t.calls[0];
    assert.equal(call.body.message, 'What is Naam?');

    call.push('ਸਤਿ ਨਾਮੁ ');
    await settle();
    assert.equal(t.runtime.getSnapshot().get(UUID(1))?.reply.text, 'ਸਤਿ ਨਾਮੁ ');
    call.push('ਕਰਤਾ ਪੁਰਖੁ ॥');
    call.end();
    await settle();

    assert.equal(t.runtime.getSnapshot().size, 0, 'the live copy hands over to the saved one');
    const [ex] = exchangesIn(t.store.getChat(UUID(1)));
    assert.deepEqual([ex.id, ex.reply.id, ex.reply.status, ex.reply.text], [plan.exchange.id, plan.exchange.reply.id, 'done', 'ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ॥']);
    assert.equal(t.verified.length, 1);
    assert.equal(ex.reply.citations?.length, 1);
});

test('the reported bug end to end: busy, asked again, answered — one question in the chat', async () => {
    const t = setup();
    const Q = 'Explain the meaning of the Mool Mantar';
    await t.send(UUID(1), Q);
    t.calls[0].respond(429);
    await settle();
    let [ex] = exchangesIn(t.store.getChat(UUID(1)));
    assert.deepEqual([ex.reply.status, ex.reply.errorCode], ['error', 'chat_busy']);

    await t.send(UUID(1), Q);
    t.calls[1].push('Ik Onkar — One creator.');
    t.calls[1].end();
    await settle();
    const all = exchangesIn(t.store.getChat(UUID(1)));
    assert.equal(all.length, 1);
    [ex] = all;
    assert.deepEqual([ex.question.text, ex.reply.status], [Q, 'done']);
});

test('error responses become codes the reply can show', async () => {
    const t = setup();
    await t.send(UUID(1), 'Blocked?');
    t.calls[0].respond(422, { error: '…', code: 'chat_blocked' });
    await settle();
    assert.equal(exchangesIn(t.store.getChat(UUID(1)))[0].reply.errorCode, 'chat_blocked');

    await t.send(UUID(2), 'Empty?');
    t.calls[1].end();
    await settle();
    assert.deepEqual(
        [exchangesIn(t.store.getChat(UUID(2)))[0].reply.status, exchangesIn(t.store.getChat(UUID(2)))[0].reply.errorCode],
        ['error', 'generic'],
    );
});

test('a broken stream keeps what arrived; with nothing, it is an error', async () => {
    const t = setup();
    await t.send(UUID(1), 'One');
    t.calls[0].push('Half an');
    await settle();
    t.calls[0].fail();
    await settle();
    assert.deepEqual([exchangesIn(t.store.getChat(UUID(1)))[0].reply.status, exchangesIn(t.store.getChat(UUID(1)))[0].reply.text], ['interrupted', 'Half an']);

    await t.send(UUID(2), 'Two');
    t.calls[1].fail();
    await settle();
    assert.equal(exchangesIn(t.store.getChat(UUID(2)))[0].reply.errorCode, 'generic');
});

test('Stop before any text keeps the reply as stopped, ready to retry; after text, as interrupted and checked', async () => {
    const t = setup();
    const first = await t.send(UUID(1), 'One');
    t.runtime.stop(first.exchange.reply.id);
    await settle();
    const [one] = exchangesIn(t.store.getChat(UUID(1)));
    assert.equal(one.reply.status, 'stopped', 'the old page deleted the bubble here, orphaning the question');

    const second = await t.send(UUID(2), 'Two');
    t.calls[1].push('ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ');
    await settle();
    t.runtime.stop(second.exchange.reply.id);
    await settle();
    const [two] = exchangesIn(t.store.getChat(UUID(2)));
    assert.deepEqual([two.reply.status, two.reply.text], ['interrupted', 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ']);
    assert.equal(t.verified.length, 1, 'what arrived before a Stop is still checked');
});

test('deleting a chat ends its reply and writes nothing', async () => {
    const t = setup();
    await t.send(UUID(1), 'One');
    t.calls[0].push('Partial');
    await settle();
    await t.store.deleteChat(UUID(1));
    t.runtime.discardChat(UUID(1));
    await settle();
    assert.equal(t.store.getChat(UUID(1)).status, 'missing');
    assert.equal(t.runtime.getSnapshot().size, 0);
});

test('two chats reply at once, and one finishing leaves the other streaming', async () => {
    const t = setup();
    await t.send(UUID(1), 'A');
    await t.send(UUID(2), 'B');
    t.calls[0].push('Answer A');
    t.calls[0].end();
    t.calls[1].push('Answer B, still going');
    await settle();
    assert.deepEqual([...t.runtime.getSnapshot().keys()], [UUID(2)]);
    assert.equal(exchangesIn(t.store.getChat(UUID(1)))[0].reply.status, 'done');
    assert.equal(t.runtime.isBusy(UUID(2)), true);
});

test('a reply is saved as it streams, so a reload mid-answer keeps what arrived', async () => {
    const t = setup();
    await t.send(UUID(1), 'Long question');
    t.calls[0].push('First part. ');
    await settle();
    t.tick(1_500); // past the local store's checkpoint interval
    t.calls[0].push('Second part. ');
    await settle();

    // The page reloads: a new store on the same storage, the stream gone.
    let reopened = new LocalChatStore({ storage: t.storage });
    let [ex] = exchangesIn(reopened.getChat(UUID(1)));
    assert.deepEqual([ex.reply.status, ex.reply.text], ['interrupted', 'First part. Second part. ']);

    // pagehide saves whatever came after the last checkpoint.
    t.calls[0].push('Third.');
    await settle();
    t.runtime.flush();
    reopened = new LocalChatStore({ storage: t.storage });
    [ex] = exchangesIn(reopened.getChat(UUID(1)));
    assert.equal(ex.reply.text, 'First part. Second part. Third.');
});

test('a reply that could not be saved stays on screen for this visit', async () => {
    const failures: unknown[] = [];
    const t = setup({ onSaveFailed: (_job, e) => failures.push(e) });
    await t.send(UUID(1), 'Q');
    t.storage.quota = t.storage.size(); // full, and nothing else to evict
    t.calls[0].push('An answer that will not fit');
    t.calls[0].end();
    await settle();
    assert.equal(failures.length, 1);
    assert.equal(t.runtime.getSnapshot().get(UUID(1))?.reply.status, 'done');
    assert.equal(t.verified.length, 0, 'no check for a reply that was not saved');
});

test('the next question leaves the last answer\'s Gurbani check running; retrying that answer ends it', async () => {
    const pending: { text: string; resolve: () => void }[] = [];
    const card: Citation = { quote: 'ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ', status: 'unverified' };
    const t = setup({
        verify: (text, signal) => new Promise((resolve, reject) => {
            pending.push({ text, resolve: () => resolve([card]) });
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    });
    const gurbani = 'ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ॥';
    await t.send(UUID(1), 'One');
    t.calls[0].push(gurbani);
    t.calls[0].end();
    await settle();
    assert.equal(pending.length, 1, 'the first answer is being checked');

    await t.send(UUID(1), 'Two'); // a new question, while that check runs
    pending[0].resolve();
    await settle();
    assert.equal(exchangesIn(t.store.getChat(UUID(1)))[0].reply.citations?.length, 1, 'its cards still arrive');

    t.calls[1].push(gurbani);
    t.calls[1].end();
    await settle();
    assert.equal(pending.length, 2);

    // Regenerate the second answer while its check is still out.
    const state = t.store.getChat(UUID(1));
    const plan = planRetry(state.status === 'ready' ? state.record.transcript : [], { now: 5_000, newId: () => 'retry-reply', settings: SIKHAI })!;
    await t.store.putEntries(UUID(1), [plan.exchange], { touch: 5_000, removeIds: plan.removeNoticeIds });
    t.runtime.start({ store: t.store, chatId: UUID(1), exchangeId: plan.exchange.id, reply: plan.exchange.reply, body: { message: 'Two', history: [], ...SIKHAI } });
    await settle();
    pending[1].resolve();
    await settle();
    const second = exchangesIn(t.store.getChat(UUID(1)))[1];
    assert.equal(second.reply.id, 'retry-reply');
    assert.equal(second.reply.citations, undefined, 'the replaced attempt\'s cards never land on the new one');
});

test('the list of replying chats changes when a reply starts and ends, not with every chunk', async () => {
    const t = setup();
    assert.equal(t.runtime.getReplying().size, 0);
    await t.send(UUID(1), 'What is Naam?');
    const replying = t.runtime.getReplying();
    assert.deepEqual([...replying], [UUID(1)]);
    t.calls[0].push('Naam is ');
    await settle();
    t.calls[0].push('the Name.');
    await settle();
    assert.equal(t.runtime.getReplying(), replying, 'the same object while it streams');
    t.calls[0].end();
    await settle();
    assert.equal(t.runtime.getReplying().size, 0);
});
