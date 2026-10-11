import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseHukamnamaPayload } from '@/lib/gurbani/gurbaninow';

// A day's Hukamnama exactly as GurbaniNow sent it (GET /v2/hukamnama/today,
// recorded 11 October 2026): Ang 560, Raag Vadhans, Guru Amardas Ji, eleven
// lines, the first of them the heading.
const RECORDED: unknown = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/hukamnama.json'), 'utf8'));

test("today's Hukamnama parses with its date, raag, writer, Ang and shabad", () => {
    const h = parseHukamnamaPayload(RECORDED);
    assert.ok(h);
    assert.deepEqual(h.date, { month: 'Assu', monthGurmukhi: 'ਅੱਸੂ', day: 27, year: 558 });
    assert.equal(h.raag, 'Raag Vadhans');
    assert.equal(h.raagGurmukhi, 'ਰਾਗੁ ਵਡਹੰਸੁ');
    assert.equal(h.writer, 'Guru Amardas Ji');
    assert.equal(h.ang, 560);
    assert.equal(h.shabadId, 'C9L');
});

test("every line keeps its kind, transliteration and translation", () => {
    const h = parseHukamnamaPayload(RECORDED);
    assert.ok(h);
    assert.equal(h.lines.length, 11);
    assert.equal(h.lines[0].kind, 'header');
    assert.equal(h.lines[0].gurmukhi, 'ਵਡਹੰਸੁ ਮਹਲਾ ੩ ॥');
    assert.ok(h.lines.slice(1).every(line => line.kind === 'verse'));
    // Verbatim, the danda as GurbaniNow romanizes it included.
    assert.equal(h.lines[1].transliteration, 'rasanaa har saad lagee sehaj subhaae |');
    assert.ok(h.lines.slice(1).every(line => line.translation.length > 0));
    assert.ok(h.lines.every(line => line.ang === 560));
});

test('a payload with nothing to show is null, and a drifted one never throws', () => {
    assert.equal(parseHukamnamaPayload(null), null);
    assert.equal(parseHukamnamaPayload({}), null);
    assert.equal(parseHukamnamaPayload({ hukamnama: [] }), null);
    assert.equal(parseHukamnamaPayload({ hukamnama: [{ line: { id: 'X1' } }] }), null);
    const bare = parseHukamnamaPayload({ hukamnama: [{ line: { id: 'X1', type: 4, gurmukhi: { unicode: 'ਸਤਿ' } } }], hukamnamainfo: { shabadid: 'not an id' } });
    assert.ok(bare);
    assert.equal(bare.date, null);
    assert.equal(bare.shabadId, null);
    assert.equal(bare.ang, null);
    assert.equal(bare.lines[0].transliteration, '');
});
