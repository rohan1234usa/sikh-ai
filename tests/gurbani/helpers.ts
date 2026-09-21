// Offline GurbaniNow: replays the answers recorded by `npm run fixtures:gurbani`
// and logs every call, so tests can assert how many lookups a check cost.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GurbaniClient, GurbaniLine } from '@/lib/gurbani/gurbaninow';

const DIR = resolve(import.meta.dirname, 'fixtures');

export type Reply = { id: string; source: string; text: string };

export const replies: Reply[] = JSON.parse(readFileSync(`${DIR}/replies.json`, 'utf8'));
const recorded: Record<string, GurbaniLine[]> = JSON.parse(readFileSync(`${DIR}/gurbaninow.json`, 'utf8'));

export function reply(id: string): string {
    const found = replies.find(r => r.id === id);
    if (!found) throw new Error(`no fixture reply "${id}"`);
    return found.text;
}

// `down` makes every lookup fail, the way an unreachable source does.
export function fakeClient(opts: { down?: boolean } = {}) {
    const calls: string[] = [];
    const answer = (key: string) => {
        calls.push(key);
        if (opts.down) return null;
        if (!(key in recorded)) throw new Error(`no recorded GurbaniNow answer for "${key}" — run npm run fixtures:gurbani`);
        return recorded[key];
    };
    const client: GurbaniClient = {
        async fetchAng(ang) { return answer(`ang:${ang}`); },
        async searchLines(query, type, results) { return answer(`search:${type}:${results}:${query}`); },
    };
    return { client, calls };
}
