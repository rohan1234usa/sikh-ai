import type { Metadata } from 'next';

// A saved chat lives in a browser (or an account), never in search results.
// It drops the canonical URL it would inherit from /chat: noindex plus a
// canonical that points elsewhere tells a search engine two different things.
export const metadata: Metadata = { robots: { index: false, follow: false }, alternates: { canonical: null } };

// /chat/{id}: a saved chat. The screen is the layout's (ChatScreen), which
// reads the id from the URL itself.
export default function SavedChatPage() {
  return null;
}
