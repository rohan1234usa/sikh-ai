'use client';

import { storedSwitch } from '@/lib/storedSwitch';
import { useStoredSwitch } from '../useStoredSwitch';

// Talk's Speak switch: whether each translation is read aloud as it comes.
// On unless switched off, remembered in this browser and followed across its
// tabs (lib/storedSwitch.ts), like the translator's Live switch. A line can
// always be heard again with its own button, whichever way this is set.

const speak = storedSwitch('sikhai.translate.speak'); // '0' when switched off; absent when on

export const useSpeakSwitch = () => useStoredSwitch(speak);
