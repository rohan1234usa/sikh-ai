// Browser-only: an on/off choice kept in localStorage, on unless switched
// off, and followed across this browser's tabs. The translator's Live switch
// and Talk's Speak switch are two of these (app/components/translate). The
// key holds '0' while off and is absent while on, so "Clear this browser"
// (lib/browserData.ts) turns a switch back on; /privacy lists each one.
//
// When storage is blocked or full, the choice still holds for this page.

import { onStorageKey } from './storage';

export type StoredSwitch = {
    read(): boolean;
    subscribe(onChange: () => void): () => void;
    write(on: boolean): void;
};

export function storedSwitch(key: string): StoredSwitch {
    // Where the choice lives when storage is blocked or full: this page only.
    let unsaved = true;
    let unsavable = false;
    const listeners = new Set<() => void>();

    return {
        read() {
            if (unsavable) return unsaved;
            try {
                return localStorage.getItem(key) !== '0';
            } catch {
                return unsaved;
            }
        },
        subscribe(onChange) {
            listeners.add(onChange);
            const stopFollowing = onStorageKey(key, onChange);
            return () => {
                listeners.delete(onChange);
                stopFollowing();
            };
        },
        write(on) {
            unsaved = on;
            try {
                if (on) localStorage.removeItem(key);
                else localStorage.setItem(key, '0');
            } catch {
                unsavable = true; // `unsaved` holds it for this page
            }
            for (const onChange of listeners) onChange();
        },
    };
}
