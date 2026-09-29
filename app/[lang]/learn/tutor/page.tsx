import type { Metadata } from 'next';
import TutorConversation from '@/app/components/learn/TutorConversation';
import { getServerT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  return pageMetadata(lang, t, '/learn/tutor', t.learn.tracks.tutor.title, t.learn.tracks.tutor.desc);
}

// The Punjabi tutor. The page is static; the conversation is the tab's own
// (TutorConversation, app/api/learn), and a lesson arrives as ?lesson=<slug>.
export default function TutorPage() {
  return (
    <main className="flex-1 flex flex-col">
      <TutorConversation />
    </main>
  );
}
