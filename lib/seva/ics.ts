// An event as an iCalendar file (RFC 5545), for Apple Calendar, Outlook and
// the rest: what "Add to calendar" downloads (app/api/seva/ics). Times are
// UTC, which every calendar shows in its owner's zone; the event's own UID
// and SEQUENCE let a calendar that added it once take a later copy as an
// update, a cancelled one included.

import type { SevaEvent } from './model';
import { utcStamp } from './links';

// Text escaped as the format asks: backslash, semicolon, comma and newline.
export const escapeText = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const encoder = new TextEncoder();

// A content line folded at 75 octets, as the format requires, never inside a
// character: Gurmukhi takes three octets each, and a split one is garbage.
export function foldLine(line: string): string {
    const parts: string[] = [];
    let current = '';
    let octets = 0;
    let limit = 75;
    for (const ch of line) {
        const size = encoder.encode(ch).length;
        if (octets + size > limit) {
            parts.push(current);
            current = '';
            octets = 0;
            limit = 74; // a continuation line starts with a space
        }
        current += ch;
        octets += size;
    }
    parts.push(current);
    return parts.join('\r\n ');
}

export function buildIcs(e: SevaEvent, { url, description, location }: { url: string; description: string; location: string }): string {
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SikhAI//Seva Events//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:seva-${e.id}@sikhai.vercel.app`,
        `DTSTAMP:${utcStamp(e.updatedAt)}`,
        // Grows with every change the host makes, so a newer copy wins.
        `SEQUENCE:${Math.max(0, Math.floor((e.updatedAt - e.createdAt) / 1000))}`,
        `DTSTART:${utcStamp(e.startsAt)}`,
        `DTEND:${utcStamp(e.endsAt)}`,
        `SUMMARY:${escapeText(e.title)}`,
        `DESCRIPTION:${escapeText(description)}`,
        `LOCATION:${escapeText(location)}`,
        `URL:${url}`,
        `STATUS:${e.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
        'END:VEVENT',
        'END:VCALENDAR',
    ];
    return lines.map(foldLine).join('\r\n') + '\r\n';
}
