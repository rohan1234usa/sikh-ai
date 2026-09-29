// Holds every lesson and vocabulary word to the section's contract: complete parallel text,
// Gurmukhi that is only Gurmukhi, romanization in the house style, quizzes
// that can be answered, and one spelling per word across the lessons, the
// vocabulary and the translator's phrasebook. The content is AI-drafted and
// waiting for a fluent review; these checks can't say a sentence is good
// Punjabi, only that it is consistent.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    GENDERS,
    LESSON_META,
    LESSON_TRACK_IDS,
    TRACK_IDS,
    PARTS_OF_SPEECH,
    VOCAB_TOPIC_IDS,
    isLessonSlug,
    learnPaths,
    lessonPath,
    lessonsFor,
    topicPath,
    type Example,
    type QuizQuestion,
} from '@/lib/learn/config';
import { VOCAB, getLesson, neighbors } from '@/lib/learn/curriculum';
import { buildVocabQuiz, typedMatches } from '@/lib/learn/quiz';
import { PHRASES } from '@/lib/translate/phrasebook';
import { scanValue } from '../../scripts/i18n-audit/free-checks';
import { caseIssues, romanIssues, scriptIssues } from '../../scripts/translate-eval/score';

const LESSONS = LESSON_META.map((meta) => getLesson(meta.slug));
const GURMUKHI = /[਀-੿]/;

// Every place a lesson writes Punjabi, gathered once, with a label that
// says where it is.
type Field = { label: string; value: string };
const gurmukhiFields: Field[] = [];
const romanFields: Field[] = [];
const englishFields: Field[] = [];
// Gurmukhi paired with its romanization, for the one-spelling check.
const pairs: { label: string; gurmukhi: string; roman: string }[] = [];

function addExample(label: string, example: Example) {
    gurmukhiFields.push({ label: `${label}.gurmukhi`, value: example.gurmukhi });
    romanFields.push({ label: `${label}.roman`, value: example.roman });
    englishFields.push({ label: `${label}.english`, value: example.english });
    if (example.note) englishFields.push({ label: `${label}.note`, value: example.note });
    pairs.push({ label, gurmukhi: example.gurmukhi, roman: example.roman });
}

function addQuestion(label: string, question: QuizQuestion) {
    englishFields.push({ label: `${label}.prompt`, value: question.prompt });
    if (question.explanation) englishFields.push({ label: `${label}.explanation`, value: question.explanation });
    if (question.promptPa) gurmukhiFields.push({ label: `${label}.promptPa`, value: question.promptPa });
    if (question.promptRoman) romanFields.push({ label: `${label}.promptRoman`, value: question.promptRoman });
    if (question.promptPa && question.promptRoman) {
        pairs.push({ label, gurmukhi: question.promptPa, roman: question.promptRoman });
    }
    if (question.kind === 'typed') {
        // `accept` lists the other spellings families use, which break the
        // house style on purpose; the quiz test checks they grade right.
        romanFields.push({ label: `${label}.answer`, value: question.answer });
        if (question.promptPa && !question.promptRoman) {
            pairs.push({ label, gurmukhi: question.promptPa, roman: question.answer });
        }
        return;
    }
    const target = question.choicesLang === 'pa' ? gurmukhiFields : question.choicesLang === 'pa-Latn' ? romanFields : englishFields;
    question.choices.forEach((choice, i) => target.push({ label: `${label}.choices[${i}]`, value: choice }));
}

for (const lesson of LESSONS) {
    const at = lesson.slug;
    englishFields.push({ label: `${at}.title`, value: lesson.title }, { label: `${at}.summary`, value: lesson.summary });
    lesson.sections.forEach((section, s) => {
        const where = `${at}.sections[${s}]`;
        englishFields.push({ label: `${where}.heading`, value: section.heading });
        section.body.forEach((paragraph, p) => englishFields.push({ label: `${where}.body[${p}]`, value: paragraph }));
        if (section.tip) englishFields.push({ label: `${where}.tip`, value: section.tip });
        section.letters?.forEach((letter, l) => {
            gurmukhiFields.push({ label: `${where}.letters[${l}].glyph`, value: letter.glyph });
            romanFields.push({ label: `${where}.letters[${l}].name`, value: letter.name });
            romanFields.push({ label: `${where}.letters[${l}].roman`, value: letter.roman });
            englishFields.push({ label: `${where}.letters[${l}].sound`, value: letter.sound });
        });
        section.examples?.forEach((example, e) => addExample(`${where}.examples[${e}]`, example));
    });
    lesson.quiz.forEach((question, q) => addQuestion(`${at}.quiz[${q}]`, question));
}

