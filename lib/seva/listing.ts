// The board: what's coming up, in the order people look for it, and the
// filters that narrow it to a country, a city and a kind of seva. The server
// groups and renders the cards; the browser only filters them (SevaBoard),
// using the facets each card carries.

import type { SevaCategory } from './config';
import { isCategory, isCountryCode } from './config';
import type { SevaEvent } from './model';
import { localDateKey } from './time';

// A city as typed by many hands ("Surrey", " surrey ", "SURREY") as one key.
export const cityKey = (city: string) => city.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

// Not over yet, soonest first.
export function upcoming(events: SevaEvent[], now: number): SevaEvent[] {
    return events
        .filter((e) => e.endsAt > now && e.status === 'open')
        .sort((a, b) => a.startsAt - b.startsAt || a.endsAt - b.endsAt || a.title.localeCompare(b.title));
}

export type DayGroup = { key: string; events: SevaEvent[] };

// Events under way first, then one group per day, by the venue's calendar:
// a 7 pm event in Surrey and a 7 pm event in Delhi are both on their own day.
export function groupByDay(events: SevaEvent[], now: number): { now: SevaEvent[]; days: DayGroup[] } {
    const byDay = new Map<string, SevaEvent[]>();
    for (const e of events.filter((e) => e.startsAt > now)) {
        const key = localDateKey(e.startsAt, e.timeZone);
        byDay.set(key, [...(byDay.get(key) ?? []), e]);
    }
    return {
        now: events.filter((e) => e.startsAt <= now && e.endsAt > now),
        days: [...byDay].map(([key, dayEvents]) => ({ key, events: dayEvents })).sort((a, b) => a.key.localeCompare(b.key)),
    };
}

// What each card carries for the filters.
export type Facets = { country: string; city: string; cityLabel: string; category: SevaCategory; endsAt: number };

export const facetsOf = (e: SevaEvent): Facets => ({
    country: e.country,
    city: cityKey(e.city),
    cityLabel: e.city.trim(),
    category: e.category,
    endsAt: e.endsAt,
});

export type Filters = { country: string; city: string; category: string };
export const NO_FILTERS: Filters = { country: '', city: '', category: '' };

export const matches = (f: Facets, filters: Filters) =>
    (!filters.country || f.country === filters.country)
    && (!filters.city || f.city === filters.city)
    && (!filters.category || f.category === filters.category);

export type Option = { value: string; label: string; count: number };

// The choices each filter offers, each with how many events it would show:
// countries from every event; cities from the chosen country's, or from all
// when none is chosen; categories from those left after country and city.
export function filterOptions(all: Facets[], filters: Filters): { countries: Option[]; cities: Option[]; categories: Option[] } {
    const tally = (items: Facets[], value: (f: Facets) => string, label: (f: Facets) => string) => {
        const m = new Map<string, Option>();
        for (const f of items) {
            const v = value(f);
            if (!v) continue;
            const o = m.get(v);
            if (o) o.count++;
            else m.set(v, { value: v, label: label(f), count: 1 });
        }
        return [...m.values()];
    };
    const inCountry = all.filter((f) => !filters.country || f.country === filters.country);
    const inCity = inCountry.filter((f) => !filters.city || f.city === filters.city);
    return {
        countries: tally(all, (f) => f.country, (f) => f.country),
        cities: tally(inCountry, (f) => f.city, (f) => f.cityLabel),
        categories: tally(inCity, (f) => f.category, (f) => f.category),
    };
}

// The filters a link carries (?country=CA&city=surrey&category=langar), or
// none for anything that isn't one.
export function parseFilters(search: string): Filters {
    const p = new URLSearchParams(search);
    const country = p.get('country')?.toUpperCase() ?? '';
    const category = p.get('category') ?? '';
    return {
        country: isCountryCode(country) ? country : '',
        city: cityKey(p.get('city') ?? '').slice(0, 80),
        category: isCategory(category) ? category : '',
    };
}

export function filtersToSearch(filters: Filters): string {
    const p = new URLSearchParams();
    if (filters.country) p.set('country', filters.country);
    if (filters.city) p.set('city', filters.city);
    if (filters.category) p.set('category', filters.category);
    const s = p.toString();
    return s ? `?${s}` : '';
}
