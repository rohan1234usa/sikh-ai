// The three appearance choices and how they are written to <html>.
//
// The constants and predicates below are environment-free and safe anywhere.
// `applyTheme`, `setTheme` and `watchTheme` touch the DOM and are browser-only;
// so is THEME_INIT_SCRIPT once it runs — the server layout only inlines it.
//
// Unlike the language — see lib/i18n/config.ts — the choice lives in
// localStorage rather than a cookie, so the server cannot know it and the
// pre-paint script below exists to apply it before the first frame.

export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

/** No stored choice means "follow the OS" — how the site behaved before. */
export const DEFAULT_THEME: Theme = 'system';

// Deliberately NOT namespaced like the repo's other persisted keys
// (sikhai.chat.v2, sikhai.translate.history.v1, the sikhai.lang cookie):
// earlier builds wrote a bare `theme`, and renaming it would silently reset
// the saved choice for every existing visitor. Migrate before you rename.
export const THEME_STORAGE_KEY = 'theme';

export const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * `<meta name="theme-color">` values, which tint the browser's own bars where
 * it honours the tag — Chrome and Samsung Internet on Android, Safari 15–18,
 * and installed web apps; Safari 26 and desktop Chrome ignore it in ordinary
 * tabs. They equal `--surface` in globals.css (keep the two in step), though
 * what sits directly under the bars on every page is the sticky navy navbar.
 */
export const THEME_COLORS = { light: '#F8FAFC', dark: '#020617' } as const;

export const isTheme = (v: unknown): v is Theme => THEMES.includes(v as Theme);
export const parseTheme = (v: unknown): Theme => (isTheme(v) ? v : DEFAULT_THEME);

/** Browser-only: does this choice paint dark right now? `system` asks the OS. */
const resolvesDark = (theme: Theme): boolean =>
    theme === 'dark' || (theme === 'system' && window.matchMedia(DARK_QUERY).matches);

/** Browser-only: the stored choice, or the default if none or unreadable. */
function readStoredTheme(): Theme {
    try { return parseTheme(localStorage.getItem(THEME_STORAGE_KEY)); } catch { return DEFAULT_THEME; }
}

// The page's one theme-color tag, written only by this module and the
// pre-paint script; app/layout.tsx must not emit `viewport.themeColor`. React
// hydrates a <meta> by claiming any existing one with the same name + content,
// so a Next-rendered tag beside this one would be mistaken for it — the crash
// fixed in #2. Found by its own id, so no other theme-color tag takes the
// updates. React can still delete it (a failed hydration makes React rebuild
// the page and clear <head>); watchTheme puts it back.
const THEME_COLOR_ID = 'theme-color';

function syncThemeColor(dark: boolean) {
    const found = document.getElementById(THEME_COLOR_ID);
    let meta = found instanceof HTMLMetaElement ? found : null;
    if (!meta) {
        meta = document.createElement('meta');
        meta.id = THEME_COLOR_ID;
        meta.name = 'theme-color';
        document.head.append(meta);
    }
    meta.content = THEME_COLORS[dark ? 'dark' : 'light'];
}

// Browser-only. Two attributes, two jobs: `class="dark"` drives the CSS (see
// the `dark` custom variant in globals.css), `data-theme` records which of the
// three options the user picked so the picker can show it — light-because-
// chosen and light-because-the-OS-says-so look the same to the class alone.
// data-theme goes first, as in the pre-paint script, so it lands even if
// matchMedia throws. The theme-color tag follows the resolved appearance.
export function applyTheme(theme: Theme) {
    const root = document.documentElement;
    root.dataset.theme = theme;
    const dark = resolvesDark(theme);
    root.classList.toggle('dark', dark);
    syncThemeColor(dark);
}

/** Browser-only: apply a pick and remember it. */
export function setTheme(next: Theme) {
    applyTheme(next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* storage blocked — holds for this page */ }
}

/**
 * Browser-only: keep the page on the stored choice for its whole life. Starts
 * by re-applying it, because between the pre-paint script and whenever this
 * runs another tab may have picked, the OS may have flipped under System, or a
 * failed hydration may have made React rebuild the page and wipe <html>'s
 * attributes and the theme-color tag. Then follows the OS (under System) and
 * other tabs. Returns a function that stops it.
 */
export function watchTheme(): () => void {
    applyTheme(readStoredTheme());

    const query = window.matchMedia(DARK_QUERY);
    const onOsChange = () => {
        if (parseTheme(document.documentElement.dataset.theme) === 'system') applyTheme('system');
    };
    // Fires only in the tabs that didn't write, and for sessionStorage too —
    // hence the storageArea check. Storage is re-read rather than trusting
    // e.newValue, which two tabs picking at once can leave out of date. A null
    // key means storage was cleared, which reads as the default.
    const onStorage = (e: StorageEvent) => {
        try { if (e.storageArea !== localStorage) return; } catch { return; }
        if (e.key === null || e.key === THEME_STORAGE_KEY) applyTheme(readStoredTheme());
    };
    query.addEventListener('change', onOsChange);
    window.addEventListener('storage', onStorage);
    return () => {
        query.removeEventListener('change', onOsChange);
        window.removeEventListener('storage', onStorage);
    };
}

// Inlined in <head> and run before first paint, so there is no flash of the
// wrong theme or tint. Standalone by necessity (nothing is loaded yet), so it
// restates applyTheme: the storage key, default, allow-list, media query, tag
// id and colours are interpolated from the constants above; the theme names,
// the `dark` class and the meta name are written out, as they are in
// applyTheme. Older builds' values ('light' / 'dark' / nothing) keep their
// meaning, and anything unrecognised falls back exactly like parseTheme.
// data-theme is written before matchMedia is consulted, so it lands even if
// that throws. Wrapped in a function so none of its variables leak onto window.
export const THEME_INIT_SCRIPT = `(function(){try{
var d=document.documentElement,t='${DEFAULT_THEME}';
try{t=localStorage.getItem('${THEME_STORAGE_KEY}')||t}catch(e){}
if(${JSON.stringify(THEMES)}.indexOf(t)<0)t='${DEFAULT_THEME}';
d.dataset.theme=t;
var k=t==='dark'||(t==='system'&&matchMedia('${DARK_QUERY}').matches);
d.classList.toggle('dark',k);
var m=document.createElement('meta');m.id='${THEME_COLOR_ID}';m.name='theme-color';m.content=k?'${THEME_COLORS.dark}':'${THEME_COLORS.light}';document.head.append(m);
}catch(e){}})()`;
