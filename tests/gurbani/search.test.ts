import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SGGS_SOURCE_ID } from '@/lib/gurbani/citations';
import { classifyQuery, isSearchable, type SearchableQuery } from '@/lib/gurbani/query';
import { containedRun, lineKeys, looseKey } from '@/lib/gurbani/score';
import { MAX_SEARCH_CALLS, planSearch, searchVerses, type VerseSearch } from '@/lib/gurbani/search';
import { fakeClient } from './helpers';
import { searchKey } from './keys';
import { inputOf, SEARCHES, sourceLine, type SearchFixture } from './search-fixtures';

// Searches as readers type them, replayed against GurbaniNow's recorded
// answers (npm run fixtures:gurbani -- --only search), through the client
// Shabad Search uses: Sri Guru Granth Sahib Ji only.
const fixture = (id: string): SearchFixture => {
    const found = SEARCHES.find(f => f.id === id);
    assert.ok(found, `no search fixture ${id}`);
    return found;
};
function queryOf(f: SearchFixture): SearchableQuery {
    const query = classifyQuery(inputOf(f), f.as);
    assert.ok(isSearchable(query), `${f.id}: ${inputOf(f)}`);
    return query;
}
async function search(id: string, opts: { down?: boolean; fail?: (key: string) => boolean; maxCalls?: number; signal?: AbortSignal } = {}) {
    const { client, calls } = fakeClient({ source: SGGS_SOURCE_ID, down: opts.down, fail: opts.fail });
    const found = await searchVerses(queryOf(fixture(id)), { client, maxCalls: opts.maxCalls, signal: opts.signal });
    return { found, calls };
}
const firstWave = (id: string) => planSearch(queryOf(fixture(id)))[0].map(l => searchKey(l.query, l.type, l.results, SGGS_SOURCE_ID));
const sameText = (a: string, b: string) => lineKeys(a).raw.map(looseKey).join(' ') === lineKeys(b).raw.map(looseKey).join(' ');

// The line a search was cut from comes first, or the same words where they
// first appear.
function foundFirst(found: VerseSearch | null, id: string) {
    const source = sourceLine(fixture(id))!;
    assert.ok(found && found.hits.length > 0, `${id} finds something`);
    const top = found.hits[0];
    assert.ok(top.lineId === source.id || (sameText(top.gurmukhi, source.gurmukhi) && (top.ang ?? 0) <= (source.ang ?? 0)), `${id}: ${top.gurmukhi}`);
    assert.ok(found.hits.some(h => h.lineId === source.id), `${id}: its own line is among the hits`);
    return top;
}

test('a line typed as GurbaniNow spells it, or as Unicode spells it, is found word for word in one wave', async () => {
    for (const id of ['refrain-line', 'udaat-rahao', 'udaat-salok', 'sukhmani-line']) {
        const { found, calls } = await search(id);
        assert.equal(foundFirst(found, id).match, 'exact', id);
        assert.deepEqual(calls, firstWave(id), `${id}: the first wave settles it`);
        assert.equal(found!.complete, true);
    }
});

test('typed without vowel signs it is found by its words; with a typo, by most of them', async () => {
    assert.equal(foundFirst((await search('loose-line')).found, 'loose-line').match, 'contained');
    for (const id of ['typo-line', 'typo-short']) {
        const { found } = await search(id);
        assert.equal(foundFirst(found, id).match, 'close', id);
        assert.ok(found!.hits.every(h => h.match !== 'exact' && h.match !== 'contained'), `${id}: nothing claims to match exactly`);
    }
});

test('by its first letters, run together or spaced out', async () => {
    for (const id of ['refrain-letters', 'spaced-letters', 'mool-mantar-letters']) {
        assert.equal(foundFirst((await search(id)).found, id).match, 'letters', id);
    }
});

test('a line repeated in other shabads is shown in up to three, saying how many more', async () => {
    const { found } = await search('mool-mantar-letters');
    const mool = found!.hits.filter(h => sameText(h.gurmukhi, sourceLine(fixture('mool-mantar-letters'))!.gurmukhi));
    assert.equal(mool.length, 3);
    assert.ok(mool.every(h => h.sameLineIn >= 3), 'the Mool Mantar opens many shabads');
    assert.deepEqual(mool.map(h => h.ang), [...mool.map(h => h.ang)].sort((a, b) => (a ?? 0) - (b ?? 0)), 'earliest Ang first');
    assert.equal(found!.truncated, true, 'more lines matched than one lookup reads');
    const refrain = (await search('refrain-line')).found!;
    assert.ok(refrain.hits.length >= 2 && refrain.hits[0].sameLineIn >= 1, 'ਆਦਿ ਸਚੁ ਜੁਗਾਦਿ ਸਚੁ is in Sukhmani too');
});

