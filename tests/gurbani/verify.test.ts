import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeCitations } from '@/lib/gurbani/citations';
import { parseAngPayload, parseSearchPayload } from '@/lib/gurbani/gurbaninow';
import { verifyReply } from '@/lib/gurbani/verify';
import { fakeClient, reply } from './helpers';

const check = async (id: string) => {
    const { client, calls } = fakeClient();
    const citations = await verifyReply(reply(id), { client });
    return { citations, calls };
};

test('a correct quote on the cited Ang verifies with no search at all', async () => {
    const { citations, calls } = await check('haumai-gurbani-first:36');
    assert.equal(citations.length, 1);
    assert.equal(citations[0].status, 'verified');
    assert.equal(citations[0].exact, true);
    assert.equal(citations[0].line?.ang, 466);
    assert.deepEqual(calls, ['ang:466']);
});

test('the card names the real writer, even when the reply names another', async () => {
    // 3.8 Flash credited this Mahalla 2 salok to Guru Nanak Dev Ji.
    const { citations } = await check('haumai-gurbani-first:38');
    assert.equal(citations[0].line?.writer, 'Guru Angad Dev Ji');
    assert.deepEqual(citations.map(c => c.status), ['verified', 'verified', 'verified']);
});

test('a vowel slip still verifies, flagged as a spelling difference', async () => {
    const { citations } = await check('nanak-impersonation:36');
    assert.equal(citations[0].status, 'verified');
    assert.equal(citations[0].exact, false);
    assert.equal(citations[0].line?.gurmukhi, 'ਕੀਤਾ ਪਸਾਉ ਏਕੋ ਕਵਾਉ ॥');
});

test('an altered line is close, and the card shows the real one', async () => {
    const { citations } = await check('arjan-grief-gurbani-first:36');
    assert.equal(citations[0].status, 'close');
    assert.equal(citations[0].line?.gurmukhi, 'ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥');
});

test('lines corrupted by other scripts are close, never verified', async () => {
    assert.equal((await check('haumai-gurbani-first:lite')).citations[0].status, 'close');
    assert.equal((await check('arjan-grief-gurbani-first:lite')).citations[0].status, 'close');
});

test('blended lines are close to the lines they came from', async () => {
    const { citations } = await check('simran-punjabi-gurmukhi:lite');
    assert.deepEqual(citations.map(c => [c.status, c.line?.ang]), [['close', 202], ['close', 262]]);
});

test('a quote with no citation is found by search', async () => {
    const { citations } = await check('simran-punjabi-gurmukhi:36');
    assert.equal(citations[0].status, 'verified');
    assert.equal(citations[0].line?.ang, 263);
});

test('a real line cited on the wrong Ang is reported with the right one', async () => {
    const { citations } = await check('synthetic:wrong-ang');
    assert.equal(citations[0].status, 'wrong-ang');
    assert.equal(citations[0].citedAng, 394);
    assert.equal(citations[0].line?.ang, 469);
});

test('an Ang off by one is not called wrong', async () => {
    const { citations } = await check('synthetic:near-ang');
    assert.equal(citations[0].status, 'verified');
});

test('two lines quoted with no ॥ between them verify separately', async () => {
    const { citations } = await check('synthetic:two-lines-one-danda');
    assert.deepEqual(citations.map(c => c.status), ['verified', 'verified']);
    assert.equal(citations[0].line?.gurmukhi, 'ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥');
});

test('an invented line is unverified', async () => {
    const { citations } = await check('synthetic:invented');
    assert.deepEqual(citations.map(c => c.status), ['unverified']);
    assert.equal(citations[0].line, undefined);
});

test('a Dasam Granth line verifies under its own source name', async () => {
    const { citations } = await check('synthetic:dasam');
    assert.equal(citations[0].status, 'verified');
    assert.equal(citations[0].line?.source.name, 'Sri Dasam Granth');
});

