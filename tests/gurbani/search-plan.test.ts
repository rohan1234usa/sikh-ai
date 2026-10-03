import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SEARCH_TYPES, type GurbaniLine } from '@/lib/gurbani/gurbaninow';
import { firstLetters } from '@/lib/gurbani/gurmukhi';
import { classifyQuery, isSearchable, type SearchableQuery } from '@/lib/gurbani/query';
import { romanTokens } from '@/lib/gurbani/roman';
import { lineKeys, toSearchLetters } from '@/lib/gurbani/score';
import { MAX_SEARCH_CALLS, planSearch, type Lookup } from '@/lib/gurbani/search';

// The lookups a search plans, before any is made. Queries are cut from
// recorded lines, so the plans are those real searches would make.
const PAGES: Record<string, GurbaniLine[]> = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/gurbaninow.json'), 'utf8'));
const LINES = [...new Map(Object.values(PAGES).flat().filter(l => !l.isHeader).map(l => [l.id, l])).values()];

function plan(input: string, as?: 'words' | 'letters'): Lookup[][] {
    const query = classifyQuery(input, as);
    assert.ok(isSearchable(query), `${input} is searchable`);
    return planSearch(query);
}
const { firstLettersStart: START, firstLettersAnywhere: ANYWHERE, phrase: PHRASE, allWords: ALL_WORDS } = SEARCH_TYPES;
const letters = (line: GurbaniLine) => toSearchLetters(firstLetters(line.gurmukhi));
const longestTwo = (words: string[]) => [...new Set(lineKeys(words.join(' ')).folded)].sort((a, b) => [...b].length - [...a].length).slice(0, 2).join(' ');
const withLetters = (n: number) => LINES.find(l => [...letters(l)].length === n && lineKeys(l.gurmukhi).raw.length === n)!;

test('a whole line: the exact words and the first letters, then all the words and the last letters', () => {
    const line = LINES.find(l => [...letters(l)].length >= 8)!;
    const keys = lineKeys(line.gurmukhi);
    const l = [...letters(line)];
    assert.deepEqual(plan(line.gurmukhi), [
        [{ query: keys.folded.slice(0, 10).join(' '), type: PHRASE, results: 30 }, { query: l.slice(0, 12).join(''), type: ANYWHERE, results: 30 }],
        [{ query: longestTwo(keys.raw), type: ALL_WORDS, results: 30 }, { query: l.slice(-5).join(''), type: ANYWHERE, results: 30 }],
    ]);
});

test('fewer words: two need all the words, three start a line, five or six check the start again', () => {
    const two = withLetters(5).gurmukhi.split(' ').slice(0, 2);
    assert.deepEqual(plan(two.join(' '), 'words'), [[
        { query: lineKeys(two.join(' ')).folded.join(' '), type: PHRASE, results: 30 },
        { query: longestTwo(two), type: ALL_WORDS, results: 30 },
    ]]);
    const three = lineKeys(withLetters(3).gurmukhi).raw;
    assert.deepEqual(plan(three.join(' ')), [
        [{ query: lineKeys(three.join(' ')).folded.join(' '), type: PHRASE, results: 30 }, { query: toSearchLetters(lineKeys(three.join(' ')).first), type: START, results: 50 }],
        [{ query: longestTwo(three), type: ALL_WORDS, results: 30 }],
    ]);
    const five = withLetters(5);
    assert.deepEqual(plan(five.gurmukhi)[1], [
        { query: longestTwo(lineKeys(five.gurmukhi).raw), type: ALL_WORDS, results: 30 },
        { query: [...letters(five)].slice(0, 4).join(''), type: START, results: 30 },
    ]);
});

test("the exact-words lookup uses GurbaniNow's spelling of a subjoined ha", () => {
    const line = LINES.find(l => l.gurmukhi.includes('ੑ'))!;
    assert.ok(line, 'a recorded line spelled with the udaat sign');
    const standard = line.gurmukhi.replace(/ੑ/g, '੍ਹ');
    const [[phrase]] = plan(standard);
    assert.equal(phrase.type, PHRASE);
    assert.ok(phrase.query.includes('ੑ') && !phrase.query.includes('੍ਹ'), phrase.query);
});

