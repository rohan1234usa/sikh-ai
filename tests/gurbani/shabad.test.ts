import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseShabadPayload, type GurbaniLine } from '@/lib/gurbani/gurbaninow';
import {
    assignAngs, groupByShabad, isGurbaniId, lineAnchor, lineKind, opening, parseShabadIdParam, shabadPath, shabadSections,
} from '@/lib/gurbani/shabad';

// Whole shabads, and the source's own Ang for some of their lines, as
// GurbaniNow sent them (npm run fixtures:gurbani -- --only shabad). The Angs
// the parser works out are held to the source's.
type RawShabad = { shabadinfo: { shabadid: string; navigation?: { previous?: { id: string }; next?: { id: string } } }; shabad: { line: { type: number } }[] };
type LineAnswer = { id: string; shabadid: string; pageno: number; lineno: number };

const RECORDED: Record<string, unknown> = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/shabads.json'), 'utf8'));
const PAGES: Record<string, GurbaniLine[]> = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/gurbaninow.json'), 'utf8'));
const SHABADS = Object.entries(RECORDED).filter(([key]) => key.startsWith('shabad:')).map(([, raw]) => raw as RawShabad);
const ANSWERS = Object.entries(RECORDED).filter(([key]) => key.startsWith('line:')).map(([, raw]) => raw as LineAnswer);

function shabad(id: string) {
    const parsed = parseShabadPayload(RECORDED[`shabad:${id}`]);
    assert.ok(parsed, `shabad ${id} parses`);
    return parsed;
}

test('every recorded shabad parses, with every line it was sent', () => {
    assert.ok(SHABADS.length >= 4);
    for (const raw of SHABADS) {
        const id = raw.shabadinfo.shabadid;
        const parsed = shabad(id);
        assert.equal(parsed.id, id);
        assert.equal(parsed.lines.length, raw.shabad.length, id);
        assert.equal(parsed.source.id, 1, 'Sri Guru Granth Sahib Ji');
        assert.ok(parsed.writer && parsed.writerGurmukhi && parsed.raag && parsed.raagGurmukhi, id);
        parsed.lines.forEach((line, i) => {
            assert.ok(line.gurmukhi && isGurbaniId(line.id), `${id} ${line.id}`);
            assert.equal(line.kind, lineKind(raw.shabad[i].line.type), `${id} ${line.id}`);
        });
        assert.ok(parsed.lines.some(line => line.transliteration && line.translation), `${id} has its transliteration and translation`);
    }
    const kinds = new Set(SHABADS.flatMap(raw => shabad(raw.shabadinfo.shabadid).lines.map(line => line.kind)));
    assert.deepEqual([...kinds].sort(), ['header', 'mangal', 'verse'], 'the recordings hold every kind of line');
});

test("each line's Ang and place agree with the source's own, across a change of Ang", () => {
    assert.ok(ANSWERS.length >= 10);
    for (const answer of ANSWERS) {
        const line = shabad(answer.shabadid).lines.find(l => l.id === answer.id);
        assert.ok(line, answer.id);
        assert.equal(line.ang, answer.pageno, `${answer.shabadid} ${answer.id}`);
        assert.equal(line.lineNo, answer.lineno, `${answer.shabadid} ${answer.id}`);
    }
});

test('a shabad knows the Angs it starts and ends on, and its neighbours', () => {
    let across = 0;
    for (const raw of SHABADS) {
        const parsed = shabad(raw.shabadinfo.shabadid);
        const pageOf = (lineId: string) => ANSWERS.find(a => a.id === lineId)?.pageno;
        assert.equal(parsed.ang, pageOf(parsed.lines[0].id), 'its first line is where it starts');
        assert.equal(parsed.angEnd, pageOf(parsed.lines.at(-1)!.id), 'its last line is where it ends');
        if (parsed.angEnd !== parsed.ang) across++;
        assert.equal(parsed.previousId, raw.shabadinfo.navigation?.previous?.id ?? null);
        assert.equal(parsed.nextId, raw.shabadinfo.navigation?.next?.id ?? null);
    }
    assert.ok(across >= 2, 'the recordings include shabads that run onto the next Ang');
    assert.equal(shabad('DMP').previousId, null, 'the first shabad of the Granth has none before it');
});

