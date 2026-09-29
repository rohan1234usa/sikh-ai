import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import IntentLink from '@/app/components/IntentLink';
import LearnPageHeader from '@/app/components/learn/LearnPageHeader';
import LessonQuiz from '@/app/components/learn/LessonQuiz';
import LessonSections from '@/app/components/learn/LessonSections';
import { fmt } from '@/lib/i18n/fmt';
import { localePath } from '@/lib/i18n/paths';
import { getServerT } from '@/lib/i18n/server';
import { LESSON_META, isLessonSlug, lessonMeta, lessonPath } from '@/lib/learn/config';
import { getLesson, neighbors } from '@/lib/learn/curriculum';
import { pageMetadata } from '@/lib/metadata';

// Every lesson, built ahead of time in every language. An unknown one, or a
// lesson under the wrong track, gets the site's own 404
// (app/global-not-found.tsx, checked against a production build), because of
// dynamicParams below; the redirect is only a fallback. Only this lesson's
// quiz reaches the browser as data: the teaching is rendered here.
export function generateStaticParams() {
  return LESSON_META.map((meta) => ({ track: meta.track, slug: meta.slug }));
}
export const dynamicParams = false;

// The lesson a URL names, if it names one: the slug must exist and sit in
// the track the URL says.
function findLesson(track: string, slug: string) {
  if (!isLessonSlug(slug)) return null;
  const meta = lessonMeta(slug);
  return meta.track === track ? meta : null;
}

export async function generateMetadata({ params }: PageProps<'/[lang]/learn/[track]/[slug]'>): Promise<Metadata> {
  const { track, slug } = await params;
  const meta = findLesson(track, slug);
  if (!meta) return {};
  const { lang, t } = await getServerT();
  return pageMetadata(lang, t, lessonPath(meta), `${meta.title} · ${t.learn.tracks[meta.track].title}`, meta.summary);
}

export default async function LessonPage({ params }: PageProps<'/[lang]/learn/[track]/[slug]'>) {
  const { lang, t } = await getServerT();
  const { track, slug } = await params;
  const meta = findLesson(track, slug);
  if (!meta) redirect(localePath(lang, '/learn'));

  const lesson = getLesson(meta.slug);
  const { prev, next, index, total } = neighbors(meta.slug);
  const to = (path: string) => localePath(lang, path);

  return (
    <main className="flex-1 flex flex-col">
      <div className="max-w-3xl mx-auto w-full p-6 flex-1 space-y-10">
        <LearnPageHeader
          t={t}
          crumbs={[
            { href: to('/learn'), label: t.meta.learnTitle },
            { href: to(`/learn/${meta.track}`), label: t.learn.tracks[meta.track].title },
          ]}
          eyebrow={fmt(t.learn.lesson.lessonOf, { n: index + 1, total })}
          title={lesson.title}
          lead={lesson.summary}
          lang="en"
        />

        <LessonSections t={t} sections={lesson.sections} />

        <IntentLink
          href={`${to('/learn/tutor')}?lesson=${lesson.slug}`}
          className="inline-flex items-center gap-2 rounded-xl border border-kesri/40 bg-kesri/10 px-4 py-2.5 text-sm font-semibold text-accent-text transition-colors hover:bg-kesri/20"
        >
          <ChatBubbleLeftRightIcon className="h-5 w-5" aria-hidden="true" />
          {t.learn.lesson.askTutor}
        </IntentLink>

        <LessonQuiz slug={lesson.slug} questions={lesson.quiz} />

        {/* Plain Links, like the Ang page's: the next lesson is prefetched
            as it scrolls into view, since reading on is the likely move. */}
        <nav aria-label={t.learn.lesson.pagerAria} className="grid gap-3 border-t border-edge pt-6 text-sm sm:grid-cols-2">
          {prev ? (
            <Link rel="prev" href={to(lessonPath(prev))} className="rounded-xl border border-edge p-3 transition-colors hover:border-accent-text/40">
              <span className="block text-ink-muted">← {t.learn.lesson.previous}</span>
              <span lang="en" className="block font-semibold text-ink">{prev.title}</span>
            </Link>
          ) : <span className="hidden sm:block" />}
          {next ? (
            <Link rel="next" href={to(lessonPath(next))} className="rounded-xl border border-edge p-3 text-right transition-colors hover:border-accent-text/40">
              <span className="block text-ink-muted">{t.learn.lesson.next} →</span>
              <span lang="en" className="block font-semibold text-ink">{next.title}</span>
            </Link>
          ) : (
            <Link href={to(`/learn/${meta.track}`)} className="rounded-xl border border-edge p-3 text-right font-semibold text-accent-text transition-colors hover:border-accent-text/40">
              {t.learn.lesson.allLessons}
            </Link>
          )}
        </nav>

        <p className="text-xs italic text-ink-muted">{t.learn.caveat}</p>
      </div>
    </main>
  );
}
