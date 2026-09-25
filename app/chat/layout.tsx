import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/metadata';
import ChatScreen from '../components/chat/ChatScreen';

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  // /chat/{id} pages keep this preview but drop the canonical URL (see there).
  return pageMetadata(lang, t, '/chat', t.meta.chatTitle);
}

// The chat screen lives here, not in the pages (which render nothing): see
// ChatScreen for why it must never remount between chats.
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ChatScreen />
      {children}
    </>
  );
}
