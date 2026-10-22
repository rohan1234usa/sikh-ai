import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, MINUTE_MS, REFUSALS, VISITOR_LIMITS, allowances, limitVisitor, visitorAllowance, visitorOf } from '@/lib/api/allowance';
import { REPLY_ERROR_CODES } from '@/lib/chat/transcript';
import { getDictionary } from '@/lib/i18n';
import { responseErrorText } from '@/lib/i18n/apiError';
import { LANGS } from '@/lib/i18n/config';
import en from '@/lib/i18n/dictionaries/en';
import { getTalkCopy } from '@/lib/i18n/talk';
import { TUTOR_ERROR_CODES } from '@/lib/learn/tutor';
import { DAILY_CHAR_CEILING } from '@/lib/translate/cloud';
import { MAX_CROSSCHECK_CHARS } from '@/lib/translate/config';
import { SPEAK_DAILY_CHAR_CEILING } from '@/lib/translate/speak';
import { MAX_SPEAK_CHARS } from '@/lib/translate/voice';
import { spendDay } from '../helpers/routes';

// Its own file: `allowances` is module state, and these tests spend it. A
// test that does uses addresses no other test uses.
process.env.APP_LOG = 'off';

// Runs `run` with logging on, and collects the JSON lines it writes.
function capture<T>(run: () => T): { lines: Record<string, unknown>[]; value: T } {
    delete process.env.APP_LOG;
    const lines: Record<string, unknown>[] = [];
    const saved = { log: console.log, warn: console.warn, error: console.error };
    const collect = (line: string) => { lines.push(JSON.parse(line)); };
    console.log = collect;
    console.warn = collect;
    console.error = collect;
    try {
        return { lines, value: run() };
    } finally {
        Object.assign(console, saved);
        process.env.APP_LOG = 'off';
    }
}

const headers = (h: Record<string, string>) => new Headers(h);
const from = (address: string) => new Request('http://local/api/chat', { method: 'POST', headers: { 'x-forwarded-for': address } });
// The start of a UTC day long past, so a test's clock is its own.
const DAY_START = 20_000 * DAY_MS;

