import { Geist_Mono, Newsreader, Noto_Serif_Gurmukhi, Tiro_Gurmukhi } from "next/font/google";

// Shared by the root layout, app/global-error.tsx and app/global-not-found.tsx,
// each of which renders its own <html>. The @theme font tokens in globals.css
// read these variables at :root, so every document must put them on <html>.
//
// Three faces, each with a job (docs/design/pothi.md), so nothing ever needs a
// weight its font doesn't have:
//   Newsreader           running Latin text, headings and the interface
//   Noto Serif Gurmukhi  Gurmukhi in the interface (all of it under /pa), with
//                        real weights for headings and buttons
//   Tiro Gurmukhi        Gurbani and other reading Gurmukhi, through the
//                        font-gurmukhi utility; one weight, so never bold
// Each variable is named after its font, not after the token that reads it:
// a variable named like that token would point at itself.

// Variable in weight, with its real italic for translations. Not its optical-
// size axis: that more than doubles the files (279 KB for both styles, against
// 123 KB), and every page preloads them.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const notoSerifGurmukhi = Noto_Serif_Gurmukhi({
  variable: "--font-noto-serif-gurmukhi",
  subsets: ["gurmukhi"],
});

const tiroGurmukhi = Tiro_Gurmukhi({
  variable: "--font-tiro-gurmukhi",
  subsets: ["gurmukhi"],
  weight: "400",
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

export const FONT_VARIABLES = `${newsreader.variable} ${notoSerifGurmukhi.variable} ${tiroGurmukhi.variable} ${geistMono.variable}`;
