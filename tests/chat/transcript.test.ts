import { test } from 'node:test';
import assert from 'node:assert/strict';
import en from '@/lib/i18n/dictionaries/en';
import { MAX_EXCHANGES_PER_CHAT, MAX_MESSAGE_CHARS, MAX_REPLY_CHARS } from '@/lib/chat/config';
import { toDisplayItems } from '@/lib/chat/exchange';
import {
    REPLY_ERROR_CODES,
    fromLegacyMessages,
    normalizeTranscript,
    toStoredEntry,
    type Exchange,
    type Transcript,
} from '@/lib/chat/transcript';
import { exchange, notice, reply } from './helpers';

const G = { id: 'greeting', role: 'ai', text: 'Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh.', createdAt: 0 };
const user = (id: string, text: string, createdAt: number) => ({ id, role: 'user', text, createdAt });
const ai = (id: string, text: string, createdAt: number, extra: object = {}) => ({ id, role: 'ai', text, createdAt, ...extra });
const Q = 'Explain the meaning of the Mool Mantar';

const exchanges = (t: Transcript) => t.filter((e): e is Exchange => e.kind === 'exchange');
const summary = (t: Transcript) => t.map((e) => (e.kind === 'notice' ? `N:${e.lensId ?? e.text}` : `${e.question.text}→${e.reply.status}`));

test('the stored chat from the bug report — the same question twice, no answer — becomes one question you can retry', () => {
    const t = fromLegacyMessages([G, user('u1', Q, 100), user('u2', Q, 200)]);
    assert.deepEqual(summary(t), [`${Q}→stopped`]);
    const last = toDisplayItems(t).at(-1);
    assert.equal(last?.kind === 'reply' && last.canRetry, true);
});

test('a failed question asked again keeps only the attempt that was answered', () => {
    const t = fromLegacyMessages([
        G, user('u1', 'What is Seva?', 100), ai('a1', 'Selfless service.', 110),
        user('u2', Q, 200), user('u3', Q, 300), ai('a3', 'Ik Onkar…', 310),
    ]);
    assert.deepEqual(summary(t), ['What is Seva?→done', `${Q}→done`]);
});

test('two different unanswered questions both stay, each stopped', () => {
    const t = fromLegacyMessages([G, user('u1', 'First?', 100), user('u2', 'Second?', 200)]);
    assert.deepEqual(summary(t), ['First?→stopped', 'Second?→stopped']);
});

test('old messages map onto reply states', () => {
    const t = fromLegacyMessages([
        G,
        user('u1', 'One', 100), ai('a1', 'SikhAI is very busy right now.', 110, { isError: true }),
        user('u2', 'Two', 200), ai('a2', 'Half an ans', 210, { interrupted: true }),
        user('u3', 'Three', 300), ai('a3', '', 310),
        user('u4', 'Four', 400), ai('a4', 'Whole answer.', 410),
    ]);
    const [one, two, three, four] = exchanges(t);
    // A stored error was already translated; the code is kept and the text goes.
    assert.deepEqual([one.reply.status, one.reply.errorCode, one.reply.text], ['error', 'generic', '']);
    assert.deepEqual([two.reply.status, two.reply.text], ['interrupted', 'Half an ans']);
    assert.equal(three.reply.status, 'stopped');
    assert.deepEqual([four.reply.status, four.reply.id, four.id], ['done', 'a4', 'u4']);
    assert.equal(four.reply.settings, undefined, 'old replies have no settings, so no label');
});

test('the greeting and answers to nothing are dropped; the v1 shape reads the same', () => {
    const t = fromLegacyMessages([G, ai('stray', 'Hello?', 5), user('u1', 'Hi', 10), ai('a1', 'Sat Sri Akal', 20)]);
    assert.deepEqual(summary(t), ['Hi→done']);
    assert.deepEqual(fromLegacyMessages('not a list'), []);
    assert.deepEqual(fromLegacyMessages([G]), []);
});

