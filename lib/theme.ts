// The three appearance choices and how they are written to <html>.
//
// The constants and predicates below are environment-free and safe anywhere;
// `applyTheme` and THEME_INIT_SCRIPT, which mirrors it, touch the DOM and are
// browser-only. (app/layout.tsx, a server component, imports THEME_INIT_SCRIPT
// from here.)
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
 * `<meta name="theme-color">` values: the tint Chrome and Samsung Internet on
 * Android give their address and status bars (Safari 26 and desktop browsers
 * ignore the tag outside installed web apps). They equal `--surface` in
 * globals.css — keep the two in step — though what sits directly under the
 * chrome on every page is the sticky navy navbar, not the surface.
 */
export const THEME_COLORS = { light: '#F8FAFC', dark: '#020617' } as const;

export const isTheme = (v: unknown): v is Theme => THEMES.includes(v as Theme);
export const parseTheme = (v: unknown): Theme => (isTheme(v) ? v : DEFAULT_THEME);

/** Browser-only: does this choice paint dark right now? `system` asks the OS. */
const resolvesDark = (theme: Theme): boolean =>
    theme === 'dark' || (theme === 'system' && window.matchMedia(DARK_QUERY).matches);

// This module is the ONLY owner of the page's theme-color tag; app/layout.tsx
// deliberately emits none. Next's viewport export can only key tags to the OS,
// and when both managed one, React's hydration — which claims an existing
// <meta> by name + content, ignoring media and id — adopted the tag written
// here as one of Next's. Removing it later then crashed React's next head
// update. React never claims or deletes a node it didn't render, so a tag
// only this module writes survives navigation and refresh untouched.
function syncThemeColor(dark: boolean) {
    const color = THEME_COLORS[dark ? 'dark' : 'light'];
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.append(meta);
    }
    if (meta.content !== color) meta.content = color;
}

// Browser-only. Two attributes, two jobs: `class="dark"` drives the CSS (see
// the `dark` custom variant in globals.css), `data-theme` records which of the
// three options the user picked so the picker can show it — light-because-
// chosen and light-because-the-OS-says-so look the same to the class alone.
// The theme-color tag follows the resolved appearance, System included.
export function applyTheme(theme: Theme) {
    const root = document.documentElement;
    const dark = resolvesDark(theme);
    root.dataset.theme = theme;
    root.classList.toggle('dark', dark);
    syncThemeColor(dark);
}

// Inlined in <head> and run before first paint, so there is no flash of the
// wrong theme or chrome tint. Standalone by necessity (nothing is loaded yet),
// so it restates applyTheme: the storage key, default, allow-list, media query
// and colours are interpolated from the constants above; the theme names, the
// `dark` class and the meta name are written out, as they are in applyTheme.
// Older builds' values ('light' / 'dark' / nothing) keep their meaning, and
// anything unrecognised falls back exactly like parseTheme. data-theme is
// written before matchMedia is consulted, so it lands even if that throws.
// Wrapped in a function so none of its variables leak onto `window`.
export const THEME_INIT_SCRIPT = `(function(){try{
var d=document.documentElement,t='${DEFAULT_THEME}';
try{t=localStorage.getItem('${THEME_STORAGE_KEY}')||t}catch(e){}
if(${JSON.stringify(THEMES)}.indexOf(t)<0)t='${DEFAULT_THEME}';
d.dataset.theme=t;
var k=t==='dark'||(t==='system'&&matchMedia('${DARK_QUERY}').matches);
d.classList.toggle('dark',k);
var m=document.createElement('meta');m.name='theme-color';m.content=k?'${THEME_COLORS.dark}':'${THEME_COLORS.light}';document.head.append(m);
}catch(e){}})()`;
