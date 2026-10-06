'use client';

import { useEffect, useRef, useState } from 'react';
import IntentLink from '@/app/components/IntentLink';
import { ERROR_TEXT } from '@/app/components/form/Field';
import { useAnnouncer } from '@/app/components/useAnnouncer';
import { useAuth } from '@/app/context/AuthContext';
import type { Lang } from '@/lib/i18n/config';
import { fmt } from '@/lib/i18n/fmt';
import type { SevaCopy } from '@/lib/i18n/seva';
import { isFull } from '@/lib/seva/event';
import type { Hosting, SevaEvent, Signup } from '@/lib/seva/model';
import { formatDate } from '@/lib/seva/time';
import { setMyEvents, useMinute } from './hooks';
import { loadSeva } from './sevaClient';
import { CHIP, PANEL } from './styles';

const SHOWN = 5;

type Mine = {
    joined: { signup: Signup; event: SevaEvent | null }[];
    hosting: { hosting: Hosting; event: SevaEvent | null }[];
    admin: boolean;
};

// "Your seva", on the board for someone signed in: what they've joined and
// what they host, still to come, from their own private notes. The board
// itself is the same for everyone; this is theirs.
export default function YourSevaPanel({ lang, copy, labels, eventBase, adminHref }: {
    lang: Lang;
    copy: SevaCopy['mine'];
    labels: Pick<SevaCopy['common'], 'cancelled' | 'hidden' | 'full' | 'retry'>;
    eventBase: string;
    adminHref: string;
}) {
    const { user } = useAuth();
    const now = useMinute();
    const [mine, setMine] = useState<{ uid: string; data: Mine | 'failed' } | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [showAll, setShowAll] = useState({ joined: false, hosting: false });
    const [problem, setProblem] = useState('');
    const { announce, announcer } = useAnnouncer();
    const titleRef = useRef<HTMLHeadingElement>(null);
    const joinedRef = useRef<HTMLHeadingElement>(null);
    const refocus = useRef(false);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        loadSeva()
            .then((seva) => Promise.all([seva.mine(user.uid), seva.isAdmin(user.uid)]))
            .then(([lists, admin]) => { if (!cancelled) setMine({ uid: user.uid, data: { ...lists, admin } }); })
            .catch(() => { if (!cancelled) setMine({ uid: user.uid, data: 'failed' }); });
        return () => { cancelled = true; };
    }, [user, attempt]);

    // After a line leaves the list, its heading takes the focus; or, with the
    // list now empty, the panel's.
    useEffect(() => {
        if (!refocus.current) return;
        refocus.current = false;
        (joinedRef.current ?? titleRef.current)?.focus();
    });

    // The board marks the events in these lists (SevaBoard) for as long as
    // they're shown here: the marks go with them on sign-out, for another
    // account, or when the board is left.
    const listsShown = user && mine?.uid === user.uid && mine.data !== 'failed' ? mine.data : null;
    useEffect(() => {
        if (!listsShown) return;
        setMyEvents({
            hosting: new Set(listsShown.hosting.map((h) => h.hosting.eventId)),
            joined: new Set(listsShown.joined.map((j) => j.signup.eventId)),
        });
        return () => setMyEvents(null);
    }, [listsShown]);

    if (!user) return null;
    const data = mine?.uid === user.uid ? mine.data : null;

    // The sign-up for an event that's gone, cleared.
    const forget = async (signup: Signup) => {
        setProblem('');
        try {
            await (await loadSeva()).leave(user.uid, signup.eventId, signup.volunteerId);
            setMine((m) => (m && m.data !== 'failed'
                ? { ...m, data: { ...m.data, joined: m.data.joined.filter((j) => j.signup.eventId !== signup.eventId) } }
                : m));
            refocus.current = true;
            announce(copy.forgotten);
        } catch {
            setProblem(copy.forgetFailed);
        }
    };

    const upcoming = (e: SevaEvent | null) => !e || now === null || e.endsAt > now;
    const line = (e: SevaEvent) => fmt(copy.whenWhere, { when: formatDate(e.startsAt, e.timeZone, lang), city: e.city });
    const badges = (e: SevaEvent) => (
        <>
            {e.status === 'cancelled' && <span className={CHIP}>{labels.cancelled}</span>}
            {e.hidden && <span className={CHIP}>{labels.hidden}</span>}
            {isFull(e) && e.status === 'open' && <span className={CHIP}>{labels.full}</span>}
        </>
    );

    let body: React.ReactNode;
    if (data === null) {
        body = (
            <>
                <p role="status" className="sr-only">{copy.loading}</p>
                <div aria-hidden="true" className="mt-3 h-16 animate-pulse rounded-lg bg-edge/60" />
            </>
        );
    } else if (data === 'failed') {
        body = (
            <p className="mt-3 text-ink-muted">
                {copy.failed}{' '}
                <button type="button" onClick={() => { setMine(null); setAttempt((n) => n + 1); }} className="font-semibold text-accent-text underline">
                    {labels.retry}
                </button>
            </p>
        );
    } else {
        const joinedAll = data.joined.filter((j) => upcoming(j.event)).sort((a, b) => (a.event?.startsAt ?? 0) - (b.event?.startsAt ?? 0));
        const hostingAll = data.hosting.filter((h) => h.event && upcoming(h.event)).sort((a, b) => (a.event?.startsAt ?? 0) - (b.event?.startsAt ?? 0));
        // The soonest few of each, and the rest on request.
        const joined = showAll.joined ? joinedAll : joinedAll.slice(0, SHOWN);
        const hosting = showAll.hosting ? hostingAll : hostingAll.slice(0, SHOWN);
        const more = (list: 'joined' | 'hosting', total: number) => !showAll[list] && total > SHOWN && (
            <button type="button" onClick={() => setShowAll((s) => ({ ...s, [list]: true }))} className="mt-2 min-h-6 text-sm font-semibold text-accent-text underline">
                {copy.showAll}
            </button>
        );
        body = (
            <>
                {joinedAll.length === 0 && hostingAll.length === 0 ? (
                    <p className="mt-3 text-ink-muted">{copy.empty}</p>
                ) : (
                    <div className="mt-3 grid gap-6 md:grid-cols-2">
                        <div>
                            <h3 ref={joinedRef} tabIndex={-1} className="font-semibold text-ink">{copy.joined}</h3>
                            {problem && <p role="alert" className={`mt-1 ${ERROR_TEXT}`}>{problem}</p>}
                            {joined.length === 0 ? <p className="mt-1 text-sm text-ink-muted">{copy.noneJoined}</p> : (
                                <ul className="mt-2 space-y-3">
                                    {joined.map(({ signup, event }) => (
                                        <li key={signup.eventId} className="text-sm">
                                            {event ? (
                                                <>
                                                    <IntentLink href={`${eventBase}${event.id}`} className="font-semibold text-accent-text underline [overflow-wrap:anywhere]">{event.title}</IntentLink>
                                                    <p className="text-ink-muted">{line(event)}</p>
                                                    <p className="mt-1 flex flex-wrap gap-2">
                                                        {badges(event)}
                                                        {event.updatedAt > signup.joinedAt && <span className={CHIP}>{copy.changed}</span>}
                                                    </p>
                                                </>
                                            ) : (
                                                <p className="text-ink-muted">
                                                    {copy.removed}{' '}
                                                    <button type="button" onClick={() => forget(signup)} className="font-semibold text-accent-text underline">{copy.forget}</button>
                                                </p>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {more('joined', joinedAll.length)}
                        </div>
                        <div>
                            <h3 className="font-semibold text-ink">{copy.hosting}</h3>
                            {hosting.length === 0 ? <p className="mt-1 text-sm text-ink-muted">{copy.noneHosting}</p> : (
                                <ul className="mt-2 space-y-3">
                                    {hosting.map(({ event }) => event && (
                                        <li key={event.id} className="text-sm">
                                            <IntentLink href={`${eventBase}${event.id}`} className="font-semibold text-accent-text underline [overflow-wrap:anywhere]">{event.title}</IntentLink>
                                            <p className="text-ink-muted">{line(event)}</p>
                                            <p className="mt-1 flex flex-wrap gap-2">{badges(event)}</p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {more('hosting', hostingAll.length)}
                        </div>
                    </div>
                )}
                {data.admin && (
                    <p className="mt-4 text-sm">
                        <IntentLink href={adminHref} className="font-semibold text-accent-text underline">{copy.reviewReports}</IntentLink>
                    </p>
                )}
            </>
        );
    }

    return (
        <section aria-labelledby="your-seva" className={PANEL}>
            <h2 ref={titleRef} id="your-seva" tabIndex={-1} className="text-lg font-bold text-ink">{copy.title}</h2>
            {body}
            {announcer}
        </section>
    );
}
