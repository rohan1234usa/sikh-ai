'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/app/components/buttons';
import { useT } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type { QuizQuestion } from '@/lib/learn/config';
import { isCorrect, otherSpellings, scoreQuiz, seededShuffle, type QuizScore } from '@/lib/learn/quiz';
import { useSwapGuard } from './useSwapGuard';
import Mixed from './Mixed';

type Props = {
    questions: QuizQuestion[];
    seed: string;                             // orders each question's choices: same seed, same order
    onChecked?: (score: QuizScore) => void;   // once, when the last question is checked
    onNewQuestions?: () => void;              // offered instead of "Try again" when given
    promptLang?: 'en';                        // a lesson's prompts; a topic's are in the site's language
    focusFirst?: boolean;                     // focus the first question on arrival: a new set just asked for
};

// Where focus goes after the next render, since the button pressed goes away.
type FocusTarget = { kind: 'result'; index: number } | { kind: 'score' } | { kind: 'first' } | null;

const choiceLang = (question: QuizQuestion) =>
    question.kind === 'choice' && question.choicesLang ? question.choicesLang : 'en';

// A quiz of choice and typed questions, each checked on its own: its result
// shows as soon as it is answered and checked, so nobody meets every red at
// once. The score comes when the last one is checked, and that is when the
// quiz counts (onChecked), once. Typed answers are graded leniently
// (lib/learn/quiz.ts), and the quiz says so once, above the first of them;
// a strict question says what it counts. The house spelling is always shown
// afterwards, with the other accepted ones after a miss, so the leniency
// never teaches a wrong spelling. The parent remounts it (key) for a fresh
// set of questions.
export default function Quiz({ questions, seed, onChecked, onNewQuestions, promptLang, focusFirst }: Props) {
    const t = useT();
    const id = useId();
    const [answers, setAnswers] = useState<(string | null)[]>(() => questions.map(() => null));
    const [checked, setChecked] = useState<boolean[]>(() => questions.map(() => false));
    const listRef = useRef<HTMLOListElement>(null);
    const resultRefs = useRef<(HTMLDivElement | null)[]>([]);
    const scoreRef = useRef<HTMLParagraphElement>(null);

    // Choices in an order fixed by the seed, so the server's HTML and the
    // first render agree, and the answer isn't always first.
    const orders = useMemo(
        () => questions.map((question, i) => (question.kind === 'choice' ? seededShuffle(question.choices, `${seed}:${i}`) : [])),
        [questions, seed],
    );

    const finished = checked.every(Boolean);
    const result = finished ? scoreQuiz(questions, answers) : null;
    // The answer is styled on its own, wherever the language puts it.
    const [answerBefore, answerAfter] = t.learn.quiz.answer.split('{answer}');
    const [alsoBefore, alsoAfter] = t.learn.quiz.alsoAccepted.split('{spellings}');
    // How forgiving typed answers are, said once, above the first of them.
    const firstTyped = questions.findIndex((question) => question.kind === 'typed');
    const hintId = `${id}-hint`;

    const setAnswer = (index: number, value: string) =>
        setAnswers((prev) => prev.map((answer, i) => (i === index ? value : answer)));

    // Focus follows what the learner pressed, since it goes away: to the
    // question's result as it appears (a live region, so a screen reader
    // reads it either way), to the score once the last one is checked, and
    // to the first question when they start again. Not on arrival, unless
    // the learner just asked for new questions.
    const focusNext = useRef<FocusTarget>(focusFirst ? { kind: 'first' } : null);
    useEffect(() => {
        const target = focusNext.current;
        focusNext.current = null;
        if (target?.kind === 'result') resultRefs.current[target.index]?.focus();
        else if (target?.kind === 'score') scoreRef.current?.focus();
        else if (target?.kind === 'first') listRef.current?.querySelector('input')?.focus();
    }, [checked]);

    // A question's Check gives way to its result, and the last one's to the
    // score and Try again, so a double-click must not press what appears
    // there (./useSwapGuard.ts).
    const { mark, allowed, noRepeat } = useSwapGuard();

    const check = (index: number) => {
        if (checked[index]) return;
        mark();
        const next = checked.map((done, i) => done || i === index);
        const last = next.every(Boolean);
        focusNext.current = last ? { kind: 'score' } : { kind: 'result', index };
        setChecked(next);
        if (last) onChecked?.(scoreQuiz(questions, answers).score);
    };

    const again = () => {
        mark();
        if (onNewQuestions) {
            onNewQuestions();
            return;
        }
        focusNext.current = { kind: 'first' };
        setAnswers(questions.map(() => null));
        setChecked(questions.map(() => false));
    };

    // Enter in a typed answer checks it, once there is something to check.
    const onTypedKey = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (event.repeat || event.nativeEvent.isComposing) return;
        if ((answers[index] ?? '').trim()) check(index);
    };

    return (
        <div className="space-y-6">
            <ol ref={listRef} className="space-y-6">
                {questions.map((question, i) => {
                    const answer = answers[i];
                    const done = checked[i];
                    const right = done && isCorrect(question, answer);
                    const inputId = `${id}-q${i}`;
                    const strict = question.kind === 'typed' && question.strict;
                    const others = question.kind === 'typed' && done && !right ? otherSpellings(question) : [];
                    const describedBy = [i === firstTyped ? hintId : null, strict ? `${inputId}-strict` : null].filter(Boolean).join(' ');
                    return (
                        <li key={i}>
                            {i === firstTyped && (
                                <p id={hintId} className="mb-3 border-l-2 border-edge-strong py-0.5 pl-3 text-sm text-ink-muted">{t.learn.quiz.typedHint}</p>
                            )}
                            <fieldset disabled={done} className="space-y-3">
                                {/* The word asked about is part of the legend, so it is
                                    read out with the question. */}
                                <legend className="space-y-3">
                                    <span className="block text-sm font-semibold text-ink">
                                        <span className="mr-1 text-accent-text">{fmt(t.learn.quiz.questionN, { n: i + 1 })}.</span>
                                        <span lang={promptLang}><Mixed text={question.prompt} /></span>
                                    </span>
                                    {question.promptPa && (
                                        <span lang="pa" className="block font-gurmukhi text-3xl leading-relaxed text-ink">{question.promptPa}</span>
                                    )}
                                    {question.promptRoman && <span lang="pa-Latn" className="block text-ink-muted">{question.promptRoman}</span>}
                                </legend>

                                {question.kind === 'choice' ? (
                                    // Each choice as wide as its text: short ones share a row,
                                    // even on a phone, and a long one takes a row and wraps.
                                    <div className="flex flex-wrap gap-2">
                                        {orders[i].map((choice) => (
                                            <label
                                                key={choice}
                                                className="flex min-h-11 min-w-20 max-w-full grow cursor-pointer items-center gap-2.5 rounded-lg border border-edge bg-surface px-3 py-2 text-ink transition-colors hover:border-accent-text/40 has-[:checked]:border-accent-text has-[:checked]:bg-accent-text/10 has-[:disabled]:cursor-default"
                                            >
                                                <input
                                                    type="radio"
                                                    name={inputId}
                                                    value={choice}
                                                    checked={answer === choice}
                                                    onChange={() => setAnswer(i, choice)}
                                                    className="accent-accent-text"
                                                />
                                                <span lang={choiceLang(question)} className={question.choicesLang === 'pa' ? 'font-gurmukhi text-xl' : ''}>
                                                    {question.choicesLang ? choice : <Mixed text={choice} />}
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
                                            enterKeyHint="done"
                                            aria-describedby={describedBy || undefined}
                                            value={answer ?? ''}
                                            onChange={(e) => setAnswer(i, e.target.value)}
                                            onKeyDown={(e) => onTypedKey(e, i)}
                                            placeholder={t.learn.quiz.typedPlaceholder}
                                            className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-focus-ring sm:max-w-md"
                                        />
                                        {strict && <p id={`${inputId}-strict`} className="mt-1.5 text-sm text-ink-muted">{t.learn.quiz.strictNote}</p>}
                                    </div>
                                )}

                                {/* Inside the question's group, so it is read as part of
                                    it; named with its number among seven alike. */}
                                {!done && (
                                    <button
                                        type="button"
                                        onClick={(e) => allowed(e) && check(i)}
                                        onKeyDown={noRepeat}
                                        aria-label={fmt(t.learn.quiz.checkAria, { n: i + 1 })}
                                        className={SECONDARY_BUTTON}
                                    >
                                        {t.learn.quiz.check}
                                    </button>
                                )}
                            </fieldset>

                            {/* Always there, so its content is announced as it
                                arrives; at least as tall as the button it replaces,
                                so nothing below moves up under the pointer. */}
                            <div
                                ref={(el) => { resultRefs.current[i] = el; }}
                                tabIndex={-1}
                                aria-live="polite"
                                className={`space-y-1 text-sm outline-none ${done ? 'mt-3 min-h-11' : ''}`}
                            >
                                {done && (
                                    <>
                                        <p className={`flex items-center gap-1.5 font-semibold ${right ? 'text-good' : 'text-red-700 dark:text-red-400'}`}>
                                            {right
                                                ? <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />
                                                : <XCircleIcon className="h-5 w-5" aria-hidden="true" />}
                                            {right ? t.learn.quiz.correct : answer === null || answer.trim() === '' ? t.learn.quiz.unanswered : t.learn.quiz.incorrect}
                                        </p>
                                        {(question.kind === 'typed' || !right) && (
                                            <p className="text-ink">
                                                {answerBefore}
                                                <span lang={question.kind === 'typed' ? 'pa-Latn' : choiceLang(question)} className={question.kind === 'choice' && question.choicesLang === 'pa' ? 'font-gurmukhi text-lg' : 'font-semibold'}>
                                                    {question.kind === 'choice' && !question.choicesLang ? <Mixed text={question.answer} /> : question.answer}
                                                </span>
                                                {answerAfter}
                                            </p>
                                        )}
                                        {others.length > 0 && (
                                            <p className="text-ink">
                                                {alsoBefore}
                                                <span lang="pa-Latn" className="font-semibold">{others.join(', ')}</span>
                                                {alsoAfter}
                                            </p>
                                        )}
                                        {question.explanation && <p lang="en" className="text-ink-muted"><Mixed text={question.explanation} /></p>}
                                    </>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ol>

            <div className="flex flex-wrap items-center gap-4">
                {finished && (
                    <button type="button" onClick={(e) => allowed(e) && again()} onKeyDown={noRepeat} className={PRIMARY_BUTTON}>
                        {onNewQuestions ? t.learn.quiz.newQuestions : t.learn.quiz.tryAgain}
                    </button>
                )}
                {/* How many are checked, until the score takes its place. */}
                {!finished && (
                    <p className="text-sm text-ink-muted">
                        {fmt(t.learn.quiz.progress, { n: checked.filter(Boolean).length, total: questions.length })}
                    </p>
                )}
                <p ref={scoreRef} tabIndex={-1} aria-live="polite" className="font-semibold text-ink outline-none">
                    {result && fmt(t.learn.quiz.score, result.score)}
                </p>
            </div>
        </div>
    );
}
