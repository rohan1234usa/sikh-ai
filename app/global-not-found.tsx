import './globals.css';
import { FONT_VARIABLES } from './fonts';
import { getDictionary } from '@/lib/i18n';
import { LANGS, LANG_META, type Lang } from '@/lib/i18n/config';
import { localePath } from '@/lib/i18n/paths';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { PRIMARY_BUTTON } from './components/StatusPage';

// The site's 404, for any address that isn't a page, in any language. Pages
// live under app/[lang], whose layout can't serve a 404 of its own (Next
// would fall back to its bare default page, as it does for a language prefix
// in the wrong case, which reaches that layout), so this is a whole document
// of its own: static, built once, with no navbar or providers. The logo still
// leads home, as it does on every page.
//
// A 404 page can't know its language when it's built, so it carries all
// three. A pre-paint script reads the language from the address (/pa/…,
// /pa-latn/…, or neither for English), sets <html lang> and data-lang, and
// the title; CSS then shows that language's copy. Without script, English.
// There's no metadata title on purpose: hydration would put it back over the
// script's. Next marks the page noindex itself.

const TITLES = Object.fromEntries(LANGS.map((lang) => {
  const t = getDictionary(lang);
  return [lang, t.meta.titleTemplate.replace('%s', t.meta.notFoundTitle)];
}));
const HTML_LANGS = Object.fromEntries(LANGS.map((lang) => [lang, LANG_META[lang].htmlLang]));

const LANGUAGE_SCRIPT = `(function(){try{
var m=/^\\/(pa|pa-latn)(?:\\/|$)/.exec(location.pathname),l=m?m[1]:'en',d=document.documentElement;
d.dataset.lang=l;d.lang=${JSON.stringify(HTML_LANGS)}[l];document.title=${JSON.stringify(TITLES)}[l];
}catch(e){}})()`;

// Each language's copy, shown by data-lang; English also without it.
const SHOWN: Record<Lang, string> = {
  en: 'in-data-[lang=pa]:hidden in-data-[lang=pa-latn]:hidden',
  pa: 'hidden in-data-[lang=pa]:block',
  'pa-latn': 'hidden in-data-[lang=pa-latn]:block',
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={FONT_VARIABLES} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `${THEME_INIT_SCRIPT};${LANGUAGE_SCRIPT}` }} />
      </head>
      <body className="antialiased min-h-dvh flex flex-col">
        <header className="bg-navy text-white shadow-md dark:border-b dark:border-white/10 [--focus-ring:var(--color-kesri)]">
          <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
            {LANGS.map((lang) => (
              <div key={lang} className={SHOWN[lang]}>
                <a href={localePath(lang, '/')} className="flex items-center gap-2 text-xl font-bold tracking-wide">
                  <span className="font-gurmukhi text-kesri" aria-hidden="true">ੴ</span> SikhAI
                </a>
              </div>
            ))}
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-20">
          {LANGS.map((lang) => {
            const t = getDictionary(lang);
            return (
              <div key={lang} lang={LANG_META[lang].htmlLang} className={`max-w-md text-center space-y-4 ${SHOWN[lang]}`}>
                <p className="text-sm font-semibold tracking-widest text-accent-text">404</p>
                <h1 className="text-3xl font-bold text-ink">{t.notFound.heading}</h1>
                <p className="text-ink-muted">{t.notFound.body}</p>
                <div className="pt-2">
                  <a href={localePath(lang, '/')} className={PRIMARY_BUTTON}>
                    {t.notFound.home}
                  </a>
                </div>
              </div>
            );
          })}
        </main>
      </body>
    </html>
  );
}
