import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { clientImports, importsOf, reaches } from '../helpers/clientImports';

const imports = clientImports();

test('found the client components', () => {
    assert.ok(new Set(imports.map((i) => i.file)).size > 20);
});

test("the Seva pages' words never reach a client component", () => {
    // They live apart from the dictionaries so that only the Seva pages ship
    // them, each island its own part, as a prop (lib/i18n/seva/index.ts).
    const seva = join('lib', 'i18n', 'seva');
    for (const i of imports) assert.ok(!reaches(i.target, seva), `${i.file} imports ${i.spec}`);
});

test("the server's Seva modules stay on the server", () => {
    for (const path of [join('lib', 'seva', 'server'), join('lib', 'seva', 'refresh')]) {
        for (const i of imports) assert.ok(!reaches(i.target, path), `${i.file} imports ${i.spec}`);
    }
});

test('Seva loads Firestore in the browser only when something needs it', () => {
    // A static import would put the SDK in every Seva page's script, signed
    // in or not; import() fetches it when someone acts (lib/seva/client.ts).
    const firestore = ['firebase/firestore', 'firebase/firestore/lite', join('lib', 'firebase', 'firestore'), join('lib', 'firebase', 'firestoreLite'), join('lib', 'seva', 'client'), join('app', 'components', 'seva', 'sevaFirebase')];
    const seva = imports.filter((i) => i.file.startsWith(join('app', 'components', 'seva')) || i.file.startsWith(join('app', '[lang]', 'seva')));
    for (const i of seva.filter((s) => !s.dynamic)) {
        for (const path of firestore) assert.ok(!reaches(i.target, path), `${i.file} imports ${i.spec} statically`);
    }
});

test('type-only imports are seen as shipping nothing, and dynamic ones as dynamic', () => {
    const found = importsOf('app/x/Island.tsx', `'use client';
import type { SevaCopy } from '@/lib/i18n/seva';
import {
    a,
} from '../y';
type M = typeof import('@/lib/seva/client');
const load = () => import('./sevaFirebase');
`);
    assert.deepEqual(found.map((i) => [i.target, i.dynamic]), [[join('app', 'y'), false], [join('app', 'x', 'sevaFirebase'), true]]);
});
