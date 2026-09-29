import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_HINT_KEY, AUTH_HINT_SCRIPT, planAuthStart } from '@/lib/firebase/hint';

test('Auth loads at once only for a browser that was signed in last time', () => {
    assert.equal(planAuthStart('1', null), 'restore');
    assert.equal(planAuthStart('0', true), 'wait', 'signed out last time: wait for a sign-in button');
});

test('a browser with no hint checks once, unless it has never run Auth', () => {
    // From before the hint: Auth's database is there, and only Auth can say
    // whether it holds a session.
    assert.equal(planAuthStart(null, true), 'check');
    // A browser that can't list its databases checks too, rather than
    // showing a member as signed out.
    assert.equal(planAuthStart(null, null), 'check');
    // A first visit: nothing to restore.
    assert.equal(planAuthStart(null, false), 'wait');
});

test('the pre-paint script marks only a signed-in browser', () => {
    const html: { dataset: Record<string, string> } = { dataset: {} };
    const run = (stored: string | null) => {
        html.dataset = {};
        const localStorage = { getItem: (k: string) => (k === AUTH_HINT_KEY ? stored : null) };
        new Function('localStorage', 'document', AUTH_HINT_SCRIPT)(localStorage, { documentElement: html });
        return html.dataset.auth;
    };
    assert.equal(run('1'), '1');
    assert.equal(run('0'), undefined);
    assert.equal(run(null), undefined);
    // Storage that throws (blocked cookies) leaves the page alone.
    const blocked = { getItem: () => { throw new Error('SecurityError'); } };
    assert.doesNotThrow(() => new Function('localStorage', 'document', AUTH_HINT_SCRIPT)(blocked, { documentElement: html }));
});