test('a visitor is the first x-forwarded-for address, else x-real-ip', () => {
    assert.equal(visitorOf(headers({ 'x-forwarded-for': '203.0.113.7' })), '203.0.113.7');
    assert.equal(visitorOf(headers({ 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1' })), '203.0.113.7');
    assert.equal(visitorOf(headers({ 'x-real-ip': '198.51.100.4' })), '198.51.100.4');
    assert.equal(visitorOf(headers({ 'x-forwarded-for': 'unknown', 'x-real-ip': '198.51.100.4' })), '198.51.100.4');
    assert.equal(visitorOf(headers({})), null);
    for (const junk of ['', 'localhost', '203.0.113', '203.0.113.7:443', '1::2::3', '<script>'])
        assert.equal(visitorOf(headers({ 'x-forwarded-for': junk })), null, junk);
});

test('an IPv6 visitor is its /64, however the address is written; IPv4 carried in IPv6 is the IPv4 address', () => {
    for (const ip of ['2001:db8:1:2::a', '2001:DB8:1:2:ffff:ffff:ffff:ffff', '2001:0db8:0001:0002:0:0:0:1', '2001:db8:1:2::1%eth0'])
        assert.equal(visitorOf(headers({ 'x-forwarded-for': ip })), '2001:db8:1:2::/64', ip);
    assert.equal(visitorOf(headers({ 'x-forwarded-for': '2001:db8:1:3::a' })), '2001:db8:1:3::/64', 'the next /64 is someone else');
    assert.equal(visitorOf(headers({ 'x-forwarded-for': '2001:db8::1' })), '2001:db8:0:0::/64');
    assert.equal(visitorOf(headers({ 'x-forwarded-for': '::1' })), '0:0:0:0::/64');
    assert.equal(visitorOf(headers({ 'x-forwarded-for': '64:ff9b:1:2::192.0.2.1' })), '64:ff9b:1:2::/64');
    assert.equal(visitorOf(headers({ 'x-forwarded-for': '::ffff:192.0.2.1' })), '192.0.2.1');
    assert.equal(visitorOf(headers({ 'x-forwarded-for': '::FFFF:192.0.2.1' })), '192.0.2.1');
    // The same, as a URL parser writes it back: two IPv4 visitors stay two.
    assert.equal(visitorOf(headers({ 'x-forwarded-for': '::ffff:c000:201' })), '192.0.2.1');
    assert.equal(visitorOf(headers({ 'x-forwarded-for': '0:0:0:0:0:ffff:c633:6401' })), '198.51.100.1');
    assert.equal(visitorOf(headers({ 'x-forwarded-for': '::ffff:0:c000:201' })), '0:0:0:0::/64', 'ffff in another group is plain IPv6');
});

test('a minute allows its limit, then refuses until the next minute, saying how many seconds that is', () => {
    const allowance = visitorAllowance({ perMinute: 3, perDay: 100 });
    const t = DAY_START + 10 * MINUTE_MS;
    for (let i = 0; i < 3; i++) assert.deepEqual(allowance.take('a', t + i * 1000), { ok: true });
    assert.deepEqual(allowance.take('a', t + 15_000), { ok: false, window: 'minute', retryAfter: 45 });
    assert.deepEqual(allowance.take('a', t + 59_999), { ok: false, window: 'minute', retryAfter: 1 });
    assert.deepEqual(allowance.take('b', t + 15_000), { ok: true }, 'another visitor counts apart');
    assert.deepEqual(allowance.take('a', t + MINUTE_MS), { ok: true }, 'a new minute');
});

test('a day allows its limit, then refuses until midnight UTC; refusals and other visitors never count', () => {
    const allowance = visitorAllowance({ perMinute: 2, perDay: 4 });
    const at = (minute: number, visitor = 'a') => allowance.take(visitor, DAY_START + minute * MINUTE_MS);
    assert.equal(at(0).ok, true);
    assert.equal(at(0).ok, true);
    assert.deepEqual(at(0), { ok: false, window: 'minute', retryAfter: 60 }, 'not counted toward the day');
    assert.equal(at(1).ok, true);
    assert.equal(at(1).ok, true, 'the fourth of the day');
    assert.deepEqual(at(1), { ok: false, window: 'day', retryAfter: (DAY_MS - MINUTE_MS) / 1000 }, 'both are full: the day is said first');
    assert.deepEqual(at(5), { ok: false, window: 'day', retryAfter: (DAY_MS - 5 * MINUTE_MS) / 1000 });
    assert.deepEqual(at(5, 'b'), { ok: true });
    assert.deepEqual(allowance.take('a', DAY_START + DAY_MS), { ok: true }, 'a new day');
});

test('a new day starts every count again, and forgets yesterday’s visitors', () => {
    const allowance = visitorAllowance({ perMinute: 5, perDay: 1 });
    allowance.take('a', DAY_START + DAY_MS - 1);
    allowance.take('b', DAY_START + DAY_MS - 1);
    assert.equal(allowance.take('a', DAY_START + DAY_MS - 1).ok, false);
    assert.equal(allowance.take('a', DAY_START + DAY_MS).ok, true);
    assert.equal(allowance.size(), 1);
});

test("a request's cost counts toward the day, and the minute still counts requests", () => {
    const allowance = visitorAllowance({ perMinute: 3, perDay: 10 });
    const t = DAY_START + 5 * MINUTE_MS;
    assert.deepEqual(allowance.take('a', t, 6), { ok: true });
    assert.deepEqual(allowance.take('a', t, 5), { ok: false, tooBig: true }, '6 + 5 is past 10, but 4 are left: too big, not past the day');
    assert.deepEqual(allowance.take('a', t, 4), { ok: true }, 'the refused 5 spent nothing; 6 + 4 is exactly 10');
    assert.deepEqual(allowance.take('a', t + MINUTE_MS, 1), { ok: false, window: 'day', retryAfter: (DAY_MS - 6 * MINUTE_MS) / 1000 }, 'the day is spent: until midnight UTC');
    for (let i = 0; i < 3; i++) assert.deepEqual(allowance.take('b', t, 1), { ok: true });
    assert.deepEqual(allowance.take('b', t, 1), { ok: false, window: 'minute', retryAfter: 60 }, 'three requests in the minute, whatever they cost');
    assert.equal(allowance.take('c', t, 11).ok, false, 'one request costing more than a whole day never goes through');
});

test('used() says what a visitor has spent of today, and counts nothing', () => {
    const allowance = visitorAllowance({ perMinute: 2, perDay: 10 });
    const t = DAY_START + 7 * MINUTE_MS;
    assert.equal(allowance.used('a', t), 0, 'not seen yet');
    assert.deepEqual(allowance.take('a', t, 4), { ok: true });
    assert.equal(allowance.used('a', t), 4);
    assert.equal(allowance.used('a', t), 4, 'asking twice spends nothing');
    assert.deepEqual(allowance.take('a', t, 1), { ok: true }, 'nor counts toward the minute');
    assert.equal(allowance.used('b', t), 0);
    assert.equal(allowance.used('a', t + DAY_MS), 0, 'a new day');
});

test("one comparison, however long, fits in a visitor's day of them", () => {
    assert.ok(MAX_CROSSCHECK_CHARS <= VISITOR_LIMITS.crosscheck.perDay, 'or the longest comparisons would always be refused');
});

test("one line read aloud, however long, fits in a visitor's day of them", () => {
    assert.ok(MAX_SPEAK_CHARS <= VISITOR_LIMITS.speak.perDay, 'or the longest lines would always be refused');
});

test("one visitor can't use up a server's day of characters: it takes four", () => {
    assert.ok(VISITOR_LIMITS.crosscheck.perDay * 4 <= DAILY_CHAR_CEILING, 'Compare');
    assert.ok(VISITOR_LIMITS.speak.perDay * 4 <= SPEAK_DAILY_CHAR_CEILING, 'read-aloud');
});

// What a route answers for a request too big for what's left (its own 502).
const tooBig = () => new Response(null, { status: 502 });

test('limitVisitor charges read-aloud and Compare by their text\'s length', () => {
    for (const [feature, address, last] of [['speak', '203.0.113.13', 400], ['crosscheck', '203.0.113.12', 10]] as const) {
        const t = DAY_START + 40_000;
        assert.equal(limitVisitor(from(address), feature, { now: t, cost: VISITOR_LIMITS[feature].perDay - last, tooBig }), null, feature);
        assert.equal(limitVisitor(from(address), feature, { now: t, cost: last, tooBig }), null, `${feature}: exactly the day`);
        assert.equal(limitVisitor(from(address), feature, { now: t + MINUTE_MS, cost: 1, tooBig })?.status, 429, `${feature}: the day is spent`);
    }
});

test("a request too big for what's left fails as its route says, apart from a spent day, and smaller ones still go", () => {
    const t = DAY_START + 9 * MINUTE_MS;
    const { lines, value } = capture(() => {
        assert.equal(limitVisitor(from('203.0.113.16'), 'speak', { now: t, cost: VISITOR_LIMITS.speak.perDay - 10, tooBig }), null);
        const res = limitVisitor(from('203.0.113.16'), 'speak', { now: t, cost: 11, tooBig });
        assert.equal(res?.status, 502, "the route's own answer, with nothing to wait for");
        assert.equal(limitVisitor(from('203.0.113.16'), 'speak', { now: t, cost: 10, tooBig }), null, 'the ten left still go');
        return limitVisitor(from('203.0.113.16'), 'speak', { now: t, cost: 1, tooBig });
    });
    assert.equal(value?.status, 429, 'then the day is spent');
    assert.deepEqual(lines.map(({ evt, window, why }) => ({ evt, window, why })), [
        { evt: 'visitor_limited', window: 'day', why: 'too_big' },
        { evt: 'visitor_limited', window: 'day', why: undefined },
    ], 'each case on its own line');
});

test('one feature remembers a bounded number of visitors, forgetting the one seen longest ago', () => {
    const allowance = visitorAllowance({ perMinute: 1, perDay: 1 }, 3);
    for (const v of ['a', 'b', 'c']) allowance.take(v, DAY_START);
    assert.equal(allowance.take('a', DAY_START).ok, false, 'a is still counted, and now seen latest');
    allowance.take('d', DAY_START); // one too many: b, seen longest ago, goes
    assert.equal(allowance.size(), 3);
    assert.equal(allowance.take('b', DAY_START).ok, true, 'b was forgotten, so starts again');
    assert.equal(allowance.take('a', DAY_START).ok, false, 'a, still active, is still counted');
});

test('a refusal is a 429 that is never cached, with the code for its window and when to try again', async () => {
    const t = DAY_START + 30_000;
    const { lines, value: res } = capture(() => {
        for (let i = 0; i < VISITOR_LIMITS.chat.perMinute; i++) assert.equal(limitVisitor(from('203.0.113.10'), 'chat', { now: t }), null);
        assert.equal(limitVisitor(from('203.0.113.11'), 'chat', { now: t }), null, 'someone else');
        return limitVisitor(from('203.0.113.10'), 'chat', { now: t });
    });
    assert.equal(res?.status, 429);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('retry-after'), '30');
    assert.deepEqual(await res.json(), REFUSALS.chat.minute);
    assert.deepEqual(lines.map(({ evt, window, limit, refused }) => ({ evt, window, limit, refused })),
        [{ evt: 'visitor_limited', window: 'minute', limit: VISITOR_LIMITS.chat.perMinute, refused: 1 }]);
    assert.equal(JSON.stringify(lines).includes('203.0.113'), false, 'never the address');
});

test('past the day, the answer is the limit code, and Retry-After runs to midnight UTC', async () => {
    // A request a minute from midnight, so no minute's limit stops it first.
    const midnight = Math.floor(Date.now() / DAY_MS) * DAY_MS;
    for (let i = 0; allowances.search.take('198.51.100.20', midnight + i * MINUTE_MS).ok; i++);
    const req = new Request('http://local/api/shabad/search?q=x', { headers: { 'x-real-ip': '198.51.100.20' } });
    const res = limitVisitor(req, 'search', { now: midnight + 23 * 60 * MINUTE_MS });
    assert.equal(res?.status, 429);
    assert.deepEqual(await res.json(), REFUSALS.search.day);
    assert.equal(res.headers.get('retry-after'), String(60 * 60));
});

test('a request with no address is never limited, and that is logged once', () => {
    const { lines } = capture(() => {
        for (let i = 0; i < 50; i++) assert.equal(limitVisitor(new Request('http://local/api/chat', { method: 'POST' }), 'chat'), null);
    });
    assert.deepEqual(lines.map((l) => [l.evt, l.why]), [['limit_skipped', 'no_address']]);
});

// Talk's refusals are worded with its page's own words (lib/i18n/talk),
// the rest in the dictionaries.
const TALK_FEATURES = new Set(['translateVoice', 'speak']);
const wordsFor = (feature: string, lang: (typeof LANGS)[number]): Record<string, string> =>
    TALK_FEATURES.has(feature) ? getTalkCopy(lang).errors : getDictionary(lang).errors;

test("the English of every refusal the site shows is its page's words for its code", () => {
    for (const [feature, windows] of Object.entries(REFUSALS)) {
        for (const { code, error } of Object.values(windows)) {
            if (TALK_FEATURES.has(feature)) assert.equal(error, wordsFor(feature, 'en')[code], `${feature} ${code}`);
            else if (code in en.errors) assert.equal(error, en.errors[code as keyof typeof en.errors], `${feature} ${code}`);
        }
    }
});

test('every refusal the chat, the tutor, the translators and Shabad Search show has words in all three languages', () => {
    for (const feature of ['chat', 'learn', 'translate', 'translateVoice', 'speak', 'search'] as const) {
        for (const { code } of Object.values(REFUSALS[feature])) {
            for (const lang of LANGS) {
                const text = wordsFor(feature, lang)[code];
                assert.ok(typeof text === 'string' && text.length > 0, `${lang} ${code}`);
                assert.doesNotMatch(text, /\{\w+\}/, `${lang} ${code}: shown as is, so no placeholders`);
            }
        }
    }
    // The chat and the tutor show only the codes on their lists; the
    // translator and Shabad Search, any the dictionary has.
    assert.ok(REPLY_ERROR_CODES.includes('chat_limit'));
    assert.ok(TUTOR_ERROR_CODES.includes('learn_limit'));
    const t = getDictionary('pa');
    const refused = new Response(null, { status: 429 });
    assert.equal(responseErrorText(t, refused, REFUSALS.translate.day, 'translate_busy'), t.errors.translate_limit);
    assert.equal(responseErrorText(t, refused, REFUSALS.search.day, 'search_busy'), t.errors.search_limit);
    assert.equal(responseErrorText(t, refused, REFUSALS.search.minute, 'search_busy'), t.errors.search_busy);
});

// Last: it counts at today's real time, which starts the tutor's day afresh.
test('spendDay refuses a visitor already counted today, by however little', () => {
    assert.equal(limitVisitor(from('203.0.113.14'), 'learn'), null);
    assert.throws(() => spendDay('learn', '203.0.113.14', 1), /already counted today/);
    spendDay('learn', '203.0.113.15', 1);
    assert.equal(limitVisitor(from('203.0.113.15'), 'learn'), null, 'a fresh visitor keeps the one left');
    assert.equal(limitVisitor(from('203.0.113.15'), 'learn')?.status, 429);
});
