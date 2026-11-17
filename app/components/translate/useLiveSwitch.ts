'use client';

import { storedSwitch } from '@/lib/storedSwitch';
import { useStoredSwitch } from '../useStoredSwitch';

// The translator's Live switch: on unless switched off, remembered in this
// browser and followed across its tabs (lib/storedSwitch.ts). /privacy lists
// it with the other settings kept here, and "Clear this browser" turns it
// back on.

const live = storedSwitch('sikhai.translate.live'); // '0' when switched off; absent when on

export const useLiveSwitch = () => useStoredSwitch(live);
