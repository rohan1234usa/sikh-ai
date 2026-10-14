'use client';

import { useSyncExternalStore } from 'react';
import { storedSwitch } from '@/lib/storedSwitch';

// The translator's Live switch: on unless switched off, remembered in this
// browser and followed across its tabs (lib/storedSwitch.ts). /privacy lists
// it with the other settings kept here, and "Clear this browser" turns it
// back on.

const live = storedSwitch('sikhai.translate.live'); // '0' when switched off; absent when on

// On for the server render and hydration; the stored choice follows.
const onBeforeReading = () => true;

export function useLiveSwitch(): [boolean, (on: boolean) => void] {
    return [useSyncExternalStore(live.subscribe, live.read, onBeforeReading), live.write];
}
