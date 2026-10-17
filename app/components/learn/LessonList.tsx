'use client';

import { CheckIcon } from '@heroicons/react/24/outline';
import IntentLink from '@/app/components/IntentLink';
import { useT } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import { lessonPlace, lessonRecord, placeHash } from '@/lib/learn/progress';
import { useLearnProgress } from './useLearnProgress';
import Mixed from './Mixed';

export type LessonLink = {
    slug: string;
    title: string;
    summary: string;
    href: string;
    sections: number; // its section count, for "Section 2 of 4"
};

// A track's lessons in order, as ruled rows led by their numbers, like a
// contents page. Once the browser's progress is read, a finished one's number
// becomes a tick, and its best score shows; one started and not finished
// says which section the learner reached, and its link reopens it there.
export default function LessonList({ lessons }: { lessons: LessonLink[] }) {
    const t = useT();
    const { progress, hydrated } = useLearnProgress();

    return (
        <ol className="border-t border-edge">
            {lessons.map((lesson, i) => {
                const record = hydrated ? lessonRecord(progress, lesson.slug) : undefined;
                const place = hydrated ? lessonPlace(progress, lesson.slug, lesson.sections) : { kind: 'new' as const };
                const status = record ? `${t.learn.lesson.done} · ${fmt(t.learn.lesson.best, record.best)}`
                    : place.kind === 'section' ? fmt(t.learn.lesson.sectionOf, { n: place.index + 1, total: lesson.sections })
                        : place.kind === 'quiz' ? t.learn.lesson.atQuiz
                            : null;
                return (
                    <li key={lesson.slug} className="border-b border-edge">
                        <IntentLink
                            href={lesson.href + placeHash(place)}
                            className="flex items-start gap-4 px-2 py-4 transition-colors hover:bg-surface-raised"
                        >
                            <span
                                aria-hidden="true"
                                className="flex h-6 w-6 shrink-0 items-center justify-end font-semibold tabular-nums text-accent-text"
                            >
                                {record ? <CheckIcon className="h-5 w-5" /> : i + 1}
                            </span>
                            <span className="min-w-0 space-y-1">
                                <span lang="en" className="block font-semibold text-ink"><Mixed text={lesson.title} /></span>
                                <span lang="en" className="block text-sm text-ink-muted"><Mixed text={lesson.summary} /></span>
                                {status && <span className="block text-xs font-semibold text-accent-text">{status}</span>}
                            </span>
                        </IntentLink>
                    </li>
                );
            })}
        </ol>
    );
}
