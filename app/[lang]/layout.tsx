import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import { FONT_VARIABLES } from "@/app/fonts";
import { AuthProvider } from "@/app/context/AuthContext";
import { LanguageProvider } from "@/app/context/LanguageContext";
import { GoogleAnalytics } from "@next/third-parties/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { LANGS, LANG_META, parseLang } from "@/lib/i18n/config";
import { getServerT } from "@/lib/i18n/server";
import { SITE_URL, openGraph } from "@/lib/metadata";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { AUTH_HINT_SCRIPT } from "@/lib/firebase/hint";

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  return {
    title: {
      default: t.meta.title,
      template: t.meta.titleTemplate,
    },
    description: t.meta.description,
    metadataBase: new URL(SITE_URL),
    // The preview for pages that don't build their own (share links, 404s):
    // the site's title and image, with no URL. Each page's own preview and
    // canonical URL come from pageMetadata() in lib/metadata.ts.
    openGraph: openGraph(lang, t, t.meta.title),
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  viewportFit: "cover",
  // No `themeColor` here, on purpose: the theme-color tag is owned entirely by
  // lib/theme.ts, which knows the user's choice. Emitting one from Next as well
  // put two parties on the same tag, and React's hydration mixed them up.
};

// Every page is built once per language, ahead of time, and served from the
// CDN. The language comes from the URL (lib/i18n/paths.ts): English at the
// root, Punjabi under /pa and /pa-latn. No other value is a page.
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}
export const dynamicParams = false;

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  // From the URL, so <html lang> and every word are right in the built HTML,
  // and the client provider is seeded with the same value.
  const lang = parseLang((await params).lang);

  return (
    <html
      lang={LANG_META[lang].htmlLang}
      suppressHydrationWarning
      className={FONT_VARIABLES}
    >
      <head>
        {/* Before first paint, to avoid a flash: the stored theme, and whether
            this browser was signed in (which hides "Sign in" while the
            session is restored). */}
        <script dangerouslySetInnerHTML={{ __html: `${THEME_INIT_SCRIPT};${AUTH_HINT_SCRIPT}` }} />
      </head>
      <body className="antialiased min-h-dvh flex flex-col">
        <AuthProvider>
          <LanguageProvider lang={lang}>
            <Navbar />
            {children}
            <Footer />
          </LanguageProvider>
        </AuthProvider>
        <GoogleAnalytics gaId="G-9WWKK5Z5GD" />
        {/* Core Web Vitals from real visits, on Vercel's dashboard once it's
            switched on there. No cookies; Vercel serves the script from this
            site (/_vercel/speed-insights), so it only exists on Vercel. */}
        {process.env.VERCEL === "1" && <SpeedInsights />}
      </body>
    </html>
  );
}