test('an old notice goes after the reply it was written during, and orders rise strictly', () => {
    const t = fromLegacyMessages([
        G, user('u1', 'One', 100), ai('a1', 'A', 100),
        user('u2', 'Two', 100), { id: 'n1', role: 'notice', text: 'Now answering through the lens of Guru Nanak Dev Ji', createdAt: 100 },
        ai('a2', 'B', 100), user('u3', 'Three', 100), ai('a3', 'C', 100),
    ]);
    assert.deepEqual(summary(t), ['One→done', 'Two→done', 'N:Now answering through the lens of Guru Nanak Dev Ji', 'Three→done']);
    const orders = t.map((e) => e.order);
    assert.ok(orders.every((o, i) => i === 0 || o > orders[i - 1]), `orders ${orders} must rise`);
});

test('status and text always agree after loading', () => {
    const t = normalizeTranscript([
        exchange('a', { order: 1, reply: { status: 'done', text: '  ' } }),
        exchange('b', { order: 2, reply: { status: 'interrupted', text: '' } }),
        exchange('c', { order: 3, reply: { status: 'stopped', text: 'Some words' } }),
        exchange('d', { order: 4, reply: { status: 'error', errorCode: 'chat_busy', text: 'leftover' } }),
        exchange('e', { order: 5, reply: { status: 'error', errorCode: 'made_up' as never } }),
    ]);
    const r = exchanges(t).map((e) => e.reply);
    assert.deepEqual([r[0].status, r[0].errorCode], ['error', 'generic']);
    assert.equal(r[1].status, 'stopped');
    assert.deepEqual([r[2].status, r[2].text], ['interrupted', 'Some words']);
    assert.deepEqual([r[3].status, r[3].errorCode, r[3].text], ['error', 'chat_busy', '']);
    assert.equal(r[4].errorCode, 'generic');
});

test('a reply still streaming is kept only in memory; stored, it is interrupted or stopped', () => {
    const raw = [
        exchange('a', { order: 1, reply: { status: 'streaming', text: 'Partial' } }),
        exchange('b', { order: 2, reply: { status: 'streaming', text: '' } }),
    ];
    assert.deepEqual(exchanges(normalizeTranscript(raw)).map((e) => e.reply.status), ['interrupted', 'stopped']);
    assert.deepEqual(exchanges(normalizeTranscript(raw, { allowStreaming: true })).map((e) => e.reply.status), ['streaming', 'streaming']);
    assert.deepEqual(raw.map((e) => (toStoredEntry(e) as Exchange).reply.status), ['interrupted', 'stopped']);
});

test('a retry of a failed question keeps only the retry, even across a lens notice', () => {
    const t = normalizeTranscript([
        exchange('Q', { order: 1, reply: { status: 'error', errorCode: 'chat_busy' } }),
        notice('guru-nanak', 2),
        exchange('q ', { order: 3 }),
    ]);
    assert.deepEqual(summary(t), ['q →done']);
});

test('an interrupted or answered question asked again stays: it said something', () => {
    const t = normalizeTranscript([
        exchange('Q', { order: 1, reply: { status: 'interrupted', text: 'Part' } }),
        exchange('Q', { order: 2 }),
        exchange('Q', { order: 3 }),
    ]);
    assert.equal(exchanges(t).length, 3);
});

test('notices stand only directly before an exchange', () => {
    const t = normalizeTranscript([
        notice('guru-nanak', 1),
        exchange('One', { order: 2 }),
        notice('guru-angad', 3),
        notice('guru-arjan', 4),
        exchange('Two', { order: 5 }),
        notice('sikhai', 6),
    ]);
    assert.deepEqual(summary(t), ['One→done', 'N:guru-arjan', 'Two→done']);
});

