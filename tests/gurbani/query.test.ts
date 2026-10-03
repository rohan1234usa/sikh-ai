import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GurbaniLine } from '@/lib/gurbani/gurbaninow';
import { firstLetters, skeletonToken } from '@/lib/gurbani/gurmukhi';
import {
    alternativesOf, canonicalQuery, classifyQuery, ENGLISH_ONLY_WORDS, isSearchable, MAX_QUERY_CHARS, parseSearchAs,
    sanitizeVerseSearch, SEARCH_EXAMPLES, type ShabadQuery,
} from '@/lib/gurbani/query';
import { IK_ONKAR, romanTokens } from '@/lib/gurbani/roman';
import { lineKeys, toSearchLetters } from '@/lib/gurbani/score';

// Gurbani as GurbaniNow recorded it: the Gurmukhi inputs below are cut from
// these lines, never typed here. Romanized inputs are typed as readers would.
const PAGES: Record<string, GurbaniLine[]> = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/gurbaninow.json'), 'utf8'));
const LINES = [...new Map(Object.values(PAGES).flat().filter(l => !l.isHeader).map(l => [l.id, l])).values()];
const words = (line: GurbaniLine) => lineKeys(line.gurmukhi).raw;
const LINE = LINES.find(l => words(l).length >= 6 && words(l).some(w => /[ਾ-੍]/.test(w)))!;

const kind = (query: ShabadQuery) => query.kind === 'invalid' ? `invalid:${query.reason}` : query.kind;

test('an Ang, in either kind of digits, with or without the word', () => {
    const angs: [string, number][] = [
        ['1', 1], [' 1430 ', 1430], ['012', 12], ['੧੪੩੦', 1430], ['ang 7', 7], ['ANG #7', 7], ['Ang: 7', 7],
        ['page 5', 5], ['ਅੰਗ ੭', 7],
    ];
    for (const [input, ang] of angs) assert.deepEqual(classifyQuery(input), { kind: 'ang', ang }, JSON.stringify(input));
    for (const input of ['0', '1431', '99999', 'ang 0']) assert.equal(kind(classifyQuery(input)), 'invalid:ang-range', input);
    for (const input of ['1.5', '-3', '1e3']) assert.notEqual(classifyQuery(input).kind, 'ang', input);
});

test('Gurmukhi words are searched as words, however they were written down', () => {
    const expected = words(LINE);
    for (const input of [
        LINE.gurmukhi,
        LINE.gurmukhi.replace(/ /g, '\u200B'), // larivaar, words joined by zero-width spaces
        expected.join('\u200D '), // a stray joiner
        `${expected.join(' ')} ॥੧੩॥`, // with a verse number
        `"${expected.join(' ')}"`,
    ]) {
        const query = classifyQuery(input);
        assert.equal(query.kind, 'gurmukhi', JSON.stringify(input));
        assert.deepEqual(query.kind === 'gurmukhi' && query.words, expected, JSON.stringify(input));
    }
    const pair = expected.findIndex((_, i) => i + 1 < expected.length && lineKeys(expected.slice(i, i + 2).join(' ')).letters >= 4);
    assert.equal(classifyQuery(expected.slice(pair, pair + 2).join(' ')).kind, 'gurmukhi', 'two words of four letters or more are enough');
    const tiny = LINES.flatMap(words).filter(w => lineKeys(w).letters === 1).slice(0, 2);
    assert.equal(kind(classifyQuery(tiny.join(' '))), 'invalid:too-short', 'two words of a letter each are not');
});

test('one written word is too little to find a line, unless asked for anyway', () => {
    const word = words(LINE).find(w => /[ਾ-੍]/.test(w) && lineKeys(w).letters >= 3)!;
    assert.deepEqual(classifyQuery(word), { kind: 'invalid', reason: 'too-short', alternatives: ['words'] });
    assert.deepEqual(classifyQuery(word, 'words'), { kind: 'gurmukhi', words: [word], alternatives: [] });
});

test('first letters are searched as letters, run together or spaced out', () => {
    const letters = toSearchLetters(firstLetters(LINE.gurmukhi));
    assert.deepEqual(classifyQuery(letters), { kind: 'gurmukhi-letters', letters, alternatives: ['words'] });
    assert.deepEqual(classifyQuery([...letters].join(' ')), { kind: 'gurmukhi-letters', letters, alternatives: [] });
    const two = [...letters].slice(0, 2).join('');
    assert.equal(kind(classifyQuery(two)), 'invalid:too-short', 'two letters match too much');
    assert.equal(kind(classifyQuery([...two].join(' '))), 'invalid:too-short');
});

test('vowels typed as themselves become the letters the index files them under', () => {
    const vowelLine = LINES.find(l => /[ਆਇਈਉਊਏਐਓਔ]/.test(firstLetters(l.gurmukhi)))!;
    const typed = firstLetters(vowelLine.gurmukhi);
    const query = classifyQuery(typed);
    assert.equal(query.kind, 'gurmukhi-letters');
    assert.equal(query.kind === 'gurmukhi-letters' && query.letters, toSearchLetters(typed).slice(0, 24));
});

