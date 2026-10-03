import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GurbaniLine } from '@/lib/gurbani/gurbaninow';
import { firstLetters } from '@/lib/gurbani/gurmukhi';
import {
    acceptsRoman, alignRoman, IK_ONKAR, LETTER_STARTS, letterInitials, romanKey, romanSkeleton, romanTokens, romanWindows,
    TUNING, variants, WORD_STARTS, wordInitials, wordSimilarity, type Alt,
} from '@/lib/gurbani/roman';
import { toSearchLetters } from '@/lib/gurbani/score';

// Real lines and GurbaniNow's own transliteration of them, as recorded: the
// romanized side of every comparison is checked against the source's.
const PAGES: Record<string, GurbaniLine[]> = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/gurbaninow.json'), 'utf8'));
const LINES = [...new Map(Object.values(PAGES).flat().filter(l => !l.isHeader && l.transliteration).map(l => [l.id, l])).values()];
const LONG = LINES.filter(l => romanTokens(l.transliteration).length >= 3);

// What a reader types instead of GurbaniNow's spelling: long vowels once,
// retroflex letters single.
const casual = (text: string) => text.toLowerCase()
    .replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/tth/g, 'th').replace(/tt/g, 't').replace(/dd/g, 'd').replace(/rr/g, 'r');

test('romanized text becomes plain lowercase words, accents and punctuation gone', () => {
    assert.deepEqual(romanTokens('So Purakh Niranjan!'), ['so', 'purakh', 'niranjan']);
    assert.deepEqual(romanTokens('sō purakh nirañjan'), ['so', 'purakh', 'niranjan']);
    assert.deepEqual(romanTokens("tera kiya meetha laage |1| rahaau |"), ['tera', 'kiya', 'meetha', 'laage', 'rahaau']);
    assert.deepEqual(romanTokens('  '), []);
    assert.deepEqual(romanTokens('ਸੋ ਪੁਰਖੁ'), [], 'no English letters, no words');
});

test('every spelling of ੴ is one word, as it is in Gurmukhi', () => {
    for (const form of ['ik onkar', 'Ik Ongkar', 'ek omkar', '1 onkar', 'ikoankaar', 'ik oankaar', 'Ekonkar', 'ikk onkaar'])
        assert.deepEqual(romanTokens(`${form} sat naam`), [IK_ONKAR, 'sat', 'naam'], form);
    assert.deepEqual(romanTokens('ik man'), ['ik', 'man'], 'ik on its own is a word');
    assert.deepEqual(romanTokens('onkar'), ['onkar']);
});

test('words readers run together or split up are written as Gurbani writes them', () => {
    assert.deepEqual(romanTokens('ik onkar satnam karta purakh'), [IK_ONKAR, 'sat', 'nam', 'karta', 'purakh']);
    assert.deepEqual(romanTokens('gurprasad'), ['gur', 'prasad']);
    assert.deepEqual(romanTokens('akalpurakh'), ['akal', 'purakh']);
    assert.deepEqual(romanTokens('waheguru'), ['waheguru'], 'one word in Gurbani too');
    assert.deepEqual(romanTokens('dhan dhan ram das gur'), ['dhan', 'dhan', 'ramdas', 'gur']);
    assert.deepEqual(romanTokens('wahe guru ji'), ['waheguru', 'ji']);
    assert.deepEqual(romanTokens('paar brahm parmesar'), ['paarbrahm', 'parmesar']);
    assert.deepEqual(romanTokens('sat guru nir bhau'), ['satguru', 'nirbhau']);
    assert.deepEqual(romanTokens('ram naam'), ['ram', 'naam'], 'only the compounds');
});

const guesses = (word: string) => wordInitials(word).map(a => a.letter).join('');

test("a word's first letter: the longest spelling at its start decides", () => {
    const cases: [string, string][] = [
        ['chhaad', 'ਛ'], ['chit', 'ਚਛ'], ['kirpa', 'ਕਖ'], ['khalsa', 'ਖ'], ['ghar', 'ਘ'], ['gur', 'ਗਘ'],
        ['thakur', 'ਤਠਥ'], ['tthaakur', 'ਠ'], ['ttootee', 'ਟਤ'], ['tera', 'ਤਟ'],
        ['dhan', 'ਧਢਦ'], ['ddar', 'ਡ'], ['dtaah', 'ਢ'], ['ddhol', 'ਢ'], ['dard', 'ਦਡਧ'],
        ['phir', 'ਫ'], ['fir', 'ਫ'], ['prabh', 'ਪ'], ['bhagat', 'ਭ'], ['bisar', 'ਬਭ'],
        ['shabad', 'ਸ'], ['sabad', 'ਸ'], ['waheguru', 'ਵ'], ['vaheguru', 'ਵ'], ['zaat', 'ਜ'], ['jag', 'ਜਝ'], ['jhoothaa', 'ਝ'],
        ['qudrat', 'ਕ'], ['rahao', 'ਰ'], ['rhaao', 'ਰ'], ['yaar', 'ਯ'], ['naam', 'ਨ'], ['man', 'ਮ'], ['lok', 'ਲ'], ['har', 'ਹ'],
        ['aad', 'ਅ'], ['aisa', 'ਅ'], ['aukha', 'ਅੳ'], ['aoochaa', 'ੳ'], ['ik', 'ੲ'], ['eko', 'ੲਅ'], ['utam', 'ੳ'],
        ['oh', 'ੳਅ'], ['oochaa', 'ੳ'], [IK_ONKAR, 'ੴ'],
    ];
    for (const [word, expected] of cases) assert.equal(guesses(word), expected, word);
    assert.deepEqual(wordInitials('123'), [], 'no letters, no guess');
});

