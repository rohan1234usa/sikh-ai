import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import LearnPageHeader from '@/app/components/learn/LearnPageHeader';
import LessonList from '@/app/components/learn/LessonList';
import { localePath } from '@/lib/i18n/paths';
import { getServerT } from '@/lib/i18n/server';
import { LESSON_TRACK_IDS, isLessonTrack, lessonPath, lessonsFor } from '@/lib/learn/config';
import { pageMetadata } from '@/lib/metadata';

// /learn/script and /learn/grammar, built ahead of time in every language.
// Any other track gets the site's own 404 (app/global-not-found.tsx, checked
// against a production build), because of dynamicParams below. The redirect
// is only a fallback, the Ang page's, should a request ever get this far.
export function generateStaticParams() {
  return LESSON_TRACK_IDS.map((track) => ({ track }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<'/[lang]/learn/[track]'>): Promise<Metadata> {
  const { track } = await params;
  if (!isLessonTrack(track)) return {};
  const { lang, t } = await getServerT();
  return pageMetadata(lang, t, `/learn/${track}`, t.learn.tracks[track].title, t.learn.tracks[track].desc);
}

export default async function TrackPage({ params }: PageProps<'/[lang]/learn/[track]'>) {
  const { lang, t } = await getServerT();
  const { track } = await params;
  if (!isLessonTrack(track)) redirect(localePath(lang, '/learn'));
  const to = (path: string) => localePath(lang, path);

  return (
    <main className="flex-1 flex flex-col">
      <div className="max-w-3xl mx-auto w-full p-6 flex-1 space-y-8">
        <LearnPageHeader
          t={t}
          crumbs={[{ href: to('/learn'), label: t.meta.learnTitle }]}
          title={t.learn.tracks[track].title}
          lead={t.learn.tracks[track].desc}
        />
        <LessonList
          lessons={lessonsFor(track).map((meta) => ({ slug: meta.slug, title: meta.title, summary: meta.summary, href: to(lessonPath(meta)) }))}
        />
      </div>
    </main>
  );
}
