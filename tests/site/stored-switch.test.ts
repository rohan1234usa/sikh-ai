import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storedSwitch } from '@/lib/storedSwitch';

// The browser-only store, on fakes: this file runs in its own process.
function installBrowser({ storage = new Map<string, string>(), refuse = false, blocked = false } = {}) {
    const localStorage = {
        getItem: (k: string) => {
            if (blocked) throw new Error('SecurityError');
            return storage.get(k) ?? null;
        },
        setItem: (k: string, v: string) => {
            if (refuse || blocked) throw new Error('QuotaExceededError');
            storage.set(k, v);
        },
        removeItem: (k: string) => {
            if (blocked) throw new Error('SecurityError');
            storage.delete(k);
        },
    };
    const window = new EventTarget();
    for (const [name, value] of Object.entries({ localStorage, window }))
        Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    return { localStorage, window, storage };
}

test('on until switched off: the key holds 0 while off and is gone while on', () => {
    const { storage } = installBrowser();
    const s = storedSwitch('sikhai.test.a');
    assert.equal(s.read(), true);
    s.write(false);
    assert.equal(storage.get('sikhai.test.a'), '0');
    assert.equal(s.read(), false);
    s.write(true);
    assert.equal(storage.has('sikhai.test.a'), false, 'so clearing the browser turns it back on');
    assert.equal(s.read(), true);
});

test('a choice storage refuses still holds for the page', () => {
    installBrowser({ refuse: true });
    const s = storedSwitch('sikhai.test.b');
    s.write(false);
    assert.equal(s.read(), false);
    installBrowser({ blocked: true });
    const blocked = storedSwitch('sikhai.test.c');
    assert.equal(blocked.read(), true, 'blocked storage reads as on');
    blocked.write(false);
    assert.equal(blocked.read(), false);
});

test('subscribers hear this tab and other tabs, for this key only', () => {
    const { localStorage, window, storage } = installBrowser();
    const s = storedSwitch('sikhai.test.d');
    let heard = 0;
    const stop = s.subscribe(() => { heard++; });
    const storageEvent = (key: string | null, storageArea: unknown = localStorage) =>
        Object.assign(new Event('storage'), { key, storageArea });
    s.write(false);
    assert.equal(heard, 1, 'a write in this tab');
    storage.delete('sikhai.test.d');
    window.dispatchEvent(storageEvent('sikhai.test.d'));
    assert.equal(heard, 2, 'another tab switched it back on');
    assert.equal(s.read(), true);
    window.dispatchEvent(storageEvent(null));
    assert.equal(heard, 3, 'another tab cleared storage');
    window.dispatchEvent(storageEvent('sikhai.test.other'));
    assert.equal(heard, 3, 'another key');
    stop();
    s.write(true);
    window.dispatchEvent(storageEvent('sikhai.test.d'));
    assert.equal(heard, 3, 'stopped');
});

test('two switches keep their own keys', () => {
    const { storage } = installBrowser();
    const live = storedSwitch('sikhai.translate.live');
    const speak = storedSwitch('sikhai.translate.speak');
    speak.write(false);
    assert.equal(live.read(), true);
    assert.equal(speak.read(), false);
    assert.deepEqual([...storage.keys()], ['sikhai.translate.speak']);
});
