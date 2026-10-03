import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GurbaniLine } from '@/lib/gurbani/gurbaninow';
import { firstLetters } from '@/lib/gurbani/gurmukhi';
import { classifyQuery, isSearchable, type SearchableQuery } from '@/lib/gurbani/query';
import { romanTokens } from '@/lib/gurbani/roman';
import { lineKeys, looseKey, toSearchLetters } from '@/lib/gurbani/score';
import type { GurbaniClient } from '@/lib/gurbani/gurbaninow';
import { rankLines, searchVerses } from '@/lib/gurbani/search';

// Ranking, with no lookups: candidates are recorded lines, or mechanical
// variants of them (vowel signs stripped, a word swapped), filed under
// made-up shabads and Angs to see what wins.
const PAGES: Record<string, GurbaniLine[]> = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/gurbaninow.json'), 'utf8'));
const LINES = [...new Map(Object.values(PAGES).flat().filter(l => !l.isHeader && l.source.id === 1).map(l => [l.id, l])).values()];
const words = (line: GurbaniLine) => lineKeys(line.gurmukhi).raw;
const A = LINES.find(l => words(l).length >= 7 && words(l).every(w => [...w].length >= 2))!;

let serial = 0;
function variant(line: GurbaniLine, changes: Partial<GurbaniLine> = {}): GurbaniLine {
    serial++;
    return { ...line, id: `V${serial}`, shabadId: `S${serial}`, ...changes };
}
function query(input: string, as?: 'words' | 'letters'): SearchableQuery {
    const q = classifyQuery(input, as);
    assert.ok(isSearchable(q), input);
    return q;
}
// Vowel signs, tippi, bindi and addak gone: the same words, loosely.
const loose = (text: string) => text.replace(/[ਾ-੍ੰੱਂ]/g, '');
// Each word swapped for another recorded word with the same first letter.
const WORD_BANK = LINES.flatMap(words);
function sameFirstLetters(line: GurbaniLine): string {
    return words(line).map(w => WORD_BANK.find(o => firstLetters(o) === firstLetters(w) && looseKey(o) !== looseKey(w)) ?? w).join(' ');
}
// The line with its shortest word replaced by one from another line.
function oneWordSwapped(line: GurbaniLine): string {
    const ws = words(line);
    const shortest = ws.reduce((best, w, i) => ([...w].length < [...ws[best]].length ? i : best), 0);
    const other = WORD_BANK.find(w => !ws.some(x => looseKey(x) === looseKey(w)) && [...w].length === [...ws[shortest]].length)!;
    return ws.map((w, i) => (i === shortest ? other : w)).join(' ');
}

test('word for word beats loosely, which beats most of the words; first letters alone go when words match', () => {
    const exact = variant(A, { ang: 900 });
    const looser = variant(A, { gurmukhi: loose(A.gurmukhi), ang: 5 });
    const most = variant(A, { gurmukhi: oneWordSwapped(A), ang: 1 });
    const lettersOnly = variant(A, { gurmukhi: sameFirstLetters(A), ang: 2 });
    const { hits } = rankLines(query(A.gurmukhi), [lettersOnly, most, looser, exact]);
    assert.deepEqual(hits.map(h => [h.lineId, h.match]), [[exact.id, 'exact'], [looser.id, 'contained'], [most.id, 'close']]);

    const alone = rankLines(query(A.gurmukhi), [lettersOnly]).hits;
    assert.deepEqual(alone.map(h => [h.lineId, h.match]), [[lettersOnly.id, 'letters']], 'with nothing better, the first letters are shown');
});

test("headings, other sources, and ids we couldn't link to are never shown", () => {
    const q = query(A.gurmukhi);
    const lines = [
        variant(A, { isHeader: true }),
        variant(A, { source: { id: 2, name: 'Sri Dasam Granth', nameGurmukhi: '' } }),
        variant(A, { id: '../x' }),
        variant(A, { shabadId: '' }),
    ];
    assert.deepEqual(rankLines(q, lines).hits, []);
});

test('one hit per shabad, its best line, and a line returned twice counts once', () => {
    const shabad = variant(A);
    const weaker = { ...variant(A, { gurmukhi: oneWordSwapped(A) }), shabadId: shabad.shabadId };
    const { hits } = rankLines(query(A.gurmukhi), [weaker, shabad, shabad]);
    assert.deepEqual(hits.map(h => h.lineId), [shabad.id]);
});