test('a word written without vowel signs could be either, so the other reading is offered', () => {
    const bare = LINES.flatMap(words).find(w => !/[ਾ-੍]/.test(w) && [...skeletonToken(w)].length === 3)!;
    assert.ok(bare, 'a recorded word with no vowel signs');
    assert.deepEqual(classifyQuery(bare), { kind: 'gurmukhi-letters', letters: toSearchLetters(skeletonToken(bare)), alternatives: ['words'] });
    assert.deepEqual(classifyQuery(bare, 'words'), { kind: 'gurmukhi', words: [bare], alternatives: ['letters'] });
});

test('Gurmukhi wins over English letters in the same query', () => {
    const query = classifyQuery(`${words(LINE).slice(0, 3).join(' ')} so purakh niranjan`);
    assert.equal(query.kind, 'gurmukhi');
    const fallback = classifyQuery(`${[...words(LINE)[0]][0]} so purakh niranjan`);
    assert.equal(fallback.kind, 'roman', 'a lone Gurmukhi letter yields to searchable English letters');
});

test('romanized words, and romanized first letters', () => {
    const cases: [string, ShabadQuery][] = [
        ['so purakh niranjan', { kind: 'roman', words: ['so', 'purakh', 'niranjan'], alternatives: [] }],
        ['So Purakh Niranjan!', { kind: 'roman', words: ['so', 'purakh', 'niranjan'], alternatives: [] }],
        ['sō purakh nirañjan 🙏', { kind: 'roman', words: ['so', 'purakh', 'niranjan'], alternatives: [] }],
        ['ik onkar satnam karta purakh', { kind: 'roman', words: [IK_ONKAR, 'sat', 'nam', 'karta', 'purakh'], alternatives: [] }],
        ['naam japo kirat karo vand chhako', { kind: 'roman', words: ['naam', 'japo', 'kirat', 'karo', 'vand', 'chhako'], alternatives: [] }],
        ['the lord is my shepherd', { kind: 'roman', words: ['the', 'lord', 'is', 'my', 'shepherd'], alternatives: [] }],
        ['spnh', { kind: 'roman-letters', letters: 'spnh', alternatives: [] }],
        ['SPNH', { kind: 'roman-letters', letters: 'spnh', alternatives: [] }],
        ['s p n h', { kind: 'roman-letters', letters: 'spnh', alternatives: [] }],
        ['tttpa', { kind: 'roman-letters', letters: 'tttpa', alternatives: [] }],
    ];
    for (const [input, expected] of cases) assert.deepEqual(classifyQuery(input), expected, input);
    assert.deepEqual(classifyQuery('so purakh niranjan', 'letters'), { kind: 'roman-letters', letters: 'sopurakhniranjan', alternatives: [] });
});

test('too little romanized text to find a line', () => {
    for (const input of ['so purakh', 'satnam', 'waheguru', 'sp', 'ikonkar'])
        assert.equal(kind(classifyQuery(input)), 'invalid:too-short', input);
    assert.deepEqual(alternativesOf(classifyQuery('sapn')), ['letters'], 'maybe first letters');
    assert.deepEqual(alternativesOf(classifyQuery('10')), [], 'an Ang has no other reading');
});

test('a question in English is not searched', () => {
    for (const input of ['what does japji sahib mean', 'Please explain this verse', 'meaning of so purakh'])
        assert.equal(kind(classifyQuery(input)), 'invalid:english', input);
});

test('nothing to search for', () => {
    assert.equal(kind(classifyQuery('')), 'invalid:empty');
    assert.equal(kind(classifyQuery(' \u200B ')), 'invalid:empty');
    for (const input of ['!!!', '॥', '🙏🙏', '1.5', '-3']) assert.equal(kind(classifyQuery(input)), 'invalid:no-letters', input);
    assert.equal(kind(classifyQuery('सो पुरखु निरंजनु')), 'invalid:unsupported-script', 'Devanagari');
    assert.equal(kind(classifyQuery('سو پرکھ')), 'invalid:unsupported-script', 'Shahmukhi');
    assert.equal(kind(classifyQuery('x'.repeat(MAX_QUERY_CHARS + 1))), 'invalid:too-long');
    assert.equal(classifyQuery(`${'so purakh niranjan '.repeat(10)}`.slice(0, MAX_QUERY_CHARS)).kind, 'roman', 'up to the limit');
});

test('every alternative offered can be searched', () => {
    const inputs = [
        ...LINES.slice(0, 60).map(l => l.gurmukhi),
        ...LINES.slice(0, 60).map(l => toSearchLetters(firstLetters(l.gurmukhi))),
        ...LINES.flatMap(words).slice(0, 200),
        'sapn', 'spnh', 'so purakh niranjan',
    ];
    let offered = 0;
    for (const input of inputs) {
        for (const as of alternativesOf(classifyQuery(input))) {
            offered++;
            assert.ok(isSearchable(classifyQuery(input, as)), `${input} as ${as}`);
        }
    }
    assert.ok(offered > 10, `${offered} alternatives checked`);
});

