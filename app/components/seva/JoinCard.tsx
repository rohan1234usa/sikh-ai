'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BUTTON_LG, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/app/components/buttons';
import { ERROR_TEXT, Field, INPUT } from '@/app/components/form/Field';
import { useAnnouncer } from '@/app/components/useAnnouncer';
import { useAuth } from '@/app/context/AuthContext';
import { fmt } from '@/lib/i18n/fmt';
import type { SevaCopy } from '@/lib/i18n/seva';
import type { ViewerOfEvent } from '@/lib/seva/client';
import { errorKind } from '@/lib/seva/errors';
import { isFull, room, takesSignups } from '@/lib/seva/event';
import { SEVA_VOLUNTEER_TEXT } from '@/lib/seva/limits';
import { validateJoin, type JoinErrors } from '@/lib/seva/validate';
import { useEvent } from './EventContext';
import { loadSeva, refreshPages } from './sevaClient';

type Mode = 'idle' | 'form' | 'busy' | 'confirmLeave';
type Form = { name: string; shareEmail: boolean; sharePhone: boolean; phone: string };

// Joining, and everything after: the details the host sees, changing them,
// and leaving. Whatever replaces the control that was pressed takes the
// focus, so no one is left on a button that vanished. An event that takes no
// sign-ups has no Join: the card says to just come along.
export default function JoinCard({ copy, capacity, fullLabel, hostingLabel, contactFallback }: {
    copy: SevaCopy['actions'];
    hostingLabel: string;
    // "Volunteers: {count} of {spots}" and "Spots left: {n}"; "Volunteers:
    // {count}" with no limit; "No sign-up needed".
    capacity: { count: string; left: string; noLimit: string; none: string };
    fullLabel: string;
    contactFallback: string | null;
}) {
    const { signIn, signInIntent, user } = useAuth();
    const router = useRouter();
    const { event, viewer, ended, update, setIs, whenViewer } = useEvent();
    const [mode, setMode] = useState<Mode>('idle');
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState<Form>({ name: '', shareEmail: false, sharePhone: false, phone: '' });
    const [errors, setErrors] = useState<JoinErrors>({});
    const [problem, setProblem] = useState('');
    const [note, setNote] = useState('');
    const { announce, announcer } = useAnnouncer();
    const joinRef = useRef<HTMLButtonElement>(null);
    const nameRef = useRef<HTMLInputElement>(null);
    const joinedRef = useRef<HTMLHeadingElement>(null);
    const stayRef = useRef<HTMLButtonElement>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const focusNext = useRef<'join' | 'name' | 'joined' | 'stay' | null>(null);
    const ids = useId();

    // After a join or a leave, the server builds this page and the board
    // again; then this tab lets go of the copies it kept (router.refresh), so
    // Back to the board shows the new count beside the new mark rather than
    // the count from before.
    const refreshAfterChange = () => { void refreshPages(event.id).then(() => router.refresh()); };

    const is = viewer.kind === 'ready' ? viewer.is : null;
    const joined = !!is?.signup;
    const r = room(event);
    const full = isFull(event);
    const open = event.status === 'open' && !ended && !event.hidden;

    // Focus follows what took the pressed control's place.
    useEffect(() => {
        const target = focusNext.current;
        focusNext.current = null;
        // After leaving an event that's over or off, there's no Join to
        // return to: the card's heading takes the focus instead.
        if (target === 'join') (joinRef.current ?? headingRef.current)?.focus();
        if (target === 'name') nameRef.current?.focus();
        if (target === 'joined') joinedRef.current?.focus();
        if (target === 'stay') stayRef.current?.focus();
    });

    const openForm = (prefill: Form) => {
        setForm(prefill);
        setErrors({});
        setProblem('');
        setMode('form');
        focusNext.current = 'name';
    };

    // Signed in first if need be (with no await before signIn(): Safari
    // blocks a popup that isn't the click's own), then, once it's known what
    // this account is to the event, the form; or, if they'd already joined,
    // what they joined with.
    const startJoin = async () => {
        setNote('');
        const account = user ?? await signIn();
        if (!account) {
            setNote(copy.signInFailed);
            return;
        }
        // What this account is to the event: known already, or (just signed
        // in) once it's been read.
        const known = viewer.kind === 'ready' && viewer.user.uid === account.uid;
        if (!known) setNote(copy.checking);
        let is: ViewerOfEvent;
        try {
            is = await whenViewer(account);
        } catch {
            setNote(copy.errors.failed);
            return;
        }
        if (!known) setNote('');
        if (is.signup) {
            focusNext.current = 'joined';
            setMode('idle');
        } else if (!is.isHost) {
            openForm({ name: account.displayName ?? '', shareEmail: false, sharePhone: false, phone: '' });
        }
    };

    const cancelForm = () => {
        setMode('idle');
        if (editing) {
            setEditing(false);
            focusNext.current = 'joined';
        } else {
            focusNext.current = 'join';
        }
    };

    const errorText = (field: 'name' | 'phone') => {
        const e = errors[field];
        if (!e) return undefined;
        if (e === 'tooLong') return fmt(copy.errors.tooLong, { max: SEVA_VOLUNTEER_TEXT[field][1] });
        if (field === 'name') return copy.errors.nameRequired;
        return e === 'required' ? copy.errors.phoneRequired : copy.errors.phoneInvalid;
    };

    // Why a join was refused: the event as it is now says, or null if it
    // can't be read.
    const refusal = async (): Promise<string | null> => {
        try {
            const fresh = await (await loadSeva()).getEvent(event.id);
            if (!fresh) return copy.errors.closed;
            update({ status: fresh.status, volunteerCount: fresh.volunteerCount, spots: fresh.spots, endsAt: fresh.endsAt, cancelNote: fresh.cancelNote });
            if (fresh.endsAt <= Date.now()) return copy.errors.ended;
            if (fresh.status !== 'open' || !takesSignups(fresh)) return copy.errors.closed;
            if (isFull(fresh)) return copy.errors.full;
        } catch { /* no answer: say so below */ }
        return null;
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (mode === 'busy' || !user) return;
        const result = validateJoin({ name: form.name, shareEmail: form.shareEmail, email: user.email ?? '', sharePhone: form.sharePhone, phone: form.phone });
        if (!result.ok) {
            setErrors(result.errors);
            (result.errors.name ? nameRef.current : document.getElementById(`${ids}-phone`))?.focus();
            return;
        }
        setErrors({});
        setProblem('');
        setMode('busy');
        try {
            const seva = await loadSeva();
            if (editing && is?.signup) {
                await seva.updateSignup(event.id, is.signup.volunteerId, result.fields);
                setIs({ volunteer: { key: is.signup.volunteerId, joinedAt: is.volunteer?.joinedAt ?? Date.now(), ...result.fields } });
                setEditing(false);
                setMode('idle');
                focusNext.current = 'joined';
                announce(copy.detailsSaved);
                return;
            }
            const signup = await seva.join(user.uid, event.id, result.fields);
            setIs({ signup, volunteer: { key: signup.volunteerId, joinedAt: signup.joinedAt, ...result.fields } });
            update({ volunteerCount: event.volunteerCount + 1 });
            setMode('idle');
            focusNext.current = 'joined';
            refreshAfterChange();
        } catch (error) {
            const why = !editing && errorKind(error) === 'denied' ? await refusal() : null;
            if (why) {
                // The event changed under the form, which the card may no
                // longer show (it's full, or closed): the reason goes in the
                // card's note, and the focus to Join, or else the heading.
                setMode('idle');
                setNote(why);
                focusNext.current = 'join';
                return;
            }
            setMode('form');
            setProblem(editing ? copy.errors.saveFailed : copy.errors.failed);
        }
    };

    const leave = async () => {
        if (!user || !is?.signup) return;
        setMode('busy');
        setProblem('');
        try {
            await (await loadSeva()).leave(user.uid, event.id, is.signup.volunteerId);
            setIs({ signup: null, volunteer: null });
            update({ volunteerCount: Math.max(0, event.volunteerCount - 1) });
            setMode('idle');
            setNote(open ? copy.left : copy.signupRemoved);
            focusNext.current = 'join';
            refreshAfterChange();
        } catch {
            setMode(open ? 'confirmLeave' : 'idle');
            setProblem(copy.errors.leaveFailed);
        }
    };

    const capacityLine = (
        <p className="text-ink-muted">
            {r.mode === 'none' ? capacity.none
                : r.mode === 'unlimited' ? fmt(capacity.noLimit, { count: r.joined })
                    : `${fmt(capacity.count, { count: r.joined, spots: r.spots })} · ${r.full ? fullLabel : fmt(capacity.left, { n: r.left })}`}
        </p>
    );

    const shared = is?.volunteer;
    const form_ = (mode === 'form' || mode === 'busy') && (
        <form onSubmit={submit} noValidate className="mt-4 space-y-4" aria-labelledby={`${ids}-legend`}>
            <p id={`${ids}-legend`} className="font-semibold text-ink">{copy.formLegend}</p>
            <Field id={`${ids}-name`} label={copy.name} hint={copy.nameHint} error={errorText('name')}>
                {(c) => (
                    <input
                        ref={nameRef}
                        id={c.id}
                        type="text"
                        autoComplete="name"
                        required
                        maxLength={SEVA_VOLUNTEER_TEXT.name[1]}
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        aria-describedby={c.describedBy}
                        aria-invalid={c.invalid || undefined}
                        className={INPUT}
                    />
                )}
            </Field>
            <fieldset aria-describedby={`${ids}-contact-hint`}>
                <legend className="text-sm font-semibold text-ink">{copy.contactLegend}</legend>
                <p id={`${ids}-contact-hint`} className="mt-1 text-sm text-ink-muted">{copy.contactHint}</p>
                {user?.email && (
                    <label className="mt-2 flex min-h-11 items-center gap-3 text-ink">
                        <input type="checkbox" className="h-5 w-5" checked={form.shareEmail} onChange={(e) => setForm({ ...form, shareEmail: e.target.checked })} />
                        <span className="[overflow-wrap:anywhere]">{fmt(copy.shareEmail, { email: user.email })}</span>
                    </label>
                )}
                <label className="flex min-h-11 items-center gap-3 text-ink">
                    <input type="checkbox" className="h-5 w-5" checked={form.sharePhone} onChange={(e) => setForm({ ...form, sharePhone: e.target.checked })} />
                    {copy.sharePhone}
                </label>
                {form.sharePhone && (
                    <Field id={`${ids}-phone`} label={copy.phone} error={errorText('phone')} className="mt-2">
                        {(c) => (
                            <input
                                id={c.id}
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                maxLength={SEVA_VOLUNTEER_TEXT.phone[1]}
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                aria-describedby={c.describedBy}
                                aria-invalid={c.invalid || undefined}
                                className={INPUT}
                            />
                        )}
                    </Field>
                )}
            </fieldset>
            {problem && <p role="alert" className={ERROR_TEXT}>{problem}</p>}
            <div className="flex flex-wrap gap-3">
                <button type="submit" aria-disabled={mode === 'busy' || undefined} className={`${PRIMARY_BUTTON} ${BUTTON_LG}`}>
                    {mode === 'busy' ? (editing ? copy.saving : copy.joining) : editing ? copy.saveDetails : copy.confirm}
                </button>
                <button type="button" onClick={cancelForm} className={`${SECONDARY_BUTTON} ${BUTTON_LG}`}>{copy.cancel}</button>
            </div>
        </form>
    );

    let body: React.ReactNode;
    if (is?.isHost && !joined) {
        body = (
            <div className="space-y-2">
                <p className="font-semibold text-ink">{hostingLabel}</p>
                {capacityLine}
            </div>
        );
    } else if (joined && !editing) {
        const stillOn = open;
        body = (
            <div className="space-y-3">
                <h3 ref={joinedRef} tabIndex={-1} className="font-bold text-ink">{stillOn ? copy.joinedTitle : copy.wasJoined}</h3>
                {stillOn && (
                    <>
                        <p className="text-ink">{copy.joinedBody}</p>
                        {shared?.email && <p className="text-ink-muted">{copy.hostSeesEmail}</p>}
                        {shared?.phone && <p className="text-ink-muted">{copy.hostSeesPhone}</p>}
                        {capacityLine}
                    </>
                )}
                {mode === 'confirmLeave' || (mode === 'busy' && !editing) ? (
                    <div role="group" aria-labelledby={`${ids}-leave`} className="rounded-lg border border-edge-strong p-3">
                        <p id={`${ids}-leave`} className="text-ink">{r.mode === 'limited' ? copy.leavePrompt : copy.leavePromptNoLimit}</p>
                        {problem && <p role="alert" className={`mt-2 ${ERROR_TEXT}`}>{problem}</p>}
                        <div className="mt-3 flex flex-wrap gap-3">
                            <button type="button" onClick={leave} aria-disabled={mode === 'busy' || undefined} className={`${SECONDARY_BUTTON} ${BUTTON_LG}`}>
                                {mode === 'busy' ? copy.leaving : copy.leaveConfirm}
                            </button>
                            <button ref={stayRef} type="button" onClick={() => { setMode('idle'); focusNext.current = 'joined'; }} className={`${PRIMARY_BUTTON} ${BUTTON_LG}`}>
                                {copy.leaveKeep}
                            </button>
                        </div>
                    </div>
                ) : stillOn ? (
                    <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={() => { setEditing(true); openForm({ name: shared?.name ?? '', shareEmail: !!shared?.email, sharePhone: !!shared?.phone, phone: shared?.phone ?? '' }); }} className={`${SECONDARY_BUTTON} ${BUTTON_LG}`}>
                            {copy.changeDetails}
                        </button>
                        <button type="button" onClick={() => { setMode('confirmLeave'); focusNext.current = 'stay'; }} className={`${SECONDARY_BUTTON} ${BUTTON_LG}`}>
                            {copy.leave}
                        </button>
                    </div>
                ) : (
                    <>
                        {problem && <p role="alert" className={ERROR_TEXT}>{problem}</p>}
                        <button type="button" onClick={leave} className={`${SECONDARY_BUTTON} ${BUTTON_LG}`}>{copy.removeSignup}</button>
                    </>
                )}
            </div>
        );
    } else if (joined && editing) {
        body = form_;
    } else if (r.mode === 'none') {
        body = open ? <p className="text-ink">{copy.noSignupBody}</p> : capacityLine;
    } else if (!open) {
        body = note ? null : capacityLine;
    } else if (full) {
        body = (
            <div className="space-y-2">
                <h3 className="font-bold text-ink">{copy.fullTitle}</h3>
                <p className="text-ink-muted">{copy.fullBody}</p>
                {capacityLine}
            </div>
        );
    } else {
        body = (
            <div className="space-y-3">
                {capacityLine}
                {mode === 'idle' || mode === 'confirmLeave' ? (
                    <>
                        <button ref={joinRef} type="button" onClick={startJoin} {...(user ? {} : signInIntent)} className={`${PRIMARY_BUTTON} ${BUTTON_LG}`}>
                            {copy.join}
                        </button>
                        {!user && <p className="text-sm text-ink-muted in-data-[auth=1]:hidden">{copy.signInFirst}</p>}
                        {contactFallback && !user && <p className="text-sm text-ink-muted [overflow-wrap:anywhere]">{contactFallback}</p>}
                    </>
                ) : form_}
            </div>
        );
    }

    return (
        <section aria-labelledby={`${ids}-heading`} className="rounded-xl border border-edge bg-surface-raised p-5 shadow-sm">
            <h2 ref={headingRef} id={`${ids}-heading`} tabIndex={-1} className="text-lg font-bold text-ink">{copy.joinHeading}</h2>
            <div className="mt-3">{body}</div>
            <p role="status" className={note ? 'mt-3 text-sm font-semibold text-ink' : undefined}>{note}</p>
            {announcer}
        </section>
    );
}