test('a long chat keeps its latest exchanges, whole', () => {
    const raw: Transcript = Array.from({ length: MAX_EXCHANGES_PER_CHAT + 30 }, (_, i) => exchange(`Q${i}`, { order: i * 2 + 2 }));
    raw.splice(60, 0, notice('guru-nanak', 61));
    const t = normalizeTranscript(raw);
    assert.equal(exchanges(t).length, MAX_EXCHANGES_PER_CHAT);
    assert.equal(t[0].kind, 'exchange');
    assert.equal((t[0] as Exchange).question.text, 'Q30');
});

test('junk is dropped, strings are capped, bad settings are dropped, citations are cleaned', () => {
    const t = normalizeTranscript([
        null,
        'nope',
        { kind: 'exchange', id: '', order: 1, question: { text: 'x' } },
        { kind: 'exchange', id: 'no-order', question: { text: 'x' } },
        { kind: 'exchange', id: 'blank', order: 2, question: { text: '   ' } },
        { kind: 'mystery', id: 'm', order: 3 },
        {
            kind: 'exchange', id: 'big', order: 4,
            question: { text: 'q'.repeat(MAX_MESSAGE_CHARS + 10), createdAt: 4 },
            reply: {
                id: 'r', status: 'done', text: 'a'.repeat(MAX_REPLY_CHARS + 10), startedAt: 4,
                settings: { lensId: 'guru-nobody', modeId: 'balanced', languageId: 'english' },
                citations: [{ status: 'verified', quote: 'ਸਤਿ ਨਾਮੁ' }, { status: 'bogus' }],
            },
        },
    ]);
    assert.equal(t.length, 1);
    const big = t[0] as Exchange;
    assert.equal(big.question.text.length, MAX_MESSAGE_CHARS);
    assert.equal(big.reply.text.length, MAX_REPLY_CHARS);
    assert.equal(big.reply.settings, undefined);
    assert.equal(big.reply.citations, undefined, 'a verified citation without a source line is not kept');
    assert.deepEqual(normalizeTranscript({ not: 'an array' }), []);
});

test('the later copy of an entry wins, and loading twice changes nothing', () => {
    const first = exchange('Q', { id: 'same', order: 5, reply: { status: 'stopped', text: '' } });
    const second = exchange('Q', { id: 'same', order: 5, reply: { text: 'Answered' } });
    const fixtures: unknown[][] = [
        [first, second],
        [exchange('Q', { order: 1, reply: { status: 'error' } }), exchange('Z', { order: 2, reply: { status: 'error' } }), exchange('Z', { order: 3 })],
        fromLegacyMessages([G, user('u1', Q, 1), user('u2', Q, 2), ai('a', 'x', 3), { id: 'n', role: 'notice', text: 'Now…', createdAt: 4 }]),
        [notice('sikhai', 1), exchange('A', { order: 2 }), notice('guru-nanak', 3), notice('guru-arjan', 4)],
    ];
    const once = normalizeTranscript(fixtures[0]);
    assert.equal((once[0] as Exchange).reply.text, 'Answered');
    for (const f of fixtures) {
        const a = normalizeTranscript(f);
        assert.deepEqual(normalizeTranscript(JSON.parse(JSON.stringify(a))), a);
    }
});

test('what is stored has no undefined values anywhere', () => {
    const e = toStoredEntry(exchange('Q', { reply: { status: 'streaming', text: 'x', citations: undefined, finishedAt: undefined } }));
    const walk = (v: unknown, path: string) => {
        assert.notEqual(v, undefined, `${path} is undefined`);
        if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(e, 'entry');
    assert.deepEqual(normalizeTranscript([e]), [e], 'a stored entry reads back unchanged');
});

test('every reply error code has text in the dictionary', () => {
    for (const code of REPLY_ERROR_CODES) assert.equal(typeof en.errors[code], 'string', code);
    assert.equal(reply({ status: 'error', errorCode: 'chat_blocked' }).errorCode, 'chat_blocked');
});
