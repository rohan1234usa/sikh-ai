import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GurbaniLine } from '@/lib/gurbani/gurbaninow';
import { classifyQuery, isSearchable } from '@/lib/gurbani/query';
import { getDictionary } from '@/lib/i18n';
import { LANGS } from '@/lib/i18n/config';
import { inputOf, SEARCHES } from '../gurbani/search-fixtures';

// GurbaniNow is stubbed with the recorded answers to Shabad Search's lookups
// (npm run fixtures:gurbani -- --only search), rebuilt into the payloads the
// live API sends; each test can override it. Every URL asked for is kept.
const RECORDED: Record<string, GurbaniLine[]> = JSON.parse(readFileSync(resolve(import.meta.dirname, '../gurbani/fixtures/search.json'), 'utf8'));
const realFetch = globalThis.fetch;
let asked: string[] = [];
let upstream: (url: string) => Promise<Response>;

function keyOf(url: string): string {
    const u = new URL(url);
    const query = decodeURIComponent(u.pathname.replace('/v2/search/', ''));
    const source = u.searchParams.get('source');
    return `search:${u.searchParams.get('searchtype')}:${u.searchParams.get('results')}:${source ? `source=${source}:` : ''}${query}`;
}

function payload(lines: GurbaniLine[]) {
    return {
        count: lines.length,
        error: false,
        shabads: lines.map(line => ({
            shabad: {
                id: line.id,
                type: line.isHeader ? 2 : 4,
                shabadid: line.shabadId,
                gurmukhi: { unicode: line.gurmukhi },
                translation: { english: { default: line.translation } },
                transliteration: { english: { text: line.transliteration } },
                writer: { english: line.writer, unicode: line.writerGurmukhi },
                raag: { english: line.raag, unicode: line.raagGurmukhi },
                source: { id: line.source.id, english: line.source.name, unicode: line.source.nameGurmukhi },
                pageno: line.ang,
                lineno: line.lineNo,
            },
        })),
    };
}

const replay = async (url: string) => {
    const key = keyOf(url);
    if (!(key in RECORDED)) throw new Error(`no recorded answer for ${key}: npm run fixtures:gurbani -- --only search`);
    return Response.json(payload(RECORDED[key]));
};

let GET: (req: Request) => Promise<Response>;
before(async () => {
    process.env.APP_LOG = 'off';
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        asked.push(url);
        return upstream(url);
    }) as typeof fetch;
    ({ GET } = await import('@/app/api/shabad/search/route'));
});
after(() => { globalThis.fetch = realFetch; });
beforeEach(() => {
    asked = [];
    upstream = replay;
});

const ask = (q: string | null, as?: string) => {
    const params = new URLSearchParams();
    if (q !== null) params.set('q', q);
    if (as !== undefined) params.set('as', as);
    return GET(new Request(`http://local/api/shabad/search?${params}`));
};
const FOUND_CACHE = 'public, max-age=3600, s-maxage=2592000, stale-while-revalidate=86400';
const EMPTY_CACHE = 'public, max-age=300, s-maxage=86400';

test('what cannot be searched is refused with its reason, never cached, and GurbaniNow is never asked', async () => {
    const cases: [string | null, string, string?][] = [
        [null, 'missing_query'],
        ['', 'missing_query'],
        ['   ', 'missing_query'],
        ['10', 'invalid_query', 'ang'],
        ['so purakh', 'invalid_query', 'too-short'],
        ['what does japji sahib mean', 'invalid_query', 'english'],
        ['सो पुरखु निरंजनु', 'invalid_query', 'unsupported-script'],
        ['!!!', 'invalid_query', 'no-letters'],
        ['x'.repeat(201), 'invalid_query', 'too-long'],
    ];
    for (const [q, code, reason] of cases) {
        const res = await ask(q);
        assert.equal(res.status, 400, String(q));
        const body = await res.json();
        assert.equal(body.code, code, String(q));
        if (reason) assert.equal(body.reason, reason, String(q));
        assert.equal(res.headers.get('cache-control'), 'no-store');
    }
    assert.deepEqual(asked, []);
});

test('a verse found: its hits, kept a month at the CDN, from one lookup when one settles it', async () => {
    const res = await ask('So Purakh Niranjan');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.kind, 'roman');
    assert.equal(body.hits[0].lineId, '546S');
    assert.equal(body.hits[0].ang, 10);
    assert.equal(body.complete, true);
    assert.deepEqual(body.alternatives, []);
    assert.equal(res.headers.get('cache-control'), FOUND_CACHE);
    assert.deepEqual(asked, [`https://api.gurbaninow.com/v2/search/${encodeURIComponent('ਸਪਨ')}?searchtype=0&results=50&source=1`]);
});

