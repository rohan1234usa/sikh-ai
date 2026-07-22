// Cloud Translation v2 (Basic) client for the audit script.
//
// Deliberately NOT sharing lib/translate/cloud.ts: that module is the runtime
// fallback's transport — it swallows errors, times out fast, and meters itself
// against a per-request budget. The audit wants the opposite: loud failures,
// batching, and a persistent cache. Same API, different contract.

import { cacheKey, saveCache, type Cache } from './cache';

const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';

// v2 accepts an array of `q`. Batching cuts HTTP round-trips by ~10x; billing
// is per character either way, so this is purely a speed win.
const MAX_SEGMENTS = 100;
const MAX_CHARS_PER_REQUEST = 4500;

export type Lang = 'en' | 'pa';

export type TranslateRequest = { source: Lang; target: Lang; text: string };

export type TranslateStats = { cacheHits: number; billedChars: number; requests: number };

function chunk(items: TranslateRequest[]): TranslateRequest[][] {
    const chunks: TranslateRequest[][] = [];
    let current: TranslateRequest[] = [];
    let currentChars = 0;
    for (const item of items) {
        const len = item.text.length;
        if (
            current.length > 0 &&
            (current.length >= MAX_SEGMENTS || currentChars + len > MAX_CHARS_PER_REQUEST)
        ) {
            chunks.push(current);
            current = [];
            currentChars = 0;
        }
        current.push(item);
        currentChars += len;
    }
    if (current.length) chunks.push(current);
    return chunks;
}

async function callApi(
    apiKey: string,
    source: Lang,
    target: Lang,
    texts: string[],
): Promise<string[]> {
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: texts, source, target, format: 'text' }),
    });

    if (!res.ok) {
        const body = await res.text();
        // Redact the key in case it is echoed back in an error URL
        const safe = body.split(apiKey).join('REDACTED');
        if (res.status === 403) {
            throw new Error(
                `Cloud Translation returned 403. The key is likely restricted to another API\n` +
                `(look for API_KEY_SERVICE_BLOCKED below). Add "Cloud Translation API" to the\n` +
                `key's API restrictions, or set GOOGLE_TRANSLATE_API_KEY to an unrestricted key.\n${safe}`
            );
        }
        throw new Error(`Cloud Translation ${res.status}: ${safe}`);
    }

    const data = await res.json() as {
        data?: { translations?: { translatedText?: string }[] };
    };
    const translations = data?.data?.translations;
    if (!Array.isArray(translations) || translations.length !== texts.length) {
        throw new Error(`Unexpected response shape: got ${translations?.length ?? 0} of ${texts.length}`);
    }
    return translations.map(t => t.translatedText ?? '');
}

// Resolves every request against the cache, calling the API only for misses.
// The cache is persisted after each chunk so an interrupted run keeps what it
// already paid for.
export async function translateAll(
    requests: TranslateRequest[],
    cache: Cache,
    apiKey: string,
): Promise<{ results: Map<string, string>; stats: TranslateStats }> {
    const results = new Map<string, string>();
    const stats: TranslateStats = { cacheHits: 0, billedChars: 0, requests: 0 };

    // Deduped by cache key, the same identity estimateUncachedChars uses, so
    // the estimate and the bill always agree. (A Set rather than scanning the
    // misses array: the corpus is ~400 strings and repeats are common.)
    const misses: TranslateRequest[] = [];
    const queued = new Set<string>();
    for (const req of requests) {
        const key = cacheKey(req.source, req.target, req.text);
        const hit = cache.entries[key];
        if (hit) {
            results.set(key, hit.translatedText);
            stats.cacheHits++;
        } else if (!queued.has(key)) {
            queued.add(key);
            misses.push(req);
        }
    }

    // Group by direction — one request cannot mix source/target pairs.
    const byDirection = new Map<string, TranslateRequest[]>();
    for (const miss of misses) {
        const dir = `${miss.source}→${miss.target}`;
        const list = byDirection.get(dir) ?? [];
        list.push(miss);
        byDirection.set(dir, list);
    }

    for (const [dir, items] of byDirection) {
        const [source, target] = dir.split('→') as [Lang, Lang];
        for (const batch of chunk(items)) {
            const texts = batch.map(b => b.text);
            const translated = await callApi(apiKey, source, target, texts);
            const now = new Date().toISOString();
            batch.forEach((item, i) => {
                const key = cacheKey(source, target, item.text);
                const chars = item.text.length;
                cache.entries[key] = { translatedText: translated[i], chars, at: now };
                cache.meta.totalCharsBilled += chars;
                stats.billedChars += chars;
                results.set(key, translated[i]);
            });
            stats.requests++;
            saveCache(cache);
            process.stdout.write(`  batch ${stats.requests}: ${batch.length} strings, ${texts.join('').length} chars\n`);
        }
    }

    return { results, stats };
}

export function estimateUncachedChars(requests: TranslateRequest[], cache: Cache): number {
    const seen = new Set<string>();
    let total = 0;
    for (const req of requests) {
        const key = cacheKey(req.source, req.target, req.text);
        if (cache.entries[key] || seen.has(key)) continue;
        seen.add(key);
        total += req.text.length;
    }
    return total;
}
