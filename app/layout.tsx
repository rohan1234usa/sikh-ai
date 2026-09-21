import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Gurmukhi } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { GoogleAnalytics } from "@next/third-parties/google";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { LANG_META } from "@/lib/i18n/config";
import { getLang, getServerT } from "@/lib/i18n/server";
import { DARK_QUERY, THEME_COLORS, THEME_INIT_SCRIPT } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoGurmukhi = Noto_Sans_Gurmukhi({
  // Distinct from the --font-gurmukhi @theme token to avoid a self-referential
  // CSS variable (see the Geist --font-geist-sans -> --font-sans pattern)
  variable: "--font-noto-gurmukhi",
  subsets: ["gurmukhi"],
  weight: ["400", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  return {
    title: {
      default: t.meta.title,
      template: t.meta.titleTemplate,
    },
    description: t.meta.description,
    metadataBase: new URL("https://sikhai.vercel.app/"),
    openGraph: {
      title: t.meta.title,
      description: t.meta.description,
      url: "https://sikhai.vercel.app/",
      siteName: "SikhAI",
      images: [
        {
          url: "/logo.png",
          width: 1200,
          height: 630,
          alt: t.meta.ogImageAlt,
        },
      ],
      locale: LANG_META[lang].ogLocale,
      type: "website",
    },
  };
}

export const viewport: Viewport = {
  viewportFit: "cover",
  // Right for the `system` theme, and the fallback with no script. An explicit
  // Light / Dark pick overrides it from lib/theme.ts (see syncThemeColor).
  themeColor: [
    { media: DARK_QUERY, color: THEME_COLORS.dark },
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
  ],
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
      className={`${geistSans.variable} ${geistMono.variable} ${notoGurmukhi.variable}`}
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
