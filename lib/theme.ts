// The three appearance choices and how they are written to <html>.
//
// The constants and predicates below are environment-free and safe anywhere;
// `applyTheme` and the script it mirrors touch the DOM and are browser-only.
// (app/layout.tsx, a server component, imports THEME_INIT_SCRIPT from here.)
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

export const isTheme = (v: unknown): v is Theme => THEMES.includes(v as Theme);
export const parseTheme = (v: unknown): Theme => (isTheme(v) ? v : DEFAULT_THEME);

/** Browser-only: does this choice paint dark right now? `system` asks the OS. */
const resolvesDark = (theme: Theme): boolean =>
    theme === 'dark' || (theme === 'system' && window.matchMedia(DARK_QUERY).matches);

// Browser-only. Two attributes, two jobs: `class="dark"` drives the CSS (see
// the `dark` custom variant in globals.css), `data-theme` records which of the
// three options the user picked so the picker can show it — light-because-
// chosen and light-because-the-OS-says-so look the same to the class alone.
export function applyTheme(theme: Theme) {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle('dark', resolvesDark(theme));
}

// Inlined in <head> and run before first paint, so there is no flash of the
// wrong theme. Standalone by necessity (nothing is loaded yet), so it repeats
// applyTheme's logic — every value it depends on is interpolated from the
// constants above rather than restated, so the two cannot drift. Values
// written by older builds ('light' / 'dark' / nothing) still mean what they
// used to, and anything unrecognised falls back exactly like parseTheme.
export const THEME_INIT_SCRIPT = `try{
var d=document.documentElement,t='${DEFAULT_THEME}';
try{t=localStorage.getItem('${THEME_STORAGE_KEY}')||t}catch(e){}
if(${JSON.stringify(THEMES)}.indexOf(t)<0)t='${DEFAULT_THEME}';
d.dataset.theme=t;
d.classList.toggle('dark',t==='dark'||(t==='system'&&matchMedia('${DARK_QUERY}').matches));
}catch(e){}`;
