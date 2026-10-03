'use client';

import { useEffect, useRef, useState } from 'react';
import IntentLink from '@/app/components/IntentLink';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/app/components/buttons';
import { ERROR_TEXT } from '@/app/components/form/Field';
import { useAuth } from '@/app/context/AuthContext';
import { useT } from '@/app/context/LanguageContext';
import type { Lang } from '@/lib/i18n/config';
import { formatDate } from '@/lib/i18n/date';
import { fmt } from '@/lib/i18n/fmt';
import type { SevaCopy } from '@/lib/i18n/seva';
import type { Report, SevaEvent } from '@/lib/seva/model';
import { formatDate as formatEventDate } from '@/lib/seva/time';
import { loadSeva, refreshPages } from './sevaClient';

type Row = { eventId: string; event: SevaEvent | null; reports: Report[] };
type Loaded = { uid: string; state: 'notAdmin' } | { uid: string; state: 'failed' } | { uid: string; state: 'ready'; rows: Row[] };

// The admins' page: events people reported, and events hidden from the
// public, with the two things an admin does about them: hide or show the
// event, and dismiss the reports once dealt with (which deletes them).
export default function AdminReview({ lang, copy, reasons, hostedBy, retry, eventBase }: {
    lang: Lang;
    copy: SevaCopy['admin'];
    reasons: SevaCopy['report']['reasons'];
    hostedBy: string;
    retry: string;
    eventBase: string;
}) {
    const { user, loading, signIn, signInIntent } = useAuth();
    const t = useT();
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [tab, setTab] = useState<'reported' | 'hidden'>('reported');
    // Rows acted on stay where they are, saying what was done, until the tab
    // changes: one that left the list at once would take the focus with it.
    const [kept, setKept] = useState<string[]>([]);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        const settle = (next: Loaded) => { if (!cancelled) setLoaded(next); };
        (async () => {
            const seva = await loadSeva();
            if (!(await seva.isAdmin(user.uid))) return settle({ uid: user.uid, state: 'notAdmin' });
            const [reports, hidden] = await Promise.all([seva.reports(), seva.hiddenEvents()]);
            const byEvent = new Map<string, Report[]>();
            for (const r of reports) byEvent.set(r.eventId, [...(byEvent.get(r.eventId) ?? []), r]);
            const ids = [...new Set([...byEvent.keys(), ...hidden.map((e) => e.id)])];
            const known = new Map(hidden.map((e) => [e.id, e]));
            const rows = await Promise.all(ids.map(async (id) => ({
                eventId: id,
                event: known.get(id) ?? await seva.getEvent(id, { allowHidden: true }),
                reports: byEvent.get(id) ?? [],
            })));
            settle({ uid: user.uid, state: 'ready', rows });
        })().catch(() => settle({ uid: user.uid, state: 'failed' }));
        return () => { cancelled = true; };
    }, [user, attempt]);

    if (!user) {
        if (loading) return <p role="status" className="mt-6 text-ink-muted">{copy.loading}</p>;
        return (
            <div className="mt-6 rounded-xl border border-edge bg-surface-raised p-5">
                <p className="text-ink">{copy.signIn}</p>
                <button type="button" onClick={() => void signIn()} {...signInIntent} className={`mt-3 ${PRIMARY_BUTTON}`}>{t.nav.signIn}</button>
            </div>
        );
    }
    const current = loaded?.uid === user.uid ? loaded : null;
    if (!current) return <p role="status" className="mt-6 text-ink-muted">{copy.loading}</p>;
    if (current.state === 'notAdmin') return <p className="mt-6 text-ink">{copy.notAdmin}</p>;
    if (current.state === 'failed') {
        return (
            <p className="mt-6 text-ink">
                <span role="alert">{copy.failed}</span>{' '}
                <button type="button" onClick={() => { setLoaded(null); setAttempt((n) => n + 1); }} className="font-semibold text-accent-text underline">{retry}</button>
            </p>
        );
    }

    const rows = current.rows.filter((r) => kept.includes(r.eventId) || (tab === 'reported' ? r.reports.length > 0 : r.event?.hidden));
    const replace = (eventId: string, next: Partial<Row>) => {
        setKept((k) => (k.includes(eventId) ? k : [...k, eventId]));
        setLoaded((l) => (l && l.state === 'ready'
            ? { ...l, rows: l.rows.map((r) => (r.eventId === eventId ? { ...r, ...next } : r)) }
            : l));
    };

    return (
        <div className="mt-6 space-y-6">
            <fieldset>
                <legend className="text-sm font-semibold text-ink">{copy.tabsAria}</legend>
                <div className="mt-2 flex flex-wrap gap-4">
                    {(['reported', 'hidden'] as const).map((t) => (
                        <label key={t} className="flex min-h-11 items-center gap-2 text-ink">
                            <input type="radio" name="admin-tab" className="h-5 w-5" checked={tab === t} onChange={() => { setTab(t); setKept([]); }} />
                            {t === 'reported' ? copy.reported : copy.hiddenTab}
                        </label>
                    ))}
                </div>
            </fieldset>
            <p role="status" className="text-sm text-ink-muted">{fmt(copy.count, { n: rows.length })}</p>
            {rows.length === 0 ? (
                <p className="text-ink-muted">{tab === 'reported' ? copy.emptyReported : copy.emptyHidden}</p>
            ) : (
                <ul className="space-y-4">
                    {rows.map((row) => (
                        <li key={row.eventId}>
                            <AdminRow row={row} lang={lang} copy={copy} reasons={reasons} hostedBy={hostedBy} eventBase={eventBase} onChange={(next) => replace(row.eventId, next)} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function AdminRow({ row, lang, copy, reasons, hostedBy, eventBase, onChange }: {
    row: Row;
    lang: Lang;
    copy: SevaCopy['admin'];
    reasons: SevaCopy['report']['reasons'];
    hostedBy: string;
    eventBase: string;
    onChange: (next: Partial<Row>) => void;
}) {
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');
    const [problem, setProblem] = useState('');
    const headingRef = useRef<HTMLHeadingElement>(null);
    const { event, reports } = row;
    const titleId = `admin-${row.eventId}`;
    const name = event?.title ?? row.eventId;

    // `next` is the row afterwards; with no button left to keep the focus
    // (the reports dismissed), the row's heading takes it.
    const act = async (work: () => Promise<void>, done: string, next: Partial<Row>, focusHeading = false) => {
        if (busy) return;
        setBusy(true);
        setProblem('');
        try {
            await work();
            setNote(done);
            onChange(next);
            if (focusHeading) headingRef.current?.focus();
            void refreshPages(row.eventId);
        } catch {
            setProblem(copy.actionFailed);
        } finally {
            setBusy(false);
        }
    };

    return (
        <article aria-labelledby={titleId} className="rounded-xl border border-edge bg-surface-raised p-5 shadow-sm">
            <h2 ref={headingRef} id={titleId} tabIndex={-1} className="text-lg font-bold text-ink [overflow-wrap:anywhere]">
                {event ? <IntentLink href={`${eventBase}${event.id}`} className="hover:underline">{event.title}</IntentLink> : copy.missingEvent}
            </h2>
            {event && (
                <>
                    <p className="mt-1 text-sm text-ink-muted [overflow-wrap:anywhere]">
                        {fmt(hostedBy, { name: event.organizer })} · {formatEventDate(event.startsAt, event.timeZone, lang)} · {event.city}
                    </p>
                    <p className="mt-1 text-sm text-ink">{fmt(copy.status, { status: event.hidden ? copy.hiddenStatus : copy.visible })}</p>
                </>
            )}
            {reports.length > 0 && (
                <>
                    <p className="mt-3 text-sm font-semibold text-ink">{fmt(copy.reports, { n: reports.length })}</p>
                    <ul className="mt-1 space-y-2 text-sm">
                        {reports.map((r) => (
                            <li key={r.id} className="rounded-lg border border-edge p-2">
                                <p className="font-semibold text-ink">{reasons[r.reason]}</p>
                                <p className="text-ink [overflow-wrap:anywhere]">{r.note || copy.noNote}</p>
                                <p className="text-ink-muted">{fmt(copy.reportedOn, { date: formatDate(r.createdAt, lang) })}</p>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
                {event && (
                    <button
                        type="button"
                        aria-disabled={busy || undefined}
                        onClick={() => act(
                            async () => (await loadSeva()).setHidden(event.id, !event.hidden),
                            event.hidden ? copy.unhiddenDone : copy.hiddenDone,
                            { event: { ...event, hidden: !event.hidden } },
                        )}
                        className={SECONDARY_BUTTON}
                    >
                        {event.hidden ? copy.unhide : copy.hide}
                        <span className="sr-only">: {name}</span>
                    </button>
                )}
                {reports.length > 0 && (
                    <button
                        type="button"
                        aria-disabled={busy || undefined}
                        onClick={() => act(
                            async () => (await loadSeva()).dismissReports(reports.map((r) => r.id)),
                            copy.dismissedDone,
                            { reports: [] },
                            true,
                        )}
                        className={SECONDARY_BUTTON}
                    >
                        {copy.dismiss}
                        <span className="sr-only">: {name}</span>
                    </button>
                )}
            </div>
            <p role="status" className={note ? 'mt-2 text-sm font-semibold text-ink' : undefined}>{note}</p>
            {problem && <p role="alert" className={`mt-2 ${ERROR_TEXT}`}>{problem}</p>}
        </article>
    );
}
