import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, MINUTE_MS, REFUSALS, VISITOR_LIMITS, allowances, limitVisitor, visitorAllowance, visitorOf } from '@/lib/api/allowance';
import en from '@/lib/i18n/dictionaries/en';

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
        for (let i = 0; i < VISITOR_LIMITS.chat.perMinute; i++) assert.equal(limitVisitor(from('203.0.113.10'), 'chat', t), null);
        assert.equal(limitVisitor(from('203.0.113.11'), 'chat', t), null, 'someone else');
        return limitVisitor(from('203.0.113.10'), 'chat', t);
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
    const res = limitVisitor(req, 'search', midnight + 23 * 60 * MINUTE_MS);
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

test("the English of every refusal the site shows is the dictionary's for its code", () => {
    for (const [feature, windows] of Object.entries(REFUSALS)) {
        for (const { code, error } of Object.values(windows)) {
            if (code in en.errors) assert.equal(error, en.errors[code as keyof typeof en.errors], `${feature} ${code}`);
        }
    }
});