test('every recorded line is searchable as Gurmukhi, as its first letters, and as its transliteration', () => {
    let roman = 0;
    for (const line of LINES) {
        if (words(line).length >= 2 && lineKeys(line.gurmukhi).letters >= 4) assert.equal(classifyQuery(line.gurmukhi).kind, 'gurmukhi', line.id);
        const letters = toSearchLetters(firstLetters(line.gurmukhi));
        if ([...letters].length >= 3) assert.equal(classifyQuery(letters).kind, 'gurmukhi-letters', line.id);
        const typed = romanTokens(line.transliteration);
        if (typed.length >= 3 && typed.join('').length >= 8) {
            roman++;
            assert.equal(classifyQuery(line.transliteration).kind, 'roman', `${line.id}: ${line.transliteration}`);
        }
    }
    assert.ok(roman > 300, `${roman} transliterations`);
});

test("the English-only words never occur in GurbaniNow's transliteration", () => {
    const seen = new Set(LINES.flatMap(l => romanTokens(l.transliteration)));
    for (const word of ENGLISH_ONLY_WORDS) assert.ok(!seen.has(word), word);
});

test('a query has one spelling, so the same search is cached once', () => {
    assert.equal(canonicalQuery('  So   Purakh\tNIRANJAN '), 'so purakh niranjan');
    assert.equal(canonicalQuery(`${words(LINE)[0]}\u200B${words(LINE)[1]}`), `${words(LINE)[0]} ${words(LINE)[1]}`);
    assert.equal(canonicalQuery('ਸ਼ਬਦ'), 'ਸ਼ਬਦ'.normalize('NFC'));
    for (const line of LINES.slice(0, 50)) {
        for (const text of [line.gurmukhi, line.transliteration]) {
            const once = canonicalQuery(text);
            assert.equal(canonicalQuery(once), once, 'idempotent');
            assert.deepEqual(classifyQuery(once), classifyQuery(text), 'the same query either way');
        }
    }
});

test('the search-as parameter takes only its two values', () => {
    assert.equal(parseSearchAs('words'), 'words');
    assert.equal(parseSearchAs('letters'), 'letters');
    for (const bad of [null, undefined, '', 'WORDS', 'auto', 7]) assert.equal(parseSearchAs(bad), undefined, String(bad));
});

test('the examples under the box are real searches of the recorded source', () => {
    const japji = LINES.find(l => l.id === 'J92N')!;
    assert.deepEqual(lineKeys(SEARCH_EXAMPLES.words).raw, lineKeys(japji.gurmukhi).raw, 'the words of ਆਦਿ ਸਚੁ ਜੁਗਾਦਿ ਸਚੁ, letter for letter');
    assert.equal(SEARCH_EXAMPLES.letters, toSearchLetters(firstLetters(japji.gurmukhi)), 'and its first letters');
    assert.equal(classifyQuery(SEARCH_EXAMPLES.words).kind, 'gurmukhi');
    assert.equal(classifyQuery(SEARCH_EXAMPLES.letters).kind, 'gurmukhi-letters');
    assert.equal(classifyQuery(SEARCH_EXAMPLES.roman).kind, 'roman');
});

test("an answer from the network is checked before it's shown", () => {
    const hit = {
        lineId: '546S', shabadId: '823', gurmukhi: 'ਗੁਰਮੁਖੀ', transliteration: 'roman', translation: 'English',
        ang: 10, lineNo: 17, writer: 'W', writerGurmukhi: 'ਲ', raag: 'R', raagGurmukhi: 'ਰ', match: 'roman', sameLineIn: 1,
    };
    const good = { kind: 'roman', hits: [hit], complete: true, truncated: false, alternatives: ['words'] };
    assert.deepEqual(sanitizeVerseSearch(good), good);
    for (const bad of [null, 'text', [], { ...good, kind: 'ang' }, { ...good, hits: 'x' }, { ...good, complete: 'yes' }, { ...good, truncated: undefined }])
        assert.equal(sanitizeVerseSearch(bad), null, JSON.stringify(bad));
    const cleaned = sanitizeVerseSearch({
        ...good,
        hits: [hit, { ...hit, lineId: '../x' }, { ...hit, shabadId: 'javascript:' }, { ...hit, gurmukhi: '' }, null, 'x',
            { ...hit, lineId: 'B1', match: 'magic', ang: -4, sameLineIn: 'many', writer: 7 }],
        alternatives: ['words', 'words', 'everything', 3],
    })!;
    assert.deepEqual(cleaned.hits.map(h => h.lineId), ['546S', 'B1'], 'hits we could not link to are dropped');
    assert.deepEqual([cleaned.hits[1].match, cleaned.hits[1].ang, cleaned.hits[1].sameLineIn, cleaned.hits[1].writer], ['letters', null, 0, '']);
    assert.deepEqual(cleaned.alternatives, ['words']);
    assert.equal(sanitizeVerseSearch({ ...good, hits: Array(80).fill(hit) })!.hits.length, 50, 'a bounded list');
});
