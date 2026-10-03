// Addresses that take an event elsewhere: directions, a calendar, a chat. All
// are plain links (nothing is fetched or embedded), so they work without
// JavaScript and need nothing from the site's Content-Security-Policy.

import type { SevaEvent } from './model';

// The place in words, for a map search and a calendar: "Gurdwara Sahib, 300
// Gurdwara Rd, Fremont, CA, United States".
export function placeLine(e: Pick<SevaEvent, 'venue' | 'address' | 'city' | 'region'>, countryName: string): string {
    return [e.venue, e.address, e.city, e.region, countryName].map((s) => s.trim()).filter(Boolean).join(', ');
}

// Google Maps' search for the place: the app on a phone, the site elsewhere.
export const mapsUrl = (place: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;

// 20261011T010000Z: an instant as Google Calendar and iCalendar write UTC.
export const utcStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// What a calendar entry says: the description, then who hosts it and where
// the event's page is. A link carries only the start of a long description,
// `max` characters (Google Calendar's address must stay short: 2,000
// Gurmukhi characters would be 18 KB once encoded); an .ics file, all of it.
export const CALENDAR_LINK_CHARS = 500;

export function calendarText(description: string, footer: string, max = Infinity): string {
    const chars = Array.from(description);
    const body = chars.length > max ? `${chars.slice(0, max - 1).join('').trimEnd()}…` : description;
    return body ? `${body}\n\n${footer}` : footer;
}

// A new Google Calendar event, filled in. The times are UTC, shown in the
// venue's zone (ctz) to whoever adds it.
export function googleCalendarUrl(e: Pick<SevaEvent, 'title' | 'startsAt' | 'endsAt' | 'timeZone'>, details: string, place: string): string {
    const p = new URLSearchParams({
        action: 'TEMPLATE',
        text: e.title,
        dates: `${utcStamp(e.startsAt)}/${utcStamp(e.endsAt)}`,
        details,
        location: place,
        ctz: e.timeZone,
    });
    return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

// A WhatsApp message, ready to send to a chosen chat.
export const whatsappUrl = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s().-]{6,}$/;

// A phone number as a link to call it.
export const telUrl = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

// A contact as typed, as a link when it's wholly an email or a phone number.
export function contactHref(contact: string): string | null {
    const c = contact.trim();
    if (EMAIL_RE.test(c)) return `mailto:${c}`;
    if (PHONE_RE.test(c) && c.replace(/\D/g, '').length >= 6) return telUrl(c);
    return null;
}