test('a shabad on two Angs is shown in two sections, in order', () => {
    for (const raw of SHABADS) {
        const parsed = shabad(raw.shabadinfo.shabadid);
        const sections = shabadSections(parsed.lines);
        assert.deepEqual(sections.flatMap(s => s.lines), parsed.lines);
        assert.equal(sections.length, new Set(parsed.lines.map(l => l.ang)).size, raw.shabadinfo.shabadid);
        for (const section of sections) assert.ok(section.lines.every(l => l.ang === section.ang));
        assert.equal(sections[0].ang, parsed.ang);
        assert.equal(sections.at(-1)!.ang, parsed.angEnd);
    }
});

test("a line numbered lower than the last opens the next Ang; a shared or missing number doesn't", () => {
    assert.deepEqual(assignAngs(10, [16, 17, 17, 19, 1, 1, 2]), [10, 10, 10, 10, 11, 11, 11]);
    assert.deepEqual(assignAngs(5, [18, 19, 1, 19, 1]), [5, 5, 6, 6, 7], 'three Angs');
    assert.deepEqual(assignAngs(9, [4, 4, 4]), [9, 9, 9], 'verses printed on one line share its number');
    assert.deepEqual(assignAngs(7, [3, null, 4, null, 1]), [7, 7, 7, 7, 8], 'a line with no number stays where it is');
    assert.deepEqual(assignAngs(7, [null, 2, 1]), [7, 7, 8]);
    assert.deepEqual(assignAngs(null, [1, 2]), [null, null], 'no starting Ang, no Angs');
    assert.deepEqual(assignAngs(3, []), []);
});

test('the kind of a line comes from its type', () => {
    assert.equal(lineKind(1), 'mangal');
    assert.equal(lineKind(2), 'header');
    for (const other of [3, 4, 5, undefined, null, '2']) assert.equal(lineKind(other), 'verse', String(other));
});

test('a payload that is not a usable shabad is no answer', () => {
    const line = { line: { id: 'A1', type: 4, linenum: 1, gurmukhi: { unicode: 'ਪੰਕਤੀ ॥' } } };
    const info = { shabadid: 'S1', pageno: 7 };
    assert.ok(parseShabadPayload({ shabadinfo: info, shabad: [line], error: false }), 'the smallest usable shabad');
    const bad: [unknown, string][] = [
        [null, 'nothing'],
        ['text', 'a string'],
        [{ error: true }, 'an error'],
        [{ error: { code: 'INTERNAL_SERVER_ERROR', status_code: 500 } }, 'the error an unknown id gets'],
        [{ shabadinfo: info, shabad: [line], error: { code: 'x' } }, 'an error beside a shabad'],
        [{ shabadinfo: {}, shabad: [line] }, 'no id'],
        [{ shabadinfo: { shabadid: '../ang/1' }, shabad: [line] }, 'an id we would never link to'],
        [{ shabadinfo: info, shabad: 'lines' }, 'lines that are not a list'],
        [{ shabadinfo: info, shabad: [] }, 'no lines'],
        [{ shabadinfo: info, shabad: [{ line: { id: 'A1', type: 4 } }] }, 'no line with any text'],
    ];
    for (const [payload, why] of bad) assert.equal(parseShabadPayload(payload), null, why);
});

