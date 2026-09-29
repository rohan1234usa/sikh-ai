import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ThinkingLevel } from '@google/genai';
import type { Lesson } from '@/lib/learn/config';
import { getLesson } from '@/lib/learn/curriculum';
import { MAX_LESSON_CONTEXT_CHARS, composeTutorInstruction, lessonContextText } from '@/lib/learn/prompts';
import { LEARN_MAX_OUTPUT_TOKENS, buildTutorRequest, toTutorHistory } from '@/lib/learn/request';
import { MAX_TUTOR_HISTORY_TURNS, MAX_TUTOR_HISTORY_TURN_CHARS } from '@/lib/learn/tutor';
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

test('a lesson comes last, fenced, so every call shares the same opening', () => {
    const plain = composeTutorInstruction({});
    const withLesson = composeTutorInstruction({ lesson: LESSON, nonce: 'abc12345' });
    assert.ok(withLesson.startsWith(plain), 'the fixed sections are a common prefix, for the implicit cache');
    assert.equal(withLesson, composeTutorInstruction({ lesson: LESSON, nonce: 'abc12345' }), 'deterministic with a fixed nonce');
    assert.ok(withLesson.includes(`--- BEGIN LESSON abc12345: ${LESSON.title} ---`));
    assert.ok(withLesson.includes('--- END LESSON abc12345 ---'));
    assert.ok(withLesson.includes(`Summary: ${LESSON.summary}`));
    assert.ok(withLesson.includes('ਮੈਂ ਰੋਟੀ ਖਾਧੀ — Main roti khadhi — I ate (roti)'));
    assert.notEqual(composeTutorInstruction({ lesson: LESSON }), composeTutorInstruction({ lesson: LESSON }), 'live requests get a fresh nonce');
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
    const request = buildTutorRequest('gemini-3.8-flash', { message: 'Why kita?', history, lesson: null }, { nonce: 'n' });
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

test('the history the client sends is capped, turn by turn, and junk is dropped', () => {
    const raw = [
        'junk',
        ...Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'ai' : 'user', text: `turn ${i}` })),
        { role: 'user', text: 'y'.repeat(MAX_TUTOR_HISTORY_TURN_CHARS + 10) },
        { role: 'ai', text: '   ' },
    ];
    const history = toTutorHistory(raw);
    assert.ok(history.length <= MAX_TUTOR_HISTORY_TURNS);
    assert.ok(history.every((turn) => (turn.parts?.[0]?.text ?? '').length <= MAX_TUTOR_HISTORY_TURN_CHARS));
    assert.ok(history.every((turn) => turn.role === 'user' || turn.role === 'model'));
    assert.deepEqual(toTutorHistory('nope'), []);
});
