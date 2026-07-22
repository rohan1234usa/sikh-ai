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

function emptyCache(): Cache {
    const now = new Date().toISOString();
    return {
        version: 1,
        meta: { createdAt: now, updatedAt: now, totalCharsBilled: 0 },
        entries: {},
    };
}

// A corrupt cache must never be silently discarded. This file is committed, so
// the realistic corruption is a merge conflict between two branches that both
// ran the audit — and starting fresh there would quietly re-bill the entire
// corpus and reset the spend ledger to zero. Fail loudly instead; --reset-cache
// is the deliberate way to start over.
export function loadCache(allowReset = false): Cache {
    let raw: string;
    try {
        raw = readFileSync(CACHE_PATH, 'utf8');
    } catch {
        return emptyCache(); // genuinely absent: first run
    }

    try {
        const parsed = JSON.parse(raw) as Cache;
        if (parsed?.version === 1 && parsed.entries) return parsed;
        throw new Error(`unexpected shape (version ${parsed?.version})`);
    } catch (err) {
        if (allowReset) {
            console.warn('cache.json unreadable — starting fresh (--reset-cache).');
            return emptyCache();
        }
        console.error(
            `cache.json exists but could not be read: ${err instanceof Error ? err.message : err}\n` +
            `Refusing to continue — a fresh cache would re-translate everything and reset the\n` +
            `spend ledger. Check for merge conflict markers, then rerun; or pass --reset-cache\n` +
            `to discard it deliberately.`
        );
        process.exit(1);
    }
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
