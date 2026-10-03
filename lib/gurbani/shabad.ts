// Client-safe: one whole shabad, as the shabad page shows it, and the pure
// helpers around it that the Ang page and Shabad Search share. Reading the
// upstream payload is ./gurbaninow's job (parseShabadPayload, server-only).

import type { Lang } from '../i18n/config';

export type LineKind = 'mangal' | 'header' | 'verse';

export type ShabadLine = {
    id: string;
    kind: LineKind;
    gurmukhi: string;
    transliteration: string; // '' when GurbaniNow gives none
    translation: string;     // '' for most headings
    ang: number | null;
    lineNo: number | null;   // the line's place on its Ang
};

export type Shabad = {
    id: string;
    source: { id: number; name: string; nameGurmukhi: string };
    writer: string;
    writerGurmukhi: string;
    raag: string;
    raagGurmukhi: string;
    ang: number | null;      // the Ang it starts on
    angEnd: number | null;   // the Ang it ends on
    previousId: string | null;
    nextId: string | null;
    lines: ShabadLine[];
};

// GurbaniNow's shabad and line ids are a few capital letters and digits
// ("823", "A6S", "DMP"); some are all digits, so a shabad can't share
// /shabad/{n} with the Angs. An address takes only that one spelling, so
// each shabad has one page and one cache entry.
const ID = /^[0-9A-Z]{1,6}$/;

export const isGurbaniId = (value: string): boolean => ID.test(value);

export function parseShabadIdParam(param: string): string | null {
    return isGurbaniId(param) ? param : null;
}

const MANGAL_TYPE = 1; // ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥ and its longer forms
const HEADER_TYPE = 2; // the raag and the Guru, "ਸਿਰੀਰਾਗੁ ਮਹਲਾ ੩ ॥"

export function lineKind(type: unknown): LineKind {
    if (type === MANGAL_TYPE) return 'mangal';
    if (type === HEADER_TYPE) return 'header';
    return 'verse';
}

// A shabad's lines carry their place on the page, not the page: the number
// starts again on each new Ang. So a line numbered lower than the one before
// it opens the next Ang. Two verses printed on one line share a number, which
// is why only a strictly lower number counts. A line with no number stays on
// the Ang of the line before it.
export function assignAngs(start: number | null, lineNos: (number | null)[]): (number | null)[] {
    if (start === null) return lineNos.map(() => null);
    let ang = start;
    let previous: number | null = null;
    return lineNos.map(n => {
        if (n !== null) {
            if (previous !== null && n < previous) ang++;
            previous = n;
        }
        return ang;
    });
}

// Consecutive lines on the same Ang, for the dividers on a shabad that runs
// across Angs.
export function shabadSections(lines: ShabadLine[]): { ang: number | null; lines: ShabadLine[] }[] {
    const sections: { ang: number | null; lines: ShabadLine[] }[] = [];
    for (const line of lines) {
        const last = sections.at(-1);
        if (last && last.ang === line.ang) last.lines.push(line);
        else sections.push({ ang: line.ang, lines: [line] });
    }
    return sections;
}

// An Ang's lines, one group per shabad, in page order. A shabad's lines sit
// together on a page, so consecutive lines are enough.
export function groupByShabad<T extends { shabadId: string }>(lines: T[]): { shabadId: string; lines: T[] }[] {
    const groups: { shabadId: string; lines: T[] }[] = [];
    for (const line of lines) {
        const last = groups.at(-1);
        if (last && last.shabadId === line.shabadId) last.lines.push(line);
        else groups.push({ shabadId: line.shabadId, lines: [line] });
    }
    return groups;
}

export const lineAnchor = (lineId: string): string => `line-${lineId}`;

// A shabad's address, without the language prefix (localePath adds it),
// optionally pointing at one of its lines.
export const shabadPath = (shabadId: string, lineId?: string): string =>
    `/shabad/s/${shabadId}${lineId ? `#${lineAnchor(lineId)}` : ''}`;

// A line shortened at a word, for titles and descriptions.
export function opening(text: string, max = 90): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const space = cut.lastIndexOf(' ');
    return `${space > (max * 4) / 9 ? cut.slice(0, space) : cut}…`;
}

// A writer's or raag's name: in Gurmukhi on the Gurmukhi site, in English
// letters elsewhere, and whichever there is when only one is given.
export function localName(lang: Lang, english: string, gurmukhi: string): string {
    return (lang === 'pa' && gurmukhi) || english || gurmukhi;
}
