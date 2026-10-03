import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, escapeText, foldLine } from '@/lib/seva/ics';
import { eventJsonLd, serializeJsonLd } from '@/lib/seva/jsonld';
import { CALENDAR_LINK_CHARS, calendarText, contactHref, googleCalendarUrl, mapsUrl, placeLine, utcStamp, whatsappUrl } from '@/lib/seva/links';
import { clip, indexable } from '@/lib/seva/meta';
import { event } from './helpers';

test('directions search the whole place, Gurmukhi included', () => {
    const place = placeLine(event({ venue: 'ਗੁਰਦੁਆਰਾ ਸਾਹਿਬ', region: '' }), 'United States');
    assert.equal(place, 'ਗੁਰਦੁਆਰਾ ਸਾਹਿਬ, 300 Gurdwara Rd, Fremont, United States');
    const url = new URL(mapsUrl(place));
    assert.equal(url.origin + url.pathname, 'https://www.google.com/maps/search/');
    assert.equal(url.searchParams.get('api'), '1');
    assert.equal(url.searchParams.get('query'), place);
});

test('Google Calendar gets UTC times shown in the venue zone', () => {
    const e = event();
    assert.equal(utcStamp(e.startsAt), '20261011T010000Z');
    const url = new URL(googleCalendarUrl(e, 'Hosted by Youth committee', 'Fremont'));
    assert.equal(url.searchParams.get('action'), 'TEMPLATE');
    assert.equal(url.searchParams.get('dates'), '20261011T010000Z/20261011T040000Z');
    assert.equal(url.searchParams.get('ctz'), 'America/Los_Angeles');
    assert.equal(url.searchParams.get('text'), e.title);
});

test("a calendar link carries the start of a long description, and the host's line in full", () => {
    assert.equal(calendarText('Bring gloves.', 'Hosted by Youth committee'), 'Bring gloves.\n\nHosted by Youth committee');
    assert.equal(calendarText('', 'Hosted by Youth committee'), 'Hosted by Youth committee');
    const long = 'ਸੇਵਾ '.repeat(400); // 2,000 characters, as long as a description gets
    assert.equal(calendarText(long, 'F'), `${long}\n\nF`, 'an .ics file keeps it all');
    const clipped = calendarText(long, 'F', CALENDAR_LINK_CHARS);
    assert.ok(Array.from(clipped.split('\n\n')[0]).length <= CALENDAR_LINK_CHARS, 'counted in characters, the ellipsis included');
    assert.match(clipped, /ਸੇਵਾ…\n\nF$/u);
    assert.ok(googleCalendarUrl(event(), clipped, 'Fremont').length < 8000, 'the link stays short');
});

test('a WhatsApp message keeps its lines; a contact links when it is wholly an email or a phone', () => {
    assert.equal(whatsappUrl('Langar\nhttps://x.y/z'), 'https://wa.me/?text=Langar%0Ahttps%3A%2F%2Fx.y%2Fz');
    assert.equal(contactHref(' seva@example.org '), 'mailto:seva@example.org');
    assert.equal(contactHref('+1 (510) 555-0100'), 'tel:+15105550100');
    assert.equal(contactHref('Ask for Jaspreet at the door'), null);
    assert.equal(contactHref('123'), null);
});

test('an .ics file is RFC 5545: CRLF, escaped, folded at 75 octets without splitting a character', () => {
    assert.equal(escapeText('a\\b;c,d\ne'), 'a\\\\b\\;c\\,d\\ne');
    const long = 'SUMMARY:' + 'ਸੇਵਾ '.repeat(30);
    const folded = foldLine(long);
    for (const line of folded.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
    assert.equal(folded.split('\r\n').map((l, i) => (i ? l.slice(1) : l)).join(''), long, 'unfolds to the same text');
    assert.ok(!folded.includes('�'));

    const ics = buildIcs(event({ status: 'cancelled', updatedAt: event().createdAt + 90_000 }), {
        url: 'https://sikhai.vercel.app/seva/x', description: 'Hosted by Youth committee', location: 'Fremont, CA',
    });
    assert.ok(ics.endsWith('\r\n'));
    assert.ok(!/[^\r]\n/.test(ics), 'every line ends in CRLF');
    for (const line of ['BEGIN:VCALENDAR', 'DTSTART:20261011T010000Z', 'DTEND:20261011T040000Z', 'STATUS:CANCELLED', 'SEQUENCE:90', 'LOCATION:Fremont\\, CA']) {
        assert.ok(ics.includes(`\r\n${line}\r\n`) || ics.startsWith(`${line}\r\n`), line);
    }
    assert.match(ics, /UID:seva-Ev3ntIdAbCdEfGhIj12x@sikhai\.vercel\.app/);
});

test('schema.org gets the event with its venue offset and status, safe inside a script tag', () => {
    const ld = eventJsonLd(event({ status: 'cancelled', title: '</script><script>alert(1)' }), {
        url: 'https://sikhai.vercel.app/seva/x', image: 'https://sikhai.vercel.app/og.jpg', description: 'd', inLanguage: 'en',
    });
    assert.equal(ld.startDate, '2026-10-10T18:00:00-07:00');
    assert.equal(ld.eventStatus, 'https://schema.org/EventCancelled');
    assert.equal(ld.location.address.addressCountry, 'US');
    assert.ok(!serializeJsonLd(ld).includes('</script>'));
});

test('a description is cut at a word, and a page is indexed until its event ends', () => {
    assert.equal(clip('short'), 'short');
    const cut = clip('word '.repeat(60), 40);
    assert.ok(Array.from(cut).length <= 40);
    assert.ok(cut.endsWith('word…'));
    const e = event();
    assert.ok(indexable(e, e.endsAt - 1));
    assert.ok(!indexable(e, e.endsAt));
});