test('a line found in several shabads is shown in up to three, earliest Ang first, saying how many more', () => {
    const q = query(A.gurmukhi);
    const two = rankLines(q, [variant(A, { ang: 50 }), variant(A, { ang: 20 })]).hits;
    assert.deepEqual(two.map(h => [h.ang, h.sameLineIn]), [[20, 1], [50, 1]]);
    const five = rankLines(q, [700, 30, 400, 9, 120].map(ang => variant(A, { ang }))).hits;
    assert.deepEqual(five.map(h => [h.ang, h.sameLineIn]), [[9, 4], [30, 4], [120, 4]]);
});

test('a line that is all of what was typed comes before a longer line that contains it', () => {
    const typed = words(A).slice(0, 4).join(' ');
    const longer = variant(A, { ang: 1 });
    const whole = variant(A, { gurmukhi: typed, ang: 900 });
    const { hits } = rankLines(query(typed), [longer, whole]);
    assert.deepEqual(hits.map(h => [h.lineId, h.match]), [[whole.id, 'exact'], [longer.id, 'exact']]);
});

test('first letters: a line starting with them before one containing them, and a typo forgiven in six or more', () => {
    const letters = toSearchLetters(firstLetters(A.gurmukhi));
    const typed = [...letters].slice(0, 4).join('');
    const starts = variant(A, { ang: 900 });
    const contains = variant(A, { gurmukhi: `${words(LINES[0])[0]} ${A.gurmukhi}`, ang: 1 });
    const { hits } = rankLines(query(typed), [contains, starts]);
    assert.deepEqual(hits.map(h => h.lineId), [starts.id, contains.id]);

    const six = [...letters].slice(0, 6);
    const typo = [...six.slice(0, 3), six[3] === 'ਸ' ? 'ਹ' : 'ਸ', ...six.slice(4)].join('');
    assert.deepEqual(rankLines(query(typo), [starts]).hits.map(h => h.lineId), [starts.id], 'one letter wrong in six');
    const twoWrong = [...typo].map((ch, i) => (i === 1 ? (ch === 'ਮ' ? 'ਨ' : 'ਮ') : ch)).join('');
    assert.deepEqual(rankLines(query(twoWrong), [starts]).hits, [], 'two wrong is another line');
});

test("romanized: the line whose transliteration reads like what was typed, and nothing that doesn't", () => {
    const casual = (text: string) => text.toLowerCase().replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u');
    const typed = casual(A.transliteration);
    const { hits } = rankLines(query(typed), LINES);
    assert.equal(hits[0]?.lineId, A.id, typed);
    assert.equal(hits[0].match, 'roman');
    assert.deepEqual(rankLines(query('the lord is my shepherd'), LINES).hits, []);
    const initials = romanTokens(A.transliteration).map(w => w[0]).join('');
    const byLetters = rankLines(query(initials, 'letters'), LINES).hits;
    assert.ok(byLetters.some(h => h.lineId === A.id), `${initials} finds its line`);
});

test('at most the hits asked for, saying there were more', () => {
    const lines = [100, 200, 300].map(ang => variant(A, { ang }));
    const capped = rankLines(query(A.gurmukhi), lines, { maxHits: 2 });
    assert.equal(capped.hits.length, 2);
    assert.equal(capped.more, true);
    assert.equal(rankLines(query(A.gurmukhi), lines).more, false);
});

test('the same candidates in any order rank the same', () => {
    const typed = words(A).slice(0, 4).join(' ');
    const pool = [...LINES.slice(0, 120), ...[3, 1, 2].map(ang => variant(A, { ang })), variant(A, { gurmukhi: typed, ang: 7 })];
    const expected = rankLines(query(typed), pool).hits;
    assert.ok(expected.length >= 4);
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let round = 0; round < 5; round++) {
        const shuffled = [...pool].sort(() => random() - 0.5);
        assert.deepEqual(rankLines(query(typed), shuffled).hits, expected);
    }
});

test("a heading that matches doesn't end the search: only lines that would be shown do", async () => {
    const typed = toSearchLetters(firstLetters(A.gurmukhi));
    assert.ok([...typed].length >= 6, 'enough letters for a second wave');
    const heading = variant(A, { isHeader: true });
    const asked: number[] = [];
    // The first wave finds only a heading with the same letters; the second, the line.
    const client: GurbaniClient = {
        fetchAng: async () => null,
        searchLines: async () => {
            asked.push(asked.length);
            return asked.length === 1 ? [heading] : [A];
        },
    };
    const found = await searchVerses(query(typed), { client });
    assert.equal(asked.length, 3, 'the second wave ran');
    assert.deepEqual(found?.hits.map(h => h.lineId), [A.id]);
    assert.equal(found?.complete, true);
});
