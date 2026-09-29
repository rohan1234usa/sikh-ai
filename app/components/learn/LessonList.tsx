'use client';

import { CheckIcon } from '@heroicons/react/24/outline';
import IntentLink from '@/app/components/IntentLink';
import { useT } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import { lessonRecord } from '@/lib/learn/progress';
import { useLearnProgress } from './useLearnProgress';
import Mixed from './Mixed';

export type LessonLink = { slug: string; title: string; summary: string; href: string };

// A track's lessons in order. Once the browser's progress is read, finished
// ones get a tick and their best score.
export default function LessonList({ lessons }: { lessons: LessonLink[] }) {
    const t = useT();
    const { progress, hydrated } = useLearnProgress();

    return (
        <ol className="space-y-3">
            {lessons.map((lesson, i) => {
                const record = hydrated ? lessonRecord(progress, lesson.slug) : undefined;
                return (
                    <li key={lesson.slug}>
                        <IntentLink
                            href={lesson.href}
                            className="flex items-start gap-4 rounded-xl border border-edge bg-surface-raised p-4 shadow-sm transition-colors hover:border-accent-text/40"
                        >
                            <span
                                aria-hidden="true"
                                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${record ? 'bg-accent-text text-surface' : 'bg-accent-text/10 text-accent-text'}`}
                            >
                                {record ? <CheckIcon className="h-5 w-5" /> : i + 1}
                            </span>
                            <span className="min-w-0 space-y-1">
                                <span lang="en" className="block font-semibold text-ink"><Mixed text={lesson.title} /></span>
                                <span lang="en" className="block text-sm text-ink-muted"><Mixed text={lesson.summary} /></span>
                                {record && (
                                    <span className="block text-xs font-semibold text-accent-text">
                                        {t.learn.lesson.done} · {fmt(t.learn.lesson.best, record.best)}
                                    </span>
                                )}
                            </span>
                        </IntentLink>
                    </li>
                );
            })}
        </ol>
    );
}
