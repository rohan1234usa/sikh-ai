// The translation cache is committed to the repo on purpose: it is both the
// reason a rerun costs nothing and the ledger of what has been spent. Keys
// embed the full source text, so an edited string misses naturally and there
// is no invalidation logic to get wrong.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';

const CACHE_PATH = resolve(import.meta.dirname, 'cache.json');

export type CacheEntry = { translatedText: string; chars: number; at: string };

export type Cache = {
    version: 1;
    meta: { createdAt: string; updatedAt: string; totalCharsBilled: number };
    entries: Record<string, CacheEntry>;
};

export function cacheKey(source: string, target: string, text: string): string {
    return createHash('sha256').update(`${source}→${target}:${text}`).digest('hex');
}

export function loadCache(): Cache {
    try {
        const parsed = JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as Cache;
        if (parsed?.version === 1 && parsed.entries) return parsed;
    } catch {
        // missing or corrupt — start fresh rather than fail the run
    }
    const now = new Date().toISOString();
    return {
        version: 1,
        meta: { createdAt: now, updatedAt: now, totalCharsBilled: 0 },
        entries: {},
    };
}

// Written after every chunk, not at the end: a crash or quota error mid-run
// then costs at most one chunk on the retry. Temp-then-rename keeps the file
// from being observed half-written.
export function saveCache(cache: Cache): void {
    cache.meta.updatedAt = new Date().toISOString();
    const tmp = `${CACHE_PATH}.tmp`;
    writeFileSync(tmp, JSON.stringify(cache, null, 2) + '\n', 'utf8');
    renameSync(tmp, CACHE_PATH);
}

// Opt-in only (--prune): drops entries no current string maps to. Kept manual
// because an accidental prune turns a free rerun back into a paid one.
export function pruneCache(cache: Cache, liveKeys: Set<string>): number {
    let removed = 0;
    for (const key of Object.keys(cache.entries)) {
        if (!liveKeys.has(key)) {
            delete cache.entries[key];
            removed++;
        }
    }
    return removed;
}
