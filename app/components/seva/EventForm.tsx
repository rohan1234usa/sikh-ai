'use client';

import { useEffect, useRef, useState } from 'react';
import ExternalLink from '@/app/components/ExternalLink';
import IntentLink from '@/app/components/IntentLink';
import { BUTTON_LG, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/app/components/buttons';
import { CharCount } from '@/app/components/form/CharCount';
import { ErrorSummary, type FormError } from '@/app/components/form/ErrorSummary';
import { ERROR_TEXT, Field, INPUT, describedBy } from '@/app/components/form/Field';
import { Fieldset } from '@/app/components/form/Fieldset';
import { useAnnouncer } from '@/app/components/useAnnouncer';
import { useAuth } from '@/app/context/AuthContext';
import type { Lang } from '@/lib/i18n/config';
import { fmt } from '@/lib/i18n/fmt';
import type { SevaCopy } from '@/lib/i18n/seva';
import { SIGNUP_MODES, isCategory, isCountryCode, isEventId, type SevaCategory } from '@/lib/seva/config';
import { countryName } from '@/lib/seva/countries';
import { EMPTY_DRAFT, clearDraft, draftFromEvent, postAgainDraft, readDraft, writeDraft } from '@/lib/seva/draft';
import { errorKind } from '@/lib/seva/errors';
import { SEVA_CATEGORIES, SEVA_MAX_DAYS_LONG, SEVA_SPOTS, SEVA_TEXT } from '@/lib/seva/limits';
import { mapsUrl, placeLine } from '@/lib/seva/links';
import type { SevaEvent } from '@/lib/seva/model';
import { eventPatch } from '@/lib/seva/plans';
import { formatDate, formatTime, utcToZoned, zoneName, zonedTimeToUtc, type WhenWords } from '@/lib/seva/time';
import { allTimeZones, countryTimeZones, deviceTimeZone, zoneLabel } from '@/lib/seva/timezones';
import { textLength, validateEventDraft, type DraftError, type DraftErrors, type EventDraft } from '@/lib/seva/validate';
import { setFlash, useMinute, useMounted } from './hooks';
import { loadSeva, refreshPages } from './sevaClient';

export type EventFormProps = {
    mode: 'create' | 'edit';
    eventId?: string;
    lang: Lang;
    copy: SevaCopy['form'];
    categories: Record<SevaCategory, string>;
    optional: string;
    newTab: string;
    whenWords: WhenWords;
    countries: { code: string; name: string }[];
    commonCountries: readonly string[];
    // Localized: the board, an event's address up to its id, the form for a
    // new event, the privacy page.
    hrefs: { board: string; eventBase: string; create: string; privacy: string };
};

type Source =
    | { kind: 'none' }
    | { kind: 'loading' }
    | { kind: 'ready'; event: SevaEvent }
    | { kind: 'missing' | 'notHost' | 'failed' };

// Hosting an event, new or edited. Built in the browser only: it starts from
// what this tab kept, or from an event (to edit it, or post it again), and
// posting needs a sign-in, which it asks for at the end, so the form can be
// filled in first.
export default function EventForm(props: EventFormProps) {
    const mounted = useMounted();
    if (!mounted) return <p role="status" className="mt-6 text-ink-muted">{props.copy.loading}</p>;
    return <FormLoader {...props} />;
}

function FormLoader(props: EventFormProps) {
    const { mode, eventId, copy } = props;
    const { user, loading, signIn, signInIntent } = useAuth();
    const fromId = mode === 'create' ? new URLSearchParams(window.location.search).get('from') : null;
    const needs = mode === 'edit' || isEventId(fromId);
    const [source, setSource] = useState<Source>(needs ? { kind: 'loading' } : { kind: 'none' });

    useEffect(() => {
        let cancelled = false;
        const settle = (next: Source) => { if (!cancelled) setSource(next); };
        if (mode === 'edit' && eventId) {
            if (!user) return;
            loadSeva()
                .then((seva) => seva.viewerOf(user.uid, eventId))
                .then((is) => settle(!is.event ? { kind: 'missing' } : is.isHost ? { kind: 'ready', event: is.event } : { kind: 'notHost' }))
                .catch(() => settle({ kind: 'failed' }));
        } else if (fromId && isEventId(fromId)) {
            loadSeva()
                .then((seva) => seva.getEvent(fromId, { allowHidden: true }))
                .then((event) => settle(event ? { kind: 'ready', event } : { kind: 'none' }))
                .catch(() => settle({ kind: 'none' }));
        }
        return () => { cancelled = true; };
    }, [mode, eventId, fromId, user]);

    // A returning member's session is still on its way (lib/firebase/hint.ts):
    // wait for it, so the form knows who's hosting.
    if (!user && (loading || document.documentElement.dataset.auth === '1')) {
        return <p role="status" className="mt-6 text-ink-muted">{copy.loading}</p>;
    }
    if (mode === 'edit' && !user) {
        return (
            <div className="mt-6 rounded-xl border border-edge bg-surface-raised p-5">
                <p className="text-ink">{copy.notHost}</p>
                <button type="button" onClick={() => void signIn()} {...signInIntent} className={`mt-3 ${PRIMARY_BUTTON}`}>{copy.signIn}</button>
            </div>
        );
    }
    if (source.kind === 'loading') return <p role="status" className="mt-6 text-ink-muted">{copy.loading}</p>;
    if (source.kind === 'missing' || source.kind === 'notHost' || source.kind === 'failed') {
        const message = source.kind === 'missing' ? copy.notFound : source.kind === 'notHost' ? copy.notHost : copy.loadFailed;
        return <p role="alert" className={`mt-6 ${ERROR_TEXT}`}>{message}</p>;
    }
    const route = mode === 'edit' ? `edit:${eventId}` : fromId && source.kind === 'ready' ? `from:${fromId}` : 'create';
    return <FormBody key={route} {...props} route={route} source={source.kind === 'ready' ? source.event : null} />;
}

type Start = { draft: EventDraft; origin: 'restored' | 'copied' | 'fresh' };

// The time, for handlers and the form's first state; render reads it
// through useMinute().
const clock = () => Date.now();

function startingDraft(mode: EventFormProps['mode'], route: string, source: SevaEvent | null, name: string): Start {
    const kept = readDraft(route);
    if (kept) return { draft: kept, origin: 'restored' };
    if (source && mode === 'edit') return { draft: draftFromEvent(source), origin: 'fresh' };
    if (source) return { draft: postAgainDraft(source, clock()), origin: 'copied' };
    return { draft: freshDraft(name), origin: 'fresh' };
}

function freshDraft(name: string): EventDraft {
    // "Host one in {place}" on the board passes its country, and its city.
    const params = new URLSearchParams(window.location.search);
    const country = params.get('country')?.toUpperCase() ?? '';
    const city = (params.get('city') ?? '').trim().slice(0, SEVA_TEXT.city[1]);
    return { ...EMPTY_DRAFT, timeZone: deviceTimeZone(), country: isCountryCode(country) ? country : '', city, organizer: name };
}

// The order fields appear in, for the error summary.
const FIELD_ORDER: (keyof EventDraft)[] = [
    'title', 'category', 'description', 'date', 'startTime', 'endTime', 'endDate', 'timeZone',
    'venue', 'address', 'city', 'region', 'country', 'signup', 'spots', 'organizer', 'contact',
];

const fieldId = (key: keyof EventDraft) => `seva-${key}`;

// One of a few choices, as a pill in a row that wraps: a real radio, its dot
// kept for forced colours and the site's focus ring. Checked, it isn't bold,
// which would change its width and reflow the row.
const PILL =
    'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-3xl border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink hover:border-accent-text/60 has-[:checked]:border-kesri-deep has-[:checked]:bg-kesri/10 dark:has-[:checked]:border-kesri';

function FormBody({ mode, eventId, lang, copy, categories, optional, newTab, whenWords, countries, commonCountries, hrefs, route, source }: EventFormProps & { route: string; source: SevaEvent | null }) {
    const { user, signIn, signInIntent } = useAuth();
    const [start] = useState(() => startingDraft(mode, route, source, user?.displayName ?? ''));
    const [draft, setDraft] = useState(start.draft);
    const [notice, setNotice] = useState(start.origin);
    const [errors, setErrors] = useState<DraftErrors>({});
    const [attempted, setAttempted] = useState(false);
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState('');
    const [summaryFocus, setSummaryFocus] = useState(0);
    const zoneTouched = useRef(start.origin !== 'fresh' || mode === 'edit');
    const dirty = useRef(false);
    const summaryRef = useRef<HTMLDivElement>(null);
    const { announce, announcer } = useAnnouncer();
    // The form only renders in the browser, where this is never null.
    const now = useMinute() ?? 0;

    // How many had joined when the form opened, or, after a save refused
    // because more have since, as many as there are now.
    const [joinedNow, setJoinedNow] = useState<number | null>(null);
    const editing = mode === 'edit' && source ? { startsAt: source.startsAt, endsAt: source.endsAt, volunteerCount: joinedNow ?? source.volunteerCount } : undefined;

    // The tab keeps the work in progress, once there is some.
    useEffect(() => {
        if (dirty.current) writeDraft(route, draft);
    }, [route, draft]);

    useEffect(() => {
        if (summaryFocus) summaryRef.current?.focus();
    }, [summaryFocus]);

    const set = (patch: Partial<EventDraft>) => {
        dirty.current = true;
        const next = { ...draft, ...patch };
        setDraft(next);
        // Once a submit has shown what's wrong, each fix clears as it's made.
        if (attempted) {
            const r = validateEventDraft(next, { now: clock(), editing });
            setErrors(r.ok ? {} : r.errors);
        }
    };

    const chooseCountry = (country: string) => {
        const zones = countryTimeZones(country);
        if (!zoneTouched.current && zones.length === 1 && zones[0] !== draft.timeZone) {
            set({ country, timeZone: zones[0] });
            announce(fmt(copy.timeZoneMatched, { zone: zoneName(clock(), zones[0], lang) }));
        } else {
            set({ country });
        }
    };

    const reset = () => {
        clearDraft(route);
        dirty.current = false;
        setDraft(mode === 'edit' && source ? draftFromEvent(source) : freshDraft(user?.displayName ?? ''));
        setNotice('fresh');
        setErrors({});
        setAttempted(false);
        zoneTouched.current = mode === 'edit';
    };

    const message = (key: keyof EventDraft, error: DraftError): string => {
        const e = copy.errors;
        const limits = (SEVA_TEXT as Record<string, readonly [number, number]>)[key];
        switch (error) {
            case 'tooShort': return fmt(e.tooShort, { min: limits?.[0] ?? 1 });
            case 'tooLong': return fmt(e.tooLong, { max: limits?.[1] ?? 0 });
            case 'startPast': return e.startPast;
            case 'ended': return e.ended;
            case 'endBeforeStart': return key === 'endDate' ? e.endDateBefore : e.endBeforeStart;
            case 'tooLongEvent': return fmt(e.tooLongEvent, { max: SEVA_MAX_DAYS_LONG });
            case 'tooFarAhead': return e.dateTooFar;
            case 'belowJoined': return fmt(e.spotsBelowJoined, { n: editing?.volunteerCount ?? 0 });
            case 'hasVolunteers': return fmt(e.signupJoined, { n: editing?.volunteerCount ?? 0 });
            case 'invalid':
                if (key === 'date' || key === 'endDate') return e.dateInvalid;
                if (key === 'spots') return fmt(e.spotsInvalid, { max: SEVA_SPOTS[1] });
                if (key === 'timeZone') return e.timeZoneRequired;
                return key === 'startTime' ? e.startRequired : e.endRequired;
            case 'required':
            default: {
                const required: Partial<Record<keyof EventDraft, string>> = {
                    title: e.titleRequired, category: e.categoryRequired, date: e.dateRequired, startTime: e.startRequired,
                    endTime: e.endRequired, endDate: e.endDateRequired, timeZone: e.timeZoneRequired, venue: e.venueRequired,
                    city: e.cityRequired, country: e.countryRequired, signup: e.signupRequired, spots: e.spotsRequired,
                    organizer: e.organizerRequired,
                };
                return required[key] ?? e.required;
            }
        }
    };

    const errorOf = (key: keyof EventDraft) => (errors[key] ? message(key, errors[key]) : undefined);

    // A save refused because people joined since the form opened, when the
    // change (no sign-up, or a lower limit) no longer fits: checked again
    // against the event as it is, so the form can say what's wrong.
    const recheck = async (id: string): Promise<boolean> => {
        if (!source) return false;
        try {
            const fresh = await (await loadSeva()).getEvent(id, { allowHidden: true });
            if (!fresh || fresh.volunteerCount === (joinedNow ?? source.volunteerCount)) return false;
            setJoinedNow(fresh.volunteerCount);
            const r = validateEventDraft(draft, { now: clock(), editing: { startsAt: source.startsAt, endsAt: source.endsAt, volunteerCount: fresh.volunteerCount } });
            if (r.ok) return false;
            setErrors(r.errors);
            setSummaryFocus((n) => n + 1);
            return true;
        } catch {
            return false;
        }
    };
    const summary: FormError[] = FIELD_ORDER.flatMap((key) => (errors[key] ? [{ fieldId: fieldId(key), message: message(key, errors[key]) }] : []));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;
        const result = validateEventDraft(draft, { now: clock(), editing });
        setAttempted(true);
        if (!result.ok) {
            setErrors(result.errors);
            setSummaryFocus((n) => n + 1);
            return;
        }
        setErrors({});
        setProblem('');
        // Signed in only now, so the form could be filled in first; nothing is
        // awaited before signIn(), or Safari would block its popup.
        const account = user ?? await signIn();
        if (!account) {
            setProblem(copy.signInFailed);
            return;
        }
        setBusy(true);
        try {
            const seva = await loadSeva();
            let id: string;
            if (mode === 'edit' && eventId && source) {
                id = eventId;
                const patch = eventPatch(source, result.fields);
                // Saved with nothing changed: back to the event, with no
                // "changes saved" to tell volunteers about.
                if (Object.keys(patch).length > 0) {
                    await seva.update(id, patch);
                    setFlash(id, 'saved');
                }
            } else {
                id = await seva.create(account.uid, result.fields);
                setFlash(id, 'posted');
            }
            clearDraft(route);
            await refreshPages(id);
            // A full load, so the page shows what was just saved rather than
            // the router's cached copy of it.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign(`${hrefs.eventBase}${id}`);
        } catch (error) {
            setBusy(false);
            if (mode === 'edit' && eventId && errorKind(error) === 'denied' && await recheck(eventId)) return;
            setProblem(mode === 'edit' ? copy.saveFailed : copy.failed);
        }
    };

    // ─── Fields ─────────────────────────────────────────────────────────────

    const textField = (key: 'title' | 'venue' | 'address' | 'city' | 'region' | 'organizer' | 'contact', label: string, opts: { hint?: string; optional?: boolean; autoComplete?: string; inputMode?: 'tel' | 'email' } = {}) => (
        <Field id={fieldId(key)} label={label} hint={opts.hint} optional={opts.optional ? optional : undefined} error={errorOf(key)}>
            {(c) => (
                <input
                    id={c.id}
                    type="text"
                    // Address autofill is off: a venue is rarely the host's
                    // home, and one tap could publish it.
                    autoComplete={opts.autoComplete ?? 'off'}
                    inputMode={opts.inputMode}
                    required={!opts.optional}
                    maxLength={SEVA_TEXT[key][1]}
                    value={draft[key]}
                    onChange={(e) => set({ [key]: e.target.value })}
                    aria-describedby={c.describedBy}
                    aria-invalid={c.invalid || undefined}
                    className={INPUT}
                />
            )}
        </Field>
    );

    const today = utcToZoned(now, draft.timeZone || deviceTimeZone()).date;
    const resolvedStart = draft.date && draft.startTime && draft.timeZone ? zonedTimeToUtc(draft.date, draft.startTime, draft.timeZone) : null;
    const startLine = resolvedStart
        ? fmt(copy.startsAt, {
            when: fmt(whenWords.withZone, {
                when: fmt(whenWords.sameDay, { date: formatDate(resolvedStart.ms, draft.timeZone, lang), times: formatTime(resolvedStart.ms, draft.timeZone, lang) }),
                zone: zoneName(resolvedStart.ms, draft.timeZone, lang),
            }),
        })
        : '';
    const place = placeLine({ venue: draft.venue, address: draft.address, city: draft.city, region: draft.region }, draft.country ? countryName(draft.country, lang) : '');

    const suggestedZones = [...new Set([deviceTimeZone(), ...countryTimeZones(draft.country), ...(draft.timeZone ? [draft.timeZone] : [])])].filter(Boolean);
    const otherZones = allTimeZones().filter((z) => !suggestedZones.includes(z));
    const common = commonCountries.flatMap((code) => countries.find((c) => c.code === code) ?? []);

    return (
        <form onSubmit={submit} noValidate className="mt-6 space-y-8">
            {notice === 'restored' && (
                <p role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-edge-strong p-3 text-ink">
                    {copy.draftRestored}
                    <button type="button" onClick={reset} className="font-semibold text-accent-text underline">{copy.clearForm}</button>
                </p>
            )}
            {notice === 'copied' && source && (
                <p role="status" className="rounded-lg border border-edge-strong p-3 text-ink [overflow-wrap:anywhere]">{fmt(copy.copiedFrom, { title: source.title })}</p>
            )}
            {mode === 'edit' && source && source.endsAt <= now && eventId && (
                <p className="rounded-lg border border-edge-strong p-3">
                    <IntentLink href={`${hrefs.create}?from=${eventId}`} className="font-semibold text-accent-text underline">{copy.endedOffer}</IntentLink>
                </p>
            )}
            {!user && mode === 'create' && (
                <p className="rounded-lg border border-edge-strong p-3 text-ink">
                    {copy.signInNotice}{' '}
                    <button type="button" onClick={() => void signIn()} {...signInIntent} className="font-semibold text-accent-text underline">{copy.signIn}</button>
                </p>
            )}

            <ErrorSummary ref={summaryRef} title={copy.errorSummary} errors={summary} />

            <Fieldset id="seva-about" legend={copy.about}>
                {textField('title', copy.title, { hint: copy.titleHint })}
                {/* Pills, like who may sign up: each category's word is read
                    with it, and the chosen one's is shown below. */}
                <Fieldset id={fieldId('category')} legend={copy.category} size="question" error={errorOf('category')}>
                    <div className="flex flex-wrap gap-2">
                        {SEVA_CATEGORIES.map((id) => (
                            <label key={id} className={PILL}>
                                <input
                                    type="radio"
                                    name="category"
                                    value={id}
                                    checked={draft.category === id}
                                    onChange={() => set({ category: id })}
                                    aria-describedby={`category-hint-${id}`}
                                    className="h-4 w-4 shrink-0"
                                />
                                {categories[id]}
                                <span id={`category-hint-${id}`} hidden>{copy.categoryHints[id]}</span>
                            </label>
                        ))}
                    </div>
                    <p aria-hidden="true" className="mt-2 min-h-5 text-sm text-ink-muted">{isCategory(draft.category) ? copy.categoryHints[draft.category] : ''}</p>
                </Fieldset>
                <Field id={fieldId('description')} label={copy.description} optional={optional} hint={copy.descriptionHint} error={errorOf('description')}>
                    {(c) => (
                        <>
                            <textarea
                                id={c.id}
                                rows={5}
                                maxLength={SEVA_TEXT.description[1]}
                                value={draft.description}
                                onChange={(e) => set({ description: e.target.value })}
                                aria-describedby={describedBy(c.describedBy, 'seva-description-count')}
                                aria-invalid={c.invalid || undefined}
                                className={INPUT}
                            />
                            <CharCount id="seva-description-count" length={textLength(draft.description)} max={SEVA_TEXT.description[1]} count={copy.charCount} limit={copy.charLimit} />
                        </>
                    )}
                </Field>
            </Fieldset>

            <Fieldset id="seva-when" legend={copy.when}>
                <div className="grid gap-4 sm:grid-cols-3">
                    <Field id={fieldId('date')} label={copy.date} error={errorOf('date')}>
                        {(c) => (
                            <input id={c.id} type="date" required min={mode === 'create' ? today : undefined} value={draft.date} onChange={(e) => set({ date: e.target.value })} aria-describedby={c.describedBy} aria-invalid={c.invalid || undefined} className={INPUT} />
                        )}
                    </Field>
                    <Field id={fieldId('startTime')} label={copy.start} error={errorOf('startTime')}>
                        {(c) => (
                            <input id={c.id} type="time" required value={draft.startTime} onChange={(e) => set({ startTime: e.target.value })} aria-describedby={c.describedBy} aria-invalid={c.invalid || undefined} className={INPUT} />
                        )}
                    </Field>
                    <Field id={fieldId('endTime')} label={copy.end} error={errorOf('endTime')}>
                        {(c) => (
                            <input id={c.id} type="time" required value={draft.endTime} onChange={(e) => set({ endTime: e.target.value })} aria-describedby={c.describedBy} aria-invalid={c.invalid || undefined} className={INPUT} />
                        )}
                    </Field>
                </div>
                <label className="flex min-h-11 items-center gap-3 text-ink">
                    <input type="checkbox" className="h-5 w-5" checked={draft.multiDay} onChange={(e) => set({ multiDay: e.target.checked, endDate: e.target.checked ? draft.endDate || draft.date : '' })} />
                    {copy.multiDay}
                </label>
                {draft.multiDay && (
                    <Field id={fieldId('endDate')} label={copy.endDate} error={errorOf('endDate')} className="sm:max-w-xs">
                        {(c) => (
                            <input id={c.id} type="date" required min={draft.date || undefined} value={draft.endDate} onChange={(e) => set({ endDate: e.target.value })} aria-describedby={c.describedBy} aria-invalid={c.invalid || undefined} className={INPUT} />
                        )}
                    </Field>
                )}
                <Field id={fieldId('timeZone')} label={copy.timeZone} hint={copy.timeZoneHint} error={errorOf('timeZone')}>
                    {(c) => (
                        <select
                            id={c.id}
                            required
                            value={draft.timeZone}
                            onChange={(e) => {
                                zoneTouched.current = true;
                                set({ timeZone: e.target.value });
                            }}
                            aria-describedby={c.describedBy}
                            aria-invalid={c.invalid || undefined}
                            className={INPUT}
                        >
                            <optgroup label={copy.suggestedZones}>
                                {suggestedZones.map((z) => <option key={z} value={z}>{zoneLabel(z, lang)}</option>)}
                            </optgroup>
                            <optgroup label={copy.allZones}>
                                {otherZones.map((z) => <option key={z} value={z}>{zoneLabel(z, lang)}</option>)}
                            </optgroup>
                        </select>
                    )}
                </Field>
                {startLine && <p className="text-sm text-ink-muted">{startLine}</p>}
            </Fieldset>

            <Fieldset id="seva-where" legend={copy.where}>
                {textField('venue', copy.venue, { hint: copy.venueHint })}
                {textField('address', copy.street, { hint: copy.streetHint, optional: true })}
                <div className="grid gap-4 sm:grid-cols-2">
                    {textField('city', copy.city)}
                    {textField('region', copy.region, { optional: true })}
                </div>
                <Field id={fieldId('country')} label={copy.country} error={errorOf('country')}>
                    {(c) => (
                        <select id={c.id} required value={draft.country} onChange={(e) => chooseCountry(e.target.value)} aria-describedby={c.describedBy} aria-invalid={c.invalid || undefined} className={INPUT}>
                            <option value="">{copy.chooseCountry}</option>
                            <optgroup label={copy.commonCountries}>
                                {common.map((c2) => <option key={c2.code} value={c2.code}>{c2.name}</option>)}
                            </optgroup>
                            <optgroup label={copy.allCountries}>
                                {countries.map((c2) => <option key={c2.code} value={c2.code}>{c2.name}</option>)}
                            </optgroup>
                        </select>
                    )}
                </Field>
                {(draft.venue || draft.address) && draft.city && (
                    <ExternalLink href={mapsUrl(place)} newTab={newTab} className="inline-flex items-center gap-1 font-semibold text-accent-text underline">
                        {copy.checkMap}
                    </ExternalLink>
                )}
            </Fieldset>

            {/* Who may sign up. Each choice's word is read with it (a hidden
                span, so it isn't part of its name); the chosen one's is shown
                below. A limit asks for the number, next in the tab order. */}
            <Fieldset id={fieldId('signup')} legend={copy.signup} error={errorOf('signup')}>
                <div>
                    <div className="flex flex-wrap gap-2">
                        {SIGNUP_MODES.map((m) => (
                            <label key={m} className={PILL}>
                                <input
                                    type="radio"
                                    name="signup"
                                    value={m}
                                    checked={draft.signup === m}
                                    onChange={() => set({ signup: m })}
                                    aria-describedby={`signup-hint-${m}`}
                                    className="h-4 w-4 shrink-0"
                                />
                                {copy.signupOptions[m]}
                                <span id={`signup-hint-${m}`} hidden>{copy.signupHints[m]}</span>
                            </label>
                        ))}
                    </div>
                    <p aria-hidden="true" className="mt-2 text-sm text-ink-muted">{copy.signupHints[draft.signup]}</p>
                </div>
                {draft.signup === 'limited' && (
                    <Field
                        id={fieldId('spots')}
                        label={copy.spots}
                        hint={editing && editing.volunteerCount > 0 ? `${fmt(copy.spotsHint, { max: SEVA_SPOTS[1] })} ${fmt(copy.spotsJoined, { n: editing.volunteerCount })}` : fmt(copy.spotsHint, { max: SEVA_SPOTS[1] })}
                        error={errorOf('spots')}
                        className="sm:max-w-xs"
                    >
                        {(c) => (
                            <input id={c.id} type="text" inputMode="numeric" required value={draft.spots} onChange={(e) => set({ spots: e.target.value })} aria-describedby={c.describedBy} aria-invalid={c.invalid || undefined} className={INPUT} />
                        )}
                    </Field>
                )}
            </Fieldset>

            <Fieldset id="seva-host" legend={copy.host}>
                {textField('organizer', copy.organizer, { hint: copy.organizerHint, autoComplete: 'name' })}
                {textField('contact', copy.contact, { hint: copy.contactHint, optional: true })}
            </Fieldset>

            <p className="text-sm text-ink-muted">
                {copy.publicNotice}{draft.signup !== 'none' && ` ${copy.joinNotice}`}{' '}
                <IntentLink href={hrefs.privacy} className="underline">{copy.privacyLink}</IntentLink>
            </p>

            {problem && <p role="alert" className={ERROR_TEXT}>{problem}</p>}
            <div className="flex flex-wrap gap-3">
                <button type="submit" aria-disabled={busy || undefined} {...(user ? {} : signInIntent)} className={`${PRIMARY_BUTTON} ${BUTTON_LG}`}>
                    {busy ? (mode === 'edit' ? copy.saving : copy.posting) : mode === 'edit' ? copy.save : user ? copy.submit : copy.submitSignIn}
                </button>
                <IntentLink href={mode === 'edit' && eventId ? `${hrefs.eventBase}${eventId}` : hrefs.board} className={`${SECONDARY_BUTTON} ${BUTTON_LG}`}>
                    {copy.cancel}
                </IntentLink>
            </div>
            {announcer}
        </form>
    );
}
