import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSearch, searchString } from '@/app/components/shabad/useSearchQuery';

// The search on /shabad lives in the page's address.
test('a search is written into the address and read back from it', () => {
    assert.equal(searchString({ q: 'so purakh niranjan' }), '?q=so+purakh+niranjan');
    assert.equal(searchString({ q: 'ਸਪਨਹ', as: 'words' }), `?q=${encodeURIComponent('ਸਪਨਹ')}&as=words`);
    assert.equal(searchString({ q: '' }), '', 'no search, no query string');
    for (const state of [{ q: 'so purakh niranjan' }, { q: 'ਸਪਨਹ', as: 'words' as const }, { q: 'a&b=c?d#e' }])
        assert.deepEqual(readSearch(searchString(state)), state, JSON.stringify(state));
    assert.deepEqual(readSearch(''), { q: '' });
    assert.deepEqual(readSearch('?q=x&as=everything'), { q: 'x' }, 'an unknown reading is dropped');
    assert.deepEqual(readSearch('?ang=12'), { q: '' }, 'the old Ang links are LegacyAngLink’s');
});
