// Learn's words live apart from the dictionaries so that only Learn's pages
// carry them (lib/i18n/learn): Learn's layout reads them on the server and
// hands one language's to LearnCopyProvider, which the client components read
// with useLearnCopy(). A client component that imported them would put all
// three languages in its script, on every page it is on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { getDictionary } from '@/lib/i18n';
import { LANGS } from '@/lib/i18n/config';
import { clientImports, isClientFile, reaches, sourceFiles, staticReach } from '../helpers/clientImports';

const LEARN_COPY = join('lib', 'i18n', 'learn');

test("Learn's words never reach a client component", () => {
    const imports = clientImports();
    // The provider imports their type alone, which ships nothing.
    assert.ok(imports.some((i) => i.file === join('app', 'components', 'learn', 'LearnCopy.tsx')), 'found the Learn components');
    for (const i of imports) assert.ok(!reaches(i.target, LEARN_COPY), `${i.file} imports ${i.spec}`);
});

test("nor anything a client component loads, however far down", () => {
    // lib/learn/hub.ts and lib/learn/status.ts take the copy as an argument:
    // a value import there would ship it with the hub.
    const reached = staticReach(sourceFiles().filter((file) => isClientFile(file)));
    assert.ok(reached.has(join('lib', 'learn', 'status')), 'followed the imports');
    for (const [target, from] of reached) assert.ok(!reaches(target, LEARN_COPY), `${from} reaches ${target}`);
});

test('the dictionaries every page loads hold none of them', () => {
    for (const lang of LANGS) assert.ok(!('learn' in getDictionary(lang)), lang);
});
