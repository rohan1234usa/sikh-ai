'use client';

import { useId, useState } from 'react';
import { FlagIcon } from '@heroicons/react/24/outline';
import IntentLink from '@/app/components/IntentLink';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/app/components/buttons';
import { CharCount } from '@/app/components/form/CharCount';
import { ERROR_TEXT, Field, INPUT } from '@/app/components/form/Field';
import { useAnnouncer } from '@/app/components/useAnnouncer';
import { useModalDialog } from '@/app/components/useModalDialog';
import { useAuth } from '@/app/context/AuthContext';
import { fmt } from '@/lib/i18n/fmt';
import type { SevaCopy } from '@/lib/i18n/seva';
import { SEVA_REPORT_NOTE, SEVA_REPORT_REASONS } from '@/lib/seva/limits';
import { textLength, validateReport, type ReportErrors } from '@/lib/seva/validate';
import { useEvent } from './EventContext';
import { loadSeva, refreshPages } from './sevaClient';

const DIALOG = 'm-auto w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-edge bg-surface-raised p-0 text-ink shadow-2xl backdrop:bg-black/40';

// "Something wrong with this event?": a report goes to the site's admins,
// once per account per event. Signing in first keeps reports to real people;
// the host never sees who reported.
export function ReportControl({ copy }: { copy: SevaCopy['report'] }) {
    const { signIn, signInIntent, user } = useAuth();
    const { viewer, setIs, whenViewer } = useEvent();
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState('');

    if (viewer.kind === 'ready' && viewer.is.isHost) return null;
    const reported = viewer.kind === 'ready' && viewer.is.reported;

    // Signed in first if need be (with no await before signIn(), for
    // Safari's popup); then the form, unless it turns out this account hosts
    // the event or has already reported it, which the page then shows.
    const start = async () => {
        setNote('');
        const account = user ?? await signIn();
        if (!account) return;
        let is = viewer.kind === 'ready' && viewer.user.uid === account.uid ? viewer.is : null;
        if (!is) {
            try {
                is = await whenViewer(account);
            } catch { /* not known: the form says so if sending fails */ }
        }
        if (is?.isHost || is?.reported) return;
        setOpen(true);
    };

    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-muted">
            <FlagIcon className="h-4 w-4" aria-hidden="true" />
            {reported ? (
                <p>{copy.already}</p>
            ) : (
                <>
                    <span>{copy.prompt}</span>
                    <button type="button" onClick={start} {...(user ? {} : signInIntent)} className="min-h-6 font-semibold text-accent-text underline">
                        {copy.open}
                    </button>
                </>
            )}
            <p role="status" className={note ? 'w-full font-semibold text-ink' : undefined}>{note}</p>
            <ReportDialog
                open={open}
                copy={copy}
                onClose={() => setOpen(false)}
                onSent={() => {
                    setOpen(false);
                    setIs({ reported: true });
                    setNote(copy.sent);
                }}
            />
        </div>
    );
}

function ReportDialog({ open, copy, onClose, onSent }: { open: boolean; copy: SevaCopy['report']; onClose: () => void; onSent: () => void }) {
    const { ref, onCancel, onClick } = useModalDialog(open, onClose);
    return (
        <dialog ref={ref} onCancel={onCancel} onClick={onClick} aria-labelledby="report-title" className={DIALOG}>
            {/* Mounted while open, so each report starts blank. */}
            {open && <ReportForm copy={copy} onClose={onClose} onSent={onSent} />}
        </dialog>
    );
}

