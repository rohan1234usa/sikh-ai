import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';
import SharedChatView from '../../components/share/SharedChatView';

// The link is the only key to a shared chat, so it stays out of search
// results and out of the Referer header of any link followed from it. The
// title is generic on purpose: the chat's own title never reaches a link
// preview.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return {
    title: t.meta.shareTitle,
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export default async function SharedChatPage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  return <SharedChatView shareId={shareId} />;
}
