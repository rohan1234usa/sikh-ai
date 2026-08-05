// Recorded GurbaniNow responses, keyed by the exact query that produced them.
//
// Committed so the eval runs offline and deterministically: the matcher's
// behaviour must be reproducible, and a scoring regression should never be
// masked (or invented) by the Gurbani API having a different day. `--record`
// refreshes the cache against the live API.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GurbaniVerse } from '@/lib/identify/search';

const CACHE_PATH = resolve(process.cwd(), 'scripts/identify-eval/cache.json');

export type SearchCache = Record<string, GurbaniVerse[]>;

export const searchKey = (query: string, searchtype: number) => `search:${searchtype}:${query}`;
export const shabadKey = (shabadId: string) => `shabad:${shabadId}`;

export function loadCache(): SearchCache {
    if (!existsSync(CACHE_PATH)) return {};
    try {
        return JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as SearchCache;
    } catch {
        // A corrupt cache must not silently become an empty one — that would
        // read as "every query returned nothing" and quietly pass the negative
        // cases while failing every positive one for the wrong reason.
        throw new Error('scripts/identify-eval/cache.json is unreadable. Delete it and rerun with --record.');
    }
}

export function saveCache(cache: SearchCache): void {
    // Sorted keys so a re-record produces a reviewable diff rather than a
    // reshuffled file.
    const sorted: SearchCache = {};
    for (const key of Object.keys(cache).sort()) sorted[key] = cache[key];
    writeFileSync(CACHE_PATH, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

export { CACHE_PATH };
