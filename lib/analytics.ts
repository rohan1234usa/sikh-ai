// Who is counted, and what a counted address may say (#19). Vercel Web
// Analytics counts visits and Speed Insights measures page speed
// (app/components/SiteAnalytics.tsx); both pass every event through
// analyticsBeforeSend below, which drops it for a visitor who switched
// counting off (on /privacy) or whose browser sends Global Privacy Control,
// and otherwise strips the address down to the page.
//
// The rules are pure and safe anywhere; the store below them is browser-only.
// Neither tool sets a cookie unless the site calls window.va('enableCookie'),
// which it never does: /privacy says the site sets one cookie, the language.

import { DEFAULT_LANG, isLang, type Lang } from './i18n/config';
import { localePath } from './i18n/paths';
import { onStorageKey } from './storage';

// localStorage: 'off' when the visitor switched counting off, 'on' when they
// switched it back. Absent means on.
export const ANALYTICS_CHOICE_KEY = 'sikhai.analytics.v1';
export type AnalyticsChoice = 'on' | 'off';
// What applies: the visitor's choice, or 'gpc' when their browser asks every
// site not to track them, which no choice here overrides.
export type AnalyticsState = AnalyticsChoice | 'gpc';

export const parseAnalyticsChoice = (v: unknown): AnalyticsChoice | null => (v === 'on' || v === 'off' ? v : null);

// Global Privacy Control, as browsers expose it. Not in TypeScript's DOM
// types yet, so it's read through unknown; only a literal true counts.
export const sendsGpc = (nav: unknown): boolean =>
    (nav as { globalPrivacyControl?: unknown } | null | undefined)?.globalPrivacyControl === true;

export const resolveAnalyticsState = (choice: AnalyticsChoice | null, gpc: boolean): AnalyticsState =>
    gpc ? 'gpc' : (choice ?? 'on');

// A page segment followed by an ID. A share link's ID is the only key to a
// shared chat, so it must never leave the site; a chat's ID isn't secret,
// but without it the chats count as one page. A new page whose address
// carries an ID or a secret belongs here. Matched anywhere in the path and
// in any case, so a mistyped address can't carry an ID out either.
const ID_PAGES = new Set(['share', 'chat']);
export const ID_PLACEHOLDER = ':id';

// This site's address as analytics may record it: the language prefix kept
// (the internal /en dropped), an ID and anything after it replaced, and no
// query, fragment or credentials. The path is decoded before it's read, so
// an escaped letter or slash can't hide an ID. null when the address can't
// be read with certainty, which means: don't send.
export function redactAnalyticsUrl(url: string): string | null {
    try {
        const { origin, pathname } = new URL(url);
        const segments = decodeURIComponent(pathname).split('/').filter(Boolean);
        const lang: Lang = isLang(segments[0]) ? (segments.shift() as Lang) : DEFAULT_LANG;
        const at = segments.findIndex((s) => ID_PAGES.has(s.toLowerCase()));
        const kept = at < 0
            ? segments
            : [...segments.slice(0, at), segments[at].toLowerCase(), ...(at + 1 < segments.length ? [ID_PLACEHOLDER] : [])];
        const out = new URL(origin); // throws for an opaque origin (about:, data:)
        out.pathname = localePath(lang, `/${kept.join('/')}`);
        return out.href;
    } catch {
        return null;
    }
}

// An event as it may leave the page: dropped unless counting is on, and
// otherwise with its address redacted. Everything else it carries is kept.
export function redactAnalyticsEvent<E extends { url: string }>(event: E, counted: boolean): E | null {
    if (!counted) return null;
    const url = redactAnalyticsUrl(event.url);
    return url === null ? null : { ...event, url };
}

// Google Analytics' own cookies, which it left in returning visitors'
// browsers when the site stopped using it: _ga, _ga_<property>, _gid, and
// _gat or _gat_<id>. They last two years from the visit that last refreshed
// them, so this, and its caller in SiteAnalytics, can go after October 2028.
export const isLegacyAnalyticsCookie = (name: string): boolean => /^_(ga|gid|gat)(_.+)?$/.test(name);

// What to write to document.cookie to expire them: each both as a host-only
// cookie and on this host's domain, where GA's automatic cookie domain put
// it (vercel.app is a public suffix, so that's the site's own hostname).
export function legacyAnalyticsCookieExpiries(cookies: string, hostname: string): string[] {
    const names = new Set(cookies.split(';').map((c) => c.split('=')[0].trim()).filter(isLegacyAnalyticsCookie));
    return [...names].flatMap((name) => [
        `${name}=; Max-Age=0; Path=/`,
        `${name}=; Max-Age=0; Path=/; Domain=${hostname}`,
    ]);
}

// ── Browser-only ─────────────────────────────────────────────────────────

// A choice that storage refused (blocked or full): it holds until the page
// is left, as the theme picker's does.
let unsaved: AnalyticsChoice | null = null;
// This tab's subscribers: a write here fires no storage event here.
const listeners = new Set<() => void>();

function readChoice(): AnalyticsChoice | null {
    if (unsaved) return unsaved;
    try { return parseAnalyticsChoice(localStorage.getItem(ANALYTICS_CHOICE_KEY)); } catch { return null; }
}

export function analyticsState(): AnalyticsState {
    return resolveAnalyticsState(readChoice(), typeof navigator !== 'undefined' && sendsGpc(navigator));
}

export function writeAnalyticsChoice(choice: AnalyticsChoice) {
    try {
        localStorage.setItem(ANALYTICS_CHOICE_KEY, choice);
        unsaved = null;
    } catch {
        unsaved = choice;
    }
    for (const notify of listeners) notify();
}

// Calls onChange whenever the choice may have changed: a write in this tab, a
// write or a clear in another (lib/storage.ts, as the theme follows its own),
// and a page restored from the back-forward cache, which heard nothing while
// it was frozen. Returns a function that stops it.
export function subscribeAnalyticsChoice(onChange: () => void): () => void {
    listeners.add(onChange);
    const stopFollowing = onStorageKey(ANALYTICS_CHOICE_KEY, onChange);
    window.addEventListener('pageshow', onChange);
    return () => {
        listeners.delete(onChange);
        stopFollowing();
        window.removeEventListener('pageshow', onChange);
    };
}

// Both tools' beforeSend. It reads the choice for every event, so switching
// counting off mid-visit holds from the next event on.
export const analyticsBeforeSend = <E extends { url: string }>(event: E): E | null =>
    redactAnalyticsEvent(event, analyticsState() === 'on');
