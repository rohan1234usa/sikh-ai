// The browser's half of error reports loads on every page, before it's
// interactive (instrumentation-client.ts), so it must stay small and must
// never pull in the server's half: the logs, the Sentry sender, or anything
// of Node's.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { reaches, staticReach } from '../helpers/clientImports';

const SERVER_ONLY = [
    join('lib', 'log'),
    join('lib', 'errors', 'sentry'),
    join('lib', 'errors', 'requestError'),
    join('lib', 'api'),
    'next/server',
];

test("the browser's error reporting never reaches the server's half", () => {
    const reached = staticReach([
        'instrumentation-client.ts',
        join('lib', 'errors', 'client.ts'),
        join('app', '[lang]', 'error.tsx'),
        join('app', 'global-error.tsx'),
    ]);
    assert.ok(reached.has(join('lib', 'errors', 'scrub')), 'followed the imports');
    for (const [target, from] of reached) {
        assert.ok(!target.startsWith('node:'), `${from} imports ${target}`);
        for (const path of SERVER_ONLY) assert.ok(!reaches(target, path), `${from} reaches ${target}`);
    }
});

test('what every page loads first for it is these few modules, and no package', () => {
    const reached = [...staticReach(['instrumentation-client.ts']).keys()].sort();
    assert.deepEqual(reached, [
        join('lib', 'analytics'),
        join('lib', 'errors', 'client'),
        join('lib', 'errors', 'report'),
        join('lib', 'errors', 'scrub'),
        join('lib', 'i18n', 'config'),
        join('lib', 'i18n', 'paths'),
        join('lib', 'storage'),
    ].sort());
});
