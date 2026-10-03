import type { ReactNode } from 'react';
import { ERROR_TEXT, describedBy } from './Field';

// A group of fields under one legend: a form's section ("When"), or one
// question answered by radios or checkboxes. For a question, the error follows
// the legend, and the group is described by it, so each option is read with
// what's wrong.
export function Fieldset({ id, legend, hint, error, size = 'section', children, className }: {
    id: string;
    legend: ReactNode;
    hint?: ReactNode;
    error?: string;
    size?: 'section' | 'question';
    children: ReactNode;
    className?: string;
}) {
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    return (
        <fieldset id={id} aria-describedby={describedBy(hintId, errorId)} className={className}>
            <legend className={size === 'section' ? 'text-lg font-semibold text-ink' : 'text-sm font-semibold text-ink'}>
                {legend}
            </legend>
            {hint && <p id={hintId} className="mt-1 text-sm text-ink-muted">{hint}</p>}
            {error && <p id={errorId} className={`mt-1 ${ERROR_TEXT}`}>{error}</p>}
            <div className={size === 'section' ? 'mt-4 space-y-5' : 'mt-2'}>{children}</div>
        </fieldset>
    );
}
