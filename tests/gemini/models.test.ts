import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { geminiFallbackModel, geminiModel } from '@/lib/gemini/models';

const VARS = ['GEMINI_CHAT_MODEL', 'GEMINI_TRANSLATE_MODEL', 'GEMINI_CHAT_FALLBACK_MODEL', 'GEMINI_TRANSLATE_FALLBACK_MODEL'];
afterEach(() => { for (const name of VARS) delete process.env[name]; });

test('both features use the pinned model by default', () => {
    assert.equal(geminiModel('chat'), 'gemini-3.8-flash');
    assert.equal(geminiModel('translate'), 'gemini-3.8-flash');
});

test('an env override applies to its own feature only, trimmed', () => {
    process.env.GEMINI_TRANSLATE_MODEL = '  gemini-3.6-flash ';
    assert.equal(geminiModel('translate'), 'gemini-3.6-flash');
    assert.equal(geminiModel('chat'), 'gemini-3.8-flash');
});

test('a blank override falls back to the pinned model', () => {
    process.env.GEMINI_CHAT_MODEL = '   ';
    assert.equal(geminiModel('chat'), 'gemini-3.8-flash');
});

test('the fallback model defaults to 3.7 Flash', () => {
    assert.equal(geminiFallbackModel('chat'), 'gemini-3.7-flash');
    assert.equal(geminiFallbackModel('translate'), 'gemini-3.7-flash');
});

test('the fallback can be switched off', () => {
    for (const value of ['off', 'OFF', '0', 'false', '', 'none']) {
        process.env.GEMINI_CHAT_FALLBACK_MODEL = value;
        assert.equal(geminiFallbackModel('chat'), null, `"${value}" should disable it`);
    }
    assert.equal(geminiFallbackModel('translate'), 'gemini-3.7-flash');
});

test('a fallback that repeats the primary model is dropped', () => {
    process.env.GEMINI_CHAT_MODEL = 'gemini-3.7-flash';
    assert.equal(geminiFallbackModel('chat'), null);
});
