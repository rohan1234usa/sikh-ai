import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANALYTICS_CHOICE_KEY } from '@/lib/analytics';
import {
    CLEAR_FLAG_KEY,
    CLEAR_SCRIPT,
    FIREBASE_DATABASES,
    clearThisBrowser,
    followClearElsewhere,
    keptThroughClear,
    siteCookieExpiries,
} from '@/lib/browserData';
import { onStorageCleared } from '@/lib/storage';
import { sourceFiles } from '../helpers/clientImports';

class FakeStorage {
    readonly map: Map<string, string>;
    constructor(entries: Record<string, string> = {}) {
        this.map = new Map(Object.entries(entries));
    }
    get length() { return this.map.size; }
    key(i: number) { return [...this.map.keys()][i] ?? null; }
    getItem(k: string) { return this.map.get(k) ?? null; }
    setItem(k: string, v: string) { this.map.set(k, v); }
    removeItem(k: string) { this.map.delete(k); }
    clear() { this.map.clear(); }
    toJSON() { return Object.fromEntries(this.map); }
}

// Emptied at once, localStorage tells every other tab to reload again; the
// pre-paint pass removes keys one at a time instead.
class NoClear extends FakeStorage {
    clear() { throw new Error('emptied at once'); }
}

// The pre-paint pass, as the page runs it, on fakes.
function prePaint(session: FakeStorage, local: FakeStorage) {
    const deleted: string[] = [];
    const indexedDB = { deleteDatabase: (name: string) => { deleted.push(name); } };
    const html = { dataset: {} as Record<string, string> };
    new Function('sessionStorage', 'localStorage', 'window', 'indexedDB', 'document', CLEAR_SCRIPT)(
        session, local, { indexedDB }, indexedDB, { documentElement: html });
    return { deleted, cleared: html.dataset.cleared };
}

const LOCAL = {
    'sikhai.chats.v3.index': '{}',
    'sikhai.translate.history.v1': '{}',
    'sikhai.learn.progress.v1': '{}',
    'sikhai.auth': '0',
    theme: 'dark',
};

test('a page loaded for no reason of this kind is left alone', () => {
    const session = new FakeStorage({ 'sikhai.learn.tutor.v1': '[]' });
    const local = new FakeStorage(LOCAL);
    assert.deepEqual(prePaint(session, local), { deleted: [], cleared: undefined });
    assert.equal(session.length, 1);
    assert.equal(local.length, Object.keys(LOCAL).length);
});

test('after a clear here, the page empties both storages again, all but a choice not to be counted, and Firebase\'s databases', () => {
    for (const choice of ['off', 'on', null]) {
        const session = new FakeStorage({ [CLEAR_FLAG_KEY]: 'all', 'sikhai.learn.tutor.v1': '[]' });
        const local = new NoClear({ ...LOCAL, ...(choice ? { [ANALYTICS_CHOICE_KEY]: choice } : {}) });
        assert.deepEqual(prePaint(session, local), { deleted: [...FIREBASE_DATABASES], cleared: 'all' });
        assert.equal(session.length, 0);
        assert.deepEqual(local.toJSON(), choice === 'off' ? { [ANALYTICS_CHOICE_KEY]: 'off' } : {}, String(choice));
    }
});

test('after a clear in another tab, the page empties only what this tab keeps for itself', () => {
    const session = new FakeStorage({ [CLEAR_FLAG_KEY]: 'tab', 'sikhai.learn.tutor.v1': '[]' });
    const local = new FakeStorage(LOCAL);
    assert.deepEqual(prePaint(session, local), { deleted: [], cleared: 'tab' });
    assert.equal(session.length, 0);
    assert.equal(local.length, Object.keys(LOCAL).length);
});

test('the page removes every key, even where removing one reorders the rest', () => {
    // Storage whose order, as the spec allows once the count changes, is
    // reshuffled by every removal.
    class Reordering extends FakeStorage {
        removeItem(k: string) {
            super.removeItem(k);
            const entries = [...this.map].reverse();
            this.map.clear();
            for (const [key, value] of entries) this.map.set(key, value);
        }
    }
    // Walked from the end, the kept choice and a reorder hide `a` for good.
    const local = new Reordering({ a: '1', b: '2', [ANALYTICS_CHOICE_KEY]: 'off' });
    prePaint(new FakeStorage({ [CLEAR_FLAG_KEY]: 'all' }), local);
    assert.deepEqual(local.toJSON(), { [ANALYTICS_CHOICE_KEY]: 'off' });
});

