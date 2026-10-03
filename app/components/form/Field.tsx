import type { ReactNode } from 'react';

// One labelled control: the label, a hint, the error (above the control, so a
// screen reader hears what's wrong before the field), then the control. The
// caller gives the id, so an error summary can link to the field, and spreads
// `describedBy` and `invalid` onto its input.
//
// Forms here set noValidate and say what's wrong in the page's own language;
// the browser's bubbles would speak the browser's.

export const INPUT =
    'block w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2.5 text-base text-ink placeholder:text-ink-muted aria-invalid:border-red-700 dark:aria-invalid:border-red-400';

export const ERROR_TEXT = 'text-sm font-semibold text-red-700 dark:text-red-400';

export type FieldControl = { id: string; describedBy: string | undefined; invalid: boolean };

export const describedBy = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;

export function Field({ id, label, optional, hint, error, children, className }: {
    id: string;
    label: ReactNode;
    // "(optional)", in the page's language, for a field that may stay empty.
    optional?: string;
    hint?: ReactNode;
    error?: string;
    children: (control: FieldControl) => ReactNode;
    className?: string;
}) {
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    return (
        <div className={className}>
            <label htmlFor={id} className="block text-sm font-semibold text-ink">
                {label}
                {optional && <span className="font-normal text-ink-muted"> {optional}</span>}
            </label>
            {hint && <p id={hintId} className="mt-1 text-sm text-ink-muted">{hint}</p>}
            {error && <p id={errorId} className={`mt-1 ${ERROR_TEXT}`}>{error}</p>}
            <div className="mt-2">{children({ id, describedBy: describedBy(hintId, errorId), invalid: !!error })}</div>
        </div>
    );
}
