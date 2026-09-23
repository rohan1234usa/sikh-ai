// Client-safe: the shape of a Gurbani citation check, shared by the verify
// route, the chat page, and the message store in localStorage.
//
// Principle: everything a citation shows as the source — line, translation,
// Ang, writer, raag — comes verbatim from GurbaniNow. The model's reply is
// never edited; the check only sits beside it.

export const MAX_VERIFY_CHARS = 8000;
export const MAX_CITATIONS = 6;
export const SGGS_SOURCE_ID = 1;
export const MAX_ANG = 1430;

export const CITATION_STATUSES = ['verified', 'wrong-ang', 'close', 'unverified'] as const;
export type CitationStatus = (typeof CITATION_STATUSES)[number];

export type CitationLine = {
    gurmukhi: string;
    translation: string;
    ang: number | null;
    lineNo: number | null;
    shabadId: string;
    writer: string;
    writerGurmukhi: string;
    raag: string;
    raagGurmukhi: string;
    source: { id: number; name: string; nameGurmukhi: string };
};

export type Citation = {
    quote: string;          // as it appeared in the reply
    status: CitationStatus;
    exact?: boolean;        // verified, and spelled exactly as the source
    citedAng?: number;      // the Ang the reply gave, when it gave one
    line?: CitationLine;    // the source line; absent only for 'unverified'
};

// Worth asking the verifier at all: three Gurmukhi words in a row somewhere.
// The separators match what the extractor treats as a word break (RUN in
// ./extract), commas and zero-width joiners included — a gate that turned away
// text the extractor would quote would skip the check with nothing to show.
const GURMUKHI_RUN = /(?:[਀-੿]+[\s।॥,;​-‍﻿]+){2}[਀-੿]/;

export function hasGurmukhiRun(text: string): boolean {
    return GURMUKHI_RUN.test(text);
}

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const int = (v: unknown): number | null =>
    typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null;

function toLine(v: unknown): CitationLine | undefined {
    if (!v || typeof v !== 'object') return undefined;
    const o = v as Record<string, unknown>;
    const gurmukhi = str(o.gurmukhi, 300);
    if (!gurmukhi) return undefined;
    const source = (o.source && typeof o.source === 'object' ? o.source : {}) as Record<string, unknown>;
    return {
        gurmukhi,
        translation: str(o.translation, 500),
        ang: int(o.ang),
        lineNo: int(o.lineNo),
        shabadId: str(o.shabadId, 20),
        writer: str(o.writer, 80),
        writerGurmukhi: str(o.writerGurmukhi, 80),
        raag: str(o.raag, 80),
        raagGurmukhi: str(o.raagGurmukhi, 80),
        source: {
            id: int(source.id) ?? 0,
            name: str(source.name, 80),
            nameGurmukhi: str(source.nameGurmukhi, 80),
        },
    };
}

// Citations arrive from the network and from localStorage, so both are
// treated as untrusted: malformed entries are dropped, strings are capped.
export function sanitizeCitations(raw: unknown): Citation[] {
    if (!Array.isArray(raw)) return [];
    const out: Citation[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const o = item as Record<string, unknown>;
        const status = o.status as CitationStatus;
        if (!CITATION_STATUSES.includes(status)) continue;
        const quote = str(o.quote, 300);
        const line = toLine(o.line);
        if (!quote || (status !== 'unverified' && !line)) continue;
        const citedAng = int(o.citedAng);
        out.push({
            quote,
            status,
            ...(typeof o.exact === 'boolean' ? { exact: o.exact } : {}),
            ...(citedAng && citedAng <= MAX_ANG ? { citedAng } : {}),
            ...(line ? { line } : {}),
        });
        if (out.length === MAX_CITATIONS) break;
    }
    return out;
}
