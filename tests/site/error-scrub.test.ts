import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    FIRESTORE_COLLECTIONS, MAX_FRAMES, MAX_MESSAGE_CHARS, frameLines, parseFrameLine, readsAsWords, scrubMessage,
    scrubName, scrubPath,
} from '@/lib/errors/scrub';
import { readClientReport } from '@/lib/errors/report';

const SITE = 'https://sikhai.vercel.app';
const CHUNK = `${SITE}/_next/static/chunks/0a1b2c3d4e5f.js`;
const SHARE_ID = 'AbCdEfGhIjKlMnOpQrSt'; // a Firestore ID's shape, without a digit
const UID = 'kQ8vYt2HnXcVb3LmPq9RsTuW7xYz';
const UUID = '3f2a9c1e-1111-4222-8333-944455556666';

test("an engine's or a library's own words come through as they are", () => {
    for (const message of [
        "Cannot read properties of undefined (reading 'map')",
        "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
        "Can't find variable: foo",
        'a.getBoundingClientRect is not a function',
        'Firebase: Error (auth/popup-closed-by-user).',
        'Component unavailable: NS_ERROR_FAILURE',
        'Minified React error #418; visit https://react.dev/errors/418 for the full message',
    ]) assert.equal(scrubMessage('TypeError', message), message);
});

test("a SyntaxError says only that it was one: its message quotes what it couldn't parse", () => {
    assert.equal(scrubMessage('SyntaxError', 'Unexpected token \'m\', "my private question" is not valid JSON'), '');
    assert.equal(scrubMessage('TypeError', undefined), '');
});

test('quoted text loses its words unless it is a name from code, and an open quote ends the message', () => {
    assert.equal(scrubMessage('Error', 'Unknown lens "my private question"'), 'Unknown lens "…"');
    assert.equal(scrubMessage('Error', "Expected 'a.b' but got 'what I typed'"), "Expected 'a.b' but got '…'");
    assert.equal(scrubMessage('Error', 'Bad input "my private question'), 'Bad input …');
    assert.equal(scrubMessage('Error', "Bad input 'my private question"), 'Bad input …');
});

test('Gurmukhi and anything else outside ASCII is taken out', () => {
    assert.equal(scrubMessage('Error', 'No match for ਵਾਹਿਗੁਰੂ ਜੀ in the index'), 'No match for … in the index');
    assert.equal(scrubMessage('Error', 'Quoted "ਸਤਿ ਨਾਮ"'), 'Quoted "…"');
});

test('a JSON payload, model output and all, is cut off', () => {
    assert.equal(
        scrubMessage('Error', 'Incomplete JSON segment at the end: {"candidates":[{"content":{"parts":[{"text":"Seva is selfless'),
        'Incomplete JSON segment at the end: …',
    );
    assert.equal(scrubMessage('Error', 'got [{"error": "x"}]'), 'got …');
});

test('an address keeps its origin and path, without any ID or query', () => {
    assert.equal(
        scrubMessage('Error', `Failed to load ${SITE}/pa/share/${SHARE_ID}?q=my%20question#top`),
        `Failed to load ${SITE}/pa/share/:id`,
    );
    assert.equal(scrubMessage('Error', `Failed to fetch ${SITE}/api/shabad/search?q=ਵਾਹਿਗੁਰੂ`), `Failed to fetch ${SITE}/api/shabad/search`);
    assert.equal(scrubMessage('Error', 'Blocked chrome-extension://abcdefghijklmnop/inject.js'), 'Blocked chrome-extension://…');
});

test("a Firestore path keeps its collections and loses its documents' IDs", () => {
    assert.equal(
        scrubMessage('FirebaseError', `No document to update: projects/sikhai/databases/(default)/documents/users/${UID}/chats/${UUID}`),
        'No document to update: projects/sikhai/databases/(default)/documents/users/:id/chats/:id',
    );
    assert.equal(scrubMessage('FirebaseError', `Invalid document reference: seva_reports/ev12345_${UID} has 2 segments`),
        'Invalid document reference: seva_reports/:id has 2 segments');
});

