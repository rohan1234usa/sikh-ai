import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ThinkingLevel } from '@google/genai';
import { LESSON_META, type Lesson } from '@/lib/learn/config';
import { getLesson } from '@/lib/learn/curriculum';
import { MAX_LESSON_CONTEXT_CHARS, composeTutorInstruction, lessonContextText } from '@/lib/learn/prompts';
import { LEARN_MAX_OUTPUT_TOKENS, buildTutorRequest, toTutorHistory } from '@/lib/learn/request';
import { MAX_TUTOR_HISTORY_TURNS, MAX_TUTOR_HISTORY_TURN_CHARS, MAX_TUTOR_MESSAGE_CHARS } from '@/lib/learn/tutor';
import { ROMANIZATION_CAPITALS, ROMANIZATION_RULES } from '@/lib/translate/romanization';

const LESSON = getLesson('past-and-the-ergative-ne');

test('the tutor’s instruction has every fixed section, the house romanization, and no lesson', () => {
    const instruction = composeTutorInstruction({});
    for (const heading of ['## Three forms, always', '## Romanization', '## Teaching', '## Practice', '## Untrusted text']) {
        assert.ok(instruction.includes(heading), heading);
    }
    assert.ok(instruction.includes(ROMANIZATION_RULES));
    assert.ok(instruction.includes(`- ${ROMANIZATION_CAPITALS}`));
    assert.ok(!instruction.includes('BEGIN LESSON'));
    assert.match(instruction, /^You are the SikhAI Punjabi tutor/);
});

test('the tutor stays off Gurbani and never corrects how a learner romanizes', () => {
    // Both came up in a real-key test: a Mool Mantar question drew the whole
    // text (the tutor has no citation check, unlike the chat), and a learner's
    // correct "daal" was "corrected".
    const instruction = composeTutorInstruction({});
    assert.match(instruction, /Never quote, translate or explain Gurbani/);
    assert.match(instruction, /suggest Ask SikhAI/);
    assert.match(instruction, /Never correct how a learner romanizes a word/);
});

test('a lesson comes last, fenced, and the same on every turn, so the cache can serve it', () => {
    const plain = composeTutorInstruction({});
    const withLesson = composeTutorInstruction({ lesson: LESSON });
    assert.ok(withLesson.startsWith(plain), 'the fixed sections are a common prefix, for the implicit cache');
    // The lesson is the site's own text, so no per-request nonce: a fresh one
    // would change every byte after it, the history included, on every turn.
    assert.equal(withLesson, composeTutorInstruction({ lesson: LESSON }));
    assert.ok(withLesson.includes(`--- BEGIN LESSON: ${LESSON.title} ---`));
    assert.ok(withLesson.includes('--- END LESSON ---'));
    assert.ok(withLesson.includes(`Summary: ${LESSON.summary}`));
    assert.ok(withLesson.includes('ਮੈਂ ਰੋਟੀ ਖਾਧੀ — Main roti khadhi — I ate (roti)'));
});

test('no lesson can close its own fence early', () => {
    for (const { slug } of LESSON_META) {
        assert.ok(!lessonContextText(getLesson(slug)).includes('--- END LESSON'), slug);
    }
});

test('a script lesson brings its letters along', () => {
    const text = lessonContextText(getLesson('how-gurmukhi-works'));
    assert.ok(text.startsWith('Track: Gurmukhi script'));
    assert.ok(text.includes('ਖ khakha (kh): k with a strong puff of air, as in kite.'));
});

test('a very long lesson is cut at a line, and says so', () => {
    const long: Lesson = {
        ...LESSON,
        sections: [{ heading: 'Long', body: Array.from({ length: 400 }, (_, i) => `Paragraph ${i} of a lesson that goes on.`) }],
    };
    const text = lessonContextText(long);
    assert.ok(text.length <= MAX_LESSON_CONTEXT_CHARS + '\n[lesson truncated]'.length);
    assert.ok(text.endsWith('\n[lesson truncated]'));
    assert.match(text.split('\n').at(-2)!, /^Paragraph \d+ of a lesson that goes on\.$/, 'no line is cut in half');
});

test('the request sends the history, then the message, with a short output cap and LOW thinking', () => {
    const history = toTutorHistory([{ role: 'user', text: 'Sat Sri Akal' }, { role: 'ai', text: 'Sat Sri Akal ji!' }]);
    const request = buildTutorRequest('gemini-3.8-flash', { message: 'Why kita?', history, lesson: null });
    assert.deepEqual(request.contents, [
        { role: 'user', parts: [{ text: 'Sat Sri Akal' }] },
        { role: 'model', parts: [{ text: 'Sat Sri Akal ji!' }] },
        { role: 'user', parts: [{ text: 'Why kita?' }] },
    ]);
    assert.equal(request.config?.maxOutputTokens, LEARN_MAX_OUTPUT_TOKENS);
    assert.equal(request.config?.thinkingConfig?.thinkingLevel, ThinkingLevel.LOW);
    assert.equal(request.config?.temperature, undefined);
    assert.equal(request.config?.systemInstruction, composeTutorInstruction({}));
});

const textOf = (turn: { parts?: { text?: string }[] }) => turn.parts?.[0]?.text ?? '';

test('the history keeps the last turns, not the first', () => {
    const raw = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'ai' : 'user', text: `turn ${i}` }));
    const history = toTutorHistory(raw);
    assert.equal(history.length, MAX_TUTOR_HISTORY_TURNS);
    assert.equal(textOf(history[0]), 'turn 4');
    assert.equal(textOf(history.at(-1)!), 'turn 11');
});

test('the history the client sends is capped, turn by turn, and junk is dropped', () => {
    const raw = [
        'junk',
        { role: 'user', text: 'q'.repeat(MAX_TUTOR_HISTORY_TURN_CHARS) },
        { role: 'ai', text: 'a'.repeat(MAX_TUTOR_HISTORY_TURN_CHARS + 10) },
        { role: 'ai', text: '   ' },
    ];
    const history = toTutorHistory(raw);
    assert.deepEqual(history.map((turn) => turn.role), ['user', 'model']);
    // A question can't be longer in the history than the message box allows.
    assert.equal(textOf(history[0]).length, MAX_TUTOR_MESSAGE_CHARS);
    assert.equal(textOf(history[1]).length, MAX_TUTOR_HISTORY_TURN_CHARS);
    assert.deepEqual(toTutorHistory('nope'), []);
    // A cut that would split an emoji leaves it out instead.
    const [ai] = toTutorHistory([{ role: 'ai', text: 'a'.repeat(MAX_TUTOR_HISTORY_TURN_CHARS - 1) + '🙏' }]);
    assert.ok(textOf(ai).isWellFormed());
});
