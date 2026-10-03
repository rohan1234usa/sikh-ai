// The time zones the hosting form offers: the device's own first, then the
// chosen country's, then every zone the browser knows. Browser-only in use
// (Intl.supportedValuesOf), but nothing here touches the DOM.

import type { Lang } from '@/lib/i18n/config';
import { zoneName } from './time';

export function deviceTimeZone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

export function allTimeZones(): string[] {
    try {
        return Intl.supportedValuesOf('timeZone');
    } catch {
        return [];
    }
}

// The zones a country uses, where the engine can say (Intl.Locale's
// getTimeZones, or the older timeZones property); none where it can't.
export function countryTimeZones(country: string): string[] {
    if (!/^[A-Z]{2}$/.test(country)) return [];
    try {
        const locale = new Intl.Locale(`und-${country}`) as Intl.Locale & {
            getTimeZones?: () => string[] | undefined;
            timeZones?: string[];
        };
        return locale.getTimeZones?.() ?? locale.timeZones ?? [];
    } catch {
        return [];
    }
}

const labels = new Map<string, string>();

// "Pacific Time (Los Angeles)": the zone in words, and the place its name
// comes from, so two zones with the same words stay apart. The generic name
// doesn't change with the season, so each is worked out once: the form lists
// over 400.
export function zoneLabel(tz: string, lang: Lang): string {
    const key = `${lang}|${tz}`;
    let label = labels.get(key);
    if (label === undefined) {
        const place = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
        const name = zoneName(Date.now(), tz, lang);
        label = name === tz ? place : `${name} (${place})`;
        labels.set(key, label);
    }
    return label;
}