test('first letters: three from the start then anywhere, four both ways, more anywhere, six or more checked at both ends', () => {
    const l = [...letters(LINES.find(x => [...letters(x)].length >= 9)!)];
    const typed = (n: number) => l.slice(0, n).join('');
    assert.deepEqual(plan(typed(3)), [[{ query: typed(3), type: START, results: 50 }], [{ query: typed(3), type: ANYWHERE, results: 50 }]],
        'three letters typed from the middle of a line are found too, as in English letters');
    assert.deepEqual(plan(typed(4)), [[{ query: typed(4), type: START, results: 30 }, { query: typed(4), type: ANYWHERE, results: 30 }]]);
    assert.deepEqual(plan(typed(5)), [[{ query: typed(5), type: ANYWHERE, results: 30 }]]);
    assert.deepEqual(plan(typed(9)), [
        [{ query: typed(9), type: ANYWHERE, results: 30 }],
        [{ query: typed(4), type: START, results: 30 }, { query: l.slice(4, 9).join(''), type: ANYWHERE, results: 30 }],
    ]);
});

test('romanized words: the likeliest spellings of the clearest stretch, two at a time', () => {
    assert.deepEqual(plan('so purakh niranjan'), [[{ query: 'ਸਪਨ', type: START, results: 50 }], [{ query: 'ਸਪਨ', type: ANYWHERE, results: 50 }]],
        'unambiguous, from the start of a line first');
    assert.deepEqual(plan('tu thakur tum peh ardaas'), [
        [{ query: 'ਤਤਤਪਅ', type: ANYWHERE, results: 30 }, { query: 'ਤਠਤਪਅ', type: ANYWHERE, results: 30 }],
        [{ query: 'ਤਥਤਪਅ', type: ANYWHERE, results: 30 }, { query: 'ਟਤਤਪਅ', type: ANYWHERE, results: 30 }],
    ], 'thakur is ਠਾਕੁਰ, the second guess for th');
    assert.deepEqual(plan('ik onkar sat naam karta purakh'), [[{ query: 'ੴਸਨਕਪ', type: ANYWHERE, results: 30 }]], 'ੴ, and no unlikely spellings');
    assert.deepEqual(plan('spnh'), [[{ query: 'ਸਪਨਹ', type: ANYWHERE, results: 30 }]]);
});

test("a closing rahao isn't looked up, so it doesn't count toward a romanized query's words", () => {
    assert.equal(classifyQuery('tu thakur rahao').kind, 'invalid', 'two words and a rahao are two words');
    assert.equal(classifyQuery('rahao rahao rahao').kind, 'invalid');
    const waves = plan('tu thakur tum rahao');
    assert.ok(waves.flat().every(l => [...l.query].length === 3), JSON.stringify(waves));
    assert.equal(waves[0][0].query, 'ਤਤਤ', 'three words, without the rahao');
});

test('a long romanized query looks at a second stretch too', () => {
    // jo mange thakur apne te soi soi deve: "apne te soi soi deve" holds one
    // ambiguous letter, "thakur" another; a second stretch starts elsewhere.
    const waves = plan('jo mange thakur apne te soi soi deve');
    assert.equal(waves[0][0].query, 'ਅਤਸਸਦ', 'the clearest stretch, likeliest spelling first');
    assert.ok(waves.flat().some(l => l.query.startsWith('ਮ')), 'and one from another stretch');
    assert.equal(waves.flat().length, 4);
});

test('every plan, for every recorded line however it is typed, stays within the budget and sends only Gurmukhi', () => {
    const queries: SearchableQuery[] = [];
    for (const line of LINES) {
        const words = lineKeys(line.gurmukhi).raw;
        for (const input of [line.gurmukhi, words.slice(0, 3).join(' '), letters(line), [...letters(line)].join(' '), line.transliteration, [...romanTokens(line.transliteration).map(w => w[0])].join('')]) {
            const query = classifyQuery(input);
            if (isSearchable(query)) queries.push(query);
        }
    }
    assert.ok(queries.length > 1500, `${queries.length} queries planned`);
    for (const query of queries) {
        const waves = planSearch(query);
        const all = waves.flat();
        const label = JSON.stringify(query);
        assert.ok(all.length >= 1 && all.length <= MAX_SEARCH_CALLS, label);
        assert.ok(waves.every(wave => wave.length >= 1 && wave.length <= 2), label);
        assert.equal(new Set(all.map(l => `${l.type}:${l.query}`)).size, all.length, `${label}: no lookup twice`);
        for (const lookup of all) {
            assert.match(lookup.query, /^[਀-੿ ]+$/u, `${label}: Gurmukhi only, no wildcards`);
            assert.ok([30, 50].includes(lookup.results), label);
            if (lookup.type === START || lookup.type === ANYWHERE) assert.doesNotMatch(lookup.query, / /, `${label}: letters have no spaces`);
            if (lookup.type === START || lookup.type === ANYWHERE) assert.ok([...lookup.query].length >= 3, `${label}: never fewer than three letters`);
        }
    }
});
