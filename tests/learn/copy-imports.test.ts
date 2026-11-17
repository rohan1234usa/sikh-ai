// Learn's words live apart from the dictionaries so that only Learn's pages
// load them (lib/i18n/learn). On the client, one module imports them:
// app/components/learn/LearnCopy.tsx, which Learn's layout loads, so they
// ship in a script of Learn's own; Learn's client components read them with
// useLearnCopy(). Any other client import could put them in another script,
// or in every page's.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { getDictionary } from '@/lib/i18n';
import { LANGS } from '@/lib/i18n/config';
import { importsOf, isClientFile, reaches, sourceFiles, staticReach } from '../helpers/clientImports';

const LEARN_COPY = join('lib', 'i18n', 'learn');
const LEARN_COMPONENTS = join('app', 'components', 'learn');
const PROVIDER = join(LEARN_COMPONENTS, 'LearnCopy');

const moduleOf = (file: string) => file.replace(/\.tsx?$/, '').replace(/[/\\]index$/, '');

test("one client module imports Learn's words: the provider Learn's layout loads", () => {
    // Every module client code loads, however far down: lib/learn/hub.ts and
    // lib/learn/status.ts take the words as an argument, typed only.
    const client = sourceFiles().filter((file) => isClientFile(file));
    const loaded = new Set([...staticReach(client).keys(), ...client.map(moduleOf)]);
    assert.ok(loaded.has(join('lib', 'learn', 'status')), 'followed the imports');
    const importers = sourceFiles()
        .filter((file) => loaded.has(moduleOf(file)) && !reaches(file, LEARN_COPY))
        .filter((file) => importsOf(file).some((i) => reaches(i.target, LEARN_COPY)));
    assert.deepEqual(importers, [`${PROVIDER}.tsx`]);
});

test('no client code outside Learn loads them, however far down', () => {
    // The root layout's providers, the navbar, the dictionaries' index, and
    // every other section's components.
    const outside = sourceFiles().filter((file) => isClientFile(file) && !reaches(file, LEARN_COMPONENTS));
    const reached = staticReach(outside);
    assert.ok(reached.has(join('lib', 'i18n', 'dictionaries', 'en')), 'followed the imports');
    for (const [target, from] of reached) {
        for (const path of [LEARN_COPY, PROVIDER]) assert.ok(!reaches(target, path), `${from} reaches ${target}`);
    }
});

test('the dictionaries every page loads hold none of them', () => {
    for (const lang of LANGS) assert.ok(!('learn' in getDictionary(lang)), lang);
});