test('numeric ids survive, missing pieces are empty, and junk neighbours are dropped', () => {
    const parsed = parseShabadPayload({
        shabadinfo: { shabadid: 823, pageno: 10, navigation: { previous: { id: '../x' }, next: { id: 9 } } },
        shabad: [
            { line: { id: 77, type: 2, linenum: 18, gurmukhi: { unicode: 'ਸਿਰਲੇਖ ॥' }, translation: { english: {} } } },
            { line: { id: 'B2', type: 1, linenum: 19, gurmukhi: 'ਮੰਗਲ ॥' } },
            { line: { id: 'B3', type: 4, linenum: 1, gurmukhi: { unicode: 'ਪੰਕਤੀ ॥' }, translation: { english: { default: 'A line.' } }, transliteration: { english: { text: 'pankatee |' } } } },
            { line: { id: 'B4', type: 4, gurmukhi: { unicode: 'ਹੋਰ ॥' } } },
        ],
    });
    assert.ok(parsed);
    assert.equal(parsed.id, '823');
    assert.deepEqual(parsed.lines.map(l => [l.id, l.kind, l.ang, l.lineNo]),
        [['77', 'header', 10, 18], ['B2', 'mangal', 10, 19], ['B3', 'verse', 11, 1], ['B4', 'verse', 11, null]]);
    assert.equal(parsed.lines[0].translation, '', 'a heading with no translation');
    assert.equal(parsed.lines[1].gurmukhi, 'ਮੰਗਲ ॥', 'Gurmukhi sent as a plain string is read too');
    assert.equal(parsed.lines[2].translation, 'A line.');
    assert.equal(parsed.lines[2].transliteration, 'pankatee |');
    assert.equal(parsed.lines[3].transliteration, '');
    assert.deepEqual([parsed.ang, parsed.angEnd], [10, 11]);
    assert.equal(parsed.previousId, null, 'not an id, so no link');
    assert.equal(parsed.nextId, '9');
    assert.deepEqual(parsed.source, { id: 0, name: '', nameGurmukhi: '' });
    assert.equal(parsed.writer, '');
});

test("a shabad's address takes its id in one spelling only", () => {
    for (const id of ['823', 'A6S', 'DMP', '1', 'ZZZZZZ']) assert.equal(parseShabadIdParam(id), id);
    for (const bad of ['', ' 823', '823 ', 'a6s', 'dmp', '../a', '8-2', '823/', 'ABCDEFG', 'ਸ', '%2F', '8 2'])
        assert.equal(parseShabadIdParam(bad), null, JSON.stringify(bad));
    for (const lines of Object.values(PAGES)) {
        for (const line of lines) {
            assert.ok(isGurbaniId(line.id), `line ${line.id}`);
            assert.ok(isGurbaniId(line.shabadId), `shabad ${line.shabadId}`);
        }
    }
});

test("an Ang's lines group by shabad, keeping the page's order", () => {
    const angs = Object.entries(PAGES).filter(([key]) => key.startsWith('ang:'));
    assert.ok(angs.length >= 5);
    for (const [key, lines] of angs) {
        const groups = groupByShabad(lines);
        assert.deepEqual(groups.flatMap(g => g.lines), lines, key);
        assert.equal(new Set(groups.map(g => g.shabadId)).size, groups.length, `${key}: each shabad's lines sit together`);
        for (const group of groups) assert.ok(group.lines.every(l => l.shabadId === group.shabadId), key);
    }
    const order = groupByShabad([{ shabadId: 'A' }, { shabadId: 'A' }, { shabadId: 'B' }, { shabadId: 'A' }]);
    assert.deepEqual(order.map(g => [g.shabadId, g.lines.length]), [['A', 2], ['B', 1], ['A', 1]], 'only neighbours group');
});

test('a shabad has one address, and a line within it an anchor', () => {
    assert.equal(lineAnchor('546S'), 'line-546S');
    assert.equal(shabadPath('823'), '/shabad/s/823');
    assert.equal(shabadPath('823', '546S'), '/shabad/s/823#line-546S');
});

test('an opening line is cut at a word', () => {
    const all = Object.values(PAGES).flat().map(l => l.gurmukhi);
    const short = all.find(text => text.length <= 90)!;
    assert.equal(opening(short), short);
    const long = all.slice(0, 6).join(' ');
    const cut = opening(long);
    assert.ok(cut.endsWith('…') && cut.length <= 91, cut);
    assert.ok(long.startsWith(cut.slice(0, -1)));
    assert.equal(long[cut.length - 1], ' ', 'the cut falls between words');
    assert.ok(opening(long, 60).length <= 61);
    assert.equal(opening('x'.repeat(120)), `${'x'.repeat(90)}…`, 'with no space to cut at, a hard cut');
});
