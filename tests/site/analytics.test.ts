import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
    ANALYTICS_CHOICE_KEY, analyticsState, isLegacyAnalyticsCookie, legacyAnalyticsCookieExpiries, parseAnalyticsChoice,
    redactAnalyticsEvent, redactAnalyticsUrl, resolveAnalyticsState, sendsGpc, subscribeAnalyticsChoice,
    writeAnalyticsChoice,
} from '@/lib/analytics';

const SITE = 'https://sikhai.vercel.app';
const ID = 'AbCdEfGhIjKlMnOpQrSt'; // the shape of a Firestore ID

test('a share link reaches analytics without its ID, in every language', () => {
    assert.equal(redactAnalyticsUrl(`${SITE}/share/${ID}`), `${SITE}/share/:id`);
    assert.equal(redactAnalyticsUrl(`${SITE}/pa/share/${ID}`), `${SITE}/pa/share/:id`);
    assert.equal(redactAnalyticsUrl(`${SITE}/pa-latn/share/${ID}`), `${SITE}/pa-latn/share/:id`);
    // The internal English prefix is dropped, as the public address has none.
    assert.equal(redactAnalyticsUrl(`${SITE}/en/share/${ID}`), `${SITE}/share/:id`);
});

test('no spelling of a share link lets its ID through', () => {
    for (const path of [
        `/share/${ID}?utm_source=wa#top`,
        `/share/${ID}/`,
        `//share//${ID}`,
        `/share/${ID}/more`,
        `/sh%61re/${ID}`,
        `/share%2F${ID}`,
        `/SHARE/${ID}`,
    ]) {
        assert.equal(redactAnalyticsUrl(`${SITE}${path}`), `${SITE}/share/:id`, path);
    }
    // A mistyped or unknown address never reaches the site's analytics (it's
    // a 404, a page of its own), but an ID in it still wouldn't get out.
    assert.equal(redactAnalyticsUrl(`${SITE}/PA/share/${ID}`), `${SITE}/PA/share/:id`);
    assert.equal(redactAnalyticsUrl(`${SITE}/pa/x/Share/${ID}/y`), `${SITE}/pa/x/share/:id`);
});

test('no random share ID survives, whatever surrounds it', () => {
    for (let i = 0; i < 200; i++) {
        const id = randomBytes(15).toString('base64url');
        for (const prefix of ['', '/pa', '/pa-latn', '/en', '/PA', '/x']) {
            for (const tail of ['', '/', '?x=1', '#y', '/z']) {
                const out = redactAnalyticsUrl(`${SITE}${prefix}/share/${id}${tail}`);
                assert.ok(out && !out.includes(id), `${prefix}/share/${id}${tail} → ${out}`);
            }
        }
    }
});

test('the chats count as one page, and no query or fragment is sent', () => {
    assert.equal(redactAnalyticsUrl(`${SITE}/chat/0b6f1c9e-8d2a-4f53-9a57-4c3b2e1d0f9a`), `${SITE}/chat/:id`);
    assert.equal(redactAnalyticsUrl(`${SITE}/pa/chat/legacy-abc12345?context=hukamnama`), `${SITE}/pa/chat/:id`);
    assert.equal(redactAnalyticsUrl(`${SITE}/chat?context=hukamnama&ang=12`), `${SITE}/chat`);
    assert.equal(redactAnalyticsUrl(`${SITE}/shabad?ang=12`), `${SITE}/shabad`);
    assert.equal(redactAnalyticsUrl(`${SITE}/shabad/1430#l3`), `${SITE}/shabad/1430`);
});

test('other pages keep their address', () => {
    assert.equal(redactAnalyticsUrl(`${SITE}/`), `${SITE}/`);
    assert.equal(redactAnalyticsUrl(`${SITE}/pa`), `${SITE}/pa`);
    assert.equal(redactAnalyticsUrl(`${SITE}/pa/`), `${SITE}/pa`);
    assert.equal(redactAnalyticsUrl(`${SITE}/about/`), `${SITE}/about`);
    assert.equal(redactAnalyticsUrl(`${SITE}/pa-latn/learn/script/1`), `${SITE}/pa-latn/learn/script/1`);
    // Only a whole segment names an ID page, and only as the page itself.
    assert.equal(redactAnalyticsUrl(`${SITE}/paath`), `${SITE}/paath`);
    assert.equal(redactAnalyticsUrl(`${SITE}/sharing/x`), `${SITE}/sharing/x`);
    // Credentials never leave; the origin, port included, stays.
    assert.equal(redactAnalyticsUrl(`https://u:p@sikhai.vercel.app/share/${ID}`), `${SITE}/share/:id`);
    assert.equal(redactAnalyticsUrl(`http://localhost:3000/pa/about?x=1`), 'http://localhost:3000/pa/about');
});

test("an address that can't be read isn't sent", () => {
    assert.equal(redactAnalyticsUrl('not a url'), null);
    assert.equal(redactAnalyticsUrl('about:blank'), null);
    assert.equal(redactAnalyticsUrl(`${SITE}/share/%E0%A4`), null, 'a malformed escape');
});

test('an event is dropped unless counting is on, and otherwise only its address changes', () => {
    const view = { type: 'pageview' as const, url: `${SITE}/pa/share/${ID}?x=1` };
    const vital = { type: 'vital' as const, url: `${SITE}/share/${ID}`, route: '/[lang]/share/[shareId]' };
    assert.equal(redactAnalyticsEvent(view, false), null);
    assert.equal(redactAnalyticsEvent(vital, false), null);
    assert.deepEqual(redactAnalyticsEvent(view, true), { type: 'pageview', url: `${SITE}/pa/share/:id` });
    assert.deepEqual(redactAnalyticsEvent(vital, true), { ...vital, url: `${SITE}/share/:id` });
    assert.equal(view.url, `${SITE}/pa/share/${ID}?x=1`, 'the original event is left alone');
    assert.equal(redactAnalyticsEvent({ url: 'about:blank' }, true), null);
});