test('every guess is a letter GurbaniNow indexes, and each set of guesses adds up to 1', () => {
    const tables: [string, readonly Alt[]][] = [...WORD_STARTS, ...Object.entries(LETTER_STARTS)];
    for (const [start, alts] of tables) {
        const total = alts.reduce((sum, alt) => sum + alt.p, 0);
        assert.ok(Math.abs(total - 1) < 1e-9, `${start} adds up to ${total}`);
        assert.deepEqual([...alts].sort((a, b) => b.p - a.p), alts, `${start}: likeliest first`);
        for (const alt of alts) {
            assert.equal([...alt.letter].length, 1, start);
            assert.equal(toSearchLetters(alt.letter), alt.letter, `${start}: ${alt.letter} is already a carrier, not a vowel`);
            assert.match(alt.letter, /[ਅ-ਹੲ-ੴ]/u, start);
        }
    }
});

test("GurbaniNow's own transliteration of every recorded word is covered by the guesses", () => {
    let words = 0;
    let lettersMissed = 0;
    for (const line of LINES) {
        const typed = romanTokens(line.transliteration);
        const truth = [...toSearchLetters(firstLetters(line.gurmukhi))];
        if (typed.length !== truth.length) continue;
        typed.forEach((word, i) => {
            words++;
            assert.ok(wordInitials(word).some(alt => alt.letter === truth[i]), `${word} → ${truth[i]} (${line.id})`);
            if (!letterInitials(word[0]).some(alt => alt.letter === truth[i])) lettersMissed++;
        });
    }
    assert.ok(words > 2000, `${words} words compared`);
    // A single letter can't tell GurbaniNow's "aoo" (ੳ) from "a" (ਅ).
    assert.ok(lettersMissed / words < 0.01, `${lettersMissed} of ${words} first letters missed`);
});

test('the likeliest spellings come first, ties in a fixed order, the unlikely dropped', () => {
    const t = wordInitials('tu');
    const th = wordInitials('thakur');
    const p = wordInitials('peh');
    const found = variants([t, th, t, p], 10);
    assert.deepEqual(found.map(v => v.letters).slice(0, 2), ['ਤਤਤਪ', 'ਤਠਤਪ']);
    for (let i = 1; i < found.length; i++) assert.ok(found[i - 1].p >= found[i].p, 'by probability');
    assert.ok(found.every(v => v.p >= found[0].p * 0.1), 'nothing under a tenth of the best');
    assert.equal(variants([t, th, t, p], 2).length, 2, 'a limit');
    assert.deepEqual(variants([t, th, t, p], 10), found, 'the same every time');
    const tie = variants([[{ letter: 'ਕ', p: 0.5 }, { letter: 'ਖ', p: 0.5 }]], 2);
    assert.deepEqual(tie.map(v => v.letters), ['ਕ', 'ਖ'], 'a tie goes to the earlier guess');
    assert.deepEqual(variants([], 4), []);
    assert.deepEqual(variants([t, []], 4), [], 'a word with no guess, no spelling');
});

test('the window searched is the least ambiguous run of five; a long query gets a second', () => {
    const positions = romanTokens('tu thakur tum peh ardaas jeeo pind').map(wordInitials);
    const [first, second] = romanWindows(positions);
    assert.deepEqual([first.start, first.size], [2, 5], 'tum peh ardaas jeeo pind: one ambiguous letter');
    assert.ok(second && Math.abs(second.start - first.start) >= 2, 'a second window, apart from the first');
    assert.equal(romanWindows(romanTokens('tu thakur tum peh ardaas').map(wordInitials)).length, 1, 'five words, one window');
    const short = romanWindows(romanTokens('so purakh niranjan').map(wordInitials));
    assert.deepEqual(short.map(w => [w.start, w.size, w.variants[0].letters]), [[0, 3, 'ਸਪਨ']]);
    const even = romanWindows(romanTokens('sach sach sach sach sach sach').map(wordInitials));
    assert.equal(even[0].start, 0, 'the leftmost of equals');
    assert.deepEqual(romanWindows([]), []);
});

test('one spelling per sound: doubled letters, long vowels and the usual swaps fold together', () => {
    const same: [string, string][] = [
        ['tthaakur', 'thakur'], ['aradaas', 'aradas'], ['saibhang', 'saibhan'], ['nirañjan', 'niranjan'],
        ['phir', 'fir'], ['shabad', 'sabad'], ['waheguru', 'vaheguru'], ['jeeo', 'jio'], ['soohaa', 'suha'], ['zaat', 'jat'],
    ];
    for (const [a, b] of same) assert.equal(romanKey(a), romanKey(b), `${a} ~ ${b}`);
    assert.equal(romanKey('|1|'), '');
    assert.equal(romanSkeleton(romanKey('karataa')), romanSkeleton(romanKey('karta')));
    assert.notEqual(romanKey('naam'), romanKey('man'));
});

