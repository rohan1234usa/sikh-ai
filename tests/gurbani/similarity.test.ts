import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editSimilarity, levenshtein, longestCommonSubstring } from '@/lib/gurbani/similarity';

test('edit distance counts insertions, deletions and substitutions', () => {
    assert.equal(levenshtein('', ''), 0);
    assert.equal(levenshtein('thakur', 'thakur'), 0);
    assert.equal(levenshtein('', 'abc'), 3);
    assert.equal(levenshtein('abc', ''), 3);
    assert.equal(levenshtein('kitten', 'sitting'), 3);
    assert.equal(levenshtein('niranjan', 'nirajan'), 1, 'one letter dropped');
    assert.equal(levenshtein('thakur', 'tthakur'), 1, 'one letter added');
    assert.equal(levenshtein('purakh', 'purkh'), 1);
});

test('edit distance is symmetric', () => {
    for (const [a, b] of [['purakh', 'purkh'], ['waheguru', 'vahiguru'], ['', 'x'], ['abc', 'cab']])
        assert.equal(levenshtein(a, b), levenshtein(b, a), `${a} / ${b}`);
});

test('edit similarity is the share of the longer string that survives', () => {
    assert.equal(editSimilarity('', ''), 1);
    assert.equal(editSimilarity('naam', 'naam'), 1);
    assert.equal(editSimilarity('abcde', 'abxde'), 0.8, 'one substitution in five letters');
    assert.equal(editSimilarity('abc', 'xyz'), 0);
    assert.equal(editSimilarity('', 'abc'), 0);
    for (const [a, b] of [['satnam', 'satnaam'], ['dhan', 'dhann']])
        assert.ok(editSimilarity(a, b) >= 0.8, `${a} / ${b}`);
});

test('the longest common run is contiguous', () => {
    assert.equal(longestCommonSubstring('', 'abc'), 0);
    assert.equal(longestCommonSubstring('abcd', 'xbcy'), 2);
    assert.equal(longestCommonSubstring('axbxc', 'abc'), 1, 'scattered agreement is not a run');
});