test('every collection firestore.rules names is one whose IDs are taken out', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    const named = new Set([...rules.matchAll(/match \/([^\n{]*\{[^\n]*)\{/g)]
        .flatMap((m) => [...m[1].matchAll(/([a-z_]+)\/\{/g)].map((c) => c[1]))
        .filter((name) => name !== 'databases'));
    assert.ok(named.size >= 10, `found the collections: ${[...named].join(', ')}`);
    for (const name of named) assert.ok(FIRESTORE_COLLECTIONS.includes(name), name);
});

test('IDs, emails and long numbers are taken out; names from code are not', () => {
    assert.equal(scrubMessage('Error', `Chat entry ${UUID} is not storable`), 'Chat entry :id is not storable');
    assert.equal(scrubMessage('Error', `Event ${SHARE_ID} is gone`), 'Event :id is gone');
    assert.equal(scrubMessage('Error', `token ${UID} expired`), 'token :id expired');
    assert.equal(scrubMessage('Error', 'No account for someone.else+x@example.co.uk here'), 'No account for [email] here');
    assert.equal(scrubMessage('Error', 'Call 4155550123987654 now'), 'Call :id now');
    for (const name of ['getBoundingClientRect', 'HTMLCanvasElement', 'NS_ERROR_FAILURE', 'popup-closed-by-user',
        'getElementsByTagName', 'rows-3-4-palatal-retroflex', 'dangerouslySetInnerHTML'])
        assert.ok(readsAsWords(name), name);
    for (const id of [SHARE_ID, UID, 'aBcDeFgHiJkLmNoPq', 'eyJhbGciOiJIUzI1NiJ9-abc', '1234567890123456'])
        assert.ok(!readsAsWords(id), id);
});

test('a message is one line, at most 300 characters', () => {
    assert.equal(scrubMessage('Error', 'first line\n  second   line'), 'first line second line');
    assert.equal(scrubMessage('Error', 'word '.repeat(200)).length, MAX_MESSAGE_CHARS);
});

test("an error's name stays only if it reads as one", () => {
    assert.equal(scrubName('TypeError'), 'TypeError');
    assert.equal(scrubName('FirebaseError'), 'FirebaseError');
    assert.equal(scrubName('my private question'), 'Error');
    assert.equal(scrubName(42), 'Error');
});

test("a page's path loses every ID, its query and anything typed into the address bar", () => {
    assert.equal(scrubPath(`${SITE}/pa/share/${SHARE_ID}?utm=x#top`), '/pa/share/:id');
    assert.equal(scrubPath(`/en/chat/${UUID}`, SITE), '/chat/:id');
    assert.equal(scrubPath(`/seva/${SHARE_ID}/edit?from=x`, SITE), '/seva/:id/edit');
    assert.equal(scrubPath('/pa-latn/shabad/1430', SITE), '/pa-latn/shabad/1430');
    assert.equal(scrubPath('/learn/script/rows-3-4-palatal-retroflex', SITE), '/learn/script/rows-3-4-palatal-retroflex');
    assert.equal(scrubPath('/shabad/%E0%A8%B5%E0%A8%BE', SITE), '/shabad/…');
    assert.equal(scrubPath('/shabad?q=my%20question', SITE), '/shabad');
    assert.equal(scrubPath('not an address'), null);
});

test("a stack's frames are read from below its message, without their queries", () => {
    const message = "Cannot read properties of undefined (reading 'x')";
    const chrome = [
        `TypeError: ${message}`,
        `    at Foo (${CHUNK}?dpl=dpl_123:1:2345)`,
        `    at async Bar (${CHUNK}:2:10)`,
        `    at ${CHUNK}:3:4`,
        '    at Array.map (<anonymous>)',
    ].join('\n');
    assert.deepEqual(frameLines(chrome, message), [`at Foo (${CHUNK}:1:2345)`, `at async Bar (${CHUNK}:2:10)`, `at ${CHUNK}:3:4`]);

    const firefox = `Foo@${CHUNK}:1:2345\nasync*bar@${CHUNK}:2:10\n`;
    assert.deepEqual(frameLines(firefox, message), [`Foo@${CHUNK}:1:2345`, `async*bar@${CHUNK}:2:10`]);

    const safari = `Foo@${CHUNK}:1:2345\nglobal code@${CHUNK}:3:4\n[native code]`;
    assert.deepEqual(frameLines(safari, message), [`Foo@${CHUNK}:1:2345`, `global code@${CHUNK}:3:4`]);
});

test("a message can't pose as a frame", () => {
    const message = `upstream said:\n    at my private question (${CHUNK}:9:9)`;
    const stack = `Error: ${message}\n    at real (${CHUNK}:1:2)`;
    assert.deepEqual(frameLines(stack, message), [`at real (${CHUNK}:1:2)`]);
    assert.deepEqual(frameLines(undefined, message), []);
});

test('a stack keeps at most 30 frames, and none overlong', () => {
    const many = Array.from({ length: 50 }, (_, i) => `    at f${i} (${CHUNK}:${i + 1}:1)`).join('\n');
    assert.equal(frameLines(many, '').length, MAX_FRAMES);
    assert.deepEqual(frameLines(`    at f (${SITE}/${'a'.repeat(400)}.js:1:1)`, ''), []);
});

test('a frame line reads back into its parts, its function only if it reads as code', () => {
    assert.deepEqual(parseFrameLine(`at Foo.bar (${CHUNK}:1:2345)`), { fn: 'Foo.bar', file: CHUNK, line: 1, column: 2345 });
    assert.deepEqual(parseFrameLine(`at ${CHUNK}:3:4`), { file: CHUNK, line: 3, column: 4 });
    assert.deepEqual(parseFrameLine(`at new Promise (${CHUNK}:3:4)`), { fn: 'new Promise', file: CHUNK, line: 3, column: 4 });
    assert.deepEqual(parseFrameLine(`async*bar@${CHUNK}:2:10`), { fn: 'bar', file: CHUNK, line: 2, column: 10 });
    assert.deepEqual(parseFrameLine(`global code@${CHUNK}:3:4`), { fn: 'global code', file: CHUNK, line: 3, column: 4 });
    assert.deepEqual(parseFrameLine(`at my private question (${CHUNK}:9:9)`), { file: CHUNK, line: 9, column: 9 });
    assert.equal(parseFrameLine('at Array.map (<anonymous>)'), null);
    assert.equal(parseFrameLine('[native code]'), null);
});

test("the server reads a browser's report field by field, keeping only this site's frames", () => {
    const posted = {
        kind: 'uncaught',
        name: 'TypeError',
        message: 'Unknown lens "my private question"',
        page: `/pa/share/${SHARE_ID}?q=x`,
        frames: [
            `at Foo (${CHUNK}?dpl=1:1:2)`,
            `at inline (${SITE}/pa/share/${SHARE_ID}:3:4)`,
            'at injected (chrome-extension://abcdefghijklmnop/content.js:5:6)',
            42,
        ],
        extra: 'ignored',
    };
    assert.deepEqual(readClientReport(posted, SITE), {
        kind: 'uncaught',
        name: 'TypeError',
        message: 'Unknown lens "…"',
        page: '/pa/share/:id',
        frames: [
            { fn: 'Foo', file: CHUNK, line: 1, column: 2 },
            { fn: 'inline', file: '/pa/share/:id', line: 3, column: 4 },
        ],
    });
});

test('a report with no frame on this site, or that is not one, is dropped', () => {
    const base = { kind: 'page', name: 'Error', message: 'x', page: '/', frames: [`at f (${CHUNK}:1:1)`] };
    assert.ok(readClientReport(base, SITE));
    assert.equal(readClientReport({ ...base, frames: ['at f (https://other.example/x.js:1:1)'] }, SITE), null);
    assert.equal(readClientReport({ ...base, frames: [] }, SITE), null);
    assert.equal(readClientReport({ ...base, kind: 'other' }, SITE), null);
    assert.equal(readClientReport({ ...base, page: 42 }, SITE), null);
    for (const body of [null, 'text', [base]]) assert.equal(readClientReport(body, SITE), null);
    assert.equal(readClientReport({ ...base, name: 'my private question' }, SITE)?.name, 'Error');
});
