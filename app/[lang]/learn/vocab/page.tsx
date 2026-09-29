import type { Metadata } from 'next';
import LearnPageHeader from '@/app/components/learn/LearnPageHeader';
import TopicList from '@/app/components/learn/TopicList';
import { localePath } from '@/lib/i18n/paths';
import { getServerT } from '@/lib/i18n/server';
import { VOCAB_TOPIC_IDS, topicPath } from '@/lib/learn/config';
import { VOCAB } from '@/lib/learn/curriculum';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  return pageMetadata(lang, t, '/learn/vocab', t.learn.tracks.vocab.title, t.learn.tracks.vocab.desc);
}

export default async function VocabPage() {
  const { lang, t } = await getServerT();
  const to = (path: string) => localePath(lang, path);

  return (
    <main className="flex-1 flex flex-col">
      <div className="max-w-3xl mx-auto w-full p-6 flex-1 space-y-8">
        <LearnPageHeader
          t={t}
          crumbs={[{ href: to('/learn'), label: t.meta.learnTitle }]}
          title={t.learn.tracks.vocab.title}
          lead={t.learn.tracks.vocab.desc}
        />
        <TopicList
          topics={VOCAB_TOPIC_IDS.map((id) => ({ id, href: to(topicPath(id)), wordIds: VOCAB[id].map((word) => word.id) }))}
        />
      </div>
    </main>
  );
}
