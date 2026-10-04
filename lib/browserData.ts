// Everything SikhAI keeps in this browser, cleared from /privacy ("Clear this
// browser", #42): the chats kept here, translations, Learn Punjabi progress
// and the tutor conversation, settings, the theme, the language cookie, the
// Seva board's country and form drafts, the sign-in hint, and Firebase's own
// databases (the signed-in session). The one thing kept is a choice not to
// be counted (lib/analytics.ts): clearing must never turn counting back on.
//
// Two passes, because what a page holds can be written back as it goes (the
// tutor saves its conversation on pagehide, Auth notes the sign-out):
// 1. clearThisBrowser() empties both storages and the cookies, leaves a flag
//    in sessionStorage and reloads the page;
// 2. CLEAR_SCRIPT, before the next page paints, finds the flag and empties
//    them again, key by key, and deletes Firebase's databases, which nothing
//    on a page that has only just started can be holding open. <html
//    data-cleared> then lets the page say it's done.
// Other open tabs hear localStorage emptied (a storage event with no key) and
// reload through the same script, which clears what each keeps for itself:
// sessionStorage belongs to its tab (followClearElsewhere, SiteDataGuard).
//
// The pure parts are safe anywhere; the functions at the end are browser-only.

import { ANALYTICS_CHOICE_KEY, legacyAnalyticsCookieExpiries, parseAnalyticsChoice } from './analytics';
import { FIREBASE_AUTH_DB } from './firebase/hint';
import { LANG_COOKIE } from './i18n/config';

// sessionStorage: which pass 2 to run on the next page.
export const CLEAR_FLAG_KEY = 'sikhai.clear';
// 'all': this browser was cleared; 'tab': another tab cleared it.
export type ClearScope = 'all' | 'tab';

// Firebase's databases: Auth's session, and the SDK's record of which days it
// ran (for Firebase's own usage counts).
export const FIREBASE_DATABASES = [FIREBASE_AUTH_DB, 'firebase-heartbeat-database'] as const;

// What survives a clear: only a choice not to be counted.
export function keptThroughClear(analyticsChoice: string | null): [string, string][] {
    return parseAnalyticsChoice(analyticsChoice) === 'off' ? [[ANALYTICS_CHOICE_KEY, 'off']] : [];
}

// What to write to document.cookie: the language choice, and anything Google
// Analytics left from before.
export function siteCookieExpiries(cookies: string, hostname: string): string[] {
    return [`${LANG_COOKIE}=; Max-Age=0; Path=/`, ...legacyAnalyticsCookieExpiries(cookies, hostname)];
}

// Pass 2, before first paint (app/[lang]/layout.tsx, ahead of the theme and
// sign-in scripts, which then see a clean browser). Key by key, so other tabs
// hear keys removed, not storage emptied again, and don't reload again; from
// a list taken first, since removing one may reorder the rest.
export const CLEAR_SCRIPT = `(function(){try{
var s=sessionStorage,f=s.getItem('${CLEAR_FLAG_KEY}');if(f!=='all'&&f!=='tab')return;
s.clear();
if(f==='all'){var l=localStorage,k=l.getItem('${ANALYTICS_CHOICE_KEY}')==='off',ks=[];
for(var i=0;i<l.length;i++)ks.push(l.key(i));
ks.forEach(function(n){if(n!==null&&!(k&&n==='${ANALYTICS_CHOICE_KEY}'))l.removeItem(n)});
if(window.indexedDB)${JSON.stringify(FIREBASE_DATABASES)}.forEach(function(d){indexedDB.deleteDatabase(d)})}
document.documentElement.dataset.cleared=f
}catch(e){}})()`;

// ── Browser-only ─────────────────────────────────────────────────────────

function setFlag(scope: ClearScope) {
    try {
        sessionStorage.clear();
        sessionStorage.setItem(CLEAR_FLAG_KEY, scope);
    } catch { /* blocked: nothing kept there either */ }
}

// Pass 1, once whoever was signed in is signed out. Next comes /privacy's
// #removing, where the control says it's done: this page loaded again if it's
// /privacy (in the reader's language), or else that page.
export function clearThisBrowser(privacyPage = location.pathname): void {
    try {
        const kept = keptThroughClear(localStorage.getItem(ANALYTICS_CHOICE_KEY));
        localStorage.clear();
        for (const [key, value] of kept) localStorage.setItem(key, value);
    } catch { /* blocked: nothing kept there either */ }
    setFlag('all');
    try {
        for (const expiry of siteCookieExpiries(document.cookie, location.hostname)) document.cookie = expiry;
    } catch { /* cookies blocked: none were set */ }
    if (privacyPage !== location.pathname) {
        // A whole new page, not the router's soft navigation: pass 2 runs as
        // a page starts.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        location.assign(`${privacyPage}#removing`);
        return;
    }
    history.replaceState(history.state, '', `${location.pathname}${location.search}#removing`);
    location.reload();
}

// Another tab cleared this browser: this one starts again, and pass 2 clears
// what it keeps for itself.
export function followClearElsewhere(): void {
    setFlag('tab');
    location.reload();
}
