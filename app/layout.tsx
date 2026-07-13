import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Gurmukhi } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { GoogleAnalytics } from "@next/third-parties/google";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

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

export const metadata: Metadata = {
  title: {
    default: "SikhAI - Wisdom of the Gurus, Illuminated by AI",
    template: "%s | SikhAI",
  },
  description: "Architecting a Modern Bridge Between Ancient Heritage and Generative AI.",
  metadataBase: new URL("https://sikhai.vercel.app/"),
  openGraph: {
    title: "SikhAI - Wisdom of the Gurus, Illuminated by AI",
    description: "Architecting a Modern Bridge Between Ancient Heritage and Generative AI.",
    url: "https://sikhai.vercel.app/",
    siteName: "SikhAI",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "SikhAI Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoGurmukhi.variable}`}
    >
      <head>
        {/* Apply the stored/system theme before first paint to avoid a flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.theme;if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body className="antialiased min-h-dvh flex flex-col">
        <AuthProvider>
          <Navbar />
          {children}
          <Footer />
        </AuthProvider>
        <GoogleAnalytics gaId="G-9WWKK5Z5GD" />
      </body>
    </html>
  );
}
