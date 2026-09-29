'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { PRIMARY_BUTTON } from '@/app/components/StatusPage';
import { useT } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type { QuizQuestion } from '@/lib/learn/config';
import { isCorrect, scoreQuiz, seededShuffle, type QuizScore } from '@/lib/learn/quiz';

type Props = {
    questions: QuizQuestion[];
    seed: string;                             // orders each question's choices: same seed, same order
    onChecked?: (score: QuizScore) => void;   // once per check
    onNewQuestions?: () => void;              // offered instead of "Try again" when given
    promptLang?: 'en';                        // a lesson's prompts; a topic's are in the site's language
};

const choiceLang = (question: QuizQuestion) =>
    question.kind === 'choice' && question.choicesLang ? question.choicesLang : 'en';

// A quiz of choice and typed questions, checked all at once. Typed answers
// are graded leniently (lib/learn/quiz.ts), and the house spelling is always
// shown afterwards, so the leniency never teaches a wrong spelling. The
// parent remounts it (key) for a fresh set of questions.
export default function Quiz({ questions, seed, onChecked, onNewQuestions, promptLang }: Props) {
    const t = useT();
    const id = useId();
    const [answers, setAnswers] = useState<(string | null)[]>(() => questions.map(() => null));
    const [checked, setChecked] = useState(false);
    const resultRef = useRef<HTMLParagraphElement>(null);

    // Choices in an order fixed by the seed, so the server's HTML and the
    // first render agree, and the answer isn't always first.
    const orders = useMemo(
        () => questions.map((question, i) => (question.kind === 'choice' ? seededShuffle(question.choices, `${seed}:${i}`) : [])),
        [questions, seed],
    );

    const result = checked ? scoreQuiz(questions, answers) : null;
    // The answer is styled on its own, wherever the language puts it.
    const [answerBefore, answerAfter] = t.learn.quiz.answer.split('{answer}');

    const setAnswer = (index: number, value: string) =>
        setAnswers((prev) => prev.map((answer, i) => (i === index ? value : answer)));

    const check = () => {
        setChecked(true);
        onChecked?.(scoreQuiz(questions, answers).score);
        // Keyboard and screen-reader users land on the score.
        requestAnimationFrame(() => resultRef.current?.focus());
    };

    const again = () => {
        if (onNewQuestions) {
            onNewQuestions();
            return;
        }
        setAnswers(questions.map(() => null));
        setChecked(false);
    };

    return (
        <div className="space-y-6">
            <ol className="space-y-6">
                {questions.map((question, i) => {
                    const answer = answers[i];
                    const right = checked && isCorrect(question, answer);
                    const inputId = `${id}-q${i}`;
                    return (
                        <li key={i}>
                            <fieldset disabled={checked} className="space-y-3">
                                {/* The word asked about is part of the legend, so it is
                                    read out with the question. */}
                                <legend className="space-y-3">
                                    <span className="block text-sm font-semibold text-ink">
                                        <span className="mr-1 text-accent-text">{fmt(t.learn.quiz.questionN, { n: i + 1 })}.</span>
                                        <span lang={promptLang}>{question.prompt}</span>
                                    </span>
                                    {question.promptPa && (
                                        <span lang="pa" className="block font-gurmukhi text-3xl leading-relaxed text-ink">{question.promptPa}</span>
                                    )}
                                    {question.promptRoman && <span lang="pa-Latn" className="block text-ink-muted">{question.promptRoman}</span>}
                                </legend>

                                {question.kind === 'choice' ? (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {orders[i].map((choice) => (
                                            <label
                                                key={choice}
                                                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-edge bg-surface px-3 py-2 text-ink transition-colors hover:border-accent-text/40 has-[:checked]:border-kesri has-[:checked]:bg-kesri/10 has-[:disabled]:cursor-default"
                                            >
                                                <input
                                                    type="radio"
                                                    name={inputId}
                                                    value={choice}
                                                    checked={answer === choice}
                                                    onChange={() => setAnswer(i, choice)}
                                                    className="accent-kesri"
                                                />
                                                <span lang={choiceLang(question)} className={question.choicesLang === 'pa' ? 'font-gurmukhi text-xl' : ''}>
                                                    {choice}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <div>
                                        <label htmlFor={inputId} className="sr-only">{t.learn.quiz.typedLabel}</label>
                                        <input
                                            id={inputId}
                                            type="text"
                                            lang="pa-Latn"
                                            autoCapitalize="none"
                                            autoCorrect="off"
                                            autoComplete="off"
                                            spellCheck={false}
                                            value={answer ?? ''}
                                            onChange={(e) => setAnswer(i, e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                                            placeholder={t.learn.quiz.typedPlaceholder}
                                            className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-kesri sm:max-w-md"
                                        />
                                    </div>
                                )}
                            </fieldset>

                            {checked && (
                                <div className="mt-2 space-y-1 text-sm">
                                    <p className={`flex items-center gap-1.5 font-semibold ${right ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {right
                                            ? <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />
                                            : <XCircleIcon className="h-5 w-5" aria-hidden="true" />}
                                        {right ? t.learn.quiz.correct : answer === null || answer.trim() === '' ? t.learn.quiz.unanswered : t.learn.quiz.incorrect}
                                    </p>
                                    {(question.kind === 'typed' || !right) && (
                                        <p className="text-ink">
                                            {answerBefore}
                                            <span lang={question.kind === 'typed' ? 'pa-Latn' : choiceLang(question)} className={`font-semibold ${question.kind === 'choice' && question.choicesLang === 'pa' ? 'font-gurmukhi text-lg' : ''}`}>
                                                {question.answer}
                                            </span>
                                            {answerAfter}
                                        </p>
                                    )}
                                    {question.explanation && <p lang="en" className="text-ink-muted">{question.explanation}</p>}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ol>

            <div className="flex flex-wrap items-center gap-4">
                {checked ? (
                    <button type="button" onClick={again} className={PRIMARY_BUTTON}>
                        {onNewQuestions ? t.learn.quiz.newQuestions : t.learn.quiz.tryAgain}
                    </button>
                ) : (
                    <button type="button" onClick={check} className={PRIMARY_BUTTON}>
                        {t.learn.quiz.check}
                    </button>
                )}
                <p ref={resultRef} tabIndex={-1} aria-live="polite" className="font-semibold text-ink outline-none">
                    {result && fmt(t.learn.quiz.score, result.score)}
                </p>
            </div>
        </div>
    );
}