test('words match exactly, by their consonants, or by a few letters; short words only exactly', () => {
    assert.equal(wordSimilarity('naam', 'naam'), 1);
    assert.equal(wordSimilarity('tu', 'too'), 1, 'the same once folded');
    assert.equal(wordSimilarity('so', 'se'), 0, 'two letters: the vowel is half the word');
    assert.ok(wordSimilarity('karta', 'karataa') >= 0.9, 'same consonants');
    assert.ok(wordSimilarity('waheguru', 'vaahiguroo') >= TUNING.strongWord);
    assert.ok(wordSimilarity('ardaas', 'aradaas') >= TUNING.strongWord);
    assert.equal(wordSimilarity('purakh', 'shepherd'), 0);
    assert.equal(wordSimilarity('naam', 'dhaan'), 0, 'different words');
});

test("a line's own transliteration, or a reader's spelling of it, matches it in full", () => {
    for (const line of LONG) {
        const own = alignRoman(romanTokens(line.transliteration), line.transliteration);
        assert.ok(own.coverage > 0.99 && own.precision > 0.99, line.id);
        const typed = romanTokens(casual(line.transliteration));
        const read = alignRoman(typed, line.transliteration);
        assert.ok(read.coverage >= TUNING.satisfied, `${line.id}: ${casual(line.transliteration)} → ${read.coverage}`);
        assert.ok(acceptsRoman(read, typed.length), line.id);
    }
    assert.ok(LONG.length > 300);
});

test('part of a line covers the part typed; words out of order cover less', () => {
    const line = LONG.find(l => romanTokens(l.transliteration).length >= 8)!;
    const words = romanTokens(line.transliteration);
    const half = alignRoman(words.slice(0, Math.ceil(words.length / 2)), line.transliteration);
    assert.ok(half.coverage > 0.99, 'every typed word is in the line');
    assert.ok(half.precision > 0.3 && half.precision < 0.75, `about half of the line: ${half.precision}`);
    const shuffled = alignRoman([...words].reverse(), line.transliteration);
    assert.ok(shuffled.coverage < half.coverage, 'order matters');
});

test('words run together or apart still line up', () => {
    const joined = alignRoman(['satnam', 'karta'], 'sat naam karataa purakh');
    assert.ok(joined.coverage > 0.95 && joined.strong === 2, 'one typed word for two written');
    assert.equal(alignRoman(['sat', 'naam'], 'satanaam').strong, 2, 'two typed words for one written');
});

test("English isn't mistaken for Gurbani, and every line's own words find it first", () => {
    const english = ['the lord is my shepherd', 'love your neighbour as yourself', 'in the beginning was the word', 'all you need is love'];
    for (const sentence of english) {
        const typed = romanTokens(sentence);
        for (const line of LINES) {
            const match = alignRoman(typed, line.transliteration);
            assert.ok(!acceptsRoman(match, typed.length), `${sentence} ~ ${line.transliteration}`);
            assert.ok(match.coverage < TUNING.minCoverage, `${sentence} ~ ${line.transliteration}`);
        }
    }
    // Each line, typed casually, ranks itself (or a line with the same words)
    // above every other recorded line that shares a word with it; the rest
    // can't come close.
    const keys = (text: string) => new Set(romanTokens(text).map(romanKey));
    const words = new Map(LINES.map(l => [l.id, { all: romanTokens(l.transliteration).join(' '), keys: keys(l.transliteration) }]));
    for (const line of LONG) {
        const typed = romanTokens(casual(line.transliteration));
        const typedKeys = keys(casual(line.transliteration));
        const own = alignRoman(typed, line.transliteration).coverage;
        for (const other of LINES) {
            const theirs = words.get(other.id)!;
            if (theirs.all === words.get(line.id)!.all) continue;
            if (![...theirs.keys].some(key => typedKeys.has(key))) continue;
            assert.ok(alignRoman(typed, other.transliteration).coverage <= own, `${line.id} vs ${other.id}`);
        }
    }
});

test('acceptance asks more of a three-word query, and some words found outright', () => {
    assert.equal(acceptsRoman({ coverage: 0.7, precision: 0.5, strong: 2 }, 4), true);
    assert.equal(acceptsRoman({ coverage: 0.7, precision: 0.5, strong: 2 }, 3), false, 'three words need more');
    assert.equal(acceptsRoman({ coverage: 0.8, precision: 0.5, strong: 2 }, 3), true);
    assert.equal(acceptsRoman({ coverage: 0.9, precision: 0.5, strong: 1 }, 5), false, 'one word found outright is not enough');
    assert.equal(acceptsRoman({ coverage: 0.6, precision: 0.9, strong: 4 }, 5), false);
});
