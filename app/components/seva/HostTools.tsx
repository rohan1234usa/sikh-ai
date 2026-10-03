'use client';

import { useEffect, useRef, useState } from 'react';
import { ClipboardIcon, EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';
import IntentLink from '@/app/components/IntentLink';
import { DANGER_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/app/components/buttons';
import { CharCount } from '@/app/components/form/CharCount';
import { ERROR_TEXT, Field, INPUT } from '@/app/components/form/Field';
import { useAnnouncer } from '@/app/components/useAnnouncer';
import { useModalDialog } from '@/app/components/useModalDialog';
import type { Lang } from '@/lib/i18n/config';
import { formatDate } from '@/lib/i18n/date';
import { fmt } from '@/lib/i18n/fmt';
import type { SevaCopy } from '@/lib/i18n/seva';
import { SEVA_TEXT } from '@/lib/seva/limits';
import { telUrl } from '@/lib/seva/links';
import type { Volunteer } from '@/lib/seva/model';
import { textLength, validateCancelNote } from '@/lib/seva/validate';
import { useEvent } from './EventContext';
import { loadSeva, refreshPages } from './sevaClient';

const DIALOG = 'm-auto w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-edge bg-surface-raised p-0 text-ink shadow-2xl backdrop:bg-black/40';

// The host's own tools, on their event's page: edit, see who's coming, post
// it again, cancel or reopen. Only the host sees them; the rules are what
// keep everyone else out.
export default function HostTools({ lang, copy, cancelCopy, volunteersCopy, retry, cancelledMessage, editHref, postAgainHref }: {
    lang: Lang;
    copy: SevaCopy['host'];
    // Said once the event is cancelled.
    cancelledMessage: string;
    retry: string;
    cancelCopy: SevaCopy['cancelDialog'];
    volunteersCopy: SevaCopy['volunteers'];
    editHref: string;
    postAgainHref: string;
}) {
    const { event, viewer, ended, update } = useEvent();
    const [dialog, setDialog] = useState<'volunteers' | 'cancel' | null>(null);
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState('');
    const { announce, announcer } = useAnnouncer();

    if (viewer.kind !== 'ready' || !viewer.is.isHost) return null;
    const cancelled = event.status === 'cancelled';

    const reopen = async () => {
        if (busy) return;
        setBusy(true);
        setProblem('');
        try {
            await (await loadSeva()).setStatus(event.id, 'open', '');
            update({ status: 'open', cancelNote: '' });
            announce(copy.reopened);
            void refreshPages(event.id);
        } catch {
            setProblem(copy.reopenFailed);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section aria-labelledby="host-tools" className="rounded-xl border border-edge bg-surface-raised p-5 shadow-sm">
            <h2 id="host-tools" className="text-lg font-bold text-ink">{copy.heading}</h2>
            <p className="mt-1 text-sm text-ink-muted">{copy.intro}</p>
            {event.hidden && <p className="mt-3 rounded-lg border border-edge-strong p-3 text-ink">{copy.hiddenNotice}</p>}
            <div className="mt-4 flex flex-wrap gap-3">
                <IntentLink href={editHref} className={SECONDARY_BUTTON}>{copy.edit}</IntentLink>
                <button type="button" onClick={() => setDialog('volunteers')} className={SECONDARY_BUTTON}>
                    {fmt(copy.volunteers, { n: event.volunteerCount })}
                </button>
                <IntentLink href={postAgainHref} className={SECONDARY_BUTTON} aria-describedby="post-again-hint">{copy.postAgain}</IntentLink>
                {!ended && (cancelled ? (
                    <button type="button" onClick={reopen} aria-disabled={busy || undefined} className={SECONDARY_BUTTON}>
                        {busy ? copy.reopening : copy.reopen}
                    </button>
                ) : (
                    <button type="button" onClick={() => setDialog('cancel')} className={SECONDARY_BUTTON}>{copy.cancel}</button>
                ))}
            </div>
            <p id="post-again-hint" className="mt-2 text-sm text-ink-muted">{copy.postAgainHint}</p>
            {problem && <p role="alert" className={`mt-2 ${ERROR_TEXT}`}>{problem}</p>}
            {announcer}

            <VolunteersDialog open={dialog === 'volunteers'} onClose={() => setDialog(null)} copy={volunteersCopy} retry={retry} lang={lang} />
            <CancelDialog
                open={dialog === 'cancel'}
                onClose={() => setDialog(null)}
                copy={cancelCopy}
                onSeeVolunteers={() => setDialog('volunteers')}
                onCancelled={(note) => {
                    update({ status: 'cancelled', cancelNote: note });
                    setDialog(null);
                    announce(cancelledMessage);
                }}
            />
        </section>
    );
}

function VolunteersDialog({ open, onClose, copy, retry, lang }: {
    open: boolean;
    onClose: () => void;
    copy: SevaCopy['volunteers'];
    retry: string;
    lang: Lang;
}) {
    const { ref, onCancel, onClick } = useModalDialog(open, onClose);
    return (
        <dialog ref={ref} onCancel={onCancel} onClick={onClick} aria-labelledby="volunteers-title" className={DIALOG}>
            {/* Mounted while open, so each opening reads the list afresh. */}
            {open && <VolunteersBody onClose={onClose} copy={copy} retry={retry} lang={lang} />}
        </dialog>
    );
}

function VolunteersBody({ onClose, copy, retry, lang }: { onClose: () => void; copy: SevaCopy['volunteers']; retry: string; lang: Lang }) {
    const { event } = useEvent();
    const [list, setList] = useState<Volunteer[] | null | 'failed'>(null);
    const [attempt, setAttempt] = useState(0);
    const { announce, announcer } = useAnnouncer();

    useEffect(() => {
        let cancelled = false;
        loadSeva()
            .then((seva) => seva.volunteers(event.id))
            .then((v) => { if (!cancelled) setList(v); })
            .catch(() => { if (!cancelled) setList('failed'); });
        return () => { cancelled = true; };
    }, [event.id, attempt]);

    const copyText = async (text: string, said: string) => {
        try {
            await navigator.clipboard.writeText(text);
            announce(said);
        } catch { /* nothing copied; the details are on screen */ }
    };

    const people = Array.isArray(list) ? list : [];
    const emails = people.map((v) => v.email).filter(Boolean);
    const phones = people.map((v) => v.phone).filter(Boolean);

    return (
        <div className="p-5">
            <h2 id="volunteers-title" tabIndex={-1} data-initial-focus className="text-lg font-bold text-ink">{copy.title}</h2>
            <p className="mt-1 text-sm text-ink-muted [overflow-wrap:anywhere]">{event.title}</p>
            <p className="mt-1 text-sm text-ink">{fmt(copy.count, { count: event.volunteerCount, spots: event.spots })}</p>
            {list === null && <p role="status" className="mt-4 text-ink-muted">{copy.loading}</p>}
            {list === 'failed' && (
                <div className="mt-4">
                    <p role="alert" className={ERROR_TEXT}>{copy.failed}</p>
                    <button
                        type="button"
                        onClick={() => {
                            setList(null);
                            setAttempt((n) => n + 1);
                        }}
                        className="mt-2 font-semibold text-accent-text underline"
                    >
                        {retry}
                    </button>
                </div>
            )}
            {Array.isArray(list) && (list.length === 0 ? (
                <p className="mt-4 text-ink-muted">{copy.empty}</p>
            ) : (
                <>
                    <ul className="mt-4 divide-y divide-edge">
                        {list.map((v) => (
                            <li key={v.key} className="py-3">
                                <p className="font-semibold text-ink [overflow-wrap:anywhere]">{v.name}</p>
                                <p className="text-sm text-ink-muted">{fmt(copy.joinedOn, { date: formatDate(v.joinedAt, lang) })}</p>
                                {!v.email && !v.phone && <p className="text-sm text-ink-muted">{copy.noContact}</p>}
                                {v.email && (
                                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                                        <EnvelopeIcon className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                                        <a href={`mailto:${v.email}`} aria-label={fmt(copy.email, { name: v.name })} className="text-accent-text underline [overflow-wrap:anywhere]">{v.email}</a>
                                        <button type="button" onClick={() => copyText(v.email, copy.copied)} aria-label={fmt(copy.copyEmail, { name: v.name })} className="rounded p-1.5 text-ink-muted hover:bg-edge/60 hover:text-ink">
                                            <ClipboardIcon className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                    </p>
                                )}
                                {v.phone && (
                                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                                        <PhoneIcon className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                                        <a href={telUrl(v.phone)} aria-label={fmt(copy.call, { name: v.name })} className="text-accent-text underline">{v.phone}</a>
                                        <button type="button" onClick={() => copyText(v.phone, copy.copied)} aria-label={fmt(copy.copyPhone, { name: v.name })} className="rounded p-1.5 text-ink-muted hover:bg-edge/60 hover:text-ink">
                                            <ClipboardIcon className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-3">
                        {emails.length > 0 && (
                            <button type="button" onClick={() => copyText(emails.join(', '), fmt(copy.copiedEmails, { n: emails.length }))} className={SECONDARY_BUTTON}>
                                {copy.copyAllEmails}
                            </button>
                        )}
                        {phones.length > 0 && (
                            <button type="button" onClick={() => copyText(phones.join('\n'), fmt(copy.copiedPhones, { n: phones.length }))} className={SECONDARY_BUTTON}>
                                {copy.copyAllPhones}
                            </button>
                        )}
                    </div>
                </>
            ))}
            <p className="mt-4 text-sm text-ink-muted">{copy.privacy}</p>
            <div className="mt-4 flex justify-end">
                <button type="button" onClick={onClose} className={PRIMARY_BUTTON}>{copy.close}</button>
            </div>
            {announcer}
        </div>
    );
}

function CancelDialog({ open, onClose, copy, onSeeVolunteers, onCancelled }: {
    open: boolean;
    onClose: () => void;
    copy: SevaCopy['cancelDialog'];
    onSeeVolunteers: () => void;
    onCancelled: (note: string) => void;
}) {
    const { ref, onCancel, onClick } = useModalDialog(open, onClose);
    return (
        <dialog ref={ref} onCancel={onCancel} onClick={onClick} aria-labelledby="cancel-title" className={DIALOG}>
            {open && <CancelBody onClose={onClose} copy={copy} onSeeVolunteers={onSeeVolunteers} onCancelled={onCancelled} />}
        </dialog>
    );
}

function CancelBody({ onClose, copy, onSeeVolunteers, onCancelled }: {
    onClose: () => void;
    copy: SevaCopy['cancelDialog'];
    onSeeVolunteers: () => void;
    onCancelled: (note: string) => void;
}) {
    const { event } = useEvent();
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState('');
    const fieldRef = useRef<HTMLTextAreaElement>(null);
    const max = SEVA_TEXT.cancelNote[1];

    const confirm = async () => {
        if (busy) return;
        const checked = validateCancelNote(note);
        if (!checked.ok) {
            setProblem(fmt(copy.tooLong, { max }));
            fieldRef.current?.focus();
            return;
        }
        setBusy(true);
        setProblem('');
        try {
            await (await loadSeva()).setStatus(event.id, 'cancelled', checked.note);
            void refreshPages(event.id);
            onCancelled(checked.note);
        } catch {
            setProblem(copy.failed);
            setBusy(false);
        }
    };

    return (
        <div className="p-5">
            <h2 id="cancel-title" className="text-lg font-bold text-ink">{copy.title}</h2>
            <p className="mt-2 text-ink">{copy.body}</p>
            <button type="button" onClick={onSeeVolunteers} className="mt-2 font-semibold text-accent-text underline">{copy.seeVolunteers}</button>
            <Field id="cancel-note" label={copy.note} hint={copy.noteHint} className="mt-4">
                {(c) => (
                    <>
                        <textarea
                            ref={fieldRef}
                            id={c.id}
                            rows={3}
                            maxLength={max}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            aria-describedby={c.describedBy}
                            className={INPUT}
                        />
                        <CharCount id="cancel-note-count" length={textLength(note)} max={max} count="{n} / {max}" limit={fmt(copy.tooLong, { max })} />
                    </>
                )}
            </Field>
            {problem && <p role="alert" className={`mt-2 ${ERROR_TEXT}`}>{problem}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button type="button" data-initial-focus onClick={onClose} className={SECONDARY_BUTTON}>{copy.keep}</button>
                <button type="button" onClick={confirm} aria-disabled={busy || undefined} className={DANGER_BUTTON}>
                    {busy ? copy.cancelling : copy.confirm}
                </button>
            </div>
        </div>
    );
}
