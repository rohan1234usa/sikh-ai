import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    EMPTY_SESSION,
    MAX_TUTOR_EXCHANGES,
    MAX_TUTOR_HISTORY_TURNS,
    MAX_TUTOR_HISTORY_TURN_CHARS,
    appendExchange,
    historyFor,
    parseTutorSession,
    settleReply,
    tutorErrorCode,
    type TutorExchange,
    type TutorReply,
} from '@/lib/learn/tutor';

const exchange = (id: string, reply: Partial<TutorReply> = {}): TutorExchange => ({
    id,
    question: `question ${id}`,
    reply: { text: `answer ${id}`, status: 'done', ...reply },
});

test('the history holds only answered exchanges, the most recent ones, each cut to size', () => {
    const exchanges = [
        exchange('a'),
        exchange('b', { status: 'error', text: '', errorCode: 'learn_busy' }),
        exchange('c', { status: 'stopped', text: '' }),
        exchange('d', { status: 'interrupted', text: 'half an answer' }),
        exchange('e', { text: 'x'.repeat(MAX_TUTOR_HISTORY_TURN_CHARS + 50) }),
        exchange('f'),
        exchange('g'),
    ];
    const history = historyFor(exchanges);
    assert.equal(history.length, MAX_TUTOR_HISTORY_TURNS);
    assert.deepEqual(history.filter((turn) => turn.role === 'user').map((turn) => turn.text), ['question d', 'question e', 'question f', 'question g']);
    assert.equal(history[3].text.length, MAX_TUTOR_HISTORY_TURN_CHARS);
    assert.deepEqual(history.map((turn) => turn.role), ['user', 'ai', 'user', 'ai', 'user', 'ai', 'user', 'ai']);
});

test('a finished stream settles as done, or as an error when it said nothing', () => {
    assert.deepEqual(settleReply({ text: 'Sat Sri Akal', status: 'streaming' }, { kind: 'closed' }), { text: 'Sat Sri Akal', status: 'done' });
    assert.deepEqual(settleReply({ text: ' ', status: 'streaming' }, { kind: 'closed' }), { text: '', status: 'error', errorCode: 'generic' });
});

test('an error response, a broken stream and Stop each settle their own way', () => {
    assert.deepEqual(settleReply({ text: '', status: 'streaming' }, { kind: 'http', code: 'learn_busy' }), { text: '', status: 'error', errorCode: 'learn_busy' });
    assert.deepEqual(settleReply({ text: 'half', status: 'streaming' }, { kind: 'failed' }), { text: 'half', status: 'interrupted' });
    assert.deepEqual(settleReply({ text: '', status: 'streaming' }, { kind: 'failed' }), { text: '', status: 'error', errorCode: 'generic' });
    assert.deepEqual(settleReply({ text: 'half', status: 'streaming' }, { kind: 'aborted' }), { text: 'half', status: 'interrupted' });
    assert.deepEqual(settleReply({ text: '', status: 'streaming' }, { kind: 'aborted' }), { text: '', status: 'stopped' });
});

test('an error response names its code, a bare 429 is busy, and anything else is generic', () => {
    assert.equal(tutorErrorCode(422, { code: 'learn_blocked' }), 'learn_blocked');
    assert.equal(tutorErrorCode(429, null), 'learn_busy');
    assert.equal(tutorErrorCode(500, { code: 'chat_failed' }), 'generic');
    assert.equal(tutorErrorCode(502, '<html>'), 'generic');
});

test('a full session lets its oldest exchange go', () => {
    let exchanges: TutorExchange[] = [];
    for (let i = 0; i < MAX_TUTOR_EXCHANGES + 3; i++) exchanges = appendExchange(exchanges, exchange(String(i)));
    assert.equal(exchanges.length, MAX_TUTOR_EXCHANGES);
    assert.equal(exchanges[0].id, '3');
});

test('a saved session comes back, and a reply saved mid-stream is marked as cut off', () => {
    const saved = {
        lesson: 'tones',
        exchanges: [
            exchange('a'),
            exchange('b', { status: 'streaming', text: 'half' }),
            exchange('c', { status: 'streaming', text: '' }),
            exchange('d', { status: 'error', text: 'junk', errorCode: 'nonsense' as never }),
        ],
    };
    const parsed = parseTutorSession(JSON.parse(JSON.stringify(saved)));
    assert.equal(parsed.lesson, 'tones');
    assert.deepEqual(parsed.exchanges.map((e) => e.reply), [
        { text: 'answer a', status: 'done' },
        { text: 'half', status: 'interrupted' },
        { text: '', status: 'stopped' },
        { text: '', status: 'error', errorCode: 'generic' },
    ]);
});

test('a saved reply comes back only in a state the page could have left it in', () => {
    const saved = {
        lesson: null,
        exchanges: [
            exchange('a', { status: 'done', text: '  ' }),
            exchange('b', { status: 'interrupted', text: '' }),
            exchange('c', { status: 'stopped', text: 'left over' }),
            exchange('a', { status: 'done', text: 'a second a' }),
        ],
    };
    const parsed = parseTutorSession(JSON.parse(JSON.stringify(saved)));
    assert.deepEqual(parsed.exchanges.map((e) => [e.id, e.reply]), [
        ['a', { text: '', status: 'error', errorCode: 'generic' }],
        ['b', { text: '', status: 'stopped' }],
        ['c', { text: '', status: 'stopped' }],
    ]);
});

test('anything unreadable gives an empty session, and a damaged exchange is dropped alone', () => {
    for (const raw of [null, 'x', 7, []]) assert.deepEqual(parseTutorSession(raw), EMPTY_SESSION);
    const parsed = parseTutorSession({
        lesson: '../x',
        exchanges: [exchange('ok'), { id: '', question: 'q', reply: { text: 'a', status: 'done' } }, { id: 'x', question: '  ', reply: { text: 'a', status: 'done' } }, { id: 'y', question: 'q', reply: { text: 'a', status: 'weird' } }, 'junk'],
    });
    assert.equal(parsed.lesson, null);
    assert.deepEqual(parsed.exchanges.map((e) => e.id), ['ok']);
});
