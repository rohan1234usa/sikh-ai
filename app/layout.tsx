import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// 1. Import the AuthProvider
import { AuthProvider } from "./context/AuthContext";
import { GoogleAnalytics } from "@next/third-parties/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SikhAI - Wisdom of the Gurus, Illuminated by AI",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Added 'suppressHydrationWarning' here to fix the error
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* 2. Wrap the children with AuthProvider */}
        <AuthProvider>
          {children}
        </AuthProvider>
        <GoogleAnalytics gaId="G-9WWKK5Z5GD" />
      </body>
    </html>
  );
}