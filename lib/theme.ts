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

/**
 * Browser-chrome colours (the mobile address bar and status bar). They are the
 * `--surface` values in globals.css, so the chrome meets the page seamlessly;
 * change one and change the other.
 */
export const THEME_COLORS = { light: '#F8FAFC', dark: '#020617' } as const;

export const isTheme = (v: unknown): v is Theme => THEMES.includes(v as Theme);
export const parseTheme = (v: unknown): Theme => (isTheme(v) ? v : DEFAULT_THEME);

/** Browser-only: does this choice paint dark right now? `system` asks the OS. */
const resolvesDark = (theme: Theme): boolean =>
    theme === 'dark' || (theme === 'system' && window.matchMedia(DARK_QUERY).matches);

// The `viewport.themeColor` pair in app/layout.tsx is keyed to the OS
// preference, which is exactly right under `system` — the browser follows OS
// changes natively, with no script — and wrong for an explicit pick. So an
// explicit pick adds one more tag with no `media` (it always matches), placed
// AHEAD of that pair: the browser honours the first matching tag in document
// order, and the pair is already in <head> by the time this runs. Returning
// to `system` removes it, and the pair takes over again.
const THEME_COLOR_OVERRIDE_ID = 'theme-color-override';

function syncThemeColor(theme: Theme, dark: boolean) {
    let meta = document.getElementById(THEME_COLOR_OVERRIDE_ID) as HTMLMetaElement | null;
    if (theme === 'system') {
        meta?.remove();
        return;
    }
    if (!meta) {
        meta = document.createElement('meta');
        meta.id = THEME_COLOR_OVERRIDE_ID;
        meta.name = 'theme-color';
    }
    meta.content = dark ? THEME_COLORS.dark : THEME_COLORS.light;
    const first = document.querySelector('meta[name="theme-color"]');
    if (first !== meta) document.head.insertBefore(meta, first);
}

/**
 * Browser-only: keep the override in place for the life of the page. React
 * owns <head>, and re-rendering it — a language switch runs router.refresh() —
 * drops nodes React didn't render, including the one the pre-paint script
 * inserts. So re-sync whenever <head>'s children change. syncThemeColor makes
 * no structural change once the tag is present and first, so this settles
 * after a single pass instead of feeding back on itself.
 */
export function keepThemeColor(): () => void {
    const sync = () => {
        const theme = parseTheme(document.documentElement.dataset.theme);
        syncThemeColor(theme, resolvesDark(theme));
    };
    sync(); // in case it was already dropped before this started watching
    const observer = new MutationObserver(sync);
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
}

// Browser-only. Two attributes, two jobs: `class="dark"` drives the CSS (see
// the `dark` custom variant in globals.css), `data-theme` records which of the
// three options the user picked so the picker can show it — light-because-
// chosen and light-because-the-OS-says-so look the same to the class alone.
// The browser chrome follows along via syncThemeColor.
export function applyTheme(theme: Theme) {
    const root = document.documentElement;
    const dark = resolvesDark(theme);
    root.dataset.theme = theme;
    root.classList.toggle('dark', dark);
    syncThemeColor(theme, dark);
}

// Inlined in <head> and run before first paint, so there is no flash of the
// wrong theme — or, on mobile, of the wrong browser chrome. Standalone by
// necessity (nothing is loaded yet), so it repeats applyTheme's logic — every
// value it depends on is interpolated from the constants above rather than
// restated, so the two cannot drift. Values written by older builds ('light' /
// 'dark' / nothing) still mean what they used to, and anything unrecognised
// falls back exactly like parseTheme.
export const THEME_INIT_SCRIPT = `try{
var d=document.documentElement,t='${DEFAULT_THEME}';
try{t=localStorage.getItem('${THEME_STORAGE_KEY}')||t}catch(e){}
if(${JSON.stringify(THEMES)}.indexOf(t)<0)t='${DEFAULT_THEME}';
var k=t==='dark'||(t==='system'&&matchMedia('${DARK_QUERY}').matches);
d.dataset.theme=t;
d.classList.toggle('dark',k);
if(t!=='system'){var m=document.createElement('meta');m.id='${THEME_COLOR_OVERRIDE_ID}';m.name='theme-color';m.content=k?'${THEME_COLORS.dark}':'${THEME_COLORS.light}';document.head.insertBefore(m,document.querySelector('meta[name="theme-color"]'))}
}catch(e){}`;
