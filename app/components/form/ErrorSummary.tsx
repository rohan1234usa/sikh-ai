'use client';

import type { Ref } from 'react';

export type FormError = { fieldId: string; message: string };

// What needs fixing, at the top of a form, after a submit that failed: the
// caller focuses it, so it's read at once, and each line leads to its field.
// No role="alert": the focus already announces it, and twice is noise.
export function ErrorSummary({ ref, title, errors }: { ref?: Ref<HTMLDivElement>; title: string; errors: FormError[] }) {
    if (errors.length === 0) return null;
    return (
        <div
            ref={ref}
            tabIndex={-1}
            role="group"
            aria-labelledby="error-summary-title"
            className="rounded-xl border-2 border-red-700 dark:border-red-400 bg-surface-raised p-4"
        >
            <h2 id="error-summary-title" className="font-bold text-ink">{title}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
                {errors.map((e) => (
                    <li key={e.fieldId}>
                        <a
                            href={`#${e.fieldId}`}
                            onClick={(event) => {
                                event.preventDefault();
                                focusField(e.fieldId);
                            }}
                            className="font-semibold text-red-700 dark:text-red-400 underline"
                        >
                            {e.message}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// The field itself, or for a group (a fieldset) its first control, brought to
// the middle of the screen, clear of the sticky navbar.
export function focusField(fieldId: string) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    const target = el instanceof HTMLFieldSetElement
        ? el.querySelector<HTMLElement>('input, select, textarea, button') ?? el
        : el;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'center' });
}