function ReportForm({ copy, onClose, onSent }: { copy: SevaCopy['report']; onClose: () => void; onSent: () => void }) {
    const { user } = useAuth();
    const { event } = useEvent();
    const [reason, setReason] = useState('');
    const [detail, setDetail] = useState('');
    const [errors, setErrors] = useState<ReportErrors>({});
    const [problem, setProblem] = useState('');
    const [busy, setBusy] = useState(false);
    const ids = useId();
    const max = SEVA_REPORT_NOTE[1];

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy || !user) return;
        const result = validateReport({ reason, note: detail });
        if (!result.ok) {
            setErrors(result.errors);
            document.getElementById(result.errors.reason ? `${ids}-reason-${SEVA_REPORT_REASONS[0]}` : `${ids}-note`)?.focus();
            return;
        }
        setErrors({});
        setBusy(true);
        setProblem('');
        try {
            await (await loadSeva()).report(user.uid, event.id, result.fields);
            onSent();
        } catch {
            setProblem(copy.errors.failed);
            setBusy(false);
        }
    };

    const reasonError = errors.reason ? copy.errors.reasonRequired : undefined;
    const noteError = errors.note === 'required' ? copy.errors.noteRequired : errors.note === 'tooLong' ? fmt(copy.errors.tooLong, { max }) : undefined;

    return (
        <form onSubmit={send} noValidate className="p-5">
            <h2 id="report-title" className="text-lg font-bold text-ink">{copy.title}</h2>
            <p className="mt-2 text-ink">{copy.intro}</p>
            <fieldset className="mt-4" aria-describedby={reasonError ? `${ids}-reason-error` : undefined}>
                <legend className="text-sm font-semibold text-ink">{copy.reasonLegend}</legend>
                {reasonError && <p id={`${ids}-reason-error`} className={`mt-1 ${ERROR_TEXT}`}>{reasonError}</p>}
                <div className="mt-2 space-y-1">
                    {SEVA_REPORT_REASONS.map((r, i) => (
                        <label key={r} className="flex min-h-11 items-center gap-3 text-ink">
                            <input
                                id={`${ids}-reason-${r}`}
                                type="radio"
                                name="reason"
                                value={r}
                                checked={reason === r}
                                onChange={() => setReason(r)}
                                className="h-5 w-5"
                                {...(i === 0 ? { 'data-initial-focus': true } : {})}
                            />
                            {copy.reasons[r]}
                        </label>
                    ))}
                </div>
            </fieldset>
            <Field id={`${ids}-note`} label={copy.note} hint={fmt(copy.noteHint, { max })} error={noteError} className="mt-4">
                {(c) => (
                    <>
                        <textarea
                            id={c.id}
                            rows={3}
                            maxLength={max}
                            value={detail}
                            onChange={(e) => setDetail(e.target.value)}
                            aria-describedby={c.describedBy}
                            aria-invalid={c.invalid || undefined}
                            className={INPUT}
                        />
                        <CharCount id={`${ids}-count`} length={textLength(detail)} max={max} count="{n} / {max}" limit={fmt(copy.errors.tooLong, { max })} />
                    </>
                )}
            </Field>
            {problem && <p role="alert" className={`mt-2 ${ERROR_TEXT}`}>{problem}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>{copy.cancel}</button>
                <button type="submit" aria-disabled={busy || undefined} className={PRIMARY_BUTTON}>{busy ? copy.sending : copy.send}</button>
            </div>
        </form>
    );
}

// An admin's tools on an event's page: whether the public sees it, and the
// way to every report.
export function AdminTools({ copy, adminHref }: { copy: SevaCopy['admin']; adminHref: string }) {
    const { event, viewer, update } = useEvent();
    const [busy, setBusy] = useState(false);
    const { announce, announcer } = useAnnouncer();
    const [problem, setProblem] = useState('');

    if (viewer.kind !== 'ready' || !viewer.is.isAdmin) return null;

    const toggle = async () => {
        if (busy) return;
        const hidden = !event.hidden;
        setBusy(true);
        setProblem('');
        try {
            await (await loadSeva()).setHidden(event.id, hidden);
            update({ hidden });
            announce(hidden ? copy.hiddenDone : copy.unhiddenDone);
            void refreshPages(event.id);
        } catch {
            setProblem(copy.actionFailed);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section aria-labelledby="admin-tools" className="rounded-xl border border-dashed border-edge-strong p-5">
            <h2 id="admin-tools" className="text-lg font-bold text-ink">{copy.heading}</h2>
            <p className="mt-1 text-sm text-ink-muted">{fmt(copy.status, { status: event.hidden ? copy.hiddenStatus : copy.visible })}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" onClick={toggle} aria-disabled={busy || undefined} className={SECONDARY_BUTTON}>
                    {event.hidden ? copy.unhide : copy.hide}
                </button>
                <IntentLink href={adminHref} className="font-semibold text-accent-text underline">{copy.reviewAll}</IntentLink>
            </div>
            {problem && <p role="alert" className={`mt-2 ${ERROR_TEXT}`}>{problem}</p>}
            {announcer}
        </section>
    );
}