test('the hand-written replies quote scripture exactly as the source has it', async () => {
    // They are typed, not recorded, so this is what keeps a stray mark out of
    // them; the Dasam one once carried a bindi and passed on the fuzzy path.
    for (const id of ['synthetic:wrong-ang', 'synthetic:near-ang', 'synthetic:two-lines-one-danda', 'synthetic:dasam']) {
        const { citations } = await check(id);
        assert.ok(citations.length > 0 && citations.every(c => c.exact === true), `${id} differs from the recorded line`);
    }
});

test('unmarked Punjabi prose gets no card', async () => {
    assert.deepEqual((await check('synthetic:prose-phrase')).citations, []);
});

test('replies without Gurbani cost no lookups', async () => {
    const { citations, calls } = await check('langar-vichaar-bilingual:38');
    assert.deepEqual(citations, []);
    assert.deepEqual(calls, []);
});

test('when the source is unreachable there are no cards — never "unverified"', async () => {
    const { client } = fakeClient({ down: true });
    assert.deepEqual(await verifyReply(reply('synthetic:invented'), { client }), []);
    assert.deepEqual(await verifyReply(reply('arjan-grief-gurbani-first:36'), { client }), []);
});

test('a spent budget skips the rest instead of guessing', async () => {
    const { client, calls } = fakeClient();
    const citations = await verifyReply(reply('synthetic:invented'), { client, maxOutbound: 1 });
    assert.equal(calls.length, 1);
    assert.deepEqual(citations, [], 'one search answered is not enough to call a line unverified');
});

test('a line that only resembles the quote is not flagged until every lookup has answered', async () => {
    // One lookup reads the cited Ang, where a similar line sits. The searches
    // that could still find the quote word for word never ran.
    const { client, calls } = fakeClient();
    assert.deepEqual(await verifyReply(reply('arjan-grief-gurbani-first:36'), { client, maxOutbound: 1 }), []);
    assert.deepEqual(calls, ['ang:394']);
});

test('payload parsers: null means no answer, [] means no match', () => {
    assert.equal(parseAngPayload({ error: true }), null);
    assert.equal(parseAngPayload({ page: [] }), null, 'an empty Ang page is an upstream fault');
    assert.deepEqual(parseSearchPayload({ count: 0, shabads: [] }), []);
    assert.deepEqual(parseSearchPayload({ error: 'Nothing Found!' }), [], 'the search endpoint says so in words');
    assert.equal(parseSearchPayload({ error: 'Too many requests' }), null, 'any other message is a failure, not an answer');
    assert.equal(parseSearchPayload({ error: true }), null);
    assert.equal(parseSearchPayload({ unexpected: 'shape' }), null, 'a shape we do not know is not "nothing matched"');
    const [line] = parseAngPayload({
        source: { id: 1, english: 'Sri Guru Granth Sahib Ji', unicode: 'ਸ਼੍ਰੀ ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ ਜੀ' },
        page: [{ line: { id: 'X1', type: 2, shabadid: 'S1', pageno: 7, lineno: 1, gurmukhi: { unicode: 'ਹੈਡਰ ॥' } } }],
    }) ?? [];
    assert.equal(line.isHeader, true);
    assert.equal(line.source.id, 1);
});

test('stored citations are re-validated before rendering', () => {
    const [good] = sanitizeCitations([
        { quote: 'ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥', status: 'verified', line: { gurmukhi: 'ਤੇਰਾ ਕੀਆ ਮੀਠਾ ਲਾਗੈ ॥', ang: 394, source: { id: 1 } } },
    ]);
    assert.equal(good.line?.ang, 394);
    assert.deepEqual(sanitizeCitations([{ quote: 'x', status: 'verified' }]), [], 'a verified card needs its source line');
    assert.deepEqual(sanitizeCitations([{ quote: 'x', status: 'bogus' }]), []);
    assert.deepEqual(sanitizeCitations('not an array'), []);
    assert.equal(sanitizeCitations(Array(10).fill({ quote: 'x', status: 'unverified' })).length, 6);
});