test('storage that throws leaves the page alone', () => {
    const blocked = { getItem: () => { throw new Error('SecurityError'); } };
    assert.doesNotThrow(() => new Function('sessionStorage', 'localStorage', 'window', 'indexedDB', 'document', CLEAR_SCRIPT)(
        blocked, blocked, {}, undefined, { documentElement: { dataset: {} } }));
});

test('only a choice not to be counted outlives a clear', () => {
    assert.deepEqual(keptThroughClear('off'), [[ANALYTICS_CHOICE_KEY, 'off']]);
    for (const v of ['on', null, 'OFF', '']) assert.deepEqual(keptThroughClear(v), [], String(v));
});

test('the language cookie goes, and anything Google Analytics left', () => {
    assert.deepEqual(siteCookieExpiries('sikhai.lang=pa', 'sikhai.vercel.app'), ['sikhai.lang=; Max-Age=0; Path=/']);
    assert.deepEqual(siteCookieExpiries('_ga=1; sikhai.lang=pa', 'sikhai.vercel.app'), [
        'sikhai.lang=; Max-Age=0; Path=/',
        '_ga=; Max-Age=0; Path=/',
        '_ga=; Max-Age=0; Path=/; Domain=sikhai.vercel.app',
    ]);
});

// The browser-only half, on fakes: this file runs in its own process.
function installBrowser(local: FakeStorage, session: FakeStorage) {
    const cookies: string[] = [];
    const calls: string[] = [];
    const globals = {
        localStorage: local,
        sessionStorage: session,
        window: new EventTarget(),
        document: {
            get cookie() { return '_gid=1; sikhai.lang=pa'; },
            set cookie(v: string) { cookies.push(v); },
        },
        location: {
            hostname: 'sikhai.vercel.app', pathname: '/privacy', search: '',
            reload: () => calls.push('reload'),
            assign: (url: string) => calls.push(`assign ${url}`),
        },
        history: { state: { kept: true }, replaceState: (state: unknown, _: string, url: string) => calls.push(`replace ${url} ${JSON.stringify(state)}`) },
    };
    for (const [name, value] of Object.entries(globals))
        Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    return { cookies, calls, window: globals.window };
}

test('clearing here empties the browser but for that choice, leaves the flag for the next page, and loads it again at #removing', () => {
    const local = new FakeStorage({ ...LOCAL, [ANALYTICS_CHOICE_KEY]: 'off' });
    const session = new FakeStorage({ 'sikhai.seva.draft.v1:/seva/create': '{}' });
    const { cookies, calls } = installBrowser(local, session);
    clearThisBrowser();
    assert.deepEqual(local.toJSON(), { [ANALYTICS_CHOICE_KEY]: 'off' });
    assert.deepEqual(session.toJSON(), { [CLEAR_FLAG_KEY]: 'all' });
    assert.ok(cookies.includes('sikhai.lang=; Max-Age=0; Path=/'));
    assert.ok(cookies.includes('_gid=; Max-Age=0; Path=/'));
    assert.deepEqual(calls, ['replace /privacy#removing {"kept":true}', 'reload']);
});

test('clearing from another page (the Delete account dialog) goes to the privacy page to say so', () => {
    const { calls } = installBrowser(new FakeStorage(LOCAL), new FakeStorage());
    clearThisBrowser('/pa/privacy');
    assert.deepEqual(calls, ['assign /pa/privacy#removing']);
});

test('another tab clearing the browser makes this one start again, with its own storage emptied', () => {
    const local = new FakeStorage(LOCAL);
    const session = new FakeStorage({ 'sikhai.learn.tutor.v1': '[]' });
    const { calls, window } = installBrowser(local, session);
    let heard = 0;
    const stop = onStorageCleared(() => heard++);
    const storageEvent = (key: string | null, area: unknown) => Object.assign(new Event('storage'), { key, storageArea: area });
    window.dispatchEvent(storageEvent('theme', local));
    window.dispatchEvent(storageEvent(null, session)); // another tab's sessionStorage: not ours
    window.dispatchEvent(storageEvent(null, local));
    assert.equal(heard, 1, 'only localStorage emptied at once');
    stop();
    window.dispatchEvent(storageEvent(null, local));
    assert.equal(heard, 1);

    followClearElsewhere();
    assert.deepEqual(session.toJSON(), { [CLEAR_FLAG_KEY]: 'tab' });
    assert.equal(local.length, Object.keys(LOCAL).length, "the other tab's clear already took care of it");
    assert.deepEqual(calls, ['reload']);
});

test('nothing else empties localStorage at once, which every other tab would take for a clear', () => {
    const emptying = sourceFiles().filter((f) => /\blocalStorage\.clear\(/.test(readFileSync(f, 'utf8')));
    assert.deepEqual(emptying, [join('lib', 'browserData.ts')]);
});
