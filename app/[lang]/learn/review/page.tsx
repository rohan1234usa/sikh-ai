import type { Metadata } from 'next';
import LearnPageHeader from '@/app/components/learn/LearnPageHeader';
import ReviewSession from '@/app/components/learn/ReviewSession';
import { localePath } from '@/lib/i18n/paths';
import { getServerT } from '@/lib/i18n/server';
import { flashcardWords } from '@/lib/learn/curriculum';

// Which cards are due is this browser's to say, so a search engine would
// find a header and "nothing is due": not indexed, and not in the sitemap.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return {
    title: t.learn.review.title,
    description: t.learn.review.description,
    robots: { index: false, follow: true },
    alternates: { canonical: null },
  };
}

// Every flashcard that is due, from every topic, twenty a session
// (ReviewSession). Built ahead of time like every page, it carries each word
// as a card shows it; the learner's progress picks the cards.
export default async function ReviewPage() {
  const { lang, t } = await getServerT();
  const to = (path: string) => localePath(lang, path);

  return (
    <main className="flex-1 flex flex-col">
      <div className="max-w-3xl mx-auto w-full p-6 flex-1 space-y-6">
        <LearnPageHeader
          t={t}
          crumbs={[{ href: to('/learn'), label: t.meta.learnTitle }, { href: to('/learn/vocab'), label: t.learn.tracks.vocab.title }]}
          eyebrow={t.learn.review.eyebrow}
          title={t.learn.review.title}
          lead={t.learn.review.lead}
        />
        <ReviewSession words={flashcardWords()} topicsHref={to('/learn/vocab')} />
      </div>
    </main>
  );
}
