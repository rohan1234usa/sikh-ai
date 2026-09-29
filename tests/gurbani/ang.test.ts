import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAngInput, parseAngParam } from '@/lib/gurbani/ang';

test('the search box takes an Ang from 1 to 1430, and says what was wrong otherwise', () => {
    assert.deepEqual(parseAngInput('1'), { ok: true, ang: 1 });
    assert.deepEqual(parseAngInput(' 1430 '), { ok: true, ang: 1430 });
    assert.deepEqual(parseAngInput('012'), { ok: true, ang: 12 }, 'typed with a leading zero, still Ang 12');
    assert.deepEqual(parseAngInput('0'), { ok: false, reason: 'range' });
    assert.deepEqual(parseAngInput('1431'), { ok: false, reason: 'range' });
    assert.deepEqual(parseAngInput('twelve'), { ok: false, reason: 'digits' });
    assert.deepEqual(parseAngInput('-3'), { ok: false, reason: 'digits' });
    assert.deepEqual(parseAngInput('1.5'), { ok: false, reason: 'digits' });
});

test("an address's Ang has one spelling, so each Ang has one page", () => {
    assert.equal(parseAngParam('1'), 1);
    assert.equal(parseAngParam('1430'), 1430);
    for (const bad of ['0', '01', '1431', '99999', '1e3', '+1', ' 1', 'abc', ''])
        assert.equal(parseAngParam(bad), null, JSON.stringify(bad));
});
