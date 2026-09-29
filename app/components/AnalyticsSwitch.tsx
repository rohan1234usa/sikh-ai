'use client';

import { useId, useSyncExternalStore } from 'react';
import { useT } from '@/app/context/LanguageContext';
import { analyticsState, subscribeAnalyticsChoice, writeAnalyticsChoice, type AnalyticsState } from '@/lib/analytics';

// The server, and the page while it hydrates, can't know the choice: until
// it's read, the switch keeps its place without claiming either state.
const notYet = (): AnalyticsState | 'pending' => 'pending';

// On /privacy, under "Counting visits": whether this browser is counted
// (lib/analytics.ts). A browser that sends Global Privacy Control is never
// counted, and the switch says so rather than offering a choice it can't
// honour. The choice holds across tabs, and is kept in this browser only.
export default function AnalyticsSwitch() {
    const t = useT().privacy.analyticsSwitch;
    const state = useSyncExternalStore(subscribeAnalyticsChoice, analyticsState, notYet);
    const stateId = `${useId()}-state`;

    return (
        <div className="rounded-xl border border-edge bg-surface-raised p-4 space-y-2">
            <label className="flex items-center justify-between gap-4 font-semibold text-ink">
                {t.label}
                {state === 'pending' ? (
                    <span aria-hidden="true" className="block h-6 w-11 shrink-0 rounded-full bg-edge" />
                ) : (
                    <span className="relative shrink-0">
                        <input
                            type="checkbox"
                            role="switch"
                            className="peer sr-only"
                            checked={state === 'on'}
                            disabled={state === 'gpc'}
                            aria-describedby={stateId}
                            onChange={(e) => writeAnalyticsChoice(e.target.checked ? 'on' : 'off')}
                        />
                        <span
                            aria-hidden="true"
                            className="block h-6 w-11 rounded-full bg-ink-faint transition-colors peer-checked:bg-accent-text peer-disabled:opacity-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-kesri after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
                        />
                    </span>
                )}
            </label>
            <p id={stateId} className="min-h-10 text-sm text-ink-muted">
                {state === 'pending' ? null : t[state]}
            </p>
            <noscript>
                <p className="text-sm text-ink-muted">{t.noScript}</p>
            </noscript>
        </div>
    );
}
