import type { Metadata } from 'next';
import TutorConversation from '@/app/components/learn/TutorConversation';
import { getLearnCopy } from '@/lib/i18n/learn';
import { getServerT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  const learn = getLearnCopy(lang);
  return pageMetadata(lang, t, '/learn/tutor', learn.tracks.tutor.title, learn.tracks.tutor.desc);
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
