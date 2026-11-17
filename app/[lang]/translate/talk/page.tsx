import type { Metadata } from 'next';
import TalkScreen from '@/app/components/translate/TalkScreen';
import { getLang, getServerT } from '@/lib/i18n/server';
import { getTalkCopy } from '@/lib/i18n/talk';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  return pageMetadata(lang, t, '/translate/talk', t.meta.talkTitle, t.meta.descriptions.talk);
}

// Talk, the translator's voice mode (#37). The page is static; the
// conversation lives in the tab (TalkScreen), and clips go to
// /api/translate/voice, translations to /api/translate/speak. Its words
// (lib/i18n/talk) go to TalkScreen from here, so no other page ships them.
export default async function TalkPage() {
  return (
    <main className="flex-1 flex flex-col">
      <TalkScreen copy={getTalkCopy(await getLang())} />
    </main>
  );
}
