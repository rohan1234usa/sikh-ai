'use client';

import { useT } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import { QUIZ_ANCHOR, type QuizQuestion } from '@/lib/learn/config';
import { lessonRecord } from '@/lib/learn/progress';
import { useLessonProgress } from './LessonProgress';
import Quiz from './Quiz';

// The quiz at the end of a lesson, and its last checkpoint. Checking the quiz
// completes the lesson, whatever the score, and keeps the best one.
export default function LessonQuiz({ slug, questions }: { slug: string; questions: QuizQuestion[] }) {
    const t = useT();
    const { progress, hydrated, completeLesson } = useLessonProgress();

    const record = hydrated ? lessonRecord(progress, slug) : undefined;

    return (
        <section aria-labelledby={QUIZ_ANCHOR} className="bg-surface-raised border border-edge rounded-xl shadow-sm p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={QUIZ_ANCHOR} className="text-xl font-bold text-ink">{t.learn.quiz.heading}</h2>
                {record && (
                    <p className="text-sm font-semibold text-accent-text">{fmt(t.learn.quiz.lessonDone, record.best)}</p>
                )}
            </div>
            <Quiz questions={questions} seed={slug} promptLang="en" onChecked={(score) => completeLesson(slug, score)} />
        </section>
    );
}