test('counting is on by default, off when switched off, and Global Privacy Control always wins', () => {
    assert.equal(resolveAnalyticsState(null, false), 'on');
    assert.equal(resolveAnalyticsState('on', false), 'on');
    assert.equal(resolveAnalyticsState('off', false), 'off');
    assert.equal(resolveAnalyticsState(null, true), 'gpc');
    assert.equal(resolveAnalyticsState('on', true), 'gpc');
    assert.equal(resolveAnalyticsState('off', true), 'gpc');

    assert.equal(sendsGpc({ globalPrivacyControl: true }), true);
    for (const nav of [{ globalPrivacyControl: false }, { globalPrivacyControl: 'true' }, {}, null, undefined])
        assert.equal(sendsGpc(nav), false, JSON.stringify(nav));

    assert.equal(parseAnalyticsChoice('on'), 'on');
    assert.equal(parseAnalyticsChoice('off'), 'off');
    for (const v of [null, '', 'OFF', 'false', 0, undefined]) assert.equal(parseAnalyticsChoice(v), null);
});

test("Google Analytics' leftover cookies are expired, on the host and on its domain, and nothing else is", () => {
    for (const name of ['_ga', '_ga_9WWKK5Z5GD', '_gid', '_gat', '_gat_gtag_UA_1_1'])
        assert.equal(isLegacyAnalyticsCookie(name), true, name);
    for (const name of ['sikhai.lang', 'theme', 'ga', '__ga', '_gax', '_galaxy', '_gidx', '_ga-x', ''])
        assert.equal(isLegacyAnalyticsCookie(name), false, name);

    const cookies = 'sikhai.lang=pa; _ga=GA1.1.1.2; _ga_9WWKK5Z5GD=GS2.1.s1; _gid=GA1.1.3.4';
    assert.deepEqual(legacyAnalyticsCookieExpiries(cookies, 'sikhai.vercel.app'), [
        '_ga=; Max-Age=0; Path=/',
        '_ga=; Max-Age=0; Path=/; Domain=sikhai.vercel.app',
        '_ga_9WWKK5Z5GD=; Max-Age=0; Path=/',
        '_ga_9WWKK5Z5GD=; Max-Age=0; Path=/; Domain=sikhai.vercel.app',
        '_gid=; Max-Age=0; Path=/',
        '_gid=; Max-Age=0; Path=/; Domain=sikhai.vercel.app',
    ]);
    assert.deepEqual(legacyAnalyticsCookieExpiries('', 'sikhai.vercel.app'), []);
    assert.deepEqual(legacyAnalyticsCookieExpiries('sikhai.lang=pa', 'sikhai.vercel.app'), []);
    // The same cookie twice (host-only and on the domain) is expired once each way.
    assert.equal(legacyAnalyticsCookieExpiries('_ga=1; _ga=2', 'sikhai.vercel.app').length, 2);
});

// The browser-only store, on fakes: this file runs in its own process.
function installBrowser({ gpc = false, storage = new Map<string, string>(), refuse = false } = {}) {
    const localStorage = {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => {
            if (refuse) throw new Error('QuotaExceededError');
            storage.set(k, v);
        },
    };
    const window = new EventTarget();
    for (const [name, value] of Object.entries({ localStorage, window, navigator: { globalPrivacyControl: gpc } }))
        Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    return { localStorage, window, storage };
}

test('the switch is kept in storage, and a choice storage refuses still holds for the page', () => {
    const { storage } = installBrowser();
    assert.equal(analyticsState(), 'on');
    writeAnalyticsChoice('off');
    assert.equal(storage.get(ANALYTICS_CHOICE_KEY), 'off');
    assert.equal(analyticsState(), 'off');

    installBrowser({ refuse: true });
    writeAnalyticsChoice('off');
    assert.equal(analyticsState(), 'off', 'refused, but held until the page is left');
    installBrowser();
    writeAnalyticsChoice('on'); // stored again: the held choice gives way
    assert.equal(analyticsState(), 'on');

    installBrowser({ gpc: true });
    assert.equal(analyticsState(), 'gpc');
});

test('subscribers hear this tab, other tabs and a return from the back-forward cache', () => {
    const { localStorage, window } = installBrowser();
    let heard = 0;
    const stop = subscribeAnalyticsChoice(() => { heard++; });
    const storageEvent = (key: string | null, storageArea: unknown = localStorage) =>
        Object.assign(new Event('storage'), { key, storageArea });

    writeAnalyticsChoice('off');
    assert.equal(heard, 1, 'a write in this tab');
    window.dispatchEvent(storageEvent(ANALYTICS_CHOICE_KEY));
    window.dispatchEvent(storageEvent(null));
    assert.equal(heard, 3, 'another tab wrote, or cleared storage');
    window.dispatchEvent(storageEvent('theme'));
    window.dispatchEvent(storageEvent(ANALYTICS_CHOICE_KEY, { sessionStorage: true }));
    assert.equal(heard, 3, 'another key, or another storage area');
    window.dispatchEvent(new Event('pageshow'));
    assert.equal(heard, 4, 'back from the back-forward cache');

    stop();
    writeAnalyticsChoice('on');
    window.dispatchEvent(storageEvent(ANALYTICS_CHOICE_KEY));
    assert.equal(heard, 4, 'nothing after stopping');
});
