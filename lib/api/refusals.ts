// SERVER-ONLY: the log line for a refused request (lib/api/guard.ts and
// lib/api/allowance.ts). At most one a minute for each route and reason on
// each server, carrying how many were refused since the last one written. A
// refusal costs nothing to answer, and a flood of them mustn't flood the logs
// either. A count still held back when a flood stops is never written.

import { logEvent } from '../log';

const MINUTE_MS = 60_000;

// A few routes times a few reasons, so it stays small.
const lines = new Map<string, { minute: number; held: number }>();

export function logRefusal(evt: string, key: string, fields: object, now = Date.now()): void {
    const minute = Math.floor(now / MINUTE_MS);
    const last = lines.get(key);
    if (last?.minute === minute) {
        last.held++;
        return;
    }
    logEvent(evt, { ...fields, refused: (last?.held ?? 0) + 1 }, 'warn');
    lines.set(key, { minute, held: 0 });
}
