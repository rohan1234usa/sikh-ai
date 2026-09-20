// Client-safe theme configuration: the three appearance choices and how they
// are written to <html>. Mirrors lib/i18n/config.ts, with one difference —
// the theme lives in localStorage rather than a cookie, because unlike the
// language it never changes server-rendered markup.

export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

/** No stored choice means "follow the OS" — how the site behaved before. */
export const DEFAULT_THEME: Theme = 'system';

export const THEME_STORAGE_KEY = 'theme';

export const DARK_QUERY = '(prefers-color-scheme: dark)';

export const isTheme = (v: unknown): v is Theme => THEMES.includes(v as Theme);
export const parseTheme = (v: unknown): Theme => (isTheme(v) ? v : DEFAULT_THEME);

/** Does this choice paint dark right now? `system` defers to the OS. */
export const resolvesDark = (theme: Theme): boolean =>
    theme === 'dark' || (theme === 'system' && window.matchMedia(DARK_QUERY).matches);

// Two attributes, two jobs: `class="dark"` drives the CSS (see the `dark`
// custom variant in globals.css), `data-theme` records which of the three
// options the user picked so the picker can show it — light-because-chosen
// and light-because-the-OS-says-so look the same to the class alone.
export function applyTheme(theme: Theme) {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle('dark', resolvesDark(theme));
}

// Inlined in <head> and run before first paint, so there is no flash of the
// wrong theme. Standalone by necessity (nothing is loaded yet), so it repeats
// applyTheme's logic — keep the two in step. Values written by older builds
// ('light' / 'dark' / nothing at all) still mean what they used to.
export const THEME_INIT_SCRIPT = `try{
var d=document.documentElement,t='${DEFAULT_THEME}';
try{t=localStorage.getItem('${THEME_STORAGE_KEY}')||t}catch(e){}
if(t!=='light'&&t!=='dark')t='${DEFAULT_THEME}';
d.dataset.theme=t;
d.classList.toggle('dark',t==='dark'||(t==='system'&&matchMedia('${DARK_QUERY}').matches));
}catch(e){}`;
