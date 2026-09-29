import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeTranslateInstruction } from '@/lib/translate/prompts';
import { ROMANIZATION_CAPITALS, ROMANIZATION_RULES } from '@/lib/translate/romanization';

// The translator and the Punjabi tutor share the house romanization. The
// phrasebook test proves the translate request didn't change when the rules
// moved out; this says so directly.
test('the translator’s instruction carries the shared romanization rules word for word', () => {
    const instruction = composeTranslateInstruction({ sourceHint: 'auto', detectedScript: 'latin' });
    assert.ok(instruction.includes(`\n${ROMANIZATION_RULES}\n`));
    assert.ok(instruction.includes(`\n- ${ROMANIZATION_CAPITALS} In "words"`));
});

test('the rules are bullets, and the capitalization line is ready to be one', () => {
    for (const line of ROMANIZATION_RULES.split('\n')) assert.match(line, /^- /);
    assert.match(ROMANIZATION_CAPITALS, /^Capitalize like an English sentence:/);
    assert.doesNotMatch(ROMANIZATION_CAPITALS, /"words"|"roman"/, 'nothing about the translator’s JSON fields');
});