test('every lookup any search makes asks for Gurmukhi only, in Sri Guru Granth Sahib Ji, four at most', async () => {
    for (const f of SEARCHES) {
        if (!isSearchable(classifyQuery(inputOf(f), f.as))) continue;
        asked = [];
        const res = await ask(inputOf(f), f.as);
        assert.equal(res.status, 200, f.id);
        assert.ok(asked.length >= 1 && asked.length <= 4, `${f.id}: ${asked.length} lookups`);
        for (const url of asked) {
            const u = new URL(url);
            assert.equal(u.origin + u.pathname.slice(0, 11), 'https://api.gurbaninow.com/v2/search/', url);
            assert.match(decodeURIComponent(u.pathname.slice('/v2/search/'.length)), /^[਀-੿ ]+$/u, `${f.id}: ${url}`);
            assert.ok(['0', '1', '2', '4'].includes(u.searchParams.get('searchtype')!), url);
            assert.ok(['30', '50'].includes(u.searchParams.get('results')!), url);
            assert.equal(u.searchParams.get('source'), '1', url);
        }
    }
});

test('nothing matched is an answer, kept a day; the other reading is offered', async () => {
    const res = await ask('the lord is my shepherd');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.hits, []);
    assert.equal(body.complete, true);
    assert.equal(res.headers.get('cache-control'), EMPTY_CACHE);

    const letters = SEARCHES.find(f => f.id === 'refrain-letters')!;
    const offered = await (await ask(inputOf(letters))).json();
    assert.deepEqual(offered.alternatives, ['words'], 'a run of letters with no vowel signs might be a word');
});

test('an unknown search-as is ignored', async () => {
    const res = await ask('so purakh niranjan', 'everything');
    assert.equal(res.status, 200);
    assert.equal((await res.json()).kind, 'roman');
});

test('a source that fails is a 502 with a code, never cached, never its own words', async () => {
    const failures: [string, () => Promise<Response>][] = [
        ['a 500', async () => new Response('database exploded at node 7', { status: 500 })],
        ['a 200 error', async () => Response.json({ error: true, data: 'nothing here' })],
        ['a timeout', async () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); }],
    ];
    for (const [what, answer] of failures) {
        upstream = answer;
        const res = await ask('so purakh niranjan');
        assert.equal(res.status, 502, what);
        const body = await res.json();
        assert.equal(body.code, 'source_error', what);
        assert.doesNotMatch(JSON.stringify(body), /exploded|nothing here|timeout/i, what);
        assert.equal(res.headers.get('cache-control'), 'no-store', what);
        assert.ok(asked.length <= 2, `${what}: no second wave once the source is down`);
        asked = [];
    }
});

test('when some lookups fail, what was found is shown, marked incomplete, and never cached', async () => {
    upstream = async (url) => (new URL(url).searchParams.get('searchtype') === '2' ? new Response('busy', { status: 503 }) : replay(url));
    const refrain = SEARCHES.find(f => f.id === 'refrain-line')!;
    const res = await ask(inputOf(refrain));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.complete, false);
    assert.ok(body.hits.some((h: { lineId: string }) => h.lineId === 'J92N'));
    assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('the log says what a search cost, never what was searched for', async () => {
    delete process.env.APP_LOG;
    const lines: string[] = [];
    const saved = console.log;
    console.log = (line: string) => { lines.push(line); };
    try {
        await ask('so purakh niranjan');
    } finally {
        console.log = saved;
        process.env.APP_LOG = 'off';
    }
    const entry = lines.map(line => JSON.parse(line)).find(l => l.evt === 'verse_search');
    assert.ok(entry, lines.join('\n'));
    assert.equal(entry.kind, 'roman');
    assert.equal(entry.calls, 1);
    assert.equal(entry.route, '/api/shabad/search');
    assert.doesNotMatch(lines.join('\n'), /purakh|niranjan|ਸਪਨ/);
});

test('every error code the search answers with has words in all three languages', () => {
    for (const lang of LANGS) {
        for (const code of ['missing_query', 'invalid_query', 'search_busy', 'source_error', 'search_failed'] as const) {
            const text = getDictionary(lang).errors[code];
            assert.ok(typeof text === 'string' && text.length > 0, `${lang} ${code}`);
            assert.doesNotMatch(text, /\{\w+\}/, `${lang} ${code}: error text is shown as is, so no placeholders`);
        }
    }
});

// Last: it spends this process's search allowance.
test('with the day\'s allowance spent, a search is busy, and nothing is asked', async () => {
    const { meters } = await import('@/lib/gurbani/gurbaninow');
    while (meters.verseSearch.take());
    const res = await ask('so purakh niranjan');
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, 'search_busy');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(asked, []);
});
