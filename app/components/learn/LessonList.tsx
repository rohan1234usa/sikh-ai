'use client';

import { CheckIcon } from '@heroicons/react/24/outline';
import IntentLink from '@/app/components/IntentLink';
import { useT } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type { LessonPace } from '@/lib/learn/pace';
import { lessonPlace, lessonRecord, placeHash } from '@/lib/learn/progress';
import { placeWords, timeWords } from './lessonStatus';
import { useLearnProgress } from './useLearnProgress';
import Mixed from './Mixed';

export type LessonLink = {
    slug: string;
    title: string;
    summary: string;
    href: string;
    pace: LessonPace; // its sections' and quiz's seconds: "Section 2 of 4", "About 6 min"
};

// A track's lessons in order, as ruled rows led by their numbers, like a
// contents page, each with how long it takes. Once the browser's progress is
// read, a finished one's number becomes a tick, and its best score shows;
// one started and not finished says which section the learner reached and
// how long the rest takes, and its link reopens it there.
export default function LessonList({ lessons }: { lessons: LessonLink[] }) {
    const t = useT();
    const { progress, hydrated } = useLearnProgress();

    return (
        <ol className="border-t border-edge">
            {lessons.map((lesson, i) => {
                const record = hydrated ? lessonRecord(progress, lesson.slug) : undefined;
                const place = hydrated ? lessonPlace(progress, lesson.slug, lesson.pace.sections.length) : { kind: 'new' as const };
                const status = record ? `${t.learn.lesson.done} · ${fmt(t.learn.lesson.best, record.best)}` : placeWords(t, place, lesson.pace);
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
                                {/* The time is on the server's page too, so progress only adds to this line. */}
                                <span className="block text-xs">
                                    {status && <><span className="font-semibold text-accent-text">{status}</span> · </>}
                                    <span className="text-ink-muted">{timeWords(t, place, lesson.pace)}</span>
                                </span>
                            </span>
                        </IntentLink>
                    </li>
                );
            })}
        </ol>
    );
}
