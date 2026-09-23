import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geminiModel } from '@/lib/gemini/models';
import type { TranslationResult } from '@/lib/translate/config';
import { PHRASES, type Phrase } from '@/lib/translate/phrasebook';
import { loadPhraseResult } from '@/lib/translate/phrasebookResults';
import { assemble } from '../../scripts/phrasebook-build/assemble';
import { checkPhrasebookResults, readGenerated, requestFingerprint, type Generated } from '../../scripts/phrasebook-build/check';

test('the committed phrasebook results are current (else: npm run build:phrasebook)', () => {
    const problems = checkPhrasebookResults(readGenerated(), PHRASES, geminiModel('translate'));
    assert.deepEqual(problems, []);
});

// ── the check ───────────────────────────────────────────────────────────────

const MODEL = 'gemini-test';
const [shipped, dropped] = PHRASES;

function resultFor(phrase: Phrase): TranslationResult {
    return {
        detectedInput: 'punjabi-latin',
        gurmukhi: phrase.gurmukhi,
        roman: phrase.roman,
        english: phrase.english,
        // Spelled as the entry spells it: the check re-runs the build's own
        // rules, which a lowercased "Sat Sri Akal" would (rightly) fail.
        words: [{ source: phrase.roman, gurmukhi: phrase.gurmukhi, roman: phrase.roman, meaning: 'a gloss' }],
        notes: [],
        pronunciation: [],
    };
}

function generated(): Generated {
    return {
        _meta: {
            model: MODEL,
            fingerprint: requestFingerprint(MODEL),
            generatedAt: '2026-09-21T00:00:00.000Z',
            count: 1,
            dropped: { [dropped.id]: 'a reason' },
        },
        results: { [shipped.id]: resultFor(shipped) },
    };
}

test('a current file passes, with a dropped phrase accounted for', () => {
    assert.deepEqual(checkPhrasebookResults(generated(), [shipped, dropped], MODEL), []);
});

test('a file that was never generated fails', () => {
    assert.deepEqual(checkPhrasebookResults({ _meta: null, results: {} }, [shipped], MODEL), ['never generated']);
});

test('a model change or a prompt change makes the file stale', () => {
    assert.match(checkPhrasebookResults(generated(), [shipped, dropped], 'gemini-other').join('\n'), /generated with gemini-test/);
    const g = generated();
    g._meta!.fingerprint = '000000000000';
    assert.match(checkPhrasebookResults(g, [shipped, dropped], MODEL).join('\n'), /prompt or request settings changed/);
});

test('an edited, added, or removed phrase makes the file stale', () => {
    const edited = { ...shipped, roman: `${shipped.roman} ji` };
    assert.deepEqual(checkPhrasebookResults(generated(), [edited, dropped], MODEL), [`${shipped.id}: roman edited in the phrasebook since generation`]);

    const added = { ...shipped, id: 'brand-new' };
    assert.deepEqual(checkPhrasebookResults(generated(), [shipped, dropped, added], MODEL), ['brand-new: no result (added since generation?)']);

    assert.deepEqual(checkPhrasebookResults(generated(), [shipped], MODEL), [`${dropped.id}: no longer in the phrasebook`]);
});

test('a result the client parser would alter, or a wrong count, fails', () => {
    const g = generated();
    g.results[shipped.id].words[0].meaning = ' untrimmed ';
    g._meta!.count = 2;
    assert.deepEqual(checkPhrasebookResults(g, [shipped, dropped], MODEL), [
        '_meta.count is 2, but there are 1 results',
        `${shipped.id}: the client parser would not show this result as stored`,
    ]);
});

// ── assembling one answer ───────────────────────────────────────────────────

// Taken from the phrasebook, so no Gurmukhi is typed by hand here.
const sir = PHRASES.find(p => p.id === 'sir-dhak-lavo')!;
const gWords = sir.gurmukhi.split(' ');
const rWords = sir.roman.split(' ');
const dhaa = [...gWords[1]][0]; // the first letter of the second word

function answer(over: Partial<TranslationResult> = {}): string {
    return JSON.stringify({
        detectedInput: 'punjabi-latin',
        gurmukhi: sir.gurmukhi,
        roman: sir.roman,
        english: 'Cover your head, please',
        words: rWords.map((r, i) => ({ source: r, gurmukhi: gWords[i], roman: r.toLowerCase(), meaning: 'a gloss' })),
        notes: [{ kind: 'culture', title: 'Head covering', body: 'Expected inside a Gurdwara.' }],
        pronunciation: [{ gurmukhi: dhaa, roman: 'dh', tip: 'A retroflex stop with a low tone.' }],
        ...over,
    });
}

test('the curated text replaces the model\'s, and its glosses, notes, and tips are kept', () => {
    const { result, problems } = assemble(sir, answer({ english: 'Please cover the head' }));
    assert.deepEqual(problems, []);
    assert.equal(result?.english, sir.english);
    assert.equal(result?.roman, sir.roman);
    assert.equal(result?.words.length, rWords.length);
    assert.equal(result?.notes[0].title, 'Head covering');
    assert.equal(result?.pronunciation[0].roman, 'dh'); // a sound inside a word is a fair anchor
});

test('a gloss that re-spells a word of the phrase keeps it from shipping', () => {
    const words = rWords.map((r, i) => ({ source: r, gurmukhi: gWords[i], roman: i === 1 ? 'dhakk' : r.toLowerCase(), meaning: 'a gloss' }));
    const { result, problems } = assemble(sir, answer({ roman: 'Sir dhakk lavo ji', words }));
    assert.equal(result, null);
    assert.deepEqual(problems, ['words[1].roman "dhakk" uses dhakk, which the phrase does not']);
});

test('a tip anchored on a re-spelled word keeps it from shipping', () => {
    const { result, problems } = assemble(sir, answer({ pronunciation: [{ gurmukhi: gWords[1], roman: 'dhakk', tip: 'x' }] }));
    assert.equal(result, null);
    assert.deepEqual(problems, ['pronunciation[0].roman "dhakk" uses dhakk, which the phrase does not']);
});

test('an unusable answer, or one with no glosses, does not ship', () => {
    assert.deepEqual(assemble(sir, 'not json').problems, ['the answer is not a usable result']);
    assert.deepEqual(assemble(sir, answer({ words: [] })).problems, ['no word glosses']);
});

// ── the client loader ───────────────────────────────────────────────────────

test('a phrase tap gets its stored result, unless the entry was edited since', async () => {
    const { results, _meta } = readGenerated();
    const id = Object.keys(results)[0];
    const phrase = PHRASES.find(p => p.id === id)!;
    assert.deepEqual(await loadPhraseResult(phrase), results[id]);
    assert.equal(await loadPhraseResult({ ...phrase, english: `${phrase.english}!` }), null);
    const droppedId = Object.keys(_meta!.dropped)[0];
    if (droppedId) assert.equal(await loadPhraseResult(PHRASES.find(p => p.id === droppedId)!), null);
});
