// Deleting an account needs Firestore and the deletion's own code, but every
// page carries the way to it (the navbar's account menu). So nothing a page
// loads at the start may reach them: the dialog fetches them with import()
// once someone has confirmed (app/components/account/accountDeletion.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { importsOf, reaches } from '../helpers/clientImports';

// What loads at the start, following static imports of the app's own code
// (a package is as far as it goes). Dynamic imports are where it stops.
function staticReach(entries: string[]): Map<string, string> {
    const seen = new Map<string, string>(); // module → who imported it
    const resolve = (target: string) =>
        [`${target}.ts`, `${target}.tsx`, target, join(target, 'index.ts'), join(target, 'index.tsx')]
            .find((f) => /\.tsx?$/.test(f) && existsSync(f));
    const queue = [...entries];
    while (queue.length > 0) {
        const file = queue.shift()!;
        for (const i of importsOf(file, readFileSync(file, 'utf8'))) {
            if (i.dynamic || seen.has(i.target)) continue;
            seen.set(i.target, file);
            const next = resolve(i.target);
            if (next) queue.push(next);
        }
    }
    return seen;
}

const DELETION_ONLY = [
    'firebase/firestore',
    'firebase/firestore/lite',
    join('lib', 'firebase', 'firestore'),
    join('lib', 'firebase', 'firestoreLite'),
    join('lib', 'account', 'client'),
    join('lib', 'account', 'deletion'),
    join('app', 'components', 'account', 'accountFirebase'),
];

// Every page's, and the account's own ways in.
const ENTRIES = [
    join('app', '[lang]', 'layout.tsx'),
    join('app', 'context', 'AuthContext.tsx'),
    join('app', 'components', 'account', 'AccountDialogHost.tsx'),
    join('app', 'components', 'account', 'DeleteAccountPanel.tsx'),
    join('app', 'components', 'account', 'accountDeletion.ts'),
    join('lib', 'account', 'prepare.ts'),
];

test('nothing a page loads at the start reaches the account deletion or Firestore', () => {
    const reached = staticReach(ENTRIES);
    assert.ok(reached.has(join('lib', 'firebase', 'hint')), 'followed the imports');
    for (const [target, from] of reached) {
        for (const path of DELETION_ONLY) assert.ok(!reaches(target, path), `${from} reaches ${target}`);
    }
});

test("the dialog's code comes with import(), when it's wanted", () => {
    const host = join('app', 'components', 'account', 'AccountDialogHost.tsx');
    const dynamic = importsOf(host).filter((i) => i.dynamic).map((i) => i.target);
    assert.deepEqual([...new Set(dynamic)], [join('app', 'components', 'account', 'DeleteAccountDialog')]);
    assert.ok(!staticReach(ENTRIES).has(join('app', 'components', 'account', 'DeleteAccountDialog')));
});

test('the deletion and Firestore come with import(), once someone confirms', () => {
    const loader = join('app', 'components', 'account', 'accountDeletion.ts');
    const dynamic = importsOf(loader).filter((i) => i.dynamic).map((i) => i.target);
    assert.deepEqual(dynamic, [join('app', 'components', 'account', 'accountFirebase')]);
});
