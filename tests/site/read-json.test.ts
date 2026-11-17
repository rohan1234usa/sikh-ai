import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson } from '@/lib/readJson';

test("a refusal's JSON is read; HTML from a proxy, or JSON that isn't, is null", async () => {
    const json = (body: string) => new Response(body, { status: 429, headers: { 'content-type': 'application/json' } });
    assert.deepEqual(await readJson(json('{"code":"speak_busy"}')), { code: 'speak_busy' });
    assert.equal(await readJson(json('{not json')), null);
    const html = new Response('<html>Too many requests</html>', { status: 429, headers: { 'content-type': 'text/html' } });
    assert.equal(await readJson(html), null);
    assert.equal(await readJson(new Response(null, { status: 503 })), null, 'no body at all');
});
