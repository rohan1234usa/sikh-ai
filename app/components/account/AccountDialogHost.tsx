'use client';

import dynamic from 'next/dynamic';
import { useSyncExternalStore } from 'react';

// The Delete account dialog, for whatever opens it: the account menu, on every
// page, and /privacy. It's mounted once, outside the navbar (whose focus ring
// would be the wrong colour on the dialog's light card), and its code arrives
// only when it's first wanted: on the way to a button that opens it, or when
// it opens. The deletion's own code, and Firestore, come later still: once
// someone confirms (./accountDeletion.ts).

type State = { open: boolean; opened: boolean };
const CLOSED: State = { open: false, opened: false };
let state = CLOSED;
const listeners = new Set<() => void>();

function set(next: State) {
    state = next;
    for (const notify of listeners) notify();
}

export const openDeleteAccount = () => set({ open: true, opened: true });
const closeDeleteAccount = () => set({ ...state, open: false });

const subscribe = (onChange: () => void) => {
    listeners.add(onChange);
    return () => { listeners.delete(onChange); };
};

const DeleteAccountDialog = dynamic(() => import('./DeleteAccountDialog'), { ssr: false });

// On the way to a button that opens it (hover, focus): the dialog's code, so
// it opens at once. A failed fetch (offline) is tried again on opening.
export const preloadDeleteAccount = () => { void import('./DeleteAccountDialog').catch(() => {}); };

export default function AccountDialogHost() {
    const { open, opened } = useSyncExternalStore(subscribe, () => state, () => CLOSED);
    if (!opened) return null;
    return <DeleteAccountDialog open={open} onClose={closeDeleteAccount} />;
}
