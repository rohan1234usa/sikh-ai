'use client';

import { useEffect } from 'react';
import { useT } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type { QuizQuestion } from '@/lib/learn/config';
import { lessonRecord } from '@/lib/learn/progress';
import Quiz from './Quiz';
import { useLearnProgress } from './useLearnProgress';

// The quiz at the end of a lesson. Opening the lesson makes it the one the
// hub's "Continue" returns to; checking the quiz completes it, whatever the
// score, and keeps the best one.
export default function LessonQuiz({ slug, questions }: { slug: string; questions: QuizQuestion[] }) {
    const t = useT();
    const { progress, hydrated, visitLesson, completeLesson } = useLearnProgress();

    useEffect(() => {
        if (hydrated) visitLesson(slug);
    }, [hydrated, slug, visitLesson]);

    const record = hydrated ? lessonRecord(progress, slug) : undefined;

    return (
        <section aria-labelledby="lesson-quiz" className="bg-surface-raised border border-edge rounded-xl shadow-sm p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="lesson-quiz" className="text-xl font-bold text-ink">{t.learn.quiz.heading}</h2>
                {record && (
                    <p className="text-sm font-semibold text-accent-text">{fmt(t.learn.quiz.lessonDone, record.best)}</p>
                )}
            </div>
            <Quiz questions={questions} seed={slug} onChecked={(score) => completeLesson(slug, score)} />
        </section>
    );
}
