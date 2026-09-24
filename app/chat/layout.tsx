import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';
import ChatScreen from '../components/chat/ChatScreen';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: t.meta.chatTitle };
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
