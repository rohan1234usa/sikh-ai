import { Geist, Geist_Mono, Noto_Sans_Gurmukhi } from "next/font/google";

// Shared by the root layout and app/global-error.tsx, which renders its own
// <html> in place of the layout. The @theme font tokens in globals.css read
// these variables at :root, so both documents must put them on <html>.

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// The only monospace text is inline code in chat replies, so the font is not
// preloaded: a browser downloads it the first time a page shows code. The
// variable stays on <html> on purpose. --font-mono is resolved at :root
// (globals.css), so defining this variable any lower would leave
// --font-mono without a value, and code would lose even the system
// monospace fallback.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

const notoGurmukhi = Noto_Sans_Gurmukhi({
  // Distinct from the --font-gurmukhi @theme token to avoid a self-referential
  // CSS variable (see the Geist --font-geist-sans -> --font-sans pattern)
  variable: "--font-noto-gurmukhi",
  subsets: ["gurmukhi"],
  weight: ["400", "700"],
});

export const FONT_VARIABLES = `${geistSans.variable} ${geistMono.variable} ${notoGurmukhi.variable}`;