test('a few words find every line that has them, in order, and ask for more words', async () => {
    const { found } = await search('sukhmani-start');
    const typed = lineKeys(inputOf(fixture('sukhmani-start')));
    assert.ok(found!.hits.length >= 5);
    for (const hit of found!.hits) {
        assert.ok(containedRun(typed.folded, lineKeys(hit.gurmukhi).folded), hit.gurmukhi);
        assert.equal(hit.match, 'exact');
    }
    assert.ok(found!.hits.some(h => h.lineId === sourceLine(fixture('sukhmani-start'))!.id));
    assert.equal(found!.truncated, true);
});

test('romanized, in GurbaniNow\'s spelling or a reader\'s', async () => {
    for (const id of ['refrain-casual', 'mool-mantar-roman']) assert.equal(foundFirst((await search(id)).found, id).match, 'roman', id);

    const expected: [string, number, string?][] = [
        ['so-purakh', 10, '546S'],
        ['tu-thakur', 268, 'Y99N'],
        ['thu-thakur', 268, 'Y99N'],
        ['ik-onkar', 1, '0NVY'],
        ['tera-kiya', 394],
        ['mera-baid', 618],
        ['jo-mange', 681],
        ['dhan-dhan', 968],
    ];
    for (const [id, ang, lineId] of expected) {
        const { found } = await search(id);
        const top = found!.hits[0];
        assert.equal(top?.ang, ang, `${id}: ${top?.gurmukhi}`);
        if (lineId) assert.equal(top.lineId, lineId, id);
        assert.equal(top.match, 'roman');
        assert.ok(top.transliteration && top.translation, `${id}: a hit carries its transliteration and translation`);
    }
    const soPurakh = (await search('so-purakh')).found!;
    assert.ok(soPurakh.hits.some(h => h.ang === 348), 'and the same line on Ang 348');
    const tatiVao = (await search('tati-vao')).found!;
    assert.ok(tatiVao.hits.some(h => h.ang === 819), 'ਤਾਤੀ ਵਾਉ ਨ ਲਗਈ, among the lines that read so');
});

test('romanized first letters', async () => {
    for (const id of ['spnh', 'spnh-spaced']) {
        const { found, calls } = await search(id);
        assert.equal(found!.hits[0]?.lineId, '546S', id);
        assert.equal(calls.length, 1, `${id}: one lookup`);
    }
    assert.equal(foundFirst((await search('roman-initials')).found, 'roman-initials').match, 'letters');
});

test('a Dasam Granth line, English and gibberish find nothing, and say so plainly', async () => {
    for (const id of ['dasam-line', 'dasam-roman', 'shepherd', 'gibberish']) {
        const { found } = await search(id);
        assert.ok(found, `${id}: GurbaniNow answered`);
        assert.deepEqual(found.hits, [], id);
        assert.equal(found.complete, true, `${id}: every lookup answered, so "nothing found" is true`);
    }
});

test('what each search costs: one lookup when the first settles it, never more than four', async () => {
    assert.deepEqual((await search('so-purakh')).calls, [searchKey('ਸਪਨ', 0, 50, SGGS_SOURCE_ID)]);
    for (const f of SEARCHES) {
        if (!isSearchable(classifyQuery(inputOf(f), f.as))) continue;
        const { calls } = await search(f.id);
        assert.ok(calls.length >= 1 && calls.length <= MAX_SEARCH_CALLS, `${f.id}: ${calls.length}`);
        for (const key of calls) assert.match(key, /^search:[0-4]:(30|50):source=1:[਀-੿ ]+$/u, `${f.id}: ${key}`);
    }
});

test('a source that is down is no answer, never "nothing found"', async () => {
    for (const f of SEARCHES) {
        if (!isSearchable(classifyQuery(inputOf(f), f.as))) continue;
        const { found, calls } = await search(f.id, { down: true });
        assert.equal(found, null, f.id);
        assert.ok(calls.length <= 2, `${f.id}: stops after the first wave`);
    }
});

test('when some lookups go unanswered, what was found is shown as incomplete', async () => {
    const phrase = (key: string) => key.startsWith('search:2:');
    const { found } = await search('refrain-line', { fail: phrase });
    assert.equal(found!.complete, false);
    assert.ok(found!.hits.some(h => h.lineId === 'J92N'), 'the first-letter lookup still found it');

    const nothing = await search('shepherd', { fail: key => key === firstWave('shepherd')[0] });
    assert.equal(nothing.found!.complete, false, 'no hits, but not every lookup answered');
    assert.deepEqual(nothing.found!.hits, []);
});

test('a search stops at its budget or when the reader leaves', async () => {
    const budget = await search('thu-thakur', { maxCalls: 1 });
    assert.equal(budget.calls.length, 1);
    assert.equal(budget.found!.complete, false);

    const left = new AbortController();
    left.abort();
    const gone = await search('so-purakh', { signal: left.signal });
    assert.equal(gone.found, null);
    assert.deepEqual(gone.calls, []);
});
