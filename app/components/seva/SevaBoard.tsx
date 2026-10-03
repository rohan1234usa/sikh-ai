'use client';

import { useRef, type ReactNode } from 'react';
import IntentLink from '@/app/components/IntentLink';
import { INPUT } from '@/app/components/form/Field';
import { useAnnouncer } from '@/app/components/useAnnouncer';
import { fmt } from '@/lib/i18n/fmt';
import type { Lang } from '@/lib/i18n/config';
import type { SevaCopy } from '@/lib/i18n/seva';
import type { SevaCategory } from '@/lib/seva/config';
import { SEVA_CATEGORIES } from '@/lib/seva/limits';
import { NO_FILTERS, filterOptions, filtersToSearch, matches, parseFilters, type Facets, type Filters } from '@/lib/seva/listing';
import { replaceSearch, saveCountry, useMinute, useSavedCountry, useSearch } from './hooks';

export type BoardItem = { id: string; facets: Facets; card: ReactNode };
export type BoardGroup = { key: string; heading: string; dateTime?: string; items: BoardItem[] };

// The board's filters, over cards the server has already written: each card
// carries what it's filtered by, so the browser only shows or hides them.
// The filters live in the address, so a filtered list can be shared, and
// Back from an event comes back to it; with none there, the country chosen
// last time. Until the page is interactive, every card shows.
export default function SevaBoard({ lang, groups, totalTemplate, timesLocal, copy, countryNames, categoryNames, createHref }: {
    lang: Lang;
    groups: BoardGroup[];
    // "Upcoming events: {n}"
    totalTemplate: string;
    timesLocal: string;
    copy: SevaCopy['filters'];
    countryNames: Record<string, string>;
    categoryNames: Record<SevaCategory, string>;
    createHref: string;
}) {
    const search = useSearch();
    const saved = useSavedCountry();
    // A cached page can be a few minutes old: events that have ended since
    // drop out once the browser knows the time.
    const now = useMinute();
    const { announce, announcer } = useAnnouncer();
    const countryRef = useRef<HTMLSelectElement>(null);
    const announceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

    const all = groups.flatMap((g) => g.items.map((i) => i.facets));
    const live = (f: Facets) => now === null || f.endsAt > now;
    const fromUrl = parseFilters(search);
    const filters: Filters = fromUrl.country || fromUrl.city || fromUrl.category
        ? fromUrl
        : { ...NO_FILTERS, country: all.some((f) => f.country === saved) ? saved : '' };

    const isShown = (f: Facets) => live(f) && matches(f, filters);
    const liveFacets = all.filter(live);
    const shown = all.filter(isShown).length;
    const active = !!(filters.country || filters.city || filters.category);

    const options = filterOptions(liveFacets, filters);
    const collator = new Intl.Collator(lang === 'pa' ? 'pa' : 'en');
    const countries = [...options.countries].sort((a, b) => collator.compare(countryNames[a.value] ?? a.value, countryNames[b.value] ?? b.value));
    const cities = [...options.cities].sort((a, b) => collator.compare(a.label, b.label));
    const categories = SEVA_CATEGORIES.flatMap((id) => options.categories.find((o) => o.value === id) ?? []);

    // The address and the memory follow the filters; the count is announced
    // once the choosing settles.
    const choose = (next: Partial<Filters>) => {
        const chosen = { ...filters, ...next };
        replaceSearch(filtersToSearch(chosen));
        saveCountry(chosen.country);
        const count = all.filter((f) => live(f) && matches(f, chosen)).length;
        clearTimeout(announceTimer.current);
        announceTimer.current = setTimeout(() => announce(fmt(copy.shown, { n: count, total: liveFacets.length })), 400);
    };

    const clear = () => {
        choose(NO_FILTERS);
        countryRef.current?.focus();
    };

    const place = filters.city
        ? cities.find((c) => c.value === filters.city)?.label ?? ''
        : filters.country ? countryNames[filters.country] ?? '' : '';
    // The form starts in the place the board was narrowed to.
    const hostParams = new URLSearchParams({ ...(filters.country && { country: filters.country }), ...(filters.city && place && { city: place }) });
    const hostQuery = hostParams.toString();
    const hostHere = hostQuery ? `${createHref}?${hostQuery}` : createHref;

    return (
        <div className="space-y-6">
            <div role="search" aria-label={copy.aria} className="rounded-xl border border-edge bg-surface-raised p-4 shadow-sm">
                <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                        <label htmlFor="filter-country" className="block text-sm font-semibold text-ink">{copy.country}</label>
                        <select
                            id="filter-country"
                            ref={countryRef}
                            value={filters.country}
                            onChange={(e) => choose({ country: e.target.value, city: '' })}
                            className={`mt-1 ${INPUT}`}
                        >
                            <option value="">{copy.allCountries}</option>
                            {countries.map((o) => (
                                <option key={o.value} value={o.value}>{fmt(copy.optionCount, { name: countryNames[o.value] ?? o.value, n: o.count })}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="filter-city" className="block text-sm font-semibold text-ink">{copy.city}</label>
                        <select id="filter-city" value={filters.city} onChange={(e) => choose({ city: e.target.value })} className={`mt-1 ${INPUT}`}>
                            <option value="">{copy.allCities}</option>
                            {cities.map((o) => (
                                <option key={o.value} value={o.value}>{fmt(copy.optionCount, { name: o.label, n: o.count })}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="filter-category" className="block text-sm font-semibold text-ink">{copy.category}</label>
                        <select id="filter-category" value={filters.category} onChange={(e) => choose({ category: e.target.value })} className={`mt-1 ${INPUT}`}>
                            <option value="">{copy.allCategories}</option>
                            {categories.map((o) => (
                                <option key={o.value} value={o.value}>{fmt(copy.optionCount, { name: categoryNames[o.value as SevaCategory], n: o.count })}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-ink-muted">
                    <p>
                        {active ? fmt(copy.shown, { n: shown, total: liveFacets.length }) : fmt(totalTemplate, { n: liveFacets.length })}
                        {' · '}
                        {timesLocal}
                    </p>
                    {active && (
                        <button type="button" onClick={clear} className="min-h-6 font-semibold text-accent-text underline">
                            {copy.clear}
                        </button>
                    )}
                </div>
            </div>
            {announcer}

            {shown === 0 ? (
                <div className="rounded-xl border border-dashed border-edge-strong p-6 text-center">
                    <p className="font-semibold text-ink">{copy.noMatches}</p>
                    <p className="mt-1 text-ink-muted">{copy.noMatchesHint}</p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
                        {active && (
                            <button type="button" onClick={clear} className="font-semibold text-accent-text underline">{copy.clear}</button>
                        )}
                        {place && (
                            <IntentLink href={hostHere} className="font-semibold text-accent-text underline">{fmt(copy.hostHere, { place })}</IntentLink>
                        )}
                    </div>
                </div>
            ) : (
                groups.map((group) => {
                    const items = group.items.filter((i) => isShown(i.facets));
                    if (items.length === 0) return null;
                    const headingId = `day-${group.key}`;
                    return (
                        <section key={group.key} aria-labelledby={headingId}>
                            <h2 id={headingId} className="text-lg font-bold text-ink">
                                {group.dateTime ? <time dateTime={group.dateTime}>{group.heading}</time> : group.heading}
                            </h2>
                            <ul className="mt-3 space-y-3">
                                {items.map((item) => <li key={item.id}>{item.card}</li>)}
                            </ul>
                        </section>
                    );
                })
            )}
        </div>
    );
}
