import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { QuizQuestion, TypedQuestion, VocabWord } from '@/lib/learn/config';
import {
    buildVocabQuiz,
    choiceMatches,
    foldRoman,
    scoreQuiz,
    seededShuffle,
    typedMatches,
} from '@/lib/learn/quiz';
import { VOCAB, getLesson } from '@/lib/learn/curriculum';

test('grading ignores case, spaces, punctuation and accents', () => {
    assert.equal(foldRoman('  Ki haal HAI? '), foldRoman('kihaalhai'));
    assert.equal(foldRoman('Tusī'), foldRoman('tusi'));
    assert.equal(foldRoman("main'n"), foldRoman('mainn'));
    assert.equal(foldRoman('Sat-Sri-Akal!'), foldRoman('sat sri akal'));
});

test('grading forgives the spellings families choose differently', () => {
    const same: [string, string][] = [
        ['Waheguru', 'vaheguru'],
        ['phir', 'fir'],
        ['theek', 'thik'],
        ['door', 'dur'],
        ['haal', 'hal'],
        ['rajj', 'raj'],
        ['achha', 'acha'],
        ['tussi', 'tusi'],
    ];
    for (const [a, b] of same) assert.equal(foldRoman(a), foldRoman(b), `${a} and ${b}`);
});

test('grading never folds one consonant into another', () => {
    const different: [string, string][] = [
        ['thik', 'tik'],
        ['dhan', 'dan'],
        ['kha', 'ka'],
        ['bhukh', 'bukh'],
        ['hai', 'he'],
    ];
    for (const [a, b] of different) assert.notEqual(foldRoman(a), foldRoman(b), `${a} and ${b}`);
});

test('Gurmukhi letters and digits count as nothing, so a digits question wants ordinary digits', () => {
    assert.equal(foldRoman('੧੯'), '');
    assert.equal(foldRoman('ਰੋਟੀ'), '');
    const year = getLesson('nukta-letters-and-digits').quiz.find((q) => q.promptPa === '੨੦੨੬');
    assert.ok(year?.kind === 'typed');
    assert.ok(typedMatches('2026', year));
    assert.ok(!typedMatches('੨੦੨੬', year), 'copying the prompt is not reading it');
});

test('a typed answer matches the house spelling or an accepted one, and never an empty answer', () => {
    const question: TypedQuestion = { kind: 'typed', prompt: 'No', answer: 'nahi', accept: ['nahin'] };
    assert.ok(typedMatches('Nahi', question));
    assert.ok(typedMatches('nahin', question));
    assert.ok(!typedMatches('na', question));
    assert.ok(!typedMatches('   ', question));
    assert.ok(!typedMatches('?!', { answer: '...' }));
});

test('a strict question keeps the vowel length and the addak it tests', () => {
    // The script lessons' own questions: each misreading folds to the answer
    // under the lenient rules, so these questions grade strictly.
    const quiz = [...getLesson('vowel-signs-1-muharni').quiz, ...getLesson('bindi-tippi-addak-subjoined').quiz];
    const find = (promptPa: string) => {
        const question = quiz.find((q) => q.promptPa === promptPa);
        assert.ok(question?.kind === 'typed' && question.strict, promptPa);
        return question;
    };
    const cases: [string, string[], string[]][] = [
        ['ਦਿਲ', ['dil', 'Dil'], ['deel']],
        ['ਕਿਤਾਬ', ['kitaab', 'kitab'], ['keetaab', 'keetab']],
        ['ਪੱਤਾ', ['patta', 'PATTA'], ['pata']],
        ['ਅੱਜ', ['ajj'], ['aj']],
    ];
    for (const [promptPa, right, wrong] of cases) {
        const question = find(promptPa);
        for (const answer of right) assert.ok(typedMatches(answer, question), `${promptPa}: ${answer}`);
        for (const answer of wrong) {
            assert.ok(!typedMatches(answer, question), `${promptPa}: ${answer} is a misreading`);
            assert.ok(typedMatches(answer, { ...question, strict: undefined }), `${promptPa}: ${answer} would pass if lenient`);
        }
    }
});

test('a copula question tells haan (I am) from han (they are)', () => {
    const find = (slug: Parameters<typeof getLesson>[0], answer: string) => {
        const question = getLesson(slug).quiz.find((q) => q.kind === 'typed' && q.answer === answer);
        assert.ok(question?.kind === 'typed' && question.strict, answer);
        return question;
    };
    const iAm = find('sentence-order-and-copulas', 'Main theek haan');
    assert.ok(typedMatches('main thik haan', iAm));
    assert.ok(!typedMatches('Main theek han', iAm));
    const dad = find('honorifics-and-respect', 'Papa ji aaye han');
    assert.ok(typedMatches('Papa ji aye han', dad));
    assert.ok(!typedMatches('Papa ji aaye haan', dad));
});

test('a choice matches only the answer itself', () => {
    assert.ok(choiceMatches('ਅ', { answer: 'ਅ' }));
    assert.ok(!choiceMatches('ੳ', { answer: 'ਅ' }));
    assert.ok(!choiceMatches(null, { answer: 'ਅ' }));
});

