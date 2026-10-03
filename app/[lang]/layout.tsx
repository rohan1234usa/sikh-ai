import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "@/app/globals.css";
import { FONT_VARIABLES } from "@/app/fonts";
import { AuthProvider } from "@/app/context/AuthContext";
import { LanguageProvider } from "@/app/context/LanguageContext";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import AccountDialogHost from "@/app/components/account/AccountDialogHost";
import SiteAnalytics from "@/app/components/SiteAnalytics";
import SiteDataGuard from "@/app/components/SiteDataGuard";
import { LANGS, LANG_META, isLang } from "@/lib/i18n/config";
import { getServerT } from "@/lib/i18n/server";
import { SITE_URL, openGraph } from "@/lib/metadata";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { AUTH_HINT_SCRIPT } from "@/lib/firebase/hint";
import { CLEAR_SCRIPT } from "@/lib/browserData";

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  return {
    title: {
      default: t.meta.title,
      template: t.meta.titleTemplate,
    },
    description: t.meta.description,
    metadataBase: new URL(SITE_URL),
    // The preview for pages that don't build their own (share links): the
    // site's title and image, with no URL. Each page's own preview, canonical
    // URL and language alternates come from pageMetadata() in lib/metadata.ts.
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
// root, Punjabi under /pa and /pa-latn. The routing rules (lib/i18n/routing.ts)
// let no other value reach this segment. There's no dynamicParams = false
// here: it would also refuse the Angs (shabad/[ang]), which are built as
// they're first visited.
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  // From the URL, so <html lang> and every word are right in the built HTML,
  // and the client provider is seeded with the same value. Only a prefix in
  // the wrong case (/PA/…) reaches here as anything else: the host matches the
  // routing rules regardless of case, so it skips the rewrite. That address
  // is a 404, not the English page under a name of its own.
  const lang = (await params).lang;
  if (!isLang(lang)) notFound();

  return (
    <html
      lang={LANG_META[lang].htmlLang}
      suppressHydrationWarning
      className={FONT_VARIABLES}
    >
      <head>
        {/* Before first paint, to avoid a flash: the rest of clearing this
            browser, when that's why the page loaded (so the others see it
            clear); the stored theme; and whether this browser was signed in
            (which hides "Sign in" while the session is restored). */}
        <script dangerouslySetInnerHTML={{ __html: `${CLEAR_SCRIPT};${THEME_INIT_SCRIPT};${AUTH_HINT_SCRIPT}` }} />
      </head>
      <body className="antialiased min-h-dvh flex flex-col">
        <AuthProvider>
          <LanguageProvider lang={lang}>
            <Navbar />
            {children}
            <Footer />
            <AccountDialogHost />
          </LanguageProvider>
        </AuthProvider>
        <SiteDataGuard />
        {/* Vercel's own visit counts (production only, so previews count
            nothing) and Core Web Vitals (any Vercel deployment), on its
            dashboard once each is switched on there. No cookies; Vercel serves
            both scripts from this site, so they only exist on Vercel.
            SiteAnalytics honours the visitor's choice and strips IDs from
            every address (lib/analytics.ts). */}
        {process.env.VERCEL === "1" && <SiteAnalytics webAnalytics={process.env.VERCEL_ENV === "production"} />}
      </body>
    </html>
  );
}
