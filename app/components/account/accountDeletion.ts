'use client';

import type { DeletionStep } from '@/lib/account/deletion';
import { refreshPages } from '../seva/sevaClient';

// The account deletion (lib/account/deletion.ts) and Firestore Lite, fetched
// the first time someone confirms, in the manner of Seva's (seva/
// sevaClient.ts). A failed fetch (offline) is forgotten, so trying again
// fetches it again.
type AccountFirebase = typeof import('./accountFirebase');
let load: Promise<AccountFirebase> | null = null;

export function loadAccountDeletion(): Promise<AccountFirebase> {
    if (!load) {
        load = import('./accountFirebase');
        load.catch(() => { load = null; });
    }
    return load;
}

// The cached pages of the first few events deleted are rebuilt at once. The
// firewall allows 20 posts a minute from one address, and the rest catch up
// within minutes anyway.
const MAX_REFRESHES = 10;

export async function deleteAccountData(uid: string, onStep: (step: DeletionStep) => void): Promise<void> {
    const m = await loadAccountDeletion();
    let refreshed = 0;
    await m.deleteAccountData(m.io, uid, {
        onStep,
        onEventRemoved: (eventId) => {
            if (refreshed++ < MAX_REFRESHES) void refreshPages(eventId);
        },
    });
}
