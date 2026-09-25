import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FONT_VARIABLES } from "./fonts";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { GoogleAnalytics } from "@next/third-parties/google";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { LANG_META } from "@/lib/i18n/config";
import { getLang, getServerT } from "@/lib/i18n/server";
import { SITE_URL, openGraph } from "@/lib/metadata";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Cookie-backed so SSR emits the right language and <html lang> on the
  // first byte; the client provider is seeded from the same value, so
  // hydration can never mismatch.
  const lang = await getLang();

  return (
    <html
      lang={LANG_META[lang].htmlLang}
      suppressHydrationWarning
      className={FONT_VARIABLES}
    >
      <head>
        {/* Apply the stored choice before first paint to avoid a flash */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased min-h-dvh flex flex-col">
        <AuthProvider>
          <LanguageProvider initialLang={lang}>
            <Navbar />
            {children}
            <Footer />
          </LanguageProvider>
        </AuthProvider>
        <GoogleAnalytics gaId="G-9WWKK5Z5GD" />
      </body>
    </html>
  );
}