for (const topic of VOCAB_TOPIC_IDS) {
    VOCAB[topic].forEach((word, w) => {
        const at = `vocab.${word.id ?? `${topic}[${w}]`}`;
        gurmukhiFields.push({ label: `${at}.gurmukhi`, value: word.gurmukhi });
        romanFields.push({ label: `${at}.roman`, value: word.roman });
        englishFields.push({ label: `${at}.english`, value: word.english });
        if (word.note) englishFields.push({ label: `${at}.note`, value: word.note });
        pairs.push({ label: at, gurmukhi: word.gurmukhi, roman: word.roman });
        if (word.example) addExample(`${at}.example`, word.example);
    });
}

test('every lesson has a unique, URL-safe slug and a title and summary that fit', () => {
    const slugs = LESSON_META.map((meta) => meta.slug);
    assert.equal(new Set(slugs).size, slugs.length, 'slugs are unique across tracks');
    for (const meta of LESSON_META) {
        assert.match(meta.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, meta.slug);
        assert.ok(meta.title.length > 0 && meta.title.length <= 60, `${meta.slug}: title of ${meta.title.length} characters`);
        assert.ok(meta.summary.length > 0 && meta.summary.length <= 160, `${meta.slug}: summary of ${meta.summary.length} characters`);
        assert.match(meta.summary, /[.?!]$/, `${meta.slug}: the summary is a sentence`);
        assert.ok(isLessonSlug(meta.slug));
    }
    assert.ok(!isLessonSlug('nope') && !isLessonSlug(undefined) && !isLessonSlug('constructor'));
    for (const track of LESSON_TRACK_IDS) assert.ok(lessonsFor(track).length > 0, `${track} has lessons`);
});

test('every lesson has sections with text and a quiz of four to ten questions', () => {
    for (const lesson of LESSONS) {
        assert.ok(lesson.sections.length >= 2, `${lesson.slug}: at least two sections`);
        for (const section of lesson.sections) {
            assert.ok(section.heading.trim(), `${lesson.slug}: a heading`);
            assert.ok(section.body.length > 0 && section.body.every((p) => p.trim()), `${lesson.slug}: "${section.heading}" has text`);
            assert.ok(!section.letters || section.letters.length > 0, `${lesson.slug}: an empty letter grid`);
            assert.ok(!section.examples || section.examples.length > 0, `${lesson.slug}: an empty example list`);
        }
        assert.ok(lesson.quiz.length >= 4 && lesson.quiz.length <= 10, `${lesson.slug}: ${lesson.quiz.length} questions`);
    }
});

test('every example carries all three renditions', () => {
    for (const { label, gurmukhi, roman } of pairs) {
        assert.ok(gurmukhi.trim() && roman.trim(), label);
    }
    for (const { label, value } of englishFields) assert.ok(value.trim(), `${label} is empty`);
});

test('Gurmukhi fields hold Gurmukhi and nothing from another script', () => {
    const issues = gurmukhiFields.flatMap(({ label, value }) => [
        ...scriptIssues(label, value),
        ...(GURMUKHI.test(value) ? [] : [`${label}: no Gurmukhi in "${value}"`]),
    ]);
    assert.deepEqual(issues, []);
});

test('romanized fields follow the house style', () => {
    const issues = romanFields.flatMap(({ label, value }) => [
        ...romanIssues(label, value),
        ...caseIssues(label, value),
        ...(value.trim() ? [] : [`${label} is empty`]),
    ]);
    assert.deepEqual(issues, []);
});

test('English text spells the community terms the one house way', () => {
    const issues = englishFields.flatMap(({ label, value }) => [
        ...scanValue(label, value).map((finding) => `${label}: ${finding.detail}`),
        ...caseIssues(label, value),
    ]);
    assert.deepEqual(issues, []);
});

test('every quiz question can be answered', () => {
    for (const lesson of LESSONS) {
        lesson.quiz.forEach((question, i) => {
            const at = `${lesson.slug}.quiz[${i}]`;
            if (question.kind === 'choice') {
                assert.ok(question.choices.length >= 2 && question.choices.length <= 4, `${at}: ${question.choices.length} choices`);
                // Choices written only in Gurmukhi say so, so they are marked
                // lang="pa" and set in the Gurmukhi font.
                if (question.choices.every((choice) => GURMUKHI.test(choice) && !/[A-Za-z]/.test(choice))) {
                    assert.equal(question.choicesLang, 'pa', `${at}: Gurmukhi choices need choicesLang: 'pa'`);
                }
                assert.equal(new Set(question.choices).size, question.choices.length, `${at}: repeated choices`);
                assert.equal(question.choices.filter((c) => c === question.answer).length, 1, `${at}: the answer is one of the choices`);
            } else {
                assert.ok(typedMatches(question.answer, question), `${at}: its own answer is graded right`);
                for (const spelling of question.accept ?? []) {
                    assert.ok(typedMatches(spelling, question), `${at}: "${spelling}" is graded right`);
                }
            }
        });
    }
});

// Gurmukhi and roman split into words the same way, so where the counts
// agree, the nth word of one is the nth of the other.
const gurmukhiWords = (text: string) =>
    text.normalize('NFC').replace(/[\p{P}\p{S}]/gu, ' ').split(/\s+/).filter(Boolean);
