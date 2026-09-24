import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ThinkingLevel } from '@google/genai';
import { MAX_MESSAGE_CHARS, type ChatContext } from '@/lib/chat/config';
import { buildChatRequest, CHAT_MAX_OUTPUT_TOKENS, toChatHistory, type ChatInput } from '@/lib/chat/request';

test('history keeps the last 10 turns, maps the roles, and caps each turn', () => {
    const raw = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? 'ai' : 'user', text: `turn ${i}` }));
    const history = toChatHistory(raw);
    assert.equal(history.length, 10);
    assert.deepEqual(history[0], { role: 'user', parts: [{ text: 'turn 4' }] });
    assert.equal(history[1].role, 'model');

    const long = toChatHistory([{ role: 'user', text: 'x'.repeat(MAX_MESSAGE_CHARS + 50) }]);
    assert.equal(long[0].parts?.[0].text?.length, MAX_MESSAGE_CHARS);
});

test('junk history is dropped rather than sent', () => {
    assert.deepEqual(toChatHistory('not a list'), []);
    assert.deepEqual(
        toChatHistory([{ role: 'user', text: '   ' }, { role: 'user' }, null, { role: 'system', text: 'hi' }]),
        [{ role: 'user', parts: [{ text: 'hi' }] }], // an unknown role is treated as the user's
    );
});

const input: ChatInput = {
    message: 'What is seva?',
    history: toChatHistory([{ role: 'user', text: 'Hi' }, { role: 'ai', text: 'Sat Sri Akal' }]),
    lensId: 'sikhai',
    modeId: 'balanced',
    languageId: 'english',
    context: null,
};

test('the request is the history, then the new message, with the production settings', () => {
    const request = buildChatRequest('gemini-test', input);
    assert.equal(request.model, 'gemini-test');
    assert.equal(request.contents instanceof Array && request.contents.length, 3);
    assert.deepEqual((request.contents as unknown[]).at(-1), { role: 'user', parts: [{ text: 'What is seva?' }] });
    assert.equal(request.config?.maxOutputTokens, CHAT_MAX_OUTPUT_TOKENS);
    assert.equal(request.config?.thinkingConfig?.thinkingLevel, ThinkingLevel.LOW);
    assert.match(String(request.config?.systemInstruction), /You are SikhAI/);
    assert.equal('temperature' in (request.config ?? {}), false); // deprecated on Gemini 3.x
});

test('an eval can change the thinking level, and nothing else moves', () => {
    const low = buildChatRequest('m', input);
    const medium = buildChatRequest('m', input, { thinkingLevel: ThinkingLevel.MEDIUM });
    assert.equal(medium.config?.thinkingConfig?.thinkingLevel, ThinkingLevel.MEDIUM);
    assert.deepEqual({ ...medium.config, thinkingConfig: null }, { ...low.config, thinkingConfig: null });
});

test('a passage is fenced with a nonce: fixed for evals, fresh for live requests', () => {
    const context: ChatContext = { type: 'shabad', title: 'Ang 1', text: 'line one\nits translation', capturedAt: 0 };
    const a = buildChatRequest('m', { ...input, context }, { nonce: 'abc12345' });
    assert.deepEqual(buildChatRequest('m', { ...input, context }, { nonce: 'abc12345' }), a);
    assert.match(String(a.config?.systemInstruction), /--- BEGIN PASSAGE abc12345: Ang 1 ---/);
    assert.notEqual(buildChatRequest('m', { ...input, context }).config?.systemInstruction, a.config?.systemInstruction);
});
