// Deleting an account needs Firestore and the deletion's own code, but every
// page carries the way to it (the navbar's account menu). So nothing a page
// loads at the start may reach them: the dialog fetches them with import()
// once someone has confirmed (app/components/account/accountDeletion.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { importsOf, reaches, staticReach } from '../helpers/clientImports';

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
    join('app', 'components', 'Navbar.tsx'),
    join('app', 'components', 'AccountMenu.tsx'),
    join('app', 'components', 'account', 'AccountDialogHost.tsx'),
    join('app', 'components', 'account', 'DeleteAccountPanel.tsx'),
    join('app', 'components', 'ClearBrowserControl.tsx'),
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

test("the dialog's own code leaves the deletion, and what it needs, for later", () => {
    const reached = staticReach([join('app', 'components', 'account', 'DeleteAccountDialog.tsx')]);
    assert.ok(reached.has(join('lib', 'account', 'steps')), 'followed the imports');
    for (const [target, from] of reached) {
        for (const path of [...DELETION_ONLY, join('lib', 'chat', 'store', 'firestorePlans'), join('lib', 'seva', 'plans')])
            assert.ok(!reaches(target, path), `${from} reaches ${target}`);
    }
});

test('the deletion and Firestore come with import(), once someone confirms', () => {
    const loader = join('app', 'components', 'account', 'accountDeletion.ts');
    const dynamic = importsOf(loader).filter((i) => i.dynamic).map((i) => i.target);
    assert.deepEqual(dynamic, [join('app', 'components', 'account', 'accountFirebase')]);
});
