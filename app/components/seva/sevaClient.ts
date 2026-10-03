'use client';

import type { SevaClient } from '@/lib/seva/client';

// Firestore for Seva, fetched the first time something needs it (someone
// signed in, or about to join, report or post), in the manner of the chat's
// account store (lib/chat/store/chatStores.ts). A failed fetch (offline) is
// forgotten, so the next need tries again.
let load: Promise<SevaClient> | null = null;

export function loadSeva(): Promise<SevaClient> {
    if (!load) {
        load = import('./sevaFirebase').then((m) => m.seva);
        load.catch(() => { load = null; });
    }
    return load;
}

// After a change, the server rebuilds the event's cached page, and the
// list's (app/api/seva/refresh). Best effort: if it doesn't answer quickly,
// the pages catch up within minutes anyway.
export async function refreshPages(eventId: string): Promise<void> {
    try {
        await fetch('/api/seva/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: eventId }),
            keepalive: true,
            signal: AbortSignal.timeout(2000),
        });
    } catch { /* the cache expires on its own */ }
}
