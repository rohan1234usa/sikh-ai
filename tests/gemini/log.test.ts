import { test } from 'node:test';
import assert from 'node:assert/strict';
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

test('a response with no cache hit leaves the field out of the JSON line', () => {
    const line = JSON.stringify(usageFields({ promptTokenCount: 875, candidatesTokenCount: 781 }));
    assert.equal(line.includes('cachedTokens'), false);
});