const romanWords = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

// Words spelled one way in Gurmukhi and romanized two ways on purpose. Keep
// this short: each entry is a spelling a reader sees in two forms.
const HOMOGRAPHS = new Set<string>([]);

test('one spelling per word across the lessons, the vocabulary and the phrasebook', () => {
    const seen = new Map<string, Map<string, string>>(); // Gurmukhi word → roman → where
    const all = [
        ...pairs,
        ...PHRASES.map((phrase) => ({ label: `phrasebook.${phrase.id}`, gurmukhi: phrase.gurmukhi, roman: phrase.roman })),
    ];
    for (const { label, gurmukhi, roman } of all) {
        const g = gurmukhiWords(gurmukhi);
        const r = romanWords(roman);
        if (g.length !== r.length) continue;
        g.forEach((word, i) => {
            if (HOMOGRAPHS.has(word)) return;
            const spellings = seen.get(word) ?? new Map<string, string>();
            if (!spellings.has(r[i])) spellings.set(r[i], label);
            seen.set(word, spellings);
        });
    }
    const conflicts = [...seen]
        .filter(([, spellings]) => spellings.size > 1)
        .map(([word, spellings]) => `${word}: ${[...spellings].map(([spelling, label]) => `${spelling} (${label})`).join(', ')}`);
    assert.deepEqual(conflicts, []);
});

test('every track links its lessons in order, first to last', () => {
    for (const track of LESSON_TRACK_IDS) {
        const lessons = lessonsFor(track);
        lessons.forEach((meta, i) => {
            const around = neighbors(meta.slug);
            assert.equal(around.index, i);
            assert.equal(around.total, lessons.length);
            assert.equal(around.prev?.slug, lessons[i - 1]?.slug);
            assert.equal(around.next?.slug, lessons[i + 1]?.slug);
        });
    }
});

test('the section lists every lesson and topic page once', () => {
    const paths = learnPaths();
    assert.equal(new Set(paths).size, paths.length, 'no path twice');
    for (const meta of LESSON_META) assert.ok(paths.includes(lessonPath(meta)), lessonPath(meta));
    for (const topic of VOCAB_TOPIC_IDS) assert.ok(paths.includes(topicPath(topic)), topicPath(topic));
    for (const path of ['/learn', ...TRACK_IDS.map((track) => `/learn/${track}`)]) {
        assert.ok(paths.includes(path), path);
    }
});

test('every vocabulary word is complete, in its topic, and typed right', () => {
    const ids = new Set<string>();
    for (const topic of VOCAB_TOPIC_IDS) {
        const words = VOCAB[topic];
        assert.ok(words.length >= 15, `${topic}: ${words.length} words`);
        const meanings = new Set<string>();
        for (const word of words) {
            assert.match(word.id, new RegExp(`^${topic}-[a-z0-9]+(-[a-z0-9]+)*$`), `${word.id} is prefixed by its topic`);
            assert.ok(!ids.has(word.id), `${word.id} is listed twice`);
            ids.add(word.id);
            assert.equal(word.topic, topic, `${word.id} is filed under ${topic}`);
            assert.ok(!meanings.has(word.english), `${topic}: two words mean "${word.english}"`);
            meanings.add(word.english);
            assert.ok(PARTS_OF_SPEECH.includes(word.pos), `${word.id}: part of speech`);
            if (word.pos === 'noun') assert.ok(word.gender && GENDERS.includes(word.gender), `${word.id}: a noun needs its gender`);
            else assert.equal(word.gender, undefined, `${word.id}: only nouns have a gender`);
            if (word.pos === 'verb') {
                assert.ok(word.example, `${word.id}: a verb needs an example`);
                assert.match(word.roman, /na$/, `${word.id}: a verb is its -na infinitive`);
            }
            for (const id of word.sameAs ?? []) {
                assert.ok(id !== word.id && words.some((w) => w.id === id), `${word.id}: sameAs ${id} is another word in ${topic}`);
            }
            const asTyped = { answer: word.roman, accept: word.accept };
            assert.ok(typedMatches(word.roman, asTyped), `${word.id}: its own spelling is graded right`);
            for (const spelling of word.accept ?? []) assert.ok(typedMatches(spelling, asTyped), `${word.id}: "${spelling}"`);
        }
    }
});

test('every topic can build a full vocabulary quiz', () => {
    const prompts = { meaning: 'What does this mean?', say: 'How do you say “{english}”?' };
    for (const topic of VOCAB_TOPIC_IDS) {
        const quiz = buildVocabQuiz(VOCAB[topic], `check-${topic}`, prompts);
        assert.equal(quiz.length, 10, topic);
        for (const question of quiz) {
            if (question.kind === 'choice') assert.equal(new Set(question.choices).size, 4, `${topic}: four different meanings`);
        }
    }
});
