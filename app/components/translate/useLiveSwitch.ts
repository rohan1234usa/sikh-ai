'use client';

import { useSyncExternalStore } from 'react';
import { onStorageKey } from '@/lib/storage';

// The translator's Live switch: on unless switched off, remembered in this
// browser and followed across its tabs. /privacy lists it with the other
// settings kept here, and "Clear this browser" turns it back on.

const LIVE_KEY = 'sikhai.translate.live'; // '0' when switched off; absent when on

// Where the choice lives when storage is blocked or full: this page only.
let unsaved = true;
let unsavable = false;
const listeners = new Set<() => void>();

function read(): boolean {
    if (unsavable) return unsaved;
    try {
        return localStorage.getItem(LIVE_KEY) !== '0';
    } catch {
        return unsaved;
    }
}

function subscribe(onChange: () => void): () => void {
    listeners.add(onChange);
    const stopFollowing = onStorageKey(LIVE_KEY, onChange);
    return () => {
        listeners.delete(onChange);
        stopFollowing();
    };
}

function write(on: boolean): void {
    unsaved = on;
    try {
        if (on) localStorage.removeItem(LIVE_KEY);
        else localStorage.setItem(LIVE_KEY, '0');
    } catch {
        unsavable = true; // `unsaved` holds it for this page
    }
    for (const onChange of listeners) onChange();
}

// On for the server render and hydration; the stored choice follows.
const onBeforeReading = () => true;

export function useLiveSwitch(): [boolean, (on: boolean) => void] {
    return [useSyncExternalStore(subscribe, read, onBeforeReading), write];
}
