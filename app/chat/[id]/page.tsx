import type { Metadata } from 'next';

// A saved chat lives in a browser (or an account), never in search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// /chat/{id}: a saved chat. The screen is the layout's (ChatScreen), which
// reads the id from the URL itself.
export default function SavedChatPage() {
  return null;
}
