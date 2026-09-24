import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShareSnapshot, newSinceShared, parseShareDoc, shareToRecord, type ShareDoc } from '@/lib/chat/share';
import type { ChatRecord } from '@/lib/chat/store/types';
import type { Exchange } from '@/lib/chat/transcript';
import { exchange, notice } from './helpers';
import { meta } from './store-helpers';

const record = (transcript: ChatRecord['transcript']): ChatRecord => ({ meta: meta(1), context: null, transcript });
const utf8 = (s: string) => new TextEncoder().encode(s).length;
const docOf = (payload: string, over: Partial<ShareDoc> = {}): ShareDoc =>
    ({ v: 1, ownerUid: 'u', chatId: meta(1).id, title: 'Seva', payload, createdAt: 5, updatedAt: 6, ...over });

test('a snapshot holds the answered exchanges, and a lens notice only where an answer follows it', () => {
    const snapshot = buildShareSnapshot(record([
        exchange('failed', { order: 1, reply: { status: 'error', errorCode: 'chat_busy' } }),
        notice('guru-nanak', 2),
        exchange('stopped', { order: 3, reply: { status: 'stopped', text: '' } }),
        exchange('answered', { order: 4, reply: { text: 'Yes.' } }),
        exchange('cut short', { order: 5, reply: { status: 'interrupted', text: 'Part' } }),
        notice('sikhai', 6),
        exchange('in flight', { order: 7, reply: { status: 'streaming', text: 'Still going' } }),
    ]))!;
    const shared = parseShareDoc(docOf(snapshot.payload))!;
    assert.deepEqual(
        shared.transcript.map((e) => (e.kind === 'notice' ? `N:${e.lensId}` : e.question.text)),
        ['answered', 'cut short'],
        'the notice before the first shared answer adds nothing the answer\'s label does not say',
    );
    assert.deepEqual([snapshot.lastOrder, snapshot.count, snapshot.truncated], [5, 2, false]);
    assert.equal(buildShareSnapshot(record([exchange('only a failure', { reply: { status: 'error' } })])), null);
});

test('a chat too long to share whole loses its oldest cards, then its oldest exchanges, and says so', () => {
    const gurmukhi = 'ਹਉਮੈ ਦੀਰਘ ਰੋਗੁ ਹੈ ਦਾਰੂ ਭੀ ਇਸੁ ਮਾਹਿ ॥ '.repeat(20);
    const card = { quote: 'ਹਉਮੈ ਦੀਰਘ ਰੋਗੁ ਹੈ', status: 'unverified' as const };
    const chat = record(Array.from({ length: 6 }, (_, i) =>
        exchange(`Question ${i}`, { order: i + 1, reply: { text: gurmukhi, citations: [card, card, card] } })));

    const whole = buildShareSnapshot(chat)!;
    const cardsGone = buildShareSnapshot(chat, utf8(whole.payload) - 50)!;
    const firstCards = (parseShareDoc(docOf(cardsGone.payload))!.transcript[0] as Exchange).reply.citations;
    assert.equal(firstCards, undefined, 'the oldest answer lost its cards first');
    assert.equal(cardsGone.truncated, false);

    const small = buildShareSnapshot(chat, 6_000)!;
    assert.ok(utf8(small.payload) <= 6_000, 'measured in UTF-8, where Gurmukhi is 3 bytes a letter');
    assert.equal(small.truncated, true);
    const kept = parseShareDoc(docOf(small.payload))!;
    assert.ok(kept.truncated);
    assert.equal((kept.transcript.at(-1) as Exchange).question.text, 'Question 5', 'the newest part is kept');
    assert.equal(small.lastOrder, 6);
    assert.equal(buildShareSnapshot(chat, 100), null, 'nothing fits: no snapshot');
});

test('a share document read back is checked like anything else loaded', () => {
    assert.equal(parseShareDoc(null), null);
    assert.equal(parseShareDoc(docOf('{not json')), null);
    assert.equal(parseShareDoc(docOf(JSON.stringify({ entries: [] }))), null, 'no answer, nothing to show');
    const payload = JSON.stringify({
        context: { type: 'shabad', title: 'Ang 1', text: 'ੴ ਸਤਿ ਨਾਮੁ' },
        entries: [exchange('Q', { order: 1, reply: { text: 'A', citations: [{ status: 'nonsense' }] as never } }), { kind: 'script', id: 'x', order: 2 }],
        truncated: false,
    });
    const shared = parseShareDoc(docOf(payload, { title: '  A   title ', createdAt: 'yesterday' as never }))!;
    assert.equal(shared.title, 'A title');
    assert.equal(shared.createdAt, 0);
    assert.equal(shared.context?.type, 'shabad');
    assert.equal(shared.transcript.length, 1);
    assert.equal((shared.transcript[0] as Exchange).reply.citations, undefined);
});

test('continuing a shared chat makes a new chat with fresh ids, never the original\'s', () => {
    const snapshot = buildShareSnapshot(record([
        exchange('One', { id: 'ex-a', order: 10 }),
        notice('guru-nanak', 11, 'n-b'),
        exchange('Two', { id: 'ex-c', order: 12, reply: { id: 'r-c', settings: { lensId: 'guru-nanak', modeId: 'balanced', languageId: 'english' } } }),
    ]))!;
    let n = 0;
    const copy = shareToRecord(parseShareDoc(docOf(snapshot.payload))!, { now: 1_000, newId: () => `new-${++n}` });
    const oldIds = ['ex-a', 'n-b', 'ex-c', 'r-c', meta(1).id];
    const newIds = [copy.meta.id, ...copy.transcript.flatMap((e) => (e.kind === 'exchange' ? [e.id, e.reply.id] : [e.id]))];
    assert.ok(newIds.every((id) => !oldIds.includes(id)));
    assert.deepEqual(copy.transcript.map((e) => e.kind), ['exchange', 'notice', 'exchange']);
    assert.ok(copy.transcript.every((e, i, all) => e.order < 1_000 && (i === 0 || e.order > all[i - 1].order)));
    assert.equal(copy.meta.share, null);
    assert.equal(copy.meta.pinned, false);
});

test('the dialog can tell how many answers came after the link was made', () => {
    const chat = record([exchange('One', { order: 1 }), exchange('Two', { order: 5 }), exchange('Three', { order: 9, reply: { status: 'error' } })]);
    assert.equal(newSinceShared(chat, { id: 'share-123', createdAt: 0, updatedAt: 0, lastOrder: 1 }), 1);
});
