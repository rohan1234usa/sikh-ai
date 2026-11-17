'use client';

import { useSyncExternalStore } from 'react';
import type { StoredSwitch } from '@/lib/storedSwitch';

// A switch kept in this browser (lib/storedSwitch.ts) as React state: on for
// the server render and hydration, then the stored choice, followed across
// the browser's tabs.
const onBeforeReading = () => true;

export function useStoredSwitch(sw: StoredSwitch): [boolean, (on: boolean) => void] {
    return [useSyncExternalStore(sw.subscribe, sw.read, onBeforeReading), sw.write];
}
