import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import LearnPageHeader from '@/app/components/learn/LearnPageHeader';
import VocabTopic from '@/app/components/learn/VocabTopic';
import { fmt } from '@/lib/i18n/fmt';
import { getLearnCopy } from '@/lib/i18n/learn';
import { localePath } from '@/lib/i18n/paths';
import { getServerT } from '@/lib/i18n/server';
import { VOCAB_TOPIC_IDS, isVocabTopic, topicPath } from '@/lib/learn/config';
import { VOCAB } from '@/lib/learn/curriculum';
import { pageMetadata } from '@/lib/metadata';

// Every vocabulary topic, built ahead of time in every language. An unknown
// one gets the site's own 404 (app/global-not-found.tsx, checked against a
// production build), because of dynamicParams below; the redirect is only a
// fallback.
export function generateStaticParams() {
  return VOCAB_TOPIC_IDS.map((topic) => ({ topic }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<'/[lang]/learn/vocab/[topic]'>): Promise<Metadata> {
  const { topic } = await params;
  if (!isVocabTopic(topic)) return {};
  const { lang, t } = await getServerT();
  const learn = getLearnCopy(lang);
  const description = fmt(learn.vocab.topicDescription, { topic: learn.topics[topic], n: VOCAB[topic].length });
  return pageMetadata(lang, t, topicPath(topic), `${learn.topics[topic]} · ${learn.tracks.vocab.title}`, description);
}

export default async function TopicPage({ params }: PageProps<'/[lang]/learn/vocab/[topic]'>) {
  const { lang, t } = await getServerT();
  const learn = getLearnCopy(lang);
  const { topic } = await params;
  if (!isVocabTopic(topic)) redirect(localePath(lang, '/learn/vocab'));
  const to = (path: string) => localePath(lang, path);
  const words = VOCAB[topic];

  return (
    <main className="flex-1 flex flex-col">
      <div className="max-w-3xl mx-auto w-full p-6 flex-1 space-y-6">
        <LearnPageHeader
          learn={learn}
          crumbs={[
            { href: to('/learn'), label: t.meta.learnTitle },
            { href: to('/learn/vocab'), label: learn.tracks.vocab.title },
          ]}
          eyebrow={fmt(learn.vocab.wordCount, { n: words.length })}
          title={learn.topics[topic]}
        />
        <VocabTopic topic={topic} words={words} />
      </div>
    </main>
  );
}
