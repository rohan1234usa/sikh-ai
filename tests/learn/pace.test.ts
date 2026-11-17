import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LESSON_META, type LessonBody, type LessonSection } from '@/lib/learn/config';
import { getLesson, getLessonPace } from '@/lib/learn/curriculum';
import { SECONDS_PER_QUESTION, WORDS_PER_MINUTE, lessonPace, minutes, secondsFrom, sectionMinutes, sectionWords } from '@/lib/learn/pace';

const SECTION: LessonSection = {
    heading: 'Two words',                                  // 2
    body: ['Three more words.', 'And   four, spaced oddly.'], // 3 + 4
    tip: 'One tip.',                                       // 2
    letters: [{ glyph: 'ਕ', name: 'kakka', roman: 'k', sound: 'k as in skip.' }], // 1 + 1 + 1 + 4
    examples: [{ gurmukhi: 'ਘਰ', roman: 'ghar', english: 'home, house', note: 'A note.' }], // 1 + 1 + 2 + 2
};

test('a section counts every word it shows, in every rendition', () => {
    assert.equal(sectionWords(SECTION), 24);
    assert.equal(sectionWords({ heading: 'Only', body: ['this.'] }), 2);
});

test('a lesson takes its words at 200 a minute and 20 seconds a question', () => {
    assert.equal(WORDS_PER_MINUTE, 200);
    assert.equal(SECONDS_PER_QUESTION, 20);
    const lesson: LessonBody = {
        sections: [{ heading: 'x', body: [Array(199).fill('w').join(' ')] }, SECTION],
        quiz: [
            { kind: 'typed', prompt: 'One', answer: 'ik' },
            { kind: 'typed', prompt: 'Two', answer: 'do' },
        ],
    };
    assert.deepEqual(lessonPace(lesson), { sections: [60, 7], quiz: 40 }, '200 words is a minute; 24 is 7.2 seconds, rounded');
});

test('what is left counts from the checkpoint reached to the end', () => {
    const pace = { sections: [60, 90, 30], quiz: 140 };
    assert.equal(secondsFrom(pace), 320);
    assert.equal(secondsFrom(pace, 0), 320);
    assert.equal(secondsFrom(pace, 1), 260);
    assert.equal(secondsFrom(pace, 3), 140, 'at the quiz, only the quiz is left');
    assert.equal(secondsFrom(pace, 9), 140, 'past the last section, still the quiz');
});

test('minutes round to the nearest whole one, and never to nothing', () => {
    assert.equal(minutes(0), 1);
    assert.equal(minutes(20), 1);
    assert.equal(minutes(89), 1);
    assert.equal(minutes(90), 2);
    assert.equal(minutes(342), 6);
});

test('every lesson comes to a few minutes, the first to about six', () => {
    for (const meta of LESSON_META) {
        const lesson = getLesson(meta.slug);
        const pace = lessonPace(lesson);
        assert.equal(pace.sections.length, lesson.sections.length, meta.slug);
        assert.ok(pace.sections.every((seconds) => Number.isInteger(seconds) && seconds > 0), `${meta.slug}: whole, positive seconds`);
        const total = minutes(secondsFrom(pace));
        assert.ok(total >= 2 && total <= 10, `${meta.slug}: ${total} min`);
    }
    assert.equal(minutes(secondsFrom(lessonPace(getLesson('how-gurmukhi-works')))), 6);
});

test('a short section says so rather than rounding up, so the outline adds up', () => {
    assert.equal(sectionMinutes(44), null);
    assert.equal(sectionMinutes(45), 1);
    assert.equal(sectionMinutes(150), 3);
    for (const meta of LESSON_META) {
        const pace = getLessonPace(meta.slug);
        assert.deepEqual(pace, lessonPace(getLesson(meta.slug)), meta.slug);
        const shown = pace.sections.reduce((sum, seconds) => sum + (sectionMinutes(seconds) ?? 0), 0) + minutes(pace.quiz);
        assert.ok(shown <= minutes(secondsFrom(pace)) + 1, `${meta.slug}: rows add to ${shown} min`);
    }
});
