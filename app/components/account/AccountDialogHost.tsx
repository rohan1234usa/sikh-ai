'use client';

import { useSyncExternalStore } from 'react';
import { useT } from '@/app/context/LanguageContext';

// The Delete account dialog, for whatever opens it: the account menu, on every
// page, and /privacy. It's mounted once, outside the navbar (whose focus ring
// would be the wrong colour on the dialog's light card), and its code arrives
// only when it's first wanted: on the way to a button that opens it, or when
// it opens. A plain import(), as the chat's account store and Seva fetch
// theirs, so no loader ships with every page. The deletion's own code, and
// Firestore, come later still: once someone confirms (./accountDeletion.ts).

type Dialog = typeof import('./DeleteAccountDialog').default;
// `failed`: the dialog's code couldn't be fetched when it was asked for.
type State = { open: boolean; failed: boolean; Dialog: Dialog | null };
const INITIAL: State = { open: false, failed: false, Dialog: null };
let state = INITIAL;
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
    state = { ...state, ...next };
    for (const notify of listeners) notify();
}

const subscribe = (onChange: () => void) => {
    listeners.add(onChange);
    return () => { listeners.delete(onChange); };
};

// A failed fetch (offline) is forgotten, so the next try fetches it again.
let load: Promise<void> | null = null;
function loadDialog(): Promise<void> {
    if (!load) {
        load = import('./DeleteAccountDialog').then((m) => set({ Dialog: m.default }));
        load.catch(() => { load = null; });
    }
    return load;
}

// On the way to a button that opens it (hover, focus): the dialog's code, so
// it opens at once.
export const preloadDeleteAccount = () => { void loadDialog().catch(() => {}); };

// Offline, nothing opens (rather than the dialog appearing later, whenever
// its code next arrives), and a short notice says why.
let notice: ReturnType<typeof setTimeout> | undefined;
export const openDeleteAccount = () => {
    clearTimeout(notice);
    set({ open: true, failed: false });
    loadDialog().catch(() => {
        set({ open: false, failed: true });
        notice = setTimeout(() => set({ failed: false }), 6000);
    });
};
const closeDeleteAccount = () => set({ open: false });

export default function AccountDialogHost() {
    const t = useT();
    const { open, failed, Dialog } = useSyncExternalStore(subscribe, () => state, () => INITIAL);
    return (
        <>
            {Dialog && <Dialog open={open} onClose={closeDeleteAccount} />}
            <p role="status" className={failed
                ? 'fixed bottom-4 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-edge bg-surface-raised px-4 py-3 text-sm text-ink shadow-lg'
                : 'sr-only'}>
                {failed ? t.nav.deleteAccountUnavailable : ''}
            </p>
        </>
    );
}
