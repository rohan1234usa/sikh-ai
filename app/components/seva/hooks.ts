'use client';

import { useSyncExternalStore } from 'react';

// What only the browser knows, for the Seva pages' islands, each read
// through useSyncExternalStore: the server (and the first render in the
// browser, which must match it) gets the server's answer, and the islands
// catch up straight after.

const noSubscription = () => () => {};

// Whether this is the browser, after hydration: for what can only be built
// there (the hosting form, which starts from what this tab kept).
export const useMounted = () => useSyncExternalStore(noSubscription, () => true, () => false);

// The time, to the minute: a cached page shows events as they were when it
// was built, and this keeps "ended" and "happening now" true as time passes.
// Null until the page is interactive.
const subscribeMinute = (onChange: () => void) => {
    const timer = setInterval(onChange, 15_000);
    return () => clearInterval(timer);
};
const thisMinute = () => Math.floor(Date.now() / 60_000) * 60_000;
export const useMinute = (): number | null => useSyncExternalStore(subscribeMinute, thisMinute, () => null);

// Whether the device has a share sheet (phones, mostly).
export const useCanShare = () =>
    useSyncExternalStore(noSubscription, () => typeof navigator.share === 'function', () => false);

// The address's query, which the board's filters live in. Changing it here
// (replaceSearch) tells every reader; Back and Forward do too.
const SEARCH_CHANGED = 'sikhai:seva-search';
const subscribeSearch = (onChange: () => void) => {
    window.addEventListener('popstate', onChange);
    window.addEventListener(SEARCH_CHANGED, onChange);
    return () => {
        window.removeEventListener('popstate', onChange);
        window.removeEventListener(SEARCH_CHANGED, onChange);
    };
};
export const useSearch = () => useSyncExternalStore(subscribeSearch, () => window.location.search, () => '');

export function replaceSearch(search: string) {
    const { pathname, hash } = window.location;
    window.history.replaceState(window.history.state, '', `${pathname}${search}${hash}`);
    window.dispatchEvent(new Event(SEARCH_CHANGED));
}

// The last country chosen on the board, so a returning visitor sees their
// own first. A convenience only: blocked storage just means no memory.
const COUNTRY_KEY = 'sikhai.seva.country';
const COUNTRY_CHANGED = 'sikhai:seva-country';

function readCountry(): string {
    try {
        return localStorage.getItem(COUNTRY_KEY) ?? '';
    } catch {
        return '';
    }
}

const subscribeCountry = (onChange: () => void) => {
    window.addEventListener('storage', onChange);
    window.addEventListener(COUNTRY_CHANGED, onChange);
    return () => {
        window.removeEventListener('storage', onChange);
        window.removeEventListener(COUNTRY_CHANGED, onChange);
    };
};
export const useSavedCountry = () => useSyncExternalStore(subscribeCountry, readCountry, () => '');

export function saveCountry(country: string) {
    try {
        if (country) localStorage.setItem(COUNTRY_KEY, country);
        else localStorage.removeItem(COUNTRY_KEY);
    } catch { /* storage blocked */ }
    window.dispatchEvent(new Event(COUNTRY_CHANGED));
}

// The events this account hosts and has joined, as "Your seva" last read
// them from its notes, so the board's cards can say so without reading them
// again. Each reader checks it's for the account signed in now.
export type MyEvents = { uid: string; hosting: ReadonlySet<string>; joined: ReadonlySet<string> };
let myEvents: MyEvents | null = null;
const MY_EVENTS_CHANGED = 'sikhai:seva-mine';

export function setMyEvents(next: MyEvents) {
    myEvents = next;
    window.dispatchEvent(new Event(MY_EVENTS_CHANGED));
}

const subscribeMyEvents = (onChange: () => void) => {
    window.addEventListener(MY_EVENTS_CHANGED, onChange);
    return () => window.removeEventListener(MY_EVENTS_CHANGED, onChange);
};
export const useMyEvents = () => useSyncExternalStore(subscribeMyEvents, () => myEvents, () => null);

// A word for an event's page to show once it opens, after a change made on
// another page (the hosting form): posted, or saved. Kept for the tab, not in
// the address, so the page stays the same for everyone and a copied link
// carries nothing. It goes when dismissed, or when the page is left.
export type Flash = 'posted' | 'saved';
const FLASH_KEY = 'sikhai.seva.flash';
const FLASH_CHANGED = 'sikhai:seva-flash';

export function setFlash(eventId: string, kind: Flash) {
    try {
        sessionStorage.setItem(FLASH_KEY, JSON.stringify({ eventId, kind }));
    } catch { /* storage blocked: no message */ }
}

export function clearFlash() {
    try {
        sessionStorage.removeItem(FLASH_KEY);
    } catch { /* storage blocked */ }
    window.dispatchEvent(new Event(FLASH_CHANGED));
}

function readFlash(): string {
    try {
        return sessionStorage.getItem(FLASH_KEY) ?? '';
    } catch {
        return '';
    }
}

const subscribeFlash = (onChange: () => void) => {
    window.addEventListener(FLASH_CHANGED, onChange);
    return () => window.removeEventListener(FLASH_CHANGED, onChange);
};

export function useFlash(eventId: string): Flash | null {
    const raw = useSyncExternalStore(subscribeFlash, readFlash, () => '');
    if (!raw) return null;
    try {
        const flash = JSON.parse(raw) as { eventId?: unknown; kind?: unknown };
        if (flash.eventId !== eventId) return null;
        return flash.kind === 'posted' || flash.kind === 'saved' ? flash.kind : null;
    } catch {
        return null;
    }
}
