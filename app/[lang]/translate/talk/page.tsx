import type { Metadata } from 'next';
import TalkScreen from '@/app/components/translate/TalkScreen';
import { getServerT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  return pageMetadata(lang, t, '/translate/talk', t.meta.talkTitle, t.meta.descriptions.talk);
}

// Talk, the translator's voice mode (#37). The page is static; the
// conversation lives in the tab (TalkScreen), and clips go to
// /api/translate/voice, translations to /api/translate/speak.
export default function TalkPage() {
  return (
    <main className="flex-1 flex flex-col">
      <TalkScreen />
    </main>
  );
}
