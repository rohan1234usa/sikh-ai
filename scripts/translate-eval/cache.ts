// Model answers, keyed by everything that shapes them: the model, the full
// request config (system prompt, schema, thinking level), and the input. Any
// prompt or config edit therefore misses the cache on its own — answers from an
// older prompt are not comparable, so there is nothing to invalidate by hand.
// Raw text is stored rather than parsed, so scoring can change without a rerun.

import { createHash } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CACHE_PATH = resolve(import.meta.dirname, 'cache.json');

export type CachedRun = {
    model: string;         // what was requested
    modelVersion?: string; // what the API says actually served it
    text: string;          // raw model output; '' when there was none
    finishReason?: string;
    blockReason?: string;
    usage: { prompt?: number; output?: number; thoughts?: number };
    latencyMs: number;
    at: string;
};

export type Cache = { version: 1; entries: Record<string, CachedRun> };

export function runKey(model: string, config: unknown, input: string): string {
    return createHash('sha256').update(`${model}\n${JSON.stringify(config)}\n${input}`).digest('hex');
}

// Same posture as the i18n audit: a cache that exists but will not parse is
// most likely a merge conflict, and quietly starting over would pay again —
// in money or daily quota — for answers already in hand. The path defaults to
// the eval's own cache; npm run build:phrasebook keeps a separate one.
export function loadCache(path = CACHE_PATH): Cache {
    let raw: string;
    try {
        raw = readFileSync(path, 'utf8');
    } catch {
        return { version: 1, entries: {} }; // genuinely absent: first run
    }
    try {
        const parsed = JSON.parse(raw) as Cache;
        if (parsed?.version === 1 && parsed.entries) return parsed;
        throw new Error(`unexpected shape (version ${parsed?.version})`);
    } catch (err) {
        throw new Error(
            `${path} exists but could not be read: ${err instanceof Error ? err.message : err}\n` +
            `Check for merge conflict markers, or delete it to start over.`,
        );
    }
}

// Written after every answer, so a quota stop or crash loses nothing.
// Temp-then-rename keeps the file from being observed half-written.
export function saveCache(cache: Cache, path = CACHE_PATH): void {
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(cache, null, 2) + '\n', 'utf8');
    renameSync(tmp, path);
}

// Drops every entry not in `keep` (the keys the current prompt would ask for),
// returning how many went. Only on request: after a prompt experiment is
// reverted, its predecessor's answers are free again only if still cached.
export function pruneCache(cache: Cache, keep: Set<string>): number {
    let removed = 0;
    for (const key of Object.keys(cache.entries)) {
        if (keep.has(key)) continue;
        delete cache.entries[key];
        removed++;
    }
    return removed;
}
