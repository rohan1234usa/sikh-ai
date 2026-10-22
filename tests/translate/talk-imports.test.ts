// The Talk page's words live apart from the dictionaries so that only the
// Talk page ships them (lib/i18n/talk): its server page reads them and hands
// them to TalkScreen as a prop. A client component that imported them would
// put all three languages in its script.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { clientImports, reaches, staticReach } from '../helpers/clientImports';

test("the Talk page's words never reach a client component", () => {
    const imports = clientImports();
    assert.ok(imports.some((i) => i.file === join('app', 'components', 'translate', 'TalkScreen.tsx')), 'found the Talk components');
    const talk = join('lib', 'i18n', 'talk');
    for (const i of imports) assert.ok(!reaches(i.target, talk), `${i.file} imports ${i.spec}`);
});

test('the Talk page loads no markdown: its cards are plain lines', () => {
    // The chat's bubbles import react-markdown at the top; the plain turn
    // pieces Talk shares with them live in app/components/chat/turns.tsx.
    const reached = staticReach([join('app', 'components', 'translate', 'TalkScreen.tsx')]);
    assert.ok(reached.has(join('app', 'components', 'chat', 'turns')), 'followed the imports');
    for (const [target, from] of reached) {
        for (const path of ['react-markdown', 'remark-gfm', join('app', 'components', 'chat', 'Bubbles')]) {
            assert.ok(!reaches(target, path), `${from} reaches ${target}`);
        }
    }
});
