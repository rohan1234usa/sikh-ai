'use client';

import { AcademicCapIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useT } from '@/app/context/LanguageContext';
import Mixed from './Mixed';

// The lesson the tutor was opened from, shown in the composer like the
// chat's passage chip. Dismissing it stops the tutor using the lesson.
export default function LessonChip({ title, onDismiss }: { title: string; onDismiss: () => void }) {
    const t = useT();
    // Only the title is English: the label around it is in the site's language.
    const [before, after] = t.learn.tutor.aboutLesson.split('{title}');
    return (
        <div className="flex max-w-full items-center gap-2 rounded-full border border-kesri/40 bg-kesri/10 py-1.5 pl-3 pr-1.5 text-xs text-accent-text">
            <AcademicCapIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{before}<span lang="en"><Mixed text={title} /></span>{after}</span>
            <button
                type="button"
                onClick={onDismiss}
                aria-label={t.learn.tutor.stopLessonAria}
                className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-kesri/20"
            >
                <XMarkIcon className="h-4 w-4" />
            </button>
        </div>
    );
}
