// What search engines and link previews say about an event page, from parts
// the page has already put in words.

import type { SevaEvent } from './model';

// Text for a description: whitespace run together, cut at a word, at most
// `max` characters with the ellipsis.
export function clip(text: string, max = 160): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    const chars = Array.from(flat);
    if (chars.length <= max) return flat;
    const cut = chars.slice(0, max - 1).join('');
    const space = cut.lastIndexOf(' ');
    return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

// Whether an event's page belongs in search results: not once it's over.
// A cancelled one stays until then, marked cancelled, so people who saw it
// find out.
export const indexable = (e: SevaEvent, now: number) => e.endsAt > now;
