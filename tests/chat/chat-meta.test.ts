import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    AUTO_TITLE_CHARS,
    MAX_CHAT_TITLE_CHARS,
    chatIdFromPath,
    deriveTitle,
    sanitizeMeta,
    sanitizeTitle,
    sortChats,
} from '@/lib/chat/chatMeta';
import { groupChats } from '@/lib/chat/historyGroups';

const UUID = '3f2c1b8e-9d4a-4c7b-8e2f-1a2b3c4d5e6f';

test('the chat id comes from the path, and a bad one is refused before any store sees it', () => {
    assert.equal(chatIdFromPath('/chat'), null);
    assert.equal(chatIdFromPath('/chat/'), null);
    assert.equal(chatIdFromPath(`/chat/${UUID}`), UUID);
    assert.equal(chatIdFromPath('/chat/legacy-u1a2b3c4'), 'legacy-u1a2b3c4');
    assert.equal(chatIdFromPath('/chat/short'), 'invalid');
    assert.equal(chatIdFromPath(`/chat/${UUID}/extra`), 'invalid');
    assert.equal(chatIdFromPath('/chat/..%2F..%2Fetc'), 'invalid');
    assert.equal(chatIdFromPath('/chat/%E0%A4%A'), 'invalid');
});

test('a title is the first line of the first question, cut on a word', () => {
    assert.equal(deriveTitle('\n\n  What is   Seva?  \nAnd why?'), 'What is Seva?');
    const long = deriveTitle('How do I stay steady when everything in life feels temporary and uncertain today?');
    assert.ok(long.endsWith('…'));
    assert.ok([...long].length <= AUTO_TITLE_CHARS + 1);
    assert.ok(!long.includes(' …'), 'no space before the ellipsis');
    assert.equal(deriveTitle('   '), '');
});

test('a cut never splits a Gurmukhi letter from its vowel sign, or an emoji', () => {
    const gurmukhi = 'ਸਤਿ'.repeat(40); // each ਤਿ is two code points, one grapheme
    const title = deriveTitle(gurmukhi);
    assert.ok(title.endsWith('…'));
    assert.notEqual(title.at(-2), 'ਤ', 'the vowel sign stays with its letter');
    const emoji = deriveTitle('🙏🏽'.repeat(70));
    assert.equal(emoji, `${'🙏🏽'.repeat(AUTO_TITLE_CHARS)}…`);
});

test('a typed title is tidied and capped', () => {
    assert.equal(sanitizeTitle('  My   chat \n'), 'My chat');
    assert.ok([...sanitizeTitle('x'.repeat(500))].length <= MAX_CHAT_TITLE_CHARS + 1);
    assert.equal(sanitizeTitle('   '), '');
});

test('pinned chats come first, then the most recent, with the id breaking ties', () => {
    const chats = [
        { id: 'b', pinned: false, updatedAt: 5 },
        { id: 'a', pinned: false, updatedAt: 5 },
        { id: 'p', pinned: true, updatedAt: 1 },
        { id: 'c', pinned: false, updatedAt: 9 },
    ];
    assert.deepEqual(sortChats(chats).map((c) => c.id), ['p', 'c', 'a', 'b']);
});

test('meta read from storage is rebuilt field by field', () => {
    assert.equal(sanitizeMeta(null), null);
    assert.equal(sanitizeMeta({ id: 'bad id!' }), null);
    const meta = sanitizeMeta({ id: UUID, title: 7, titleSource: 'user', createdAt: 10, pinned: 'yes', share: { id: 'nope' }, extra: 1 });
    assert.deepEqual(meta, { id: UUID, title: '', titleSource: 'auto', createdAt: 10, updatedAt: 10, pinned: false, share: null });
    assert.equal(sanitizeMeta({ title: 'x' }, UUID)?.id, UUID);
});

test('chats group by calendar day in local time, pinned apart', () => {
    const now = new Date(2026, 2, 10, 0, 5); // 00:05 on 10 March
    const at = (d: number, h = 12) => new Date(2026, 2, d, h).getTime();
    const chats = [
        { id: 'pin', pinned: true, updatedAt: at(1) },
        { id: 'future', pinned: false, updatedAt: at(12) },
        { id: 'today', pinned: false, updatedAt: new Date(2026, 2, 10, 0, 1).getTime() },
        { id: 'late-yesterday', pinned: false, updatedAt: new Date(2026, 2, 9, 23, 55).getTime() },
        // 8 March is when clocks change in much of North America
        { id: 'dst-week', pinned: false, updatedAt: at(8, 1) },
        { id: 'week-edge', pinned: false, updatedAt: at(3) },
        { id: 'month', pinned: false, updatedAt: at(2) },
        { id: 'older', pinned: false, updatedAt: new Date(2026, 0, 1).getTime() },
    ];
    const sections = groupChats(chats, now);
    assert.deepEqual(
        sections.map((s) => [s.id, s.chats.map((c) => c.id)]),
        [
            ['pinned', ['pin']],
            ['today', ['future', 'today']],
            ['yesterday', ['late-yesterday']],
            ['week', ['dst-week', 'week-edge']],
            ['month', ['month']],
            ['older', ['older']],
        ],
    );
    assert.deepEqual(groupChats([], now), []);
});
