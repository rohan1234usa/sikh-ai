import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAngParam } from '@/lib/gurbani/ang';

test("an address's Ang has one spelling, so each Ang has one page", () => {
    assert.equal(parseAngParam('1'), 1);
    assert.equal(parseAngParam('1430'), 1430);
    for (const bad of ['0', '01', '1431', '99999', '1e3', '+1', ' 1', 'abc', ''])
        assert.equal(parseAngParam(bad), null, JSON.stringify(bad));
});