test('a quiz scores each answer in order, and an unanswered question is wrong', () => {
    const questions: QuizQuestion[] = [
        { kind: 'choice', prompt: 'a', choices: ['x', 'y'], answer: 'y' },
        { kind: 'typed', prompt: 'b', answer: 'roti' },
        { kind: 'typed', prompt: 'c', answer: 'pani' },
    ];
    assert.deepEqual(scoreQuiz(questions, ['y', 'Roti']), { score: { correct: 2, total: 3 }, results: [true, true, false] });
    assert.deepEqual(scoreQuiz(questions, [null, 'x', 'pani']).results, [false, false, true]);
});

test('a seeded shuffle is a permutation that depends only on its seed', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const once = seededShuffle(items, 'family');
    assert.deepEqual([...once].sort((a, b) => a - b), items);
    assert.deepEqual(seededShuffle(items, 'family'), once);
    assert.notDeepEqual(seededShuffle(items, 'food'), once);
    assert.deepEqual(items, Array.from({ length: 20 }, (_, i) => i), 'the input is left alone');
});

const WORDS: VocabWord[] = ['roti', 'pani', 'daal', 'saag', 'lassi', 'chaul'].map((roman, i) => ({
    id: `food-${roman}`,
    topic: 'food',
    gurmukhi: `ਗ${i}`,
    roman,
    english: `meaning ${i}`,
    pos: 'noun',
    gender: 'f',
    ...(roman === 'chaul' ? { accept: ['chawal'] } : {}),
}));
const PROMPTS = { meaning: 'What does this mean?', say: 'How do you say “{english}”?' };

test('a meaning question never offers two choices a learner could defend either way', () => {
    // Listed by hand, not worked out the way the quiz builder does it, so the
    // test can catch the builder missing a pair.
    const pairs = [
        ['family-mata', 'family-mummy'],
        ['family-pita', 'family-papa'],
        ['family-bhra', 'family-veer'],
        ['greetings-dhanvaad', 'greetings-meharbani'],
        ['greetings-sat-sri-akal', 'greetings-rabb-rakha'],
        ['greetings-ki-haal-hai', 'greetings-tuhada-ki-haal-hai'],
    ];
    const all = Object.values(VOCAB).flat();
    for (const id of pairs.flat()) assert.ok(all.some((w) => w.id === id), `${id} exists`);
    for (const [topic, words] of Object.entries(VOCAB)) {
        const idOf = new Map(words.map((w) => [w.english, w.id]));
        for (let round = 0; round < 100; round++) {
            for (const question of buildVocabQuiz(words, `${topic}:${round}`, PROMPTS, words.length)) {
                if (question.kind !== 'choice') continue;
                const ids = question.choices.map((choice) => idOf.get(choice));
                for (const [a, b] of pairs) assert.ok(!(ids.includes(a) && ids.includes(b)), `${topic}:${round} offers ${a} and ${b}`);
            }
        }
    }
});

test('a typed question takes a word from the topic that means exactly what was asked', () => {
    const quizzes = Array.from({ length: 50 }, (_, round) => buildVocabQuiz(VOCAB.family, `family:${round}`, PROMPTS, VOCAB.family.length)).flat();
    const askedFor = (roman: string) => {
        const question = quizzes.find((q) => q.kind === 'typed' && q.answer === roman);
        assert.ok(question?.kind === 'typed', roman);
        return question;
    };
    assert.ok(typedMatches('veer', askedFor('bhra')), 'brother: veer is a brother too');
    assert.ok(!typedMatches('bhra', askedFor('veer')), 'brother (affectionate): only veer');
    assert.ok(!typedMatches('mata', askedFor('mummy')), 'mom: mata is formal');
});

test('a vocabulary quiz alternates choosing a meaning and typing a word', () => {
    const quiz = buildVocabQuiz(WORDS, 'seed-1', PROMPTS, 6);
    assert.equal(quiz.length, 6);
    quiz.forEach((question, i) => {
        if (i % 2 === 0) {
            assert.equal(question.kind, 'choice');
            if (question.kind !== 'choice') return;
            assert.equal(question.choices.length, 4);
            assert.equal(new Set(question.choices).size, 4);
            assert.ok(question.choices.includes(question.answer));
            const word = WORDS.find((w) => w.gurmukhi === question.promptPa)!;
            assert.equal(question.answer, word.english);
            assert.equal(question.promptRoman, word.roman);
            assert.ok(question.choices.every((choice) => WORDS.some((w) => w.english === choice)));
        } else {
            assert.equal(question.kind, 'typed');
            if (question.kind !== 'typed') return;
            const word = WORDS.find((w) => w.roman === question.answer)!;
            assert.equal(question.prompt, `How do you say “${word.english}”?`);
            assert.deepEqual(question.accept, word.accept);
        }
    });
});

test('a vocabulary quiz is the same for the same seed and asks each word once', () => {
    assert.deepEqual(buildVocabQuiz(WORDS, 'seed-1', PROMPTS), buildVocabQuiz(WORDS, 'seed-1', PROMPTS));
    const quiz = buildVocabQuiz(WORDS, 'seed-2', PROMPTS);
    assert.equal(quiz.length, WORDS.length, 'a count above the topic size asks every word');
    const asked = quiz.map((q) => (q.kind === 'choice' ? q.promptPa : q.answer));
    assert.equal(new Set(asked).size, WORDS.length);
});
