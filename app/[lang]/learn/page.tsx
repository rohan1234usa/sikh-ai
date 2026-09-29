import type { Metadata } from 'next';
import LearnHero from '@/app/components/learn/LearnHero';
import LearnHub from '@/app/components/learn/LearnHub';
import { localePath } from '@/lib/i18n/paths';
import { getServerT } from '@/lib/i18n/server';
import { LESSON_META, LESSON_TRACK_IDS, lessonPath } from '@/lib/learn/config';
import { VOCAB } from '@/lib/learn/curriculum';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  return pageMetadata(lang, t, '/learn', t.meta.learnTitle, t.meta.descriptions.learn);
}

// The Learn Punjabi hub. Built ahead of time like every page; the parts that
// depend on this browser's progress fill in once it is read (LearnHub).
export default async function LearnPage() {
  const { lang, t } = await getServerT();
  const to = (path: string) => localePath(lang, path);

  return (
    <main className="flex-1 flex flex-col">
      <LearnHero t={t} />
      <div className="max-w-5xl mx-auto w-full p-6 flex-1">
        <LearnHub
          lessons={LESSON_META.map((meta) => ({ slug: meta.slug, track: meta.track, title: meta.title, href: to(lessonPath(meta)) }))}
          wordIds={Object.values(VOCAB).flatMap((words) => words.map((word) => word.id))}
          tracks={[
            ...LESSON_TRACK_IDS.map((id) => ({ id, href: to(`/learn/${id}`) })),
            { id: 'vocab' as const, href: to('/learn/vocab') },
          ]}
        />
      </div>
    </main>
  );
}
