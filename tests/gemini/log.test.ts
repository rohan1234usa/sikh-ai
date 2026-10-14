import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MediaModality } from '@google/genai';
import { usageFields } from '@/lib/gemini/log';

test('the log line carries the cached share of the prompt', () => {
    const fields = usageFields({
        promptTokenCount: 1950,
        cachedContentTokenCount: 1792,
        candidatesTokenCount: 410,
        thoughtsTokenCount: 0,
    });
    assert.deepEqual(fields, { promptTokens: 1950, cachedTokens: 1792, outputTokens: 410, thoughtTokens: 0 });
});

test('a prompt with audio in it says how much of it was audio', () => {
    const fields = usageFields({
        promptTokenCount: 1100,
        candidatesTokenCount: 90,
        promptTokensDetails: [
            { modality: MediaModality.TEXT, tokenCount: 620 },
            { modality: MediaModality.AUDIO, tokenCount: 480 },
        ],
    });
    assert.equal(fields.audioTokens, 480);
    assert.equal(fields.promptTokens, 1100);
    const textOnly = usageFields({ promptTokenCount: 600, promptTokensDetails: [{ modality: MediaModality.TEXT, tokenCount: 600 }] });
    assert.equal('audioTokens' in textOnly, false, 'a text prompt has no audio field');
});

test('a response with no cache hit leaves the field out of the JSON line', () => {
    const line = JSON.stringify(usageFields({ promptTokenCount: 875, candidatesTokenCount: 781 }));
    assert.equal(line.includes('cachedTokens'), false);
});
