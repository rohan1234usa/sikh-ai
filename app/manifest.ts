import type { MetadataRoute } from 'next';
import { getDictionary } from '@/lib/i18n';

// What a phone needs to install the site as an app (#17): its name, where it
// opens, how it shows, and its icons. The icons (public/icon-*.png and
// app/apple-icon.png) are the navbar's ੴ, drawn in the site's own Gurmukhi
// font, kesri on navy; the maskable one leaves the edge room a phone crops.
// A manifest has one colour, so it's the icon's navy, for the splash screen
// and title bar; once a page loads, its theme-color (lib/theme.ts) takes over.
// A Punjabi reader who installs it still opens in Punjabi: the cookie sends
// the start page on (lib/i18n/routing.ts).
const NAVY = '#0F172A';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'SikhAI',
    short_name: 'SikhAI',
    description: getDictionary('en').meta.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: NAVY,
    theme_color: NAVY,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
