import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSevaCopy } from '@/lib/i18n/seva';
import { describeEvent } from '@/lib/seva/display';
import { signupLine } from '@/lib/seva/event';
import { event } from './helpers';

const common = getSevaCopy('en').common;

test('each way of signing up has its own line, and only a limit has a bar', () => {
    assert.deepEqual(signupLine({ spots: 0, volunteerCount: 0 }, common), { mode: 'none', text: 'No sign-up needed' });
    assert.deepEqual(signupLine({ spots: null, volunteerCount: 12 }, common), { mode: 'unlimited', text: 'Volunteers: 12' });
    assert.deepEqual(signupLine({ spots: 20, volunteerCount: 3 }, common), {
        mode: 'limited', text: 'Volunteers: 3 of 20', left: 'Spots left: 17', percent: 15,
    });
    assert.deepEqual(signupLine({ spots: 2, volunteerCount: 2 }, common), {
        mode: 'limited', text: 'Volunteers: 2 of 2', left: 'Full', percent: 100,
    });
});

test('the page describes every kind of event, with no NaN or null in the words', () => {
    for (const over of [{}, { spots: null, volunteerCount: 0 }, { spots: 0, volunteerCount: 0 }]) {
        const d = describeEvent(event(over), 'en', getSevaCopy('en'));
        const words = JSON.stringify(d);
        assert.ok(!/NaN|null|undefined/.test(words), words);
    }
    for (const lang of ['pa', 'pa-latn'] as const) {
        const line = describeEvent(event({ spots: null, volunteerCount: 4 }), lang, getSevaCopy(lang)).signup;
        assert.ok(line.text.includes('4'), line.text);
    }
});
